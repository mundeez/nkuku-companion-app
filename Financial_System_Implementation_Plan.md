# Nkuku Companion App — Financial System Implementation Plan

**Version:** 1.1 · **Date:** 2026-06-26  
**Scope:** Unified financials (Broiler Flocks + Batch/Cycle) · Enhanced single-entry with proper accrual statements  
**Platforms:** Fastify/Prisma API · Next.js 14 Web · Flutter 3.x Mobile

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Target Architecture](#2-target-architecture)
3. [New Dependencies](#3-new-dependencies)
4. [Milestone 1 — Schema & Unified Financial Engine](#4-milestone-1--schema--unified-financial-engine)
5. [Milestone 2 — Financial Statements API](#5-milestone-2--financial-statements-api)
6. [Milestone 3 — Report Export & Scheduled Delivery](#6-milestone-3--report-export--scheduled-delivery)
7. [Milestone 4 — Web Dashboard Enhancement](#7-milestone-4--web-dashboard-enhancement)
8. [Milestone 5 — Flutter Mobile Screens](#8-milestone-5--flutter-mobile-screens)
9. [Milestone 6 — Audit Trail, Tests & Hardening](#9-milestone-6--audit-trail-tests--hardening)
10. [Data Migration Strategy](#10-data-migration-strategy)
11. [Compliance Notes (GAAP/IFRS-aligned)](#11-compliance-notes-gaapifrs-aligned)
12. [Risk Register](#12-risk-register)
13. [Milestone Close-Out Protocol](#13-milestone-close-out-protocol)

---

## 1. Current State Analysis

### What Exists

| Component | Location | Status |
|-----------|----------|--------|
| `FinancialRecord` table | `financial_records` | Per-flock income/expense, 9 categories, auto-synced from feed/vaccination/mortality/water |
| `BatchExpense` table | `batch_expenses` | Per-batch projected/actual costs; **not linked to FinancialRecord** |
| `OverheadCost` table | `overhead_costs` | Per-batch overhead; **not linked to FinancialRecord** |
| `Projection` model | `projections` | Projected revenue/profit per batch |
| Calculation engine | `src/core/calculation-engine/index.ts` | Decimal.js-based batch cost projection (12 unit tests) |
| Web financial page | `broiler-flocks/[id]/financial/page.tsx` | Basic summary + manual projection calculator |
| `recharts` | `apps/web/package.json` | Already installed v2.10.4 |
| `fl_chart` | `apps/mobile/pubspec.yaml` | Already installed v0.69.0 |
| `decimal.js` | `apps/api/package.json` | Already installed v10.4.3 |

### Key Gaps

1. **No unified view** — broiler flock financials and batch financials live in separate tables with no cross-module aggregation
2. **No financial statements** — no Income Statement, Balance Sheet, or Cash Flow generation
3. **No audit trail** — financial records can be mutated with no immutable log
4. **No export** — no PDF, CSV, or Excel download
5. **No scheduling** — no automated email delivery of reports
6. **No period tracking** — no month/quarter/year closing; running totals only
7. **`BatchExpense`/`OverheadCost` are islands** — disconnected from the `FinancialRecord` system

---

## 2. Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        API (Fastify)                            │
│                                                                 │
│  ┌──────────────────────┐   ┌─────────────────────────────┐    │
│  │   Existing Modules   │   │   New Financial Engine      │    │
│  │  feed-records        │──▶│   UnifiedFinancialService   │    │
│  │  vaccination-events  │   │   FinancialStatementService │    │
│  │  mortality-events    │   │   ReportGenerationService   │    │
│  │  water-records       │   │   SchedulerService          │    │
│  │  batch-expenses      │──▶│   AuditService              │    │
│  │  overhead-costs      │   └─────────────────────────────┘    │
│  └──────────────────────┘             │                         │
│                                       │ new endpoints           │
│                         /api/v1/financial-engine/*              │
└───────────────────────────────────────┼─────────────────────────┘
                                        │
              ┌─────────────────────────┼──────────────────┐
              ▼                         ▼                   ▼
       Next.js Web               Flutter Mobile         Email (SMTP)
    /financials (new)        FinancialSummaryScreen    Nodemailer
    statements, charts       StatementScreen           node-cron
    report download          report download
```

### Core Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Bookkeeping model | Enhanced single-entry | Avoids full schema rebuild; adds accrual logic, period closing, and statements on top of existing records |
| Unification strategy | Materialise batch costs into `FinancialRecord` at period-close | Keeps operational records intact; bridges the two subsystems at reporting time |
| Statement currency | ZMW primary | Existing `ExchangeRate` table available for future multi-currency |
| Report generation | Server-side (API) | Consistent formatting; mobile can trigger download |
| Period granularity | Monthly (default), Quarterly, Annual | Matches IFRS interim reporting frequency |

---

## 3. New Dependencies

### API (`apps/api`)

```bash
# Install exact versions (published ≥7 days ago, vetted)
pnpm add pdfkit@0.15.0
pnpm add exceljs@4.4.0
pnpm add csv-stringify@6.4.6
pnpm add nodemailer@6.9.9
pnpm add node-cron@3.0.3
pnpm add @types/pdfkit@0.13.4 --save-dev
pnpm add @types/nodemailer@6.4.14 --save-dev
pnpm add @types/node-cron@3.0.11 --save-dev
```

### Web (`apps/web`) — no new dependencies

`recharts` is already installed and sufficient for all chart requirements.

### Mobile (`apps/mobile`) — no new dependencies

`fl_chart`, `dio`, and `path_provider` are already installed.
PDF/Excel reports are downloaded from the API as binary files using Dio.

---

## 4. Milestone 1 — Schema & Unified Financial Engine

**Estimated effort:** 2 weeks  
**Files created/modified:** ~8

### 4.1 Prisma Schema Additions

Add to `apps/api/prisma/schema.prisma`:

```prisma
// ── FINANCIAL PERIODS ────────────────────
// Tracks monthly/quarterly/annual accounting periods for statement generation.
model FinancialPeriod {
  id           String        @id @default(uuid()) @db.Uuid
  label        String        @db.VarChar(20)          // e.g. "2026-06"
  periodType   PeriodType    @map("period_type")
  startDate    DateTime      @map("start_date") @db.Date
  endDate      DateTime      @map("end_date") @db.Date
  isClosed     Boolean       @default(false) @map("is_closed")
  closedAt     DateTime?     @map("closed_at") @db.Timestamptz(6)
  createdAt    DateTime      @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt    DateTime      @updatedAt @map("updated_at") @db.Timestamptz(6)

  auditLogs    AuditLog[]

  @@unique([label, periodType])
  @@index([startDate, endDate])
  @@map("financial_periods")
}

enum PeriodType {
  monthly
  quarterly
  annual
}

// ── AUDIT LOG ────────────────────────────
// Append-only audit trail for all financial mutations.
// NEVER delete or update rows in this table.
model AuditLog {
  id            String   @id @default(uuid()) @db.Uuid
  userId        String?  @map("user_id") @db.Uuid        // who made the change
  entityType    String   @map("entity_type") @db.VarChar(50) // e.g. "FinancialRecord"
  entityId      String   @map("entity_id") @db.Uuid
  action        AuditAction
  previousState Json?    @map("previous_state")
  newState      Json?    @map("new_state")
  ipAddress     String?  @map("ip_address") @db.VarChar(45)
  periodId      String?  @map("period_id") @db.Uuid
  occurredAt    DateTime @default(now()) @map("occurred_at") @db.Timestamptz(6)

  period        FinancialPeriod? @relation(fields: [periodId], references: [id])

  @@index([entityType, entityId])
  @@index([userId, occurredAt])
  @@map("audit_logs")
}

enum AuditAction {
  create
  update
  delete
  period_close
  report_generate
}

// ── SCHEDULED REPORTS ────────────────────
model ScheduledReport {
  id           String         @id @default(uuid()) @db.Uuid
  name         String         @db.VarChar(100)
  reportType   ReportType     @map("report_type")
  frequency    ReportFrequency
  scope        ReportScope
  scopeId      String?        @map("scope_id") @db.Uuid  // flockId or null for global
  recipients   Json           // string[] of email addresses
  format       ExportFormat
  isActive     Boolean        @default(true) @map("is_active")
  lastRunAt    DateTime?      @map("last_run_at") @db.Timestamptz(6)
  nextRunAt    DateTime?      @map("next_run_at") @db.Timestamptz(6)
  createdBy    String?        @map("created_by") @db.Uuid
  createdAt    DateTime       @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt    DateTime       @updatedAt @map("updated_at") @db.Timestamptz(6)

  executions   ReportExecution[]

  @@map("scheduled_reports")
}

model ReportExecution {
  id              String          @id @default(uuid()) @db.Uuid
  scheduledReportId String        @map("scheduled_report_id") @db.Uuid
  status          ExecutionStatus
  fileUrl         String?         @map("file_url") @db.VarChar(500)
  errorMessage    String?         @map("error_message") @db.Text
  executedAt      DateTime        @default(now()) @map("executed_at") @db.Timestamptz(6)

  scheduledReport ScheduledReport @relation(fields: [scheduledReportId], references: [id], onDelete: Cascade)

  @@index([scheduledReportId, executedAt])
  @@map("report_executions")
}

enum ReportType {
  income_statement
  balance_sheet
  cash_flow
  cost_breakdown
  flock_profitability
  cycle_summary
}

enum ReportFrequency {
  weekly
  monthly
  quarterly
}

enum ReportScope {
  global
  flock
  cycle
}

enum ExportFormat {
  pdf
  csv
  excel
}

enum ExecutionStatus {
  success
  failed
  running
}
```

Also enhance the existing `FinancialRecord` model:

```prisma
// Add to FinancialRecord (new fields):
  batchExpenseId  String?  @map("batch_expense_id") @db.Uuid  // link to BatchExpense if materialised
  overheadCostId  String?  @map("overhead_cost_id") @db.Uuid  // link to OverheadCost if materialised
  periodLabel     String?  @map("period_label") @db.VarChar(20) // "2026-06" for fast period filtering
```

Apply with:
```bash
docker compose exec api npx prisma db push
```

### 4.2 Unified Financial Service

**File:** `apps/api/src/core/financial-engine/unified-financial.service.ts`

This is the core aggregation layer. It pulls from **all four** financial sources:

```typescript
import Decimal from 'decimal.js';
import { PrismaClient } from '@prisma/client';

export interface UnifiedSummary {
  // FinancialRecord totals (flocks — feed, vaccines, mortality, water, sales)
  flockCostZmw: string;
  flockRevenueZmw: string;
  // BatchExpense totals (materialised from batch subsystem)
  batchCostZmw: string;
  // OverheadCost totals
  overheadCostZmw: string;
  // Combined
  totalCostZmw: string;
  totalRevenueZmw: string;
  grossProfitZmw: string;
  netProfitZmw: string;
  // Category breakdown
  byCategory: CategoryLine[];
  // Period
  periodStart: Date;
  periodEnd: Date;
}

export interface CategoryLine {
  category: string;
  amountZmw: string;
  isIncome: boolean;
  pctOfTotal: string;
}

export class UnifiedFinancialService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Aggregate all financial data across flocks AND batches for a given
   * date range (defaults to all time).
   *
   * Strategy:
   *  1. Sum FinancialRecord rows (already captures flock operational costs)
   *  2. Sum BatchExpense rows not yet materialised (isProjected = false)
   *  3. Sum OverheadCost rows not yet materialised (isProjected = false)
   *  4. Combine with Decimal.js for precision
   */
  async aggregate(
    options: {
      flockIds?: string[];
      batchIds?: string[];
      cycleIds?: string[];
      startDate?: Date;
      endDate?: Date;
      userId?: string; // scoping — owner/manager sees all, viewer sees own flocks
    } = {},
  ): Promise<UnifiedSummary> {
    const { flockIds, batchIds, cycleIds, startDate, endDate, userId } = options;

    const dateFilter = {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: endDate }),
    };

    // ── 1. Flock-level FinancialRecords ──────────────────────
    const flockFilter: any = {};
    if (flockIds?.length) flockFilter.flockId = { in: flockIds };
    if (startDate || endDate) flockFilter.recordDate = dateFilter;
    if (userId) {
      flockFilter.flock = { createdBy: userId };
    }

    const [flockCosts, flockRevenue] = await Promise.all([
      this.prisma.financialRecord.aggregate({
        where: { ...flockFilter, isIncome: false },
        _sum: { amountZmw: true },
      }),
      this.prisma.financialRecord.aggregate({
        where: { ...flockFilter, isIncome: true },
        _sum: { amountZmw: true },
      }),
    ]);

    const categoryRows = await this.prisma.financialRecord.groupBy({
      by: ['category', 'isIncome'],
      where: flockFilter,
      _sum: { amountZmw: true },
    });

    // ── 2. BatchExpense (actual, not projected) ───────────────
    const batchFilter: any = { isProjected: false };
    if (batchIds?.length) batchFilter.batchId = { in: batchIds };
    if (cycleIds?.length) batchFilter.batch = { cycleId: { in: cycleIds } };
    if (startDate || endDate) batchFilter.recordedAt = dateFilter;

    const batchExpenseSum = await this.prisma.batchExpense.aggregate({
      where: batchFilter,
      _sum: { subtotalZmw: true },
    });

    const batchExpenseByCategory = await this.prisma.batchExpense.groupBy({
      by: ['expenseCategory'],
      where: batchFilter,
      _sum: { subtotalZmw: true },
    });

    // ── 3. OverheadCost (actual) ──────────────────────────────
    const overheadFilter: any = { isProjected: false };
    if (batchIds?.length) overheadFilter.batchId = { in: batchIds };
    if (cycleIds?.length) overheadFilter.batch = { cycleId: { in: cycleIds } };
    if (startDate || endDate) overheadFilter.recordedAt = dateFilter;

    const overheadSum = await this.prisma.overheadCost.aggregate({
      where: overheadFilter,
      _sum: { amountZmw: true },
    });

    // ── 4. Combine with Decimal precision ────────────────────
    const flockCostDec = new Decimal(flockCosts._sum.amountZmw?.toString() ?? '0');
    const flockRevDec = new Decimal(flockRevenue._sum.amountZmw?.toString() ?? '0');
    const batchCostDec = new Decimal(batchExpenseSum._sum.subtotalZmw?.toString() ?? '0');
    const overheadDec = new Decimal(overheadSum._sum.amountZmw?.toString() ?? '0');

    const totalCostDec = flockCostDec.plus(batchCostDec).plus(overheadDec);
    const totalRevDec = flockRevDec;
    const grossProfitDec = totalRevDec.minus(flockCostDec);
    const netProfitDec = totalRevDec.minus(totalCostDec);

    // ── 5. Category breakdown (merged) ───────────────────────
    const byCategory: CategoryLine[] = [];
    const totalForPct = totalCostDec.plus(totalRevDec);

    for (const row of categoryRows) {
      const amt = new Decimal(row._sum.amountZmw?.toString() ?? '0');
      byCategory.push({
        category: row.category,
        amountZmw: amt.toFixed(2),
        isIncome: row.isIncome,
        pctOfTotal: totalForPct.gt(0) ? amt.div(totalForPct).mul(100).toFixed(1) : '0.0',
      });
    }

    for (const row of batchExpenseByCategory) {
      const amt = new Decimal(row._sum.subtotalZmw?.toString() ?? '0');
      byCategory.push({
        category: `batch_${row.expenseCategory}`,
        amountZmw: amt.toFixed(2),
        isIncome: false,
        pctOfTotal: totalForPct.gt(0) ? amt.div(totalForPct).mul(100).toFixed(1) : '0.0',
      });
    }

    return {
      flockCostZmw: flockCostDec.toFixed(2),
      flockRevenueZmw: flockRevDec.toFixed(2),
      batchCostZmw: batchCostDec.toFixed(2),
      overheadCostZmw: overheadDec.toFixed(2),
      totalCostZmw: totalCostDec.toFixed(2),
      totalRevenueZmw: totalRevDec.toFixed(2),
      grossProfitZmw: grossProfitDec.toFixed(2),
      netProfitZmw: netProfitDec.toFixed(2),
      byCategory,
      periodStart: startDate ?? new Date(0),
      periodEnd: endDate ?? new Date(),
    };
  }
}
```

### 4.3 Audit Service

**File:** `apps/api/src/core/financial-engine/audit.service.ts`

```typescript
import { PrismaClient } from '@prisma/client';

export class AuditService {
  constructor(private readonly prisma: PrismaClient) {}

  async log(params: {
    userId?: string;
    entityType: string;
    entityId: string;
    action: 'create' | 'update' | 'delete' | 'period_close' | 'report_generate';
    previousState?: object;
    newState?: object;
    ipAddress?: string;
    periodId?: string;
  }) {
    return this.prisma.auditLog.create({ data: params });
  }
}
```

The `AuditService` must be called inside **every** POST/PATCH/DELETE handler in:
- `financial-records/routes.ts`
- `feed-records/routes.ts`
- `vaccination-events/routes.ts`
- `mortality-events/routes.ts`
- `water-records/routes.ts`
- `batches/routes.ts` (expense updates)
- `overhead/routes.ts`

Pass `request.ip` and `authUser.userId` for every call.

### 4.4 Unit Tests for Financial Engine

**File:** `apps/api/tests/unit/unified-financial.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnifiedFinancialService } from '../../src/core/financial-engine/unified-financial.service.js';

describe('UnifiedFinancialService', () => {
  let service: UnifiedFinancialService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      financialRecord: {
        aggregate: vi.fn(),
        groupBy: vi.fn(),
      },
      batchExpense: {
        aggregate: vi.fn(),
        groupBy: vi.fn(),
      },
      overheadCost: {
        aggregate: vi.fn(),
      },
    };
    service = new UnifiedFinancialService(mockPrisma as any);
  });

  it('combines flock and batch costs correctly', async () => {
    mockPrisma.financialRecord.aggregate
      .mockResolvedValueOnce({ _sum: { amountZmw: '5000.00' } }) // costs
      .mockResolvedValueOnce({ _sum: { amountZmw: '8000.00' } }); // revenue
    mockPrisma.financialRecord.groupBy.mockResolvedValue([]);
    mockPrisma.batchExpense.aggregate.mockResolvedValue({ _sum: { subtotalZmw: '2000.00' } });
    mockPrisma.batchExpense.groupBy.mockResolvedValue([]);
    mockPrisma.overheadCost.aggregate.mockResolvedValue({ _sum: { amountZmw: '500.00' } });

    const result = await service.aggregate();

    expect(result.flockCostZmw).toBe('5000.00');
    expect(result.batchCostZmw).toBe('2000.00');
    expect(result.overheadCostZmw).toBe('500.00');
    expect(result.totalCostZmw).toBe('7500.00');
    expect(result.totalRevenueZmw).toBe('8000.00');
    expect(result.netProfitZmw).toBe('500.00');
  });

  it('returns zeros when no data exists', async () => {
    mockPrisma.financialRecord.aggregate.mockResolvedValue({ _sum: { amountZmw: null } });
    mockPrisma.financialRecord.aggregate.mockResolvedValue({ _sum: { amountZmw: null } });
    mockPrisma.financialRecord.groupBy.mockResolvedValue([]);
    mockPrisma.batchExpense.aggregate.mockResolvedValue({ _sum: { subtotalZmw: null } });
    mockPrisma.batchExpense.groupBy.mockResolvedValue([]);
    mockPrisma.overheadCost.aggregate.mockResolvedValue({ _sum: { amountZmw: null } });

    const result = await service.aggregate();

    expect(result.totalCostZmw).toBe('0.00');
    expect(result.totalRevenueZmw).toBe('0.00');
    expect(result.netProfitZmw).toBe('0.00');
  });
});
```

### 4.5 Milestone 1 Checklist

- [ ] Add `FinancialPeriod`, `AuditLog`, `ScheduledReport`, `ReportExecution` models to Prisma schema
- [ ] Add `batchExpenseId`, `overheadCostId`, `periodLabel` to `FinancialRecord`
- [ ] Run `prisma db push` (preserves data)
- [ ] Implement `UnifiedFinancialService`
- [ ] Implement `AuditService`
- [ ] Wire `AuditService` into all existing financial mutation routes
- [ ] Write unit tests for `UnifiedFinancialService` (target: 8+ tests)
- [ ] All existing unit tests still pass

### 4.6 Milestone 1 Close-Out

> Follow the full procedure in [Section 13 — Milestone Close-Out Protocol](#13-milestone-close-out-protocol). Milestone-specific values are listed below.

| Parameter | Value |
|-----------|-------|
| **Version tag** | `v0.3.0-alpha` |
| **Commit title** | `feat(financial): Milestone 1 — Schema, Unified Engine & Audit Service` |
| **Next milestone** | Milestone 2 — Financial Statements API |

**Minimum passing test bar before tagging:**
- `pnpm run test:unit` — all original 12 engine tests green **plus** 8+ new `unified-financial` tests
- `pnpm run test:integration` — all pre-existing integration tests still green
- `docker compose ps` — all containers `Up` / `healthy`

**Release notes summary for `gh release create`:**
```
## What's in v0.3.0-alpha

### New: Unified Financial Engine
- `FinancialPeriod`, `AuditLog`, `ScheduledReport`, `ReportExecution` Prisma models
- Extended `FinancialRecord` with `batchExpenseId`, `overheadCostId`, `periodLabel`
- `UnifiedFinancialService`: aggregates across broiler flocks, batch expenses, and overhead costs in a single call
- `AuditService`: append-only audit trail wired into all financial mutation routes (feed, vaccination, mortality, water, batch expenses)
- 8+ new unit tests for financial engine

### Breaking Changes
None — schema additions only; existing API endpoints unaffected.

### Next: Milestone 2 — Financial Statements API
```

---

## 5. Milestone 2 — Financial Statements API

**Estimated effort:** 1.5 weeks  
**Files created:** `src/core/financial-engine/statements.service.ts`, `src/modules/financial-engine/routes.ts`

### 5.1 Statements Service

**File:** `apps/api/src/core/financial-engine/statements.service.ts`

The three core statements follow simplified IFRS/GAAP definitions adapted for a broiler farming context:

#### Income Statement (Profit & Loss)

```typescript
export interface IncomeStatement {
  periodStart: Date;
  periodEnd: Date;
  generatedAt: string;

  // Revenue
  birdSalesRevenue: string;     // FinancialRecord where category='sales', isIncome=true
  otherRevenue: string;         // FinancialRecord where category='other', isIncome=true
  totalRevenue: string;

  // Cost of Goods Sold (COGS)
  chickPurchaseCost: string;    // category='chick_purchase'
  feedCost: string;             // category='feed' (flock) + batch feed expenses
  vaccineCost: string;          // category='vaccines'
  medicationCost: string;       // category='medication'
  mortalityLoss: string;        // category='other', description contains 'mortality'
  totalCOGS: string;

  grossProfit: string;
  grossMarginPct: string;       // grossProfit / totalRevenue * 100

  // Operating Expenses
  laborCost: string;            // category='labor' + overhead labour
  utilitiesCost: string;        // category='utilities' + overhead electricity/water
  equipmentCost: string;        // category='equipment'
  transportCost: string;        // overhead transport_to_market
  otherOverhead: string;
  totalOperatingExpenses: string;

  operatingProfit: string;      // EBIT = grossProfit - totalOperatingExpenses
  operatingMarginPct: string;

  // Net Profit
  netProfit: string;
  netMarginPct: string;

  // Per-bird KPIs
  totalBirds: number;
  costPerBird: string;
  revenuePerBird: string;
  profitPerBird: string;
}
```

**Implementation note:** Map existing `FinancialCategory` enum + `BatchExpense.expenseCategory` + `OverheadCost.category` to COGS vs. Operating Expenses using the table below:

| Source field | Maps to |
|---|---|
| `FinancialCategory.chick_purchase` | COGS — Chick Purchase |
| `FinancialCategory.feed` | COGS — Feed |
| `FinancialCategory.vaccines` | COGS — Vaccines |
| `FinancialCategory.medication` | COGS — Medication |
| `FinancialCategory.labor` | OpEx — Labor |
| `FinancialCategory.utilities` | OpEx — Utilities |
| `FinancialCategory.equipment` | OpEx — Equipment |
| `FinancialCategory.sales` | Revenue |
| `BatchExpense.feed` | COGS — Feed (batch) |
| `BatchExpense.chick` | COGS — Chick Purchase (batch) |
| `BatchExpense.medication` | COGS — Medication (batch) |
| `BatchExpense.labor` | OpEx — Labor (batch) |
| `OverheadCategory.electricity` | OpEx — Utilities |
| `OverheadCategory.water` | OpEx — Utilities |
| `OverheadCategory.labour` | OpEx — Labor |
| `OverheadCategory.transport_to_market` | OpEx — Transport |
| `OverheadCategory.litter` | COGS — Other |

#### Balance Sheet (Simplified)

```typescript
export interface BalanceSheet {
  asOfDate: Date;
  generatedAt: string;

  // Assets
  cashAndEquivalents: string;   // totalRevenue received (proxy)
  liveInventoryAtCost: string;  // active flocks: sum of costs incurred to date
  totalAssets: string;

  // Liabilities
  accountsPayable: string;      // outstanding projected BatchExpenses not yet paid
  totalLiabilities: string;

  // Equity
  retainedEarnings: string;     // cumulative net profit across all closed flocks
  currentPeriodEarnings: string;
  totalEquity: string;

  totalLiabilitiesAndEquity: string; // must equal totalAssets
}
```

**Implementation note:** This is a simplified cash-basis balance sheet appropriate for a small agribusiness. Full GAAP balance sheets require proper asset registers and depreciation schedules (see Milestone 6 stretch goal).

#### Cash Flow Statement (Indirect Method)

```typescript
export interface CashFlowStatement {
  periodStart: Date;
  periodEnd: Date;
  generatedAt: string;

  // Operating Activities
  netProfit: string;
  // Adjustments (non-cash items)
  mortalityLossAdjustment: string;  // add back non-cash mortality losses
  // Changes in working capital
  changeInInventoryCost: string;    // increase in costs = negative cash flow
  netCashFromOperations: string;

  // Investing Activities
  equipmentPurchases: string;       // FinancialRecord category='equipment'
  netCashFromInvesting: string;

  // Financing Activities
  netCashFromFinancing: string;     // 0 for now (no loan/equity transactions)

  netChangeInCash: string;
  openingCash: string;              // always 0 — app doesn't track bank balances
  closingCash: string;
}
```

### 5.2 New API Module

**File:** `apps/api/src/modules/financial-engine/routes.ts`

```typescript
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';
import { UnifiedFinancialService } from '../../core/financial-engine/unified-financial.service.js';
import { FinancialStatementService } from '../../core/financial-engine/statements.service.js';

const DateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  flockIds: z.string().optional(),   // comma-separated UUIDs
  batchIds: z.string().optional(),
  cycleIds: z.string().optional(),
});

export async function buildFinancialEngineModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  const unifiedSvc = new UnifiedFinancialService(prisma);
  const statementSvc = new FinancialStatementService(prisma, unifiedSvc);

  // GET /api/v1/financial-engine/summary
  // Unified summary across all modules
  app.get('/summary', { preHandler: [authenticate] }, async (request) => {
    const { startDate, endDate, flockIds, batchIds, cycleIds } = DateRangeSchema.parse(request.query);
    const authUser = (request as any).authUser;
    return unifiedSvc.aggregate({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      flockIds: flockIds?.split(','),
      batchIds: batchIds?.split(','),
      cycleIds: cycleIds?.split(','),
      userId: authUser.role === 'owner' ? undefined : authUser.userId, // owner sees all
    });
  });

  // GET /api/v1/financial-engine/income-statement
  app.get('/income-statement', { preHandler: [authenticate] }, async (request) => {
    const params = DateRangeSchema.parse(request.query);
    const authUser = (request as any).authUser;
    return statementSvc.generateIncomeStatement({
      ...params,
      userId: authUser.role === 'owner' ? undefined : authUser.userId,
    });
  });

  // GET /api/v1/financial-engine/balance-sheet
  app.get('/balance-sheet', { preHandler: [authenticate] }, async (request) => {
    const { endDate } = DateRangeSchema.parse(request.query);
    const authUser = (request as any).authUser;
    return statementSvc.generateBalanceSheet({
      asOfDate: endDate ? new Date(endDate) : new Date(),
      userId: authUser.role === 'owner' ? undefined : authUser.userId,
    });
  });

  // GET /api/v1/financial-engine/cash-flow
  app.get('/cash-flow', { preHandler: [authenticate] }, async (request) => {
    const params = DateRangeSchema.parse(request.query);
    const authUser = (request as any).authUser;
    return statementSvc.generateCashFlow({
      ...params,
      userId: authUser.role === 'owner' ? undefined : authUser.userId,
    });
  });

  // GET /api/v1/financial-engine/audit-log
  // Owner/manager only
  app.get('/audit-log', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const { startDate, endDate } = DateRangeSchema.parse(request.query);
    const { page = '1', limit = '50' } = request.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    return prisma.auditLog.findMany({
      where: {
        ...(startDate && { occurredAt: { gte: new Date(startDate) } }),
        ...(endDate && { occurredAt: { lte: new Date(endDate) } }),
      },
      orderBy: { occurredAt: 'desc' },
      take: parseInt(limit),
      skip,
    });
  });

  // POST /api/v1/financial-engine/periods/close
  // Close the current accounting period (owner only)
  app.post('/periods/close', { preHandler: [authenticate, requireRole('owner')] }, async (request) => {
    const { periodLabel, periodType, startDate, endDate } = z.object({
      periodLabel: z.string().regex(/^\d{4}-(Q[1-4]|\d{2})$/),
      periodType: z.enum(['monthly', 'quarterly', 'annual']),
      startDate: z.string(),
      endDate: z.string(),
    }).parse(request.body);

    const period = await prisma.financialPeriod.create({
      data: {
        label: periodLabel,
        periodType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isClosed: true,
        closedAt: new Date(),
      },
    });

    // Backfill periodLabel on FinancialRecord rows in range
    await prisma.financialRecord.updateMany({
      where: {
        recordDate: { gte: new Date(startDate), lte: new Date(endDate) },
        periodLabel: null,
      },
      data: { periodLabel },
    });

    return period;
  });
}
```

Register in `main.ts`:
```typescript
import { buildFinancialEngineModule } from './modules/financial-engine/routes.js';
// ...
await app.register(buildFinancialEngineModule, { prefix: '/api/v1/financial-engine' });
```

### 5.3 Milestone 2 Checklist

- [ ] Implement `FinancialStatementService` with all three statement methods
- [ ] Create `financial-engine` module with 6 endpoints (summary, income-statement, balance-sheet, cash-flow, audit-log, periods/close)
- [ ] Register module in `main.ts`
- [ ] Integration test: verify income-statement totals match seeded data
- [ ] Integration test: verify balance-sheet assets = liabilities + equity
- [ ] Unit tests for statement calculation logic (8+ tests)

### 5.4 Milestone 2 Close-Out

> Follow the full procedure in [Section 13 — Milestone Close-Out Protocol](#13-milestone-close-out-protocol). Milestone-specific values are listed below.

| Parameter | Value |
|-----------|-------|
| **Version tag** | `v0.4.0-alpha` |
| **Commit title** | `feat(financial): Milestone 2 — Income Statement, Balance Sheet & Cash Flow API` |
| **Next milestone** | Milestone 3 — Report Export & Scheduled Delivery |

**Minimum passing test bar before tagging:**
- `pnpm run test:unit` — 28+ tests green (prev + 8+ new statement unit tests)
- `pnpm run test:integration` — income-statement, balance-sheet totals verified; 401 responses verified
- Balance sheet equation holds: `totalAssets === totalLiabilitiesAndEquity` across all test scenarios
- All 6 new `/api/v1/financial-engine` endpoints return HTTP 200 with correct JSON shape

**Release notes summary for `gh release create`:**
```
## What's in v0.4.0-alpha

### New: Financial Statements API
- `GET /api/v1/financial-engine/summary` — unified cost/revenue aggregation across flocks + batches
- `GET /api/v1/financial-engine/income-statement` — full P&L (COGS, gross profit, operating expenses, net profit)
- `GET /api/v1/financial-engine/balance-sheet` — assets, liabilities, equity snapshot
- `GET /api/v1/financial-engine/cash-flow` — indirect-method cash flow statement
- `GET /api/v1/financial-engine/audit-log` — paginated immutable audit trail (owner/manager)
- `POST /api/v1/financial-engine/periods/close` — period-close with automatic `periodLabel` backfill
- 8+ new unit tests for FinancialStatementService

### Breaking Changes
None.

### Next: Milestone 3 — Report Export & Scheduled Email Delivery
```

---

## 6. Milestone 3 — Report Export & Scheduled Delivery

**Estimated effort:** 1.5 weeks  
**Files created:** `src/core/financial-engine/report-generation.service.ts`, `src/core/financial-engine/scheduler.service.ts`, env config updates

### 6.1 Report Generation Service

**File:** `apps/api/src/core/financial-engine/report-generation.service.ts`

#### PDF (PDFKit)

```typescript
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

async function generateIncomePDF(statement: IncomeStatement): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    const stream = new PassThrough();

    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    doc.pipe(stream);

    // Header
    doc.fontSize(20).font('Helvetica-Bold')
       .text('NKUKU COMPANION — INCOME STATEMENT', { align: 'center' });
    doc.fontSize(11).font('Helvetica')
       .text(`Period: ${statement.periodStart.toDateString()} – ${statement.periodEnd.toDateString()}`, { align: 'center' });
    doc.text(`Generated: ${new Date(statement.generatedAt).toLocaleString()}`, { align: 'center' });
    doc.moveDown(1.5);

    // Helper to draw a row
    const row = (label: string, value: string, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
      doc.text(label, 50, doc.y, { width: 300, continued: true });
      doc.text(`ZMW ${value}`, { align: 'right' });
    };

    // Revenue section
    doc.font('Helvetica-Bold').fontSize(13).text('REVENUE');
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);
    row('Bird Sales Revenue', statement.birdSalesRevenue);
    row('Other Revenue', statement.otherRevenue);
    row('TOTAL REVENUE', statement.totalRevenue, true);
    doc.moveDown(1);

    // COGS section
    doc.font('Helvetica-Bold').fontSize(13).text('COST OF GOODS SOLD');
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);
    row('Chick Purchase', statement.chickPurchaseCost);
    row('Feed', statement.feedCost);
    row('Vaccines', statement.vaccineCost);
    row('Medication', statement.medicationCost);
    row('TOTAL COGS', statement.totalCOGS, true);
    doc.moveDown(0.5);
    row('GROSS PROFIT', statement.grossProfit, true);
    doc.font('Helvetica').text(`Gross Margin: ${statement.grossMarginPct}%`, { align: 'right' });
    doc.moveDown(1);

    // OpEx section
    doc.font('Helvetica-Bold').fontSize(13).text('OPERATING EXPENSES');
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);
    row('Labour', statement.laborCost);
    row('Utilities', statement.utilitiesCost);
    row('Equipment', statement.equipmentCost);
    row('Transport', statement.transportCost);
    row('Other Overhead', statement.otherOverhead);
    row('TOTAL OPERATING EXPENSES', statement.totalOperatingExpenses, true);
    doc.moveDown(0.5);
    row('NET PROFIT / (LOSS)', statement.netProfit, true);
    doc.font('Helvetica').text(`Net Margin: ${statement.netMarginPct}%`, { align: 'right' });

    doc.end();
  });
}
```

#### Excel (ExcelJS)

```typescript
import ExcelJS from 'exceljs';

async function generateIncomeExcel(statement: IncomeStatement): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Nkuku Companion';
  wb.created = new Date();

  const ws = wb.addWorksheet('Income Statement');

  // Style header
  ws.mergeCells('A1:C1');
  ws.getCell('A1').value = 'NKUKU COMPANION — INCOME STATEMENT';
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A1').alignment = { horizontal: 'center' };

  ws.getCell('A2').value = `Period: ${statement.periodStart.toDateString()} – ${statement.periodEnd.toDateString()}`;
  ws.getCell('A3').value = `Generated: ${statement.generatedAt}`;

  // Column headers
  ws.addRow([]);
  ws.addRow(['Category', 'Description', 'ZMW Amount']);
  ws.lastRow!.font = { bold: true };
  ws.lastRow!.fill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: 'FF1B5E20' },
  };
  ws.lastRow!.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.lastRow!.getCell(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.lastRow!.getCell(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  const addRow = (cat: string, desc: string, val: string, bold = false) => {
    const row = ws.addRow([cat, desc, parseFloat(val)]);
    if (bold) row.font = { bold: true };
    row.getCell(3).numFmt = '#,##0.00';
  };

  addRow('Revenue', 'Bird Sales', statement.birdSalesRevenue);
  addRow('Revenue', 'Other', statement.otherRevenue);
  addRow('', 'TOTAL REVENUE', statement.totalRevenue, true);
  // ... (COGS, OpEx rows)

  ws.columns.forEach((col) => { col.width = 30; });

  return wb.xlsx.writeBuffer() as Promise<Buffer>;
}
```

#### CSV (csv-stringify)

```typescript
import { stringify } from 'csv-stringify/sync';

function generateIncomeCSV(statement: IncomeStatement): string {
  const rows = [
    ['Category', 'Description', 'Amount ZMW'],
    ['Revenue', 'Bird Sales Revenue', statement.birdSalesRevenue],
    ['Revenue', 'Other Revenue', statement.otherRevenue],
    ['Revenue', 'TOTAL REVENUE', statement.totalRevenue],
    ['COGS', 'Chick Purchase', statement.chickPurchaseCost],
    ['COGS', 'Feed', statement.feedCost],
    ['COGS', 'Vaccines', statement.vaccineCost],
    ['COGS', 'Medication', statement.medicationCost],
    ['COGS', 'TOTAL COGS', statement.totalCOGS],
    ['', 'GROSS PROFIT', statement.grossProfit],
    ['', 'Gross Margin %', statement.grossMarginPct],
    ['OpEx', 'Labour', statement.laborCost],
    ['OpEx', 'Utilities', statement.utilitiesCost],
    ['OpEx', 'Equipment', statement.equipmentCost],
    ['OpEx', 'Transport', statement.transportCost],
    ['OpEx', 'TOTAL OPERATING EXPENSES', statement.totalOperatingExpenses],
    ['', 'NET PROFIT / (LOSS)', statement.netProfit],
    ['', 'Net Margin %', statement.netMarginPct],
  ];
  return stringify(rows, { header: false });
}
```

### 6.2 Export API Endpoints

Add to `financial-engine/routes.ts`:

```typescript
// GET /api/v1/financial-engine/export/income-statement
app.get('/export/income-statement', { preHandler: [authenticate] }, async (request, reply) => {
  const { format = 'pdf', startDate, endDate } = z.object({
    format: z.enum(['pdf', 'csv', 'excel']).default('pdf'),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }).parse(request.query);

  const authUser = (request as any).authUser;
  const statement = await statementSvc.generateIncomeStatement({ startDate, endDate,
    userId: authUser.role === 'owner' ? undefined : authUser.userId });

  if (format === 'pdf') {
    const buf = await reportSvc.generatePDF('income-statement', statement);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', 'attachment; filename="income-statement.pdf"');
    return reply.send(buf);
  }
  if (format === 'excel') {
    const buf = await reportSvc.generateExcel('income-statement', statement);
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', 'attachment; filename="income-statement.xlsx"');
    return reply.send(buf);
  }
  // CSV
  const csv = reportSvc.generateCSV('income-statement', statement);
  reply.header('Content-Type', 'text/csv');
  reply.header('Content-Disposition', 'attachment; filename="income-statement.csv"');
  return reply.send(csv);
});
// Repeat pattern for balance-sheet and cash-flow endpoints
```

### 6.3 Scheduled Report Delivery (node-cron + Nodemailer)

**File:** `apps/api/src/core/financial-engine/scheduler.service.ts`

```typescript
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import type { ReportGenerationService } from './report-generation.service.js';
import type { FinancialStatementService } from './statements.service.js';

export class SchedulerService {
  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  constructor(
    private readonly prisma: PrismaClient,
    private readonly reportSvc: ReportGenerationService,
    private readonly statementSvc: FinancialStatementService,
  ) {}

  start() {
    // Run daily at 06:00 to evaluate which scheduled reports are due
    cron.schedule('0 6 * * *', () => this.processScheduledReports());
    console.log('[Scheduler] Financial report scheduler started');
  }

  private async processScheduledReports() {
    const now = new Date();
    const due = await this.prisma.scheduledReport.findMany({
      where: { isActive: true, nextRunAt: { lte: now } },
    });

    for (const sr of due) {
      try {
        await this.prisma.scheduledReport.update({
          where: { id: sr.id },
          data: { lastRunAt: now, nextRunAt: this.calcNextRun(sr.frequency, now) },
        });

        const statement = await this.buildStatement(sr);
        const recipients: string[] = sr.recipients as string[];
        const buf = await this.reportSvc.generatePDF(sr.reportType, statement);

        await this.transporter.sendMail({
          from: `"Nkuku Companion" <${process.env.SMTP_FROM}>`,
          to: recipients.join(', '),
          subject: `[Nkuku] ${sr.name} — ${now.toLocaleDateString()}`,
          text: `Please find your scheduled financial report attached.`,
          attachments: [{
            filename: `${sr.reportType}-${now.toISOString().slice(0, 10)}.pdf`,
            content: buf,
          }],
        });

        await this.prisma.reportExecution.create({
          data: { scheduledReportId: sr.id, status: 'success' },
        });
      } catch (err: any) {
        await this.prisma.reportExecution.create({
          data: { scheduledReportId: sr.id, status: 'failed', errorMessage: err.message },
        });
      }
    }
  }

  private calcNextRun(frequency: string, from: Date): Date {
    const d = new Date(from);
    if (frequency === 'weekly') d.setDate(d.getDate() + 7);
    else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (frequency === 'quarterly') d.setMonth(d.getMonth() + 3);
    return d;
  }
  
  // ... buildStatement() selects correct generator based on sr.reportType
}
```

Start the scheduler in `main.ts` after server listen:

```typescript
import { SchedulerService } from './core/financial-engine/scheduler.service.js';
// after await app.listen(...)
const schedulerSvc = new SchedulerService(prisma, reportSvc, statementSvc);
schedulerSvc.start();
```

### 6.4 Environment Variables (add to `.env.example`)

```bash
# SMTP (for scheduled report email delivery)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=nkuku@example.com
SMTP_PASS=your_smtp_password
SMTP_FROM=nkuku@example.com
```

### 6.5 Scheduled Reports CRUD Endpoints

```
POST   /api/v1/financial-engine/scheduled-reports     — create (owner/manager)
GET    /api/v1/financial-engine/scheduled-reports     — list all
PATCH  /api/v1/financial-engine/scheduled-reports/:id — update (toggle isActive, change recipients)
DELETE /api/v1/financial-engine/scheduled-reports/:id — delete (owner only)
GET    /api/v1/financial-engine/scheduled-reports/:id/executions — history
```

### 6.6 Milestone 3 Checklist

- [ ] Install `pdfkit`, `exceljs`, `csv-stringify`, `nodemailer`, `node-cron`
- [ ] Implement `ReportGenerationService` (PDF/Excel/CSV for all 3 statement types)
- [ ] Add export endpoints (6 endpoints: 3 statement types × 3 formats)
- [ ] Add scheduled report CRUD endpoints (5 endpoints)
- [ ] Implement `SchedulerService` with daily cron check + email delivery
- [ ] Wire scheduler start into `main.ts`
- [ ] Add SMTP env vars to `.env.example` and Docker Compose
- [ ] Test PDF/Excel/CSV download manually
- [ ] Integration test: create scheduled report, verify `nextRunAt` calculation

### 6.7 Milestone 3 Close-Out

> Follow the full procedure in [Section 13 — Milestone Close-Out Protocol](#13-milestone-close-out-protocol). Milestone-specific values are listed below.

| Parameter | Value |
|-----------|-------|
| **Version tag** | `v0.5.0-alpha` |
| **Commit title** | `feat(financial): Milestone 3 — PDF/Excel/CSV Export & Scheduled Email Delivery` |
| **Next milestone** | Milestone 4 — Web Dashboard Enhancement |

**Minimum passing test bar before tagging:**
- `pnpm run test:unit` — all prior tests green
- `pnpm run test:integration` — export endpoints return correct `Content-Type` headers and non-empty binary bodies for PDF, Excel, and CSV
- `pnpm run test:integration` — scheduled report creation sets a valid `nextRunAt`; `ReportExecution` row created on trigger
- Manual smoke test: download one PDF, one `.xlsx`, one `.csv` from API and confirm they open correctly
- SMTP test: verify a test email is received when `POST /api/v1/financial-engine/scheduled-reports` is created and triggered manually

**Release notes summary for `gh release create`:**
```
## What's in v0.5.0-alpha

### New: Report Export (PDF / Excel / CSV)
- `GET /api/v1/financial-engine/export/income-statement?format=pdf|excel|csv`
- `GET /api/v1/financial-engine/export/balance-sheet?format=pdf|excel|csv`
- `GET /api/v1/financial-engine/export/cash-flow?format=pdf|excel|csv`
- PDFKit-rendered reports with Nkuku branding, section headers, and margin totals
- ExcelJS workbooks with colour-coded rows and auto-width columns
- CSV export compatible with Excel and Google Sheets

### New: Scheduled Report Delivery
- `ScheduledReport` and `ReportExecution` tables
- `SchedulerService` (node-cron) — daily 06:00 check, sends due reports via Nodemailer
- CRUD endpoints for managing scheduled reports
- SMTP configuration via environment variables

### Config Changes
- New env vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- Update `.env` on server after deploying

### Breaking Changes
None.

### Next: Milestone 4 — Web Dashboard Enhancement
```

---

## 7. Milestone 4 — Web Dashboard Enhancement

**Estimated effort:** 2 weeks  
**Files created/modified:** ~6

### 7.1 New Pages

| Route | Description |
|-------|-------------|
| `/financials` | Global unified dashboard |
| `/financials/income-statement` | Full Income Statement view + export |
| `/financials/balance-sheet` | Balance Sheet view + export |
| `/financials/cash-flow` | Cash Flow Statement view + export |
| `/financials/audit-log` | Audit trail table (owner/manager) |
| `/financials/scheduled-reports` | Manage scheduled reports |

### 7.2 Global Financial Dashboard (`/financials`)

This is the highest-priority new page. It provides the unified view across all flocks and batches.

**Key components:**

```tsx
// apps/web/src/app/financials/page.tsx

// KPI Summary Cards (top row)
<div className="grid gap-4 md:grid-cols-4">
  <KpiCard label="Total Revenue" value={summary.totalRevenueZmw} color="green" icon={TrendingUp} />
  <KpiCard label="Total Cost"    value={summary.totalCostZmw}    color="red"   icon={DollarSign} />
  <KpiCard label="Net Profit"    value={summary.netProfitZmw}    color={profit >= 0 ? "green" : "red"} icon={BarChart2} />
  <KpiCard label="Gross Margin"  value={`${grossMargin}%`}       icon={Target} />
</div>

// Date range filter
<DateRangePicker onChange={(start, end) => fetchSummary(start, end)} />

// recharts — Cost Breakdown Donut (PieChart)
<PieChart width={350} height={350}>
  <Pie data={costByCategory} dataKey="amountZmw" nameKey="category"
       cx="50%" cy="50%" outerRadius={120} label />
  <Tooltip formatter={(v: number) => `ZMW ${v.toFixed(2)}`} />
  <Legend />
</PieChart>

// recharts — Monthly Revenue vs Cost Bar Chart
<BarChart data={monthlyData} width={700} height={300}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="month" />
  <YAxis />
  <Tooltip formatter={(v: number) => `ZMW ${v.toFixed(2)}`} />
  <Legend />
  <Bar dataKey="revenue" name="Revenue" fill="#16a34a" />
  <Bar dataKey="cost"    name="Cost"    fill="#dc2626" />
</BarChart>

// recharts — Cumulative Profit Line Chart
<LineChart data={cumulativeData} width={700} height={250}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="date" />
  <YAxis />
  <Tooltip />
  <Line type="monotone" dataKey="cumulativeProfit" stroke="#2563eb" dot={false} />
</LineChart>

// Top 5 most profitable flocks table
// Export buttons (PDF / CSV / Excel) for each statement type
```

**API calls from this page:**
```typescript
// Summary
GET /api/v1/financial-engine/summary?startDate=...&endDate=...

// Monthly trend (custom aggregation — add to API)
GET /api/v1/financial-engine/monthly-trend?year=2026

// Per-flock profitability
GET /api/v1/financial-engine/flock-profitability
```

### 7.3 Financial Statement Pages

Each statement page follows this layout:

```tsx
// Pattern for /financials/income-statement
<div className="flex items-center justify-between mb-6">
  <h1>Income Statement</h1>
  <div className="flex gap-2">
    <ExportButton format="pdf"   onClick={() => downloadExport('income-statement', 'pdf')} />
    <ExportButton format="excel" onClick={() => downloadExport('income-statement', 'excel')} />
    <ExportButton format="csv"   onClick={() => downloadExport('income-statement', 'csv')} />
  </div>
</div>

// Statement table (mirrors PDF layout)
<StatementTable statement={statement} />

// Charts (revenue vs COGS waterfall, margin trend)
```

`downloadExport` function:
```typescript
async function downloadExport(type: string, format: 'pdf' | 'excel' | 'csv') {
  const res = await fetch(
    `/api/v1/financial-engine/export/${type}?format=${format}&startDate=${start}&endDate=${end}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}-${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'xlsx' : format}`;
  a.click();
  URL.revokeObjectURL(url);
}
```

### 7.4 Navbar Update

Add `Financials` link to `apps/web/src/components/navbar.tsx` (visible to all roles, owner/manager see more tabs):

```tsx
{ href: '/financials', label: 'Financials', icon: BarChart2 }
```

### 7.5 Scheduled Reports Settings Page

`/financials/scheduled-reports` — form to create/edit scheduled reports:

```tsx
// Form fields:
// - Name (text)
// - Report Type (select: income-statement | balance-sheet | cash-flow | cost-breakdown)
// - Frequency (select: weekly | monthly | quarterly)
// - Format (select: pdf | excel | csv)
// - Recipients (tag input for comma-separated emails)
// - Is Active (toggle)
```

### 7.6 Milestone 4 Checklist

- [ ] Create `/financials/page.tsx` (global dashboard with 3 recharts)
- [ ] Create `/financials/income-statement/page.tsx`
- [ ] Create `/financials/balance-sheet/page.tsx`
- [ ] Create `/financials/cash-flow/page.tsx`
- [ ] Create `/financials/audit-log/page.tsx` (paginated table, owner/manager only)
- [ ] Create `/financials/scheduled-reports/page.tsx`
- [ ] Add `Financials` to navbar
- [ ] Add monthly-trend API endpoint to financial-engine module
- [ ] Add flock-profitability API endpoint to financial-engine module
- [ ] Test all export downloads (PDF, Excel, CSV)

### 7.7 Milestone 4 Close-Out

> Follow the full procedure in [Section 13 — Milestone Close-Out Protocol](#13-milestone-close-out-protocol). Milestone-specific values are listed below.

| Parameter | Value |
|-----------|-------|
| **Version tag** | `v0.6.0-alpha` |
| **Commit title** | `feat(web): Milestone 4 — Unified Financial Dashboard & Statement Pages` |
| **Next milestone** | Milestone 5 — Flutter Mobile Screens |

**Minimum passing test bar before tagging:**
- `pnpm run test:unit` — all API unit tests green (no regressions from new API endpoints)
- `pnpm run test:integration` — monthly-trend and flock-profitability endpoints return valid JSON
- `pnpm run build` (inside `apps/web`) — Next.js build succeeds with zero TypeScript errors
- Manual browser smoke test on `http://localhost:30000/financials`:
  - KPI cards display correct totals
  - Pie chart, bar chart, and line chart all render data
  - PDF/Excel/CSV download buttons trigger file download
  - `/financials/audit-log` is visible to owner, returns 403 for viewer role
  - `/financials/scheduled-reports` — create a report, verify it saves

**Release notes summary for `gh release create`:**
```
## What's in v0.6.0-alpha

### New: Unified Financial Web Dashboard
- `/financials` — global P&L dashboard with date-range picker, recharts pie/bar/line charts
- `/financials/income-statement` — tabular P&L with PDF/Excel/CSV download
- `/financials/balance-sheet` — assets, liabilities, equity snapshot with export
- `/financials/cash-flow` — indirect-method cash flow with export
- `/financials/audit-log` — paginated, read-only audit trail (owner/manager only)
- `/financials/scheduled-reports` — create, edit, toggle, and delete scheduled report jobs
- `Financials` added to main navigation bar

### Breaking Changes
None.

### Next: Milestone 5 — Flutter Mobile Financial Screens
```

---

## 8. Milestone 5 — Flutter Mobile Screens

**Estimated effort:** 2 weeks  
**Files created:** ~5 Dart files

`fl_chart`, `dio`, and `path_provider` are already installed — no new packages needed.

### 8.1 New Screens

| Screen | Route/Navigation | Description |
|--------|-----------------|-------------|
| `FinancialDashboardScreen` | Bottom nav / drawer | KPI cards + pie chart + bar chart |
| `IncomeStatementScreen` | Push from dashboard | Full P&L statement table |
| `BalanceSheetScreen` | Push from dashboard | Balance sheet table |
| `CashFlowScreen` | Push from dashboard | Cash flow table |
| `ReportDownloadScreen` | Push from dashboard | Format picker + download trigger |

### 8.2 Financial API Service Extension

**File:** `apps/mobile/lib/services/financial_service.dart`

```dart
import 'package:dio/dio.dart';
import 'api_service.dart';
import 'dart:typed_data';
import 'package:path_provider/path_provider.dart';
import 'dart:io';

class FinancialService {
  static Future<Map<String, dynamic>> getSummary({
    String? startDate,
    String? endDate,
  }) async {
    final params = <String, String>{};
    if (startDate != null) params['startDate'] = startDate;
    if (endDate != null) params['endDate'] = endDate;

    final response = await ApiService.dio.get(
      '/v1/financial-engine/summary',
      queryParameters: params,
    );
    return response.data as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> getIncomeStatement({
    String? startDate,
    String? endDate,
  }) async {
    final response = await ApiService.dio.get(
      '/v1/financial-engine/income-statement',
      queryParameters: {
        if (startDate != null) 'startDate': startDate,
        if (endDate != null) 'endDate': endDate,
      },
    );
    return response.data as Map<String, dynamic>;
  }

  /// Download a report and save to device Downloads folder.
  /// Returns the saved file path.
  static Future<String> downloadReport({
    required String reportType,     // 'income-statement' | 'balance-sheet' | 'cash-flow'
    required String format,         // 'pdf' | 'excel' | 'csv'
    String? startDate,
    String? endDate,
  }) async {
    final response = await ApiService.dio.get(
      '/v1/financial-engine/export/$reportType',
      queryParameters: {
        'format': format,
        if (startDate != null) 'startDate': startDate,
        if (endDate != null) 'endDate': endDate,
      },
      options: Options(responseType: ResponseType.bytes),
    );

    final bytes = response.data as Uint8List;
    final dir = await getApplicationDocumentsDirectory();
    final ext = format == 'excel' ? 'xlsx' : format;
    final filename = '$reportType-${DateTime.now().toIso8601String().substring(0, 10)}.$ext';
    final file = File('${dir.path}/$filename');
    await file.writeAsBytes(bytes);
    return file.path;
  }
}
```

### 8.3 Financial Dashboard Screen

**File:** `apps/mobile/lib/screens/financial_dashboard_screen.dart`

```dart
import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../services/financial_service.dart';

class FinancialDashboardScreen extends StatefulWidget {
  const FinancialDashboardScreen({super.key});

  @override
  State<FinancialDashboardScreen> createState() => _FinancialDashboardScreenState();
}

class _FinancialDashboardScreenState extends State<FinancialDashboardScreen> {
  Map<String, dynamic>? _summary;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadSummary();
  }

  Future<void> _loadSummary() async {
    final data = await FinancialService.getSummary();
    setState(() { _summary = data; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_summary == null) return const Center(child: Text('No data'));

    final totalRevenue = double.parse(_summary!['totalRevenueZmw'] ?? '0');
    final totalCost = double.parse(_summary!['totalCostZmw'] ?? '0');
    final netProfit = double.parse(_summary!['netProfitZmw'] ?? '0');

    return Scaffold(
      appBar: AppBar(title: const Text('Financial Dashboard')),
      body: RefreshIndicator(
        onRefresh: _loadSummary,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // KPI Cards row
            Row(children: [
              _kpiCard('Revenue', totalRevenue, Colors.green),
              const SizedBox(width: 8),
              _kpiCard('Cost', totalCost, Colors.red),
              const SizedBox(width: 8),
              _kpiCard('Profit', netProfit, netProfit >= 0 ? Colors.green : Colors.red),
            ]),
            const SizedBox(height: 16),

            // Pie Chart: Cost by Category
            if (_summary!['byCategory'] != null) ...[
              const Text('Cost Breakdown', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              SizedBox(
                height: 220,
                child: PieChart(PieChartData(
                  sections: _buildPieSections(),
                  centerSpaceRadius: 40,
                  sectionsSpace: 2,
                )),
              ),
              const SizedBox(height: 16),
            ],

            // Navigation to Statements
            _statementTile(context, 'Income Statement', Icons.trending_up, '/financial/income-statement'),
            _statementTile(context, 'Balance Sheet',    Icons.account_balance, '/financial/balance-sheet'),
            _statementTile(context, 'Cash Flow',        Icons.swap_vert, '/financial/cash-flow'),

            const SizedBox(height: 16),
            // Download Report button
            ElevatedButton.icon(
              onPressed: () => Navigator.pushNamed(context, '/financial/download'),
              icon: const Icon(Icons.download),
              label: const Text('Download Report'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _kpiCard(String label, double value, Color color) {
    return Expanded(child: Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
          Text('ZMW ${value.toStringAsFixed(0)}',
               style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: color)),
        ]),
      ),
    ));
  }

  List<PieChartSectionData> _buildPieSections() {
    final categories = (_summary!['byCategory'] as List).where((c) => !(c['isIncome'] as bool)).toList();
    final colors = [Colors.blue, Colors.orange, Colors.green, Colors.red, Colors.purple, Colors.teal];
    return categories.asMap().entries.map((e) {
      final amt = double.parse(e.value['amountZmw'] as String);
      return PieChartSectionData(
        color: colors[e.key % colors.length],
        value: amt,
        title: '${e.value['pctOfTotal']}%',
        radius: 60,
        titleStyle: const TextStyle(fontSize: 11, color: Colors.white),
      );
    }).toList();
  }

  ListTile _statementTile(BuildContext context, String title, IconData icon, String route) {
    return ListTile(
      leading: Icon(icon, color: Theme.of(context).colorScheme.primary),
      title: Text(title),
      trailing: const Icon(Icons.chevron_right),
      onTap: () => Navigator.pushNamed(context, route),
    );
  }
}
```

### 8.4 Report Download Screen

```dart
// apps/mobile/lib/screens/report_download_screen.dart

class ReportDownloadScreen extends StatefulWidget { ... }

class _ReportDownloadScreenState extends State<ReportDownloadScreen> {
  String _reportType = 'income-statement';
  String _format = 'pdf';
  bool _downloading = false;
  String? _savedPath;

  Future<void> _download() async {
    setState(() { _downloading = true; _savedPath = null; });
    try {
      final path = await FinancialService.downloadReport(
        reportType: _reportType,
        format: _format,
      );
      setState(() { _savedPath = path; });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Saved to $path')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Download failed: $e'), backgroundColor: Colors.red),
      );
    } finally {
      setState(() { _downloading = false; });
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Download Report')),
    body: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Report Type'),
        DropdownButton<String>(
          value: _reportType,
          isExpanded: true,
          items: const [
            DropdownMenuItem(value: 'income-statement', child: Text('Income Statement')),
            DropdownMenuItem(value: 'balance-sheet', child: Text('Balance Sheet')),
            DropdownMenuItem(value: 'cash-flow', child: Text('Cash Flow')),
          ],
          onChanged: (v) => setState(() => _reportType = v!),
        ),
        const SizedBox(height: 16),
        const Text('Format'),
        DropdownButton<String>(
          value: _format,
          isExpanded: true,
          items: const [
            DropdownMenuItem(value: 'pdf',   child: Text('PDF')),
            DropdownMenuItem(value: 'excel', child: Text('Excel (.xlsx)')),
            DropdownMenuItem(value: 'csv',   child: Text('CSV')),
          ],
          onChanged: (v) => setState(() => _format = v!),
        ),
        const SizedBox(height: 32),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _downloading ? null : _download,
            icon: _downloading
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.download),
            label: Text(_downloading ? 'Downloading...' : 'Download'),
          ),
        ),
        if (_savedPath != null) ...[
          const SizedBox(height: 12),
          Text('Saved: $_savedPath', style: const TextStyle(color: Colors.green, fontSize: 12)),
        ],
      ]),
    ),
  );
}
```

### 8.5 Milestone 5 Checklist

- [ ] Create `FinancialService` Dart class with summary, statements, and download methods
- [ ] Create `FinancialDashboardScreen` with KPI cards + fl_chart pie chart
- [ ] Create `IncomeStatementScreen` (scrollable statement table)
- [ ] Create `BalanceSheetScreen`
- [ ] Create `CashFlowScreen`
- [ ] Create `ReportDownloadScreen`
- [ ] Register routes in `main.dart`
- [ ] Add Financial entry to mobile navigation drawer/bottom bar
- [ ] Manual test: verify download saves a valid PDF to device storage

### 8.6 Milestone 5 Close-Out

> Follow the full procedure in [Section 13 — Milestone Close-Out Protocol](#13-milestone-close-out-protocol). Milestone-specific values are listed below.

| Parameter | Value |
|-----------|-------|
| **Version tag** | `v0.7.0-alpha` |
| **Commit title** | `feat(mobile): Milestone 5 — Flutter Financial Dashboard & Report Download` |
| **Next milestone** | Milestone 6 — Audit Trail, Tests & Hardening |

**Minimum passing test bar before tagging:**
- `pnpm run test` (API) — all unit and integration tests green (no regressions)
- `flutter test` (inside `apps/mobile`) — all widget tests green
- `flutter build apk --release` — APK builds successfully with no Dart errors
- Manual device/emulator test:
  - Financial dashboard loads KPI cards and pie chart
  - Tapping Income Statement navigates to statement screen with data
  - Report download (PDF) saves to device; file is a valid PDF
  - 401 is handled gracefully (redirects to login screen)

**Release notes summary for `gh release create`:**
```
## What's in v0.7.0-alpha

### New: Flutter Mobile Financial Screens
- `FinancialDashboardScreen` — KPI cards + fl_chart pie chart (cost breakdown)
- `IncomeStatementScreen` — scrollable P&L table
- `BalanceSheetScreen` — assets/liabilities/equity view
- `CashFlowScreen` — operating/investing/financing activities
- `ReportDownloadScreen` — format picker (PDF/Excel/CSV) + binary download to device storage
- `FinancialService` Dart class — wraps all `/api/v1/financial-engine/*` endpoints

### Breaking Changes
None.

### Next: Milestone 6 — Audit Trail, DB Constraints, Test Coverage & Hardening
```

---

## 9. Milestone 6 — Audit Trail, Tests & Hardening

**Estimated effort:** 1 week

### 9.1 Audit Trail Enforcement

- Add a `@prisma/client` middleware (Prisma's `$extends` or manual call before every mutation) to ensure **no** financial record mutation goes without an audit log entry
- Add a PostgreSQL-level trigger (optional, belt-and-suspenders) to log deletes from `financial_records` to `audit_logs` even if the app bypasses the API
- The `audit_logs` table should never be directly writable from the API (no POST/PATCH/DELETE endpoints for it; only GET)

### 9.2 Database-Level Constraints

Run these SQL statements after schema push:

```sql
-- Prevent negative financial amounts
ALTER TABLE financial_records ADD CONSTRAINT amount_nonnegative CHECK (amount_zmw >= 0);
ALTER TABLE batch_expenses ADD CONSTRAINT subtotal_nonnegative CHECK (subtotal_zmw >= 0);
ALTER TABLE overhead_costs ADD CONSTRAINT overhead_nonneg CHECK (amount_zmw >= 0);

-- Prevent future-dated audit log entries
ALTER TABLE audit_logs ADD CONSTRAINT audit_no_future CHECK (occurred_at <= NOW() + INTERVAL '1 minute');
```

### 9.3 Test Coverage Targets

| Test file | Coverage target |
|---|---|
| `tests/unit/unified-financial.test.ts` | 100% of `UnifiedFinancialService` |
| `tests/unit/statements.test.ts` | 100% of `FinancialStatementService` |
| `tests/unit/calculation-engine.test.ts` | Already 100% — keep passing |
| `tests/integration/financial-engine.test.ts` | Happy path + error for all 6 new endpoints |
| `tests/integration/audit-log.test.ts` | Verify every mutation generates an audit row |
| `tests/integration/export.test.ts` | PDF, Excel, CSV — verify Content-Type headers and non-empty body |

**Integration test skeleton:**

```typescript
// tests/integration/financial-engine.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';

describe('GET /api/v1/financial-engine/income-statement', () => {
  it('returns a valid income statement', async () => {
    const res = await supertest(app)
      .get('/api/v1/financial-engine/income-statement')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('totalRevenue');
    expect(res.body).toHaveProperty('netProfit');
    expect(res.body).toHaveProperty('grossMarginPct');
    expect(typeof res.body.totalRevenue).toBe('string'); // decimal string
  });

  it('returns 401 without token', async () => {
    await supertest(app)
      .get('/api/v1/financial-engine/income-statement')
      .expect(401);
  });
});

describe('GET /api/v1/financial-engine/export/income-statement', () => {
  it('returns a PDF with correct content-type', async () => {
    const res = await supertest(app)
      .get('/api/v1/financial-engine/export/income-statement?format=pdf')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.body.length).toBeGreaterThan(100);
  });
});
```

### 9.4 Audit Trail Verification Test

```typescript
describe('Audit trail', () => {
  it('creates an audit log entry on FinancialRecord create', async () => {
    const before = await prisma.auditLog.count({ where: { entityType: 'FinancialRecord', action: 'create' } });
    
    await supertest(app)
      .post('/api/v1/financial-records')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ flockId, recordDate: '2026-06-01', category: 'feed', description: 'Test', amountZmw: 100, isIncome: false })
      .expect(200);

    const after = await prisma.auditLog.count({ where: { entityType: 'FinancialRecord', action: 'create' } });
    expect(after).toBe(before + 1);
  });
});
```

### 9.5 Milestone 6 Checklist

- [ ] Add DB constraints (CHECK, trigger) for data integrity
- [ ] Finalize audit trail in all mutation routes
- [ ] Achieve test coverage targets (run `vitest --coverage`)
- [ ] Load test: verify PDF generation < 3s for statements with 500+ records (using `vitest` + timer)
- [ ] Security review: verify audit-log endpoint is read-only, no admin bypass
- [ ] Update `AGENTS.md` with new commands and module locations

### 9.6 Milestone 6 Close-Out

> Follow the full procedure in [Section 13 — Milestone Close-Out Protocol](#13-milestone-close-out-protocol). Milestone-specific values are listed below.

| Parameter | Value |
|-----------|-------|
| **Version tag** | `v0.8.0` *(no alpha — this is the production-ready hardening release)* |
| **Commit title** | `feat(financial): Milestone 6 — Audit Trail, DB Constraints, Test Coverage & Hardening` |
| **Next milestone** | Double-Entry Bookkeeping (see separate plan) |

**Minimum passing test bar before tagging:**
- `pnpm run test` — 100% pass rate; coverage report shows ≥ 90% for all files in `src/core/financial-engine/`
- `pnpm run typecheck` — zero TypeScript errors across `apps/api` and `apps/web`
- `flutter test` — all widget tests green
- DB constraint smoke test: attempt to insert a negative `amount_zmw` via `psql` → confirm `CHECK` constraint rejects it
- Security: `curl` the `DELETE /api/v1/financial-engine/audit-log` endpoint → confirm `404` (route does not exist)
- Load test: POST 500 financial records, then `GET /export/income-statement?format=pdf` → confirm response in < 3 seconds
- `AGENTS.md` updated with new module locations, test commands, and version history entry

**Release notes summary for `gh release create`:**
```
## What's in v0.8.0

### Hardening & Quality
- PostgreSQL CHECK constraints on all monetary columns (amount_zmw ≥ 0)
- Append-only trigger on audit_logs prevents row mutation at DB level
- Vitest coverage ≥ 90% for all financial engine modules
- Load-tested PDF generation: < 3s for 500+ record statements
- Audit log endpoint is GET-only; no write/delete surface exposed

### Test Suite
- 6 test files added (unit + integration)
- Total test count: 50+ assertions

### Documentation
- `AGENTS.md` updated with all new module paths, test commands, SMTP config notes
- `Financial_System_Implementation_Plan.md` v1.1 committed alongside code

### Breaking Changes
None.

### What's Next
Full Double-Entry Bookkeeping (see `Double_Entry_Bookkeeping_Implementation_Plan.md`)
```

---

## 10. Data Migration Strategy

The `BatchExpense` and `OverheadCost` tables contain historical data that is **not** yet reflected in `FinancialRecord`. Two strategies:

### Option A — Materialise on Period Close (Recommended)

When the owner closes a period (`POST /api/v1/financial-engine/periods/close`), the system:
1. Finds all `BatchExpense` rows (`isProjected = false`) in the date range not yet materialised (`batchExpenseId` null in `FinancialRecord`)
2. Creates corresponding `FinancialRecord` rows with `batchExpenseId` set
3. Does the same for `OverheadCost` rows
4. Tags these records with the `periodLabel`

This is safe and non-destructive — the original rows remain untouched.

### Option B — One-Time Backfill Script

Run a one-time seed script to convert all existing `BatchExpense` and `OverheadCost` rows into `FinancialRecord` rows. Only use if historical unified reporting is immediately required.

```typescript
// apps/api/src/db/seeds/backfill-financial-records.ts
// Run: docker compose exec api tsx src/db/seeds/backfill-financial-records.ts

const batchExpenses = await prisma.batchExpense.findMany({ where: { isProjected: false } });
for (const be of batchExpenses) {
  const flock = null; // BatchExpense is not flock-scoped — use a sentinel flockId or skip
  // Note: BatchExpense does not have a flockId — they belong to batches.
  // The unified service handles this by querying both tables separately.
  // Therefore Option A (materialise at period close) is preferred.
}
```

**Recommendation:** Use Option A. The `UnifiedFinancialService` already handles the two subsystems natively without needing materialisation for reporting. Materialisation is only needed if you want all data in one table for export filtering.

---

## 11. Compliance Notes (GAAP/IFRS-aligned)

Given the app's context (small broiler farm, ZMW currency, single entity), full GAAP/IFRS compliance is not required by law. However, the following practices are adopted to align with industry standards:

| Principle | Implementation |
|-----------|---------------|
| **Accrual accounting** | `FinancialRecord.recordDate` is the transaction date, not creation date. All statements use `recordDate` for period assignment. |
| **Revenue recognition** | Revenue is recorded when birds are sold (`category = 'sales'`), not when payment is received. |
| **Matching principle** | Feed costs are recorded in the same period as the production batch they relate to. |
| **Consistency** | All monetary values use `Decimal.js` with 2 decimal places (ZMW precision). PostgreSQL `DECIMAL(14,2)` enforces this at DB level. |
| **Conservatism** | Mortality losses are recorded as expenses when they occur (category = 'other' from mortality events). |
| **Period matching** | `FinancialPeriod.periodLabel` stamps each record with its accounting period on close. |
| **Audit trail** | `AuditLog` records all mutations with before/after state (satisfies ISAE 3402 access control requirements). |
| **Going concern** | Balance Sheet shows live inventory at cost (conservative valuation, not fair value). |

**What this system does NOT implement (out of scope):**
- True double-entry bookkeeping (debits/credits, T-accounts)
- Asset depreciation schedules (equipment)
- Tax accounting (VAT, PAYE)
- Multi-currency consolidation (ExchangeRate table exists but not yet used in statements)
- Payroll accounting

These can be added in future milestones as the business grows.

---

## 12. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| PDF generation slow for large datasets | Medium | Medium | Paginate statements; limit to 1-year window by default; cache generated PDFs in Redis for 1h |
| SMTP failures for scheduled reports | Medium | Low | Log failures in `ReportExecution` table; alert via in-app notification; implement retry (max 3 attempts) |
| `decimal.js` precision issues in statements | Low | High | Unit test every arithmetic operation; use `.toFixed(2)` before display; store as `DECIMAL(14,2)` in DB |
| Data inconsistency between FinancialRecord and BatchExpense | Medium | High | Unified service reads both tables independently — no sync needed for reporting. Materialisation is optional. |
| Audit log table growth | Low | Low | Add DB index on `occurred_at`; implement log rotation (archive rows older than 2 years) |
| node-cron not running in Docker (no persistent process) | Medium | Medium | Start scheduler inside the Fastify process after server listen (already planned). Monitor with Docker healthcheck. |
| Flutter PDF download permissions (Android 13+) | Medium | Medium | Use `getApplicationDocumentsDirectory()` (app-private, no permission needed). For sharing, use `share_plus` package. |

---

## 13. Milestone Close-Out Protocol

This protocol is executed at the end of **every** milestone without exception. No version tag is created until all steps pass. Each milestone section (4.6, 5.4, 6.7, 7.7, 8.6, 9.6) lists the milestone-specific values (version tag, commit title, expected test counts, release notes).

---

### Step 1 — Rebuild Docker Containers

Stop and rebuild all containers to ensure the image reflects every code change made during the milestone. Data is preserved (no `-v` flag).

```bash
# From project root: /home/mundeez/DevWorkz/nkuku-companion-app

# Bring down containers (keeps volumes / database data intact)
docker compose down

# Rebuild images and restart
docker compose up --build -d

# Confirm all containers are up
docker compose ps

# Confirm API health
curl -s http://localhost:30001/health | jq .
# Expected: { "status": "ok", "timestamp": "..." }

# Confirm web is responding
curl -s -o /dev/null -w "%{http_code}" http://localhost:30000
# Expected: 200
```

If any container exits or stays unhealthy:
1. Check logs: `docker logs nkuku-companion-app-api-1 --tail 100`
2. Fix the root cause (build error, missing env var, schema mismatch)
3. Repeat Step 1 from the top

---

### Step 2 — Run Comprehensive Tests (Pend Until Green)

**Do not proceed to Step 3 until every test suite returns exit code 0.**

```bash
# ── Unit tests ───────────────────────────────────────────────
docker compose exec api pnpm run test:unit

# If any test fails:
#   1. Read the failure output carefully
#   2. Fix the code (or the test if the assertion is wrong)
#   3. Rebuild the container: docker compose up --build -d
#   4. Re-run test:unit
#   5. Repeat until exit code 0

# ── Integration tests ────────────────────────────────────────
docker compose exec api pnpm run test:integration

# Same fix-rebuild-retry loop if failures occur

# ── Full test suite (both unit + integration) ────────────────
docker compose exec api pnpm run test

# ── TypeScript type-check (API) ──────────────────────────────
docker compose exec api pnpm run typecheck

# ── TypeScript type-check (Web) ──────────────────────────────
docker compose exec web pnpm run typecheck

# ── Flutter tests (when mobile changes are included) ─────────
# Run locally (Flutter must be installed on host):
# cd apps/mobile && flutter test
```

**Green gate:** All commands above must exit with code `0` before continuing.  
If a test is genuinely wrong (e.g. flaky environment issue) — document the reason and get a second review before skipping. Never tag a release with red tests.

---

### Step 3 — Commit, Tag & Push to GitHub

Only run this step after Step 2 is fully green.

```bash
# ── 3a. Review what will be committed ───────────────────────
git status
git diff --stat

# ── 3b. Stage all changes ───────────────────────────────────
git add -A

# ── 3c. Commit (substitute COMMIT_TITLE and BODY per milestone) ─
git commit -m "$(cat <<'EOF'
<COMMIT_TITLE>

<BODY: bullet-point summary of what was built in this milestone>

Generated with Devin (https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"

# ── 3d. Annotated version tag ───────────────────────────────
# VERSION_TAG is milestone-specific (see each milestone's close-out section)
git tag -a <VERSION_TAG> -m "<COMMIT_TITLE>"

# ── 3e. Push commits and tag ────────────────────────────────
git push origin main
git push origin <VERSION_TAG>

# ── 3f. Create GitHub Release with auto-generated notes ─────
# RELEASE_NOTES content is defined per milestone (see each milestone's close-out section)
gh release create <VERSION_TAG> \
  --title "<VERSION_TAG> — <Milestone N: Title>" \
  --notes "$(cat <<'NOTES'
<RELEASE_NOTES: see milestone-specific close-out section>
NOTES
)"
```

**Checklist for a valid commit:**
- [ ] Commit message explains *why* the change was made, not just *what*
- [ ] No secrets, API keys, or passwords in any committed file
- [ ] `AGENTS.md` updated if new commands, paths, or config were introduced
- [ ] The annotated tag message matches the commit title

---

### Step 4 — Move to the Next Milestone

After the GitHub Release is created and visible at `https://github.com/<org>/nkuku-companion-app/releases`:

1. Update the task tracker (or this plan's checklist) — mark the completed milestone's items as done
2. Open the next milestone section in this plan
3. Start with the first checklist item of that milestone

```bash
# Quick confirmation the release is live
gh release view <VERSION_TAG>
# Should show: tag, title, published date, notes
```

The cycle then repeats: implement → rebuild → test (pend until green) → commit/tag/push → move on.

---

Each row ends with the close-out routine from [Section 13](#13-milestone-close-out-protocol): rebuild → test (pend until green) → commit/tag/push → next milestone.

```
Week 1-2  │  Milestone 1 — Schema + Unified Engine + Audit Service + Unit Tests  →  v0.3.0-alpha
Week 2-4  │  Milestone 2 — Financial Statements API (Income, Balance, Cash Flow)  →  v0.4.0-alpha
Week 4-5  │  Milestone 3 — PDF/Excel/CSV Export + node-cron + Nodemailer          →  v0.5.0-alpha
Week 5-6  │  Milestone 4 — Web Dashboard (charts, statement pages, sched. reports) →  v0.6.0-alpha
Week 6-7  │  Milestone 5 — Flutter Mobile Screens                                  →  v0.7.0-alpha
Week 7-8  │  Milestone 6 — Audit Trail, DB Constraints, Test Coverage, Hardening   →  v0.8.0
```

**Total estimated duration:** 7-8 weeks (1 developer, part-time)

**Close-out procedure per milestone** (see Section 13 for full detail):
```bash
# 1. Rebuild (preserves data)
docker compose down && docker compose up --build -d

# 2. Test — pend until all green (fix errors, rebuild, retry)
docker compose exec api pnpm run test
docker compose exec api pnpm run typecheck

# 3. Commit, tag, push, release
git add -A && git commit -m "feat(financial): Milestone N — ..."
git tag -a vX.Y.Z -m "Milestone N: ..."
git push origin main && git push origin vX.Y.Z
gh release create vX.Y.Z --title "..." --notes "..."

# 4. Move to next milestone
```

**Production deploy after each milestone:**
```bash
# On the VPS at /var/www/nkuku
git pull
docker compose -f docker-compose.prod.yml up --build -d
```

---

*End of Financial System Implementation Plan — v1.1*
