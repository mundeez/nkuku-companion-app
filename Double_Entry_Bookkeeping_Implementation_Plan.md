# Nkuku Companion App — Double-Entry Bookkeeping Implementation Plan

**Version:** 1.0 · **Date:** 2026-06-26  
**Prerequisite:** `Financial_System_Implementation_Plan.md` v1.1 fully implemented (v0.8.0 tagged)  
**Target release:** v1.0.0 (production-stable)  
**Platforms:** Fastify/Prisma API · Next.js 14 Web · Flutter 3.x Mobile

---

## Table of Contents

1. [Why Double-Entry — and Why Now](#1-why-double-entry--and-why-now)
2. [Accounting Concepts Reference](#2-accounting-concepts-reference)
3. [Target Architecture](#3-target-architecture)
4. [New Dependencies](#4-new-dependencies)
5. [Milestone A — Chart of Accounts & Journal Engine](#5-milestone-a--chart-of-accounts--journal-engine)
6. [Milestone B — Migration: Single-Entry → Double-Entry](#6-milestone-b--migration-single-entry--double-entry)
7. [Milestone C — Ledger & Trial Balance API](#7-milestone-c--ledger--trial-balance-api)
8. [Milestone D — GAAP-Compliant Financial Statements](#8-milestone-d--gaap-compliant-financial-statements)
9. [Milestone E — Web Ledger Interface](#9-milestone-e--web-ledger-interface)
10. [Milestone F — Flutter Ledger Screens](#10-milestone-f--flutter-ledger-screens)
11. [Milestone G — Hardening, Compliance Audit & v1.0.0 Release](#11-milestone-g--hardening-compliance-audit--v100-release)
12. [Milestone Close-Out Protocol](#12-milestone-close-out-protocol)
13. [Data Integrity & Immutability Rules](#13-data-integrity--immutability-rules)
14. [GAAP/IFRS Compliance Checklist](#14-gaapifrs-compliance-checklist)
15. [Risk Register](#15-risk-register)
16. [Summary Roadmap](#16-summary-roadmap)

---

## 1. Why Double-Entry — and Why Now

The existing enhanced single-entry system (v0.8.0) provides correct income/expense tracking and financial statement generation. Double-entry bookkeeping adds three critical capabilities that become necessary as the farm scales:

| Capability | Single-entry (v0.8.0) | Double-entry (this plan) |
|-----------|----------------------|--------------------------|
| Self-balancing ledger | No — errors only caught by audit log | Yes — every journal entry must balance (debits = credits) |
| True Balance Sheet | Approximated (no asset register, no liability tracking) | Exact — every asset, liability, and equity account maintained |
| Accounts Payable / Receivable | Not tracked | Full AP/AR sub-ledger |
| Bank reconciliation | Not possible | Yes — reconcile bank statements against the Cash account |
| External audit readiness | Limited | Full audit trail with journal entry references (ISAE 3402) |
| Multi-entity reporting | Not supported | Possible via entity-scoped chart of accounts |
| Tax compliance (ZRA/PAYE/VAT) | Not supported | Foundation for tax line mapping |

**When to implement:** After v0.8.0 is stable in production and the business is managing more than 5 concurrent flocks or seeking external financing/audit.

---

## 2. Accounting Concepts Reference

### 2.1 The Double-Entry Rule

Every financial transaction is recorded as **at least two entries** — one debit and one credit — such that:

```
Sum of all Debits = Sum of all Credits
```

A **Journal Entry** is the atomic unit. It contains one or more **Journal Lines** (debit or credit), each posted to a specific **Account** in the **Chart of Accounts**.

### 2.2 Account Types and Normal Balances

| Type | Normal balance | Increases with | Decreases with |
|------|---------------|----------------|----------------|
| Asset | Debit | Debit | Credit |
| Liability | Credit | Credit | Debit |
| Equity | Credit | Credit | Debit |
| Revenue | Credit | Credit | Debit |
| Expense | Debit | Debit | Credit |

### 2.3 The Accounting Equation

```
Assets = Liabilities + Equity
Equity = Paid-in Capital + Retained Earnings + Current Period Net Income
Net Income = Revenue − Expenses
```

The double-entry system enforces this equation automatically: if debits ever fail to equal credits, the system rejects the entry.

### 2.4 Chart of Accounts for Broiler Farming

The chart of accounts is a numbered hierarchy. Nkuku uses a 4-digit numbering scheme (expandable to sub-accounts with decimals):

```
1000  ASSETS
  1010  Cash & Bank
  1020  Accounts Receivable (bird sales not yet collected)
  1030  Live Inventory — Chicks at Cost
  1040  Live Inventory — Growers at Cost
  1050  Feed Inventory
  1060  Medication & Vaccine Inventory
  1070  Prepaid Expenses
  1080  Equipment (at cost)
  1081  Accumulated Depreciation — Equipment

2000  LIABILITIES
  2010  Accounts Payable (feed/vaccine suppliers not yet paid)
  2020  Accrued Expenses (wages, utilities owed but not yet paid)
  2030  Deferred Revenue (advance payments from buyers)

3000  EQUITY
  3010  Owner's Capital
  3020  Retained Earnings
  3030  Current Year Earnings (closes to Retained Earnings at year-end)

4000  REVENUE
  4010  Bird Sales Revenue
  4020  By-product Sales (litter, feathers)
  4030  Other Income

5000  COST OF GOODS SOLD (COGS)
  5010  Chick Purchase Cost
  5020  Feed Cost
  5030  Vaccine Cost
  5040  Medication Cost
  5050  Mortality Loss

6000  OPERATING EXPENSES
  6010  Labour / Wages
  6020  Electricity
  6030  Water
  6040  Transport to Market
  6050  Litter & Bedding
  6060  Equipment Maintenance
  6070  Insurance
  6080  Other Overhead
```

---

## 3. Target Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                          API (Fastify)                             │
│                                                                    │
│  ┌──────────────────────┐   ┌──────────────────────────────────┐  │
│  │  Existing Modules    │   │   NEW: Double-Entry Engine        │  │
│  │  financial-records   │──▶│   JournalEngine                  │  │
│  │  feed-records        │   │   LedgerService                  │  │
│  │  batch-expenses      │   │   TrialBalanceService             │  │
│  │  ...                 │   │   GaapStatementService            │  │
│  └──────────────────────┘   │   ReconciliationService           │  │
│                             │   ClosingService (year-end)        │  │
│                             └──────────────────────────────────┘  │
│                                        │                           │
│               /api/v1/ledger/*  ───────┘                           │
│               /api/v1/journal/* ─────────                          │
│               /api/v1/accounts/*────────                           │
└────────────────────────────────────────────────────────────────────┘
                │
  ┌─────────────┼──────────────┐
  ▼             ▼              ▼
Next.js Web   Flutter       Export
/ledger        Mobile        PDF/Excel (reuses v0.8.0 ReportGenerationService)
/journal       LedgerScreen
/accounts      TrialBalanceScreen
```

### Design Principles

1. **The existing `FinancialRecord` table is not deleted** — it remains the source of truth for operational data (feed costs, vaccination costs, etc.). The journal engine reads from it and creates corresponding journal entries.
2. **Journal entries are immutable** — you never update or delete a journal entry. To correct an error, you post a reversing entry.
3. **The `decimal.js` library** (already installed) is used for all arithmetic to prevent floating-point errors.
4. **Parallel operation** — the double-entry ledger can run alongside the existing system during migration (Milestone B). Once migration is verified, the old financial statements endpoints from v0.8.0 remain available as a fallback.

---

## 4. New Dependencies

### API (`apps/api`)

No additional libraries are required beyond what was installed in v0.8.0. The journal engine is implemented in pure TypeScript using `decimal.js`.

```bash
# No new packages needed — decimal.js, pdfkit, exceljs already installed
```

### Web (`apps/web`)

```bash
# A tree-view / collapsible component for the Chart of Accounts
pnpm add @radix-ui/react-collapsible@1.0.3
```

### Mobile (`apps/mobile`) — no new packages

---

## 5. Milestone A — Chart of Accounts & Journal Engine

**Estimated effort:** 2 weeks  
**Version tag:** `v0.9.0-alpha`  
**Files created:** ~6

### 5.1 Prisma Schema — New Tables

Add to `apps/api/prisma/schema.prisma`:

```prisma
// ── CHART OF ACCOUNTS ────────────────────
model Account {
  id            String          @id @default(uuid()) @db.Uuid
  code          String          @unique @db.VarChar(10)   // e.g. "1010"
  name          String          @db.VarChar(100)          // e.g. "Cash & Bank"
  accountType   AccountType     @map("account_type")
  normalBalance NormalBalance   @map("normal_balance")
  parentCode    String?         @map("parent_code") @db.VarChar(10)
  description   String?         @db.Text
  isActive      Boolean         @default(true) @map("is_active")
  isSystem      Boolean         @default(false) @map("is_system")  // system accounts cannot be deleted
  createdAt     DateTime        @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt     DateTime        @updatedAt @map("updated_at") @db.Timestamptz(6)

  journalLines  JournalLine[]

  @@index([accountType])
  @@map("accounts")
}

enum AccountType {
  asset
  liability
  equity
  revenue
  expense
}

enum NormalBalance {
  debit
  credit
}

// ── JOURNAL ENTRIES ──────────────────────
// Immutable — never update or delete rows.
// To reverse: post a new entry with opposite signs.
model JournalEntry {
  id            String              @id @default(uuid()) @db.Uuid
  entryNumber   String              @unique @map("entry_number") @db.VarChar(20)  // e.g. "JE-2026-000001"
  entryDate     DateTime            @map("entry_date") @db.Date
  description   String              @db.VarChar(300)
  reference     String?             @db.VarChar(100)   // e.g. invoice number, flock ID
  sourceType    JournalSourceType   @map("source_type")
  sourceId      String?             @map("source_id") @db.Uuid  // FK to source record
  periodLabel   String?             @map("period_label") @db.VarChar(20)
  isReversing   Boolean             @default(false) @map("is_reversing")
  reversesId    String?             @map("reverses_id") @db.Uuid  // points to the entry being reversed
  postedBy      String?             @map("posted_by") @db.Uuid
  postedAt      DateTime            @default(now()) @map("posted_at") @db.Timestamptz(6)
  createdAt     DateTime            @default(now()) @map("created_at") @db.Timestamptz(6)

  lines         JournalLine[]
  reversedBy    JournalEntry?       @relation("ReversalOf", fields: [reversesId], references: [id])
  reversals     JournalEntry[]      @relation("ReversalOf")

  @@index([entryDate, periodLabel])
  @@index([sourceType, sourceId])
  @@map("journal_entries")
}

enum JournalSourceType {
  manual              // hand-entered by user
  feed_record         // auto-posted from FeedRecord
  vaccination_event   // auto-posted from VaccinationEvent
  mortality_event     // auto-posted from MortalityEvent
  water_record        // auto-posted from WaterRecord
  batch_expense       // auto-posted from BatchExpense
  overhead_cost       // auto-posted from OverheadCost
  sales               // bird sale
  migration           // one-time migration from single-entry system
  period_close        // year-end closing entries
}

// ── JOURNAL LINES ────────────────────────
// Each JournalEntry has 2+ JournalLines.
// Total debits must equal total credits within an entry.
model JournalLine {
  id            String       @id @default(uuid()) @db.Uuid
  journalId     String       @map("journal_id") @db.Uuid
  accountId     String       @map("account_id") @db.Uuid
  debitZmw      Decimal?     @map("debit_zmw") @db.Decimal(14, 2)
  creditZmw     Decimal?     @map("credit_zmw") @db.Decimal(14, 2)
  description   String?      @db.VarChar(200)
  flockId       String?      @map("flock_id") @db.Uuid    // optional dimension for reporting
  batchId       String?      @map("batch_id") @db.Uuid

  journal       JournalEntry @relation(fields: [journalId], references: [id])
  account       Account      @relation(fields: [accountId], references: [id])

  @@index([journalId])
  @@index([accountId])
  @@map("journal_lines")
}

// ── LEDGER BALANCES (MATERIALIZED) ───────
// Pre-computed running balances per account per period.
// Rebuilt automatically on period close. Used for fast reporting.
model LedgerBalance {
  id            String   @id @default(uuid()) @db.Uuid
  accountId     String   @map("account_id") @db.Uuid
  periodLabel   String   @map("period_label") @db.VarChar(20)  // "2026-06"
  openingDebit  Decimal  @default(0) @map("opening_debit") @db.Decimal(14, 2)
  openingCredit Decimal  @default(0) @map("opening_credit") @db.Decimal(14, 2)
  periodDebit   Decimal  @default(0) @map("period_debit") @db.Decimal(14, 2)
  periodCredit  Decimal  @default(0) @map("period_credit") @db.Decimal(14, 2)
  closingDebit  Decimal  @default(0) @map("closing_debit") @db.Decimal(14, 2)
  closingCredit Decimal  @default(0) @map("closing_credit") @db.Decimal(14, 2)
  computedAt    DateTime @default(now()) @map("computed_at") @db.Timestamptz(6)

  @@unique([accountId, periodLabel])
  @@map("ledger_balances")
}
```

Apply with `prisma db push`.

### 5.2 Chart of Accounts Seed

**File:** `apps/api/src/db/seeds/chart-of-accounts.ts`

```typescript
// Seed the standard broiler farming chart of accounts.
// Run ONCE on a fresh ledger or when resetting accounts.
// This is idempotent — uses upsert on `code`.

const accounts = [
  // ASSETS
  { code: '1000', name: 'ASSETS', accountType: 'asset', normalBalance: 'debit', isSystem: true },
  { code: '1010', name: 'Cash & Bank', accountType: 'asset', normalBalance: 'debit', parentCode: '1000', isSystem: true },
  { code: '1020', name: 'Accounts Receivable', accountType: 'asset', normalBalance: 'debit', parentCode: '1000' },
  { code: '1030', name: 'Live Inventory — Chicks', accountType: 'asset', normalBalance: 'debit', parentCode: '1000' },
  { code: '1040', name: 'Live Inventory — Growers', accountType: 'asset', normalBalance: 'debit', parentCode: '1000' },
  { code: '1050', name: 'Feed Inventory', accountType: 'asset', normalBalance: 'debit', parentCode: '1000' },
  { code: '1060', name: 'Medication & Vaccine Inventory', accountType: 'asset', normalBalance: 'debit', parentCode: '1000' },
  { code: '1080', name: 'Equipment (at cost)', accountType: 'asset', normalBalance: 'debit', parentCode: '1000' },
  { code: '1081', name: 'Accumulated Depreciation — Equipment', accountType: 'asset', normalBalance: 'credit', parentCode: '1080' },

  // LIABILITIES
  { code: '2000', name: 'LIABILITIES', accountType: 'liability', normalBalance: 'credit', isSystem: true },
  { code: '2010', name: 'Accounts Payable', accountType: 'liability', normalBalance: 'credit', parentCode: '2000' },
  { code: '2020', name: 'Accrued Expenses', accountType: 'liability', normalBalance: 'credit', parentCode: '2000' },
  { code: '2030', name: 'Deferred Revenue', accountType: 'liability', normalBalance: 'credit', parentCode: '2000' },

  // EQUITY
  { code: '3000', name: 'EQUITY', accountType: 'equity', normalBalance: 'credit', isSystem: true },
  { code: '3010', name: "Owner's Capital", accountType: 'equity', normalBalance: 'credit', parentCode: '3000', isSystem: true },
  { code: '3020', name: 'Retained Earnings', accountType: 'equity', normalBalance: 'credit', parentCode: '3000', isSystem: true },
  { code: '3030', name: 'Current Year Earnings', accountType: 'equity', normalBalance: 'credit', parentCode: '3000', isSystem: true },

  // REVENUE
  { code: '4000', name: 'REVENUE', accountType: 'revenue', normalBalance: 'credit', isSystem: true },
  { code: '4010', name: 'Bird Sales Revenue', accountType: 'revenue', normalBalance: 'credit', parentCode: '4000' },
  { code: '4020', name: 'By-product Sales', accountType: 'revenue', normalBalance: 'credit', parentCode: '4000' },
  { code: '4030', name: 'Other Income', accountType: 'revenue', normalBalance: 'credit', parentCode: '4000' },

  // COGS
  { code: '5000', name: 'COST OF GOODS SOLD', accountType: 'expense', normalBalance: 'debit', isSystem: true },
  { code: '5010', name: 'Chick Purchase Cost', accountType: 'expense', normalBalance: 'debit', parentCode: '5000' },
  { code: '5020', name: 'Feed Cost', accountType: 'expense', normalBalance: 'debit', parentCode: '5000' },
  { code: '5030', name: 'Vaccine Cost', accountType: 'expense', normalBalance: 'debit', parentCode: '5000' },
  { code: '5040', name: 'Medication Cost', accountType: 'expense', normalBalance: 'debit', parentCode: '5000' },
  { code: '5050', name: 'Mortality Loss', accountType: 'expense', normalBalance: 'debit', parentCode: '5000' },

  // OPERATING EXPENSES
  { code: '6000', name: 'OPERATING EXPENSES', accountType: 'expense', normalBalance: 'debit', isSystem: true },
  { code: '6010', name: 'Labour / Wages', accountType: 'expense', normalBalance: 'debit', parentCode: '6000' },
  { code: '6020', name: 'Electricity', accountType: 'expense', normalBalance: 'debit', parentCode: '6000' },
  { code: '6030', name: 'Water', accountType: 'expense', normalBalance: 'debit', parentCode: '6000' },
  { code: '6040', name: 'Transport to Market', accountType: 'expense', normalBalance: 'debit', parentCode: '6000' },
  { code: '6050', name: 'Litter & Bedding', accountType: 'expense', normalBalance: 'debit', parentCode: '6000' },
  { code: '6060', name: 'Equipment Maintenance', accountType: 'expense', normalBalance: 'debit', parentCode: '6000' },
  { code: '6070', name: 'Insurance', accountType: 'expense', normalBalance: 'debit', parentCode: '6000' },
  { code: '6080', name: 'Other Overhead', accountType: 'expense', normalBalance: 'debit', parentCode: '6000' },
];

for (const acc of accounts) {
  await prisma.account.upsert({
    where: { code: acc.code },
    update: { name: acc.name },
    create: acc,
  });
}
```

### 5.3 Journal Engine

**File:** `apps/api/src/core/double-entry/journal.engine.ts`

This is the core of the double-entry system. It enforces the fundamental rule that debits must equal credits before any entry is written to the database.

```typescript
import Decimal from 'decimal.js';
import { PrismaClient } from '@prisma/client';

export interface JournalLineInput {
  accountCode: string;
  debitZmw?: number;
  creditZmw?: number;
  description?: string;
  flockId?: string;
  batchId?: string;
}

export interface JournalEntryInput {
  entryDate: Date;
  description: string;
  reference?: string;
  sourceType: string;
  sourceId?: string;
  lines: JournalLineInput[];
  isReversing?: boolean;
  reversesId?: string;
  postedBy?: string;
}

export class JournalEngine {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Post a journal entry.
   *
   * Validates:
   *  1. At least 2 lines
   *  2. Each line has exactly one of debitZmw or creditZmw (not both, not neither)
   *  3. Sum of debits === sum of credits (to 2 decimal places)
   *  4. All account codes exist and are active
   *
   * If any validation fails, throws an Error with a descriptive message.
   * The entry is written in a single Prisma transaction so it's atomic.
   */
  async post(input: JournalEntryInput): Promise<string> {
    if (input.lines.length < 2) {
      throw new Error('JOURNAL_REQUIRES_AT_LEAST_2_LINES');
    }

    // Resolve account IDs and validate
    const accounts = await this.prisma.account.findMany({
      where: {
        code: { in: input.lines.map((l) => l.accountCode) },
        isActive: true,
      },
    });

    const accountMap = new Map(accounts.map((a) => [a.code, a]));
    for (const line of input.lines) {
      if (!accountMap.has(line.accountCode)) {
        throw new Error(`ACCOUNT_NOT_FOUND: ${line.accountCode}`);
      }
      const hasDebit = line.debitZmw !== undefined && line.debitZmw > 0;
      const hasCredit = line.creditZmw !== undefined && line.creditZmw > 0;
      if (hasDebit === hasCredit) {
        throw new Error(`LINE_MUST_HAVE_EXACTLY_ONE_OF_DEBIT_OR_CREDIT: ${line.accountCode}`);
      }
    }

    // Enforce debit = credit
    const totalDebit = input.lines.reduce(
      (sum, l) => sum.plus(l.debitZmw ?? 0),
      new Decimal(0),
    );
    const totalCredit = input.lines.reduce(
      (sum, l) => sum.plus(l.creditZmw ?? 0),
      new Decimal(0),
    );

    if (!totalDebit.eq(totalCredit)) {
      throw new Error(
        `JOURNAL_OUT_OF_BALANCE: debits=${totalDebit.toFixed(2)}, credits=${totalCredit.toFixed(2)}`,
      );
    }

    // Generate sequential entry number
    const count = await this.prisma.journalEntry.count();
    const entryNumber = `JE-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;

    // Write atomically
    const entry = await this.prisma.$transaction(async (tx) => {
      const je = await tx.journalEntry.create({
        data: {
          entryNumber,
          entryDate: input.entryDate,
          description: input.description,
          reference: input.reference,
          sourceType: input.sourceType as any,
          sourceId: input.sourceId,
          isReversing: input.isReversing ?? false,
          reversesId: input.reversesId,
          postedBy: input.postedBy,
        },
      });

      for (const line of input.lines) {
        const account = accountMap.get(line.accountCode)!;
        await tx.journalLine.create({
          data: {
            journalId: je.id,
            accountId: account.id,
            debitZmw: line.debitZmw ? new Decimal(line.debitZmw) : null,
            creditZmw: line.creditZmw ? new Decimal(line.creditZmw) : null,
            description: line.description,
            flockId: line.flockId,
            batchId: line.batchId,
          },
        });
      }

      return je;
    });

    return entry.id;
  }

  /**
   * Post a reversing entry for a prior journal entry.
   * Swaps debits and credits of all lines from the original entry.
   */
  async reverse(journalId: string, postedBy?: string, reason?: string): Promise<string> {
    const original = await this.prisma.journalEntry.findUnique({
      where: { id: journalId },
      include: { lines: { include: { account: true } } },
    });

    if (!original) throw new Error(`JOURNAL_ENTRY_NOT_FOUND: ${journalId}`);

    const reversalLines: JournalLineInput[] = original.lines.map((l) => ({
      accountCode: l.account.code,
      debitZmw: l.creditZmw ? Number(l.creditZmw) : undefined,
      creditZmw: l.debitZmw ? Number(l.debitZmw) : undefined,
      description: `Reversal: ${l.description ?? ''}`,
      flockId: l.flockId ?? undefined,
      batchId: l.batchId ?? undefined,
    }));

    return this.post({
      entryDate: new Date(),
      description: `REVERSAL of ${original.entryNumber} — ${reason ?? 'Correction'}`,
      reference: original.reference ?? undefined,
      sourceType: original.sourceType,
      sourceId: original.sourceId ?? undefined,
      lines: reversalLines,
      isReversing: true,
      reversesId: journalId,
      postedBy,
    });
  }
}
```

### 5.4 Auto-Posting: Mapping FinancialCategory → Journal Lines

**File:** `apps/api/src/core/double-entry/auto-post.service.ts`

When an operational record is created (feed, vaccination, etc.), the `AutoPostService` reads it and calls `JournalEngine.post()` with the correct double-entry lines. This runs **after** the existing `FinancialRecord` is created (so both systems are populated simultaneously during the migration phase).

```typescript
// Mapping table: FinancialCategory → [Debit account code, Credit account code]
const CATEGORY_ACCOUNT_MAP: Record<string, { debit: string; credit: string }> = {
  chick_purchase: { debit: '1030', credit: '2010' },   // DR Live Inventory — Chicks / CR Accounts Payable
  feed:           { debit: '5020', credit: '2010' },   // DR Feed Cost / CR Accounts Payable
  vaccines:       { debit: '5030', credit: '2010' },   // DR Vaccine Cost / CR Accounts Payable
  medication:     { debit: '5040', credit: '2010' },   // DR Medication Cost / CR Accounts Payable
  labor:          { debit: '6010', credit: '2020' },   // DR Labour / CR Accrued Expenses
  utilities:      { debit: '6020', credit: '2020' },   // DR Electricity / CR Accrued Expenses
  equipment:      { debit: '1080', credit: '1010' },   // DR Equipment / CR Cash
  sales:          { debit: '1010', credit: '4010' },   // DR Cash / CR Bird Sales Revenue
  other:          { debit: '6080', credit: '2020' },   // DR Other Overhead / CR Accrued Expenses
};

// For mortality events: DR Mortality Loss (5050), CR Live Inventory — Growers (1040)
const MORTALITY_ENTRY = { debit: '5050', credit: '1040' };

export class AutoPostService {
  constructor(
    private readonly journalEngine: JournalEngine,
    private readonly prisma: PrismaClient,
  ) {}

  async postFromFinancialRecord(recordId: string, postedBy?: string): Promise<void> {
    const record = await this.prisma.financialRecord.findUnique({ where: { id: recordId } });
    if (!record) throw new Error(`FinancialRecord not found: ${recordId}`);

    const mapping = record.category === 'other' && record.description?.toLowerCase().includes('mortality')
      ? MORTALITY_ENTRY
      : CATEGORY_ACCOUNT_MAP[record.category];

    if (!mapping) {
      console.warn(`[AutoPost] No account mapping for category: ${record.category}`);
      return;
    }

    const amount = Number(record.amountZmw);
    if (amount <= 0) return;

    // For income records: flip debit/credit
    const lines: JournalLineInput[] = record.isIncome
      ? [
          { accountCode: mapping.credit, debitZmw: amount, description: record.description },
          { accountCode: mapping.debit,  creditZmw: amount, description: record.description },
        ]
      : [
          { accountCode: mapping.debit,  debitZmw: amount, description: record.description, flockId: record.flockId },
          { accountCode: mapping.credit, creditZmw: amount, description: record.description },
        ];

    await this.journalEngine.post({
      entryDate: record.recordDate,
      description: record.description,
      reference: record.id,
      sourceType: 'feed_record',   // adjusted per source type in practice
      sourceId: record.sourceRecordId ?? record.id,
      lines,
      postedBy,
    });
  }
}
```

### 5.5 Unit Tests for Journal Engine

**File:** `apps/api/tests/unit/journal-engine.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JournalEngine } from '../../src/core/double-entry/journal.engine.js';

describe('JournalEngine', () => {
  let engine: JournalEngine;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      account: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'acc-1', code: '5020', isActive: true },
          { id: 'acc-2', code: '2010', isActive: true },
        ]),
      },
      journalEntry: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: 'je-1', entryNumber: 'JE-2026-000001' }),
        findUnique: vi.fn(),
      },
      journalLine: { create: vi.fn() },
      $transaction: vi.fn().mockImplementation((fn) => fn(mockPrisma)),
    };
    engine = new JournalEngine(mockPrisma as any);
  });

  it('accepts a balanced entry', async () => {
    const id = await engine.post({
      entryDate: new Date('2026-01-15'),
      description: 'Feed purchase',
      sourceType: 'feed_record',
      lines: [
        { accountCode: '5020', debitZmw: 500.00 },
        { accountCode: '2010', creditZmw: 500.00 },
      ],
    });
    expect(id).toBe('je-1');
  });

  it('rejects an out-of-balance entry', async () => {
    await expect(engine.post({
      entryDate: new Date(),
      description: 'Bad entry',
      sourceType: 'manual',
      lines: [
        { accountCode: '5020', debitZmw: 500.00 },
        { accountCode: '2010', creditZmw: 400.00 },  // ≠ 500
      ],
    })).rejects.toThrow('JOURNAL_OUT_OF_BALANCE');
  });

  it('rejects entry with fewer than 2 lines', async () => {
    await expect(engine.post({
      entryDate: new Date(),
      description: 'Single line',
      sourceType: 'manual',
      lines: [{ accountCode: '5020', debitZmw: 100 }],
    })).rejects.toThrow('JOURNAL_REQUIRES_AT_LEAST_2_LINES');
  });

  it('rejects a line with both debit and credit', async () => {
    await expect(engine.post({
      entryDate: new Date(),
      description: 'Invalid line',
      sourceType: 'manual',
      lines: [
        { accountCode: '5020', debitZmw: 100, creditZmw: 100 },
        { accountCode: '2010', creditZmw: 100 },
      ],
    })).rejects.toThrow('LINE_MUST_HAVE_EXACTLY_ONE_OF_DEBIT_OR_CREDIT');
  });

  it('rejects unknown account codes', async () => {
    mockPrisma.account.findMany.mockResolvedValue([]);  // no accounts found
    await expect(engine.post({
      entryDate: new Date(),
      description: 'Unknown account',
      sourceType: 'manual',
      lines: [
        { accountCode: '9999', debitZmw: 100 },
        { accountCode: '2010', creditZmw: 100 },
      ],
    })).rejects.toThrow('ACCOUNT_NOT_FOUND');
  });

  it('handles multi-line compound entries correctly', async () => {
    mockPrisma.account.findMany.mockResolvedValue([
      { id: 'a1', code: '5020', isActive: true },
      { id: 'a2', code: '5030', isActive: true },
      { id: 'a3', code: '2010', isActive: true },
    ]);
    // DR Feed 300 + DR Vaccine 200 = CR AP 500
    const id = await engine.post({
      entryDate: new Date(),
      description: 'Combined purchase',
      sourceType: 'manual',
      lines: [
        { accountCode: '5020', debitZmw: 300.00 },
        { accountCode: '5030', debitZmw: 200.00 },
        { accountCode: '2010', creditZmw: 500.00 },
      ],
    });
    expect(id).toBe('je-1');
  });
});
```

### 5.6 Milestone A Checklist

- [ ] Add `Account`, `JournalEntry`, `JournalLine`, `LedgerBalance` to Prisma schema
- [ ] Run `prisma db push`
- [ ] Create and run `chart-of-accounts.ts` seed (idempotent upsert)
- [ ] Implement `JournalEngine` with `post()` and `reverse()`
- [ ] Implement `AutoPostService` with `CATEGORY_ACCOUNT_MAP`
- [ ] Write unit tests for `JournalEngine` (target: 10+ tests covering all validation paths)
- [ ] All existing tests from v0.8.0 still pass

### 5.7 Milestone A Close-Out

| Parameter | Value |
|-----------|-------|
| **Version tag** | `v0.9.0-alpha` |
| **Commit title** | `feat(ledger): Milestone A — Chart of Accounts, Journal Engine & Auto-Post Service` |
| **Next milestone** | Milestone B — Single-Entry → Double-Entry Migration |

**Minimum passing test bar:**
- `pnpm run test:unit` — 10+ new journal engine tests green; all prior tests green
- `pnpm run test:integration` — no regressions
- Manual: `POST /api/v1/journal` with balanced entry → journal entry created; with unbalanced → 400 error

**Release notes:**
```
## What's in v0.9.0-alpha

### New: Double-Entry Foundation
- `accounts`, `journal_entries`, `journal_lines`, `ledger_balances` Prisma tables
- Standard 36-account chart of accounts seeded (1xxx Assets, 2xxx Liabilities, 3xxx Equity,
  4xxx Revenue, 5xxx COGS, 6xxx OpEx)
- `JournalEngine`: atomic posting, balance validation, reversing entries
- `AutoPostService`: maps existing FinancialCategory values to correct debit/credit account pairs
- 10+ unit tests for all engine validation paths

### Breaking Changes
None — new tables only; no existing endpoints modified.

### Next: Milestone B — Migration from Single-Entry
```

---

## 6. Milestone B — Migration: Single-Entry → Double-Entry

**Estimated effort:** 1.5 weeks  
**Version tag:** `v0.9.1-alpha`  
**Files created:** `src/db/seeds/migrate-to-double-entry.ts`

### 6.1 Migration Strategy

The migration converts every existing `FinancialRecord` row into a corresponding `JournalEntry` + 2 `JournalLine` rows. It is:

- **Non-destructive** — `FinancialRecord` rows are not deleted
- **Idempotent** — tracks progress via `sourceId` on `JournalEntry`; re-running skips already-migrated records
- **Batched** — processes records in batches of 100 to avoid memory issues
- **Auditable** — all migrated entries have `sourceType: 'migration'` for easy identification

### 6.2 Migration Script

**File:** `apps/api/src/db/seeds/migrate-to-double-entry.ts`

```typescript
// Run inside container: docker compose exec api tsx src/db/seeds/migrate-to-double-entry.ts

import { PrismaClient } from '@prisma/client';
import { JournalEngine } from '../core/double-entry/journal.engine.js';
import { AutoPostService } from '../core/double-entry/auto-post.service.js';

const prisma = new PrismaClient();
const engine = new JournalEngine(prisma);
const autoPost = new AutoPostService(engine, prisma);

const BATCH_SIZE = 100;
let migrated = 0;
let skipped = 0;
let errors = 0;

console.log('[Migration] Starting single-entry → double-entry migration...');

let cursor: string | undefined;

while (true) {
  const records = await prisma.financialRecord.findMany({
    take: BATCH_SIZE,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { createdAt: 'asc' },
  });

  if (records.length === 0) break;
  cursor = records[records.length - 1].id;

  for (const record of records) {
    // Skip if already migrated (journal entry with this sourceId exists)
    const existing = await prisma.journalEntry.findFirst({
      where: { sourceId: record.id, sourceType: 'migration' },
    });
    if (existing) { skipped++; continue; }

    try {
      await autoPost.postFromFinancialRecord(record.id);
      migrated++;
    } catch (err: any) {
      console.error(`[Migration] FAILED record ${record.id}: ${err.message}`);
      errors++;
    }
  }

  console.log(`[Migration] Progress: migrated=${migrated}, skipped=${skipped}, errors=${errors}`);
}

// Also migrate BatchExpense and OverheadCost rows
// (similar loop — see full implementation)

console.log(`[Migration] Complete. migrated=${migrated}, skipped=${skipped}, errors=${errors}`);
await prisma.$disconnect();
```

### 6.3 Verification Queries

After migration, run these queries to verify correctness:

```sql
-- 1. Every journal entry must be balanced
SELECT je.id, je.entry_number,
       SUM(jl.debit_zmw)  AS total_debit,
       SUM(jl.credit_zmw) AS total_credit,
       (SUM(jl.debit_zmw) - SUM(jl.credit_zmw)) AS imbalance
FROM journal_entries je
JOIN journal_lines jl ON jl.journal_id = je.id
GROUP BY je.id, je.entry_number
HAVING ABS(SUM(jl.debit_zmw) - SUM(jl.credit_zmw)) > 0.01;
-- Expected: 0 rows

-- 2. Total migrated count matches FinancialRecord count
SELECT
  (SELECT COUNT(*) FROM financial_records) AS source_count,
  (SELECT COUNT(*) FROM journal_entries WHERE source_type = 'migration') AS migrated_count;
-- Expected: migrated_count = source_count (minus any records with no account mapping)

-- 3. Total debits = total credits across all lines
SELECT
  SUM(debit_zmw)  AS grand_debit,
  SUM(credit_zmw) AS grand_credit,
  SUM(debit_zmw) - SUM(credit_zmw) AS net
FROM journal_lines;
-- Expected: net = 0.00
```

### 6.4 Milestone B Checklist

- [ ] Implement `migrate-to-double-entry.ts` (idempotent, batched)
- [ ] Run migration in development environment
- [ ] Run verification SQL queries — confirm 0 imbalanced entries
- [ ] Confirm total debit = total credit across all journal lines
- [ ] Document any `FinancialRecord` categories that could not be migrated (errors log)
- [ ] All existing tests still pass

### 6.5 Milestone B Close-Out

| Parameter | Value |
|-----------|-------|
| **Version tag** | `v0.9.1-alpha` |
| **Commit title** | `feat(ledger): Milestone B — Historical data migrated to double-entry journal` |
| **Next milestone** | Milestone C — Ledger & Trial Balance API |

**Minimum passing test bar:** All prior tests green; migration verification SQL returns 0 imbalanced entries.

---

## 7. Milestone C — Ledger & Trial Balance API

**Estimated effort:** 1.5 weeks  
**Version tag:** `v0.9.2-alpha`  
**Files created:** `src/core/double-entry/ledger.service.ts`, `src/modules/ledger/routes.ts`, `src/modules/journal/routes.ts`, `src/modules/accounts/routes.ts`

### 7.1 Ledger Service

**File:** `apps/api/src/core/double-entry/ledger.service.ts`

```typescript
export interface AccountLedger {
  account: { code: string; name: string; accountType: string; normalBalance: string };
  periodLabel: string;
  openingBalance: string;    // positive = debit for debit-normal accounts
  entries: LedgerEntry[];
  closingBalance: string;
  totalDebits: string;
  totalCredits: string;
}

export interface LedgerEntry {
  date: Date;
  journalNumber: string;
  description: string;
  debitZmw: string | null;
  creditZmw: string | null;
  runningBalance: string;
}

export interface TrialBalance {
  asOfDate: Date;
  generatedAt: string;
  lines: TrialBalanceLine[];
  totalDebits: string;
  totalCredits: string;
  isBalanced: boolean;   // totalDebits === totalCredits
}

export interface TrialBalanceLine {
  accountCode: string;
  accountName: string;
  accountType: string;
  debitBalance: string;  // account balance in debit column (or '0.00')
  creditBalance: string; // account balance in credit column (or '0.00')
}
```

**Trial balance computation:**

```typescript
async generateTrialBalance(asOfDate: Date): Promise<TrialBalance> {
  // Aggregate all journal lines up to asOfDate, grouped by account
  const rows = await this.prisma.journalLine.groupBy({
    by: ['accountId'],
    where: {
      journal: { entryDate: { lte: asOfDate } },
    },
    _sum: { debitZmw: true, creditZmw: true },
  });

  const accounts = await this.prisma.account.findMany({
    where: { id: { in: rows.map((r) => r.accountId) }, isActive: true },
  });

  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  let totalDebits = new Decimal(0);
  let totalCredits = new Decimal(0);
  const lines: TrialBalanceLine[] = [];

  for (const row of rows) {
    const account = accountMap.get(row.accountId);
    if (!account) continue;

    const debitSum = new Decimal(row._sum.debitZmw?.toString() ?? '0');
    const creditSum = new Decimal(row._sum.creditZmw?.toString() ?? '0');
    const netBalance = debitSum.minus(creditSum);

    // Place net balance in correct column based on normal balance
    const isDebitNormal = account.normalBalance === 'debit';
    const debitBalance = isDebitNormal && netBalance.gt(0) ? netBalance : new Decimal(0);
    const creditBalance = !isDebitNormal && netBalance.lt(0) ? netBalance.abs() : new Decimal(0);

    totalDebits = totalDebits.plus(debitBalance);
    totalCredits = totalCredits.plus(creditBalance);

    lines.push({
      accountCode: account.code,
      accountName: account.name,
      accountType: account.accountType,
      debitBalance: debitBalance.toFixed(2),
      creditBalance: creditBalance.toFixed(2),
    });
  }

  lines.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  return {
    asOfDate,
    generatedAt: new Date().toISOString(),
    lines,
    totalDebits: totalDebits.toFixed(2),
    totalCredits: totalCredits.toFixed(2),
    isBalanced: totalDebits.eq(totalCredits),
  };
}
```

### 7.2 New API Modules

**`/api/v1/accounts`** — Chart of accounts CRUD (owner can create/deactivate custom accounts; system accounts cannot be deleted):

```
GET    /api/v1/accounts              — full chart of accounts (hierarchical)
GET    /api/v1/accounts/:code        — single account + recent journal lines
POST   /api/v1/accounts              — create custom account (owner/manager)
PATCH  /api/v1/accounts/:code        — update name/description (cannot change type of system accounts)
DELETE /api/v1/accounts/:code        — deactivate (cannot delete if has journal lines or isSystem=true)
```

**`/api/v1/journal`** — Journal entry management:

```
GET    /api/v1/journal               — list entries (filter by date, sourceType, accountCode)
GET    /api/v1/journal/:id           — single entry with all lines
POST   /api/v1/journal               — post manual entry (owner/manager)
POST   /api/v1/journal/:id/reverse   — post reversing entry (owner only)
```

**`/api/v1/ledger`** — Ledger and reporting:

```
GET    /api/v1/ledger/trial-balance  — trial balance as of date
GET    /api/v1/ledger/account/:code  — general ledger for one account (date range)
GET    /api/v1/ledger/export/trial-balance?format=pdf|excel|csv
POST   /api/v1/ledger/period-close   — materialise LedgerBalance rows and close period
```

### 7.3 Milestone C Checklist

- [ ] Implement `LedgerService` (account ledger + trial balance)
- [ ] Create `accounts` module with 5 endpoints
- [ ] Create `journal` module with 4 endpoints
- [ ] Create `ledger` module with 4 endpoints (including trial balance export)
- [ ] Register all 3 modules in `main.ts`
- [ ] Integration test: trial balance `isBalanced === true` on clean seeded data
- [ ] Integration test: posting a manual journal entry and retrieving it via GET
- [ ] Integration test: reversing an entry creates a new entry with swapped debits/credits
- [ ] Export: trial balance PDF/Excel/CSV downloads correctly

### 7.4 Milestone C Close-Out

| Parameter | Value |
|-----------|-------|
| **Version tag** | `v0.9.2-alpha` |
| **Commit title** | `feat(ledger): Milestone C — Ledger Service, Trial Balance & Journal API` |
| **Next milestone** | Milestone D — GAAP-Compliant Financial Statements |

**Minimum passing test bar:** Trial balance `isBalanced === true`; all journal CRUD endpoints working; 3 new modules registered; all prior tests green.

---

## 8. Milestone D — GAAP-Compliant Financial Statements

**Estimated effort:** 1.5 weeks  
**Version tag:** `v0.9.3-alpha`

### 8.1 How Double-Entry Statements Differ from v0.8.0

In v0.8.0, statements were computed by summing `FinancialRecord.amountZmw` rows grouped by category. In the double-entry system, statements are computed from **account balances in the general ledger**. This is the fundamental difference: the source of truth is the chart of accounts, not the operational records.

| Statement | v0.8.0 approach | Double-entry approach |
|-----------|----------------|----------------------|
| Income Statement | SUM(amountZmw) grouped by FinancialCategory | SUM of account balances in 4xxx (Revenue) and 5xxx/6xxx (Expense) |
| Balance Sheet | Approximated from cost totals | Exact account balances for 1xxx, 2xxx, 3xxx |
| Cash Flow | Derived from net profit + adjustments | Derived from changes in account balances (indirect method) |
| Trial Balance | Not available | New — full debit/credit balance for every account |

### 8.2 GAAP Statement Derivation

#### Income Statement from Ledger

```typescript
// Revenue = sum of all credit balances in accounts 4xxx
// COGS = sum of all debit balances in accounts 5xxx
// Gross Profit = Revenue − COGS
// Operating Expenses = sum of all debit balances in accounts 6xxx
// Operating Profit (EBIT) = Gross Profit − Operating Expenses
// Net Profit = Operating Profit (no interest/tax for now)
```

#### Balance Sheet from Ledger

```typescript
// Total Assets = sum of all debit balances in accounts 1xxx (net of contra-accounts like 1081)
// Total Liabilities = sum of all credit balances in accounts 2xxx
// Equity = 3010 (Owner's Capital) + 3020 (Retained Earnings) + Current Period Net Income
// CHECK: Total Assets === Total Liabilities + Total Equity
```

#### Year-End Closing Entries

At financial year-end, revenue and expense accounts are closed to `3030 Current Year Earnings`, which is then transferred to `3020 Retained Earnings`:

```typescript
async yearEndClose(year: number, postedBy?: string): Promise<void> {
  // 1. Calculate net income from 4xxx and 5xxx/6xxx balances
  // 2. Post closing entries:
  //    DR all revenue accounts (4xxx) / CR Income Summary (temporary)
  //    DR Income Summary / CR all expense accounts (5xxx, 6xxx)
  //    DR/CR Current Year Earnings (3030) for net income
  //    DR Current Year Earnings (3030) / CR Retained Earnings (3020)
  // 3. All 4xxx, 5xxx, 6xxx accounts should now have zero balance
  // This marks the start of the new fiscal year
}
```

### 8.3 New Endpoints

Add to the `/api/v1/ledger` module:

```
GET /api/v1/ledger/income-statement  — derives from account balances (replaces v0.8.0 version)
GET /api/v1/ledger/balance-sheet     — derives from account balances (replaces v0.8.0 version)
GET /api/v1/ledger/cash-flow         — derives from account balance changes
POST /api/v1/ledger/year-end-close   — post closing entries, reset income/expense accounts (owner only)
```

The existing `/api/v1/financial-engine/*` endpoints from v0.8.0 remain active as a fallback during this milestone.

### 8.4 Milestone D Checklist

- [ ] Implement `GaapStatementService` deriving all 3 statements from account balances
- [ ] Implement `ClosingService.yearEndClose()` with posting of closing journal entries
- [ ] Add 4 new ledger endpoints
- [ ] Integration test: income statement Revenue = sum of 4xxx credits
- [ ] Integration test: balance sheet equation holds (Assets = Liabilities + Equity)
- [ ] Integration test: year-end close zeroes out all income/expense accounts
- [ ] Update PDF/Excel/CSV export to use GAAP statement versions

### 8.5 Milestone D Close-Out

| Parameter | Value |
|-----------|-------|
| **Version tag** | `v0.9.3-alpha` |
| **Commit title** | `feat(ledger): Milestone D — GAAP-compliant statements from double-entry ledger` |
| **Next milestone** | Milestone E — Web Ledger Interface |

---

## 9. Milestone E — Web Ledger Interface

**Estimated effort:** 2 weeks  
**Version tag:** `v0.9.4-alpha`

### 9.1 New Pages

| Route | Description |
|-------|-------------|
| `/ledger` | Trial balance + accounting equation verification |
| `/ledger/accounts` | Chart of accounts (collapsible tree, 1xxx–6xxx) |
| `/ledger/accounts/:code` | General ledger for one account — date range, running balance |
| `/ledger/journal` | Journal entry list with search/filter |
| `/ledger/journal/new` | Post a manual journal entry (owner/manager) |
| `/ledger/journal/:id` | Single entry detail view with reverse button |
| `/ledger/close` | Year-end close wizard (owner only) |

### 9.2 Trial Balance Page (`/ledger`)

```tsx
// Summary at top:
// ✅ Trial Balance is Balanced  (or ❌ Out of Balance — total difference)
// As of: [date picker]

// Two-column table:
// | Code | Account Name         | Debit (ZMW) | Credit (ZMW) |
// |------|----------------------|-------------|--------------|
// | 1010 | Cash & Bank          | 12,500.00   |              |
// | 4010 | Bird Sales Revenue   |             |  35,000.00   |
// ...
// | TOTALS                      | 47,500.00   |  47,500.00   |  ← must match

// Export buttons: PDF | Excel | CSV
```

### 9.3 Chart of Accounts (`/ledger/accounts`)

```tsx
// Collapsible tree using @radix-ui/react-collapsible:
// ▼ 1000 ASSETS
//   ► 1010  Cash & Bank                ZMW 12,500.00
//   ► 1020  Accounts Receivable        ZMW  3,200.00
//   ► 1030  Live Inventory — Chicks    ZMW  8,400.00
//   ...
// ▼ 4000 REVENUE
//   ► 4010  Bird Sales Revenue         ZMW 35,000.00
// ...
// [+ Add Custom Account] button (owner/manager only)
```

### 9.4 Journal Entry Form (`/ledger/journal/new`)

```tsx
// Dynamic form — user can add/remove lines:
// Date: [date input]
// Description: [text input]
// Reference: [text input]
//
// Lines:
// | Account (search by code or name) | Debit (ZMW) | Credit (ZMW) |
// | 5020 Feed Cost                   |    500.00   |              |
// | 2010 Accounts Payable            |             |    500.00    |
// [+ Add Line]
//
// Balance indicator:
// Total Debits: ZMW 500.00  |  Total Credits: ZMW 500.00  ✅ Balanced
// (or ❌ Out of Balance — ZMW 100.00 difference if not balanced)
//
// [Post Entry] button — disabled when unbalanced
```

### 9.5 Milestone E Checklist

- [ ] Create `/ledger/page.tsx` (trial balance + balance indicator)
- [ ] Create `/ledger/accounts/page.tsx` (collapsible chart of accounts tree)
- [ ] Create `/ledger/accounts/[code]/page.tsx` (general ledger for one account)
- [ ] Create `/ledger/journal/page.tsx` (journal entry list with filters)
- [ ] Create `/ledger/journal/new/page.tsx` (dynamic multi-line journal entry form with live balance check)
- [ ] Create `/ledger/journal/[id]/page.tsx` (entry detail + reverse button)
- [ ] Create `/ledger/close/page.tsx` (year-end close wizard, owner only)
- [ ] Add `Ledger` to navbar (owner/manager only)
- [ ] All TypeScript type-checks pass

### 9.6 Milestone E Close-Out

| Parameter | Value |
|-----------|-------|
| **Version tag** | `v0.9.4-alpha` |
| **Commit title** | `feat(web): Milestone E — Web Ledger Interface (trial balance, CoA, journal entries)` |
| **Next milestone** | Milestone F — Flutter Ledger Screens |

---

## 10. Milestone F — Flutter Ledger Screens

**Estimated effort:** 1.5 weeks  
**Version tag:** `v0.9.5-alpha`

### 10.1 New Screens

| Screen | Description |
|--------|-------------|
| `TrialBalanceScreen` | Two-column debit/credit table; balance status chip |
| `ChartOfAccountsScreen` | Expandable account hierarchy with balances |
| `JournalListScreen` | Paginated journal entries with search |
| `JournalDetailScreen` | Single entry with lines, amounts, source type |

### 10.2 Ledger API Service (Dart)

**File:** `apps/mobile/lib/services/ledger_service.dart`

```dart
class LedgerService {
  static Future<Map<String, dynamic>> getTrialBalance({String? asOfDate}) async {
    final response = await ApiService.dio.get(
      '/v1/ledger/trial-balance',
      queryParameters: { if (asOfDate != null) 'asOfDate': asOfDate },
    );
    return response.data as Map<String, dynamic>;
  }

  static Future<List<dynamic>> getAccounts() async {
    final response = await ApiService.dio.get('/v1/accounts');
    return response.data as List<dynamic>;
  }

  static Future<Map<String, dynamic>> getAccountLedger(String code, {
    String? startDate, String? endDate,
  }) async {
    final response = await ApiService.dio.get(
      '/v1/ledger/account/$code',
      queryParameters: {
        if (startDate != null) 'startDate': startDate,
        if (endDate != null) 'endDate': endDate,
      },
    );
    return response.data as Map<String, dynamic>;
  }

  static Future<List<dynamic>> getJournalEntries({int page = 1}) async {
    final response = await ApiService.dio.get(
      '/v1/journal',
      queryParameters: { 'page': page, 'limit': 50 },
    );
    return response.data as List<dynamic>;
  }
}
```

### 10.3 Milestone F Checklist

- [ ] Create `LedgerService` Dart class
- [ ] Create `TrialBalanceScreen` with balance status chip (green = balanced, red = not)
- [ ] Create `ChartOfAccountsScreen` with `ExpansionTile` hierarchy
- [ ] Create `JournalListScreen` with pull-to-refresh and search
- [ ] Create `JournalDetailScreen`
- [ ] Register routes in `main.dart`
- [ ] Add Ledger to mobile navigation (owner/manager only — check role from auth)
- [ ] `flutter test` — all widget tests green
- [ ] `flutter build apk --release` — clean build

### 10.4 Milestone F Close-Out

| Parameter | Value |
|-----------|-------|
| **Version tag** | `v0.9.5-alpha` |
| **Commit title** | `feat(mobile): Milestone F — Flutter ledger screens (trial balance, CoA, journal entries)` |
| **Next milestone** | Milestone G — Hardening, Compliance Audit & v1.0.0 |

---

## 11. Milestone G — Hardening, Compliance Audit & v1.0.0 Release

**Estimated effort:** 2 weeks  
**Version tag:** `v1.0.0` — first stable release

### 11.1 Database-Level Immutability for Journal Entries

```sql
-- Prevent any UPDATE on journal_entries
CREATE RULE no_update_journal_entries AS
  ON UPDATE TO journal_entries
  DO INSTEAD NOTHING;

-- Prevent any DELETE on journal_entries
CREATE RULE no_delete_journal_entries AS
  ON DELETE TO journal_entries
  DO INSTEAD NOTHING;

-- Prevent any UPDATE or DELETE on journal_lines
CREATE RULE no_update_journal_lines AS ON UPDATE TO journal_lines DO INSTEAD NOTHING;
CREATE RULE no_delete_journal_lines AS ON DELETE TO journal_lines DO INSTEAD NOTHING;

-- CHECK: debit_zmw and credit_zmw cannot both be non-null on the same line
ALTER TABLE journal_lines ADD CONSTRAINT one_side_only
  CHECK (
    (debit_zmw IS NOT NULL AND credit_zmw IS NULL) OR
    (debit_zmw IS NULL AND credit_zmw IS NOT NULL)
  );

-- CHECK: no negative amounts
ALTER TABLE journal_lines ADD CONSTRAINT amounts_nonneg
  CHECK (
    (debit_zmw IS NULL OR debit_zmw >= 0) AND
    (credit_zmw IS NULL OR credit_zmw >= 0)
  );
```

### 11.2 Application-Level Guards

- `DELETE /api/v1/journal/:id` returns `405 Method Not Allowed` (route does not exist)
- `PATCH /api/v1/journal/:id` returns `405 Method Not Allowed` (route does not exist)
- Only `POST /api/v1/journal/:id/reverse` is the correction mechanism
- `isSystem: true` accounts cannot be deactivated or have their `accountType` changed

### 11.3 Test Coverage Targets

| Test file | Target |
|---|---|
| `tests/unit/journal-engine.test.ts` | 100% statement coverage |
| `tests/unit/ledger.service.test.ts` | 100% for trial balance computation |
| `tests/unit/gaap-statement.service.test.ts` | 100% for statement derivation |
| `tests/integration/journal.test.ts` | All CRUD + reversal paths |
| `tests/integration/ledger.test.ts` | Trial balance balanced; account ledger correct; year-end close |
| `tests/integration/migration.test.ts` | Migration idempotency; zero imbalanced entries |

### 11.4 GAAP/IFRS Compliance Final Review

Run through the [Section 14 — GAAP/IFRS Compliance Checklist](#14-gaapifrs-compliance-checklist) and confirm every item is satisfied before tagging v1.0.0.

### 11.5 Deprecation of v0.8.0 Single-Entry Statement Endpoints

Once double-entry statements are verified as identical (or more accurate) than their v0.8.0 equivalents, mark the old endpoints as deprecated:

```typescript
// In financial-engine/routes.ts — add deprecation header
app.get('/income-statement', ..., async (request, reply) => {
  reply.header('Deprecation', 'true');
  reply.header('Sunset', '2027-01-01');
  reply.header('Link', '</api/v1/ledger/income-statement>; rel="successor-version"');
  // ... existing handler
});
```

Remove deprecated endpoints in v1.1.0 (out of scope for this plan).

### 11.6 Milestone G Checklist

- [ ] Add PostgreSQL rules/triggers to enforce journal entry immutability
- [ ] Add CHECK constraints on `journal_lines`
- [ ] Add `405` guards to journal routes (no update/delete)
- [ ] Run full GAAP/IFRS compliance checklist (Section 14)
- [ ] Achieve test coverage targets from 11.3
- [ ] Add deprecation headers to v0.8.0 statement endpoints
- [ ] Performance: trial balance computation < 1s for 10,000+ journal lines
- [ ] Update `AGENTS.md` with all new module locations, seed commands, SQL rules
- [ ] Final documentation review

### 11.7 Milestone G Close-Out

| Parameter | Value |
|-----------|-------|
| **Version tag** | `v1.0.0` |
| **Commit title** | `release: v1.0.0 — Full double-entry bookkeeping, GAAP-aligned financial statements` |
| **Next milestone** | v1.1.0 (tax accounting, AP/AR aging, bank reconciliation — future plan) |

**Minimum passing test bar:**
- `pnpm run test` — 60+ tests, 100% pass
- `pnpm run typecheck` — zero errors (API + Web)
- `flutter test` — all widget tests green
- `flutter build apk --release` — clean build
- Trial balance `isBalanced === true` after migration verification query
- Balance sheet equation holds: `Assets = Liabilities + Equity`
- All DB immutability rules tested: attempt UPDATE on journal entry → silent no-op (rule) + 405 from API

**Release notes:**
```
## What's in v1.0.0 — PRODUCTION STABLE

### Double-Entry Bookkeeping (Full)
- 36-account chart of accounts (1xxx–6xxx) seeded and maintainable
- JournalEngine: atomic posting, debit=credit enforcement, reversing entries
- General ledger per account with running balances
- Trial balance with isBalanced verification
- Year-end closing entries (close 4xxx/5xxx/6xxx to retained earnings)
- Historical migration: all FinancialRecord data converted to journal entries

### GAAP-Compliant Financial Statements
- Income Statement, Balance Sheet, Cash Flow — all derived from account balances
- Balance sheet equation enforced: Assets = Liabilities + Equity
- Closing entries maintain clean fiscal year boundaries

### API
- /api/v1/accounts (5 endpoints) — chart of accounts CRUD
- /api/v1/journal (4 endpoints) — journal entry management
- /api/v1/ledger (6 endpoints) — trial balance, account ledger, statements, year-end close

### Web
- /ledger — trial balance with balance status
- /ledger/accounts — collapsible chart of accounts tree
- /ledger/journal — journal entry list + new entry form
- /ledger/close — year-end closing wizard

### Mobile
- TrialBalanceScreen, ChartOfAccountsScreen, JournalListScreen, JournalDetailScreen

### Security & Integrity
- Journal entries are immutable at DB level (PostgreSQL rules) and API level (no update/delete routes)
- All existing audit trail capabilities from v0.8.0 retained
- Test coverage ≥ 95% for all double-entry engine modules

### Deprecation Notice
- /api/v1/financial-engine/* endpoints are deprecated. Sunset: 2027-01-01.
  Use /api/v1/ledger/* equivalents.

### Breaking Changes
None — all v0.8.0 endpoints still available (with deprecation headers).
```

---

## 12. Milestone Close-Out Protocol

The same four-step protocol from the Financial System plan applies here. Repeat for every milestone (A through G).

### Step 1 — Rebuild Docker Containers

```bash
# From /home/mundeez/DevWorkz/nkuku-companion-app
docker compose down
docker compose up --build -d

# Health checks
docker compose ps
curl -s http://localhost:30001/health | jq .
curl -s -o /dev/null -w "%{http_code}" http://localhost:30000
```

If any container fails: check logs → fix root cause → repeat Step 1.

### Step 2 — Run Comprehensive Tests (Pend Until Green)

```bash
# API unit tests
docker compose exec api pnpm run test:unit

# API integration tests
docker compose exec api pnpm run test:integration

# Full API test suite
docker compose exec api pnpm run test

# TypeScript type checks
docker compose exec api pnpm run typecheck
docker compose exec web pnpm run typecheck

# Flutter tests (run locally with Flutter SDK)
# cd apps/mobile && flutter test

# Double-entry specific: verify trial balance
docker compose exec api tsx src/db/seeds/migrate-to-double-entry.ts  # if applicable
docker compose exec postgres psql -U nkuku -c "
  SELECT COUNT(*) FROM journal_entries je
  JOIN journal_lines jl ON jl.journal_id = je.id
  GROUP BY je.id HAVING ABS(SUM(jl.debit_zmw) - SUM(jl.credit_zmw)) > 0.01;
"
# Expected: (0 rows)
```

**Do not proceed until all tests exit 0 and trial balance query returns 0 rows.**

### Step 3 — Commit, Tag & Push to GitHub

```bash
# Review changes
git status && git diff --stat

# Stage all
git add -A

# Commit (milestone-specific commit title from each milestone's close-out section)
git commit -m "$(cat <<'EOF'
<COMMIT_TITLE>

<BULLET SUMMARY>

Generated with Devin (https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"

# Annotated tag
git tag -a <VERSION_TAG> -m "<COMMIT_TITLE>"

# Push
git push origin main
git push origin <VERSION_TAG>

# GitHub Release
gh release create <VERSION_TAG> \
  --title "<VERSION_TAG> — <Milestone X: Title>" \
  --notes "$(cat <<'NOTES'
<RELEASE_NOTES: from milestone close-out section>
NOTES
)"

# Confirm release is live
gh release view <VERSION_TAG>
```

### Step 4 — Move to Next Milestone

Confirm the release is published, mark this milestone's checklist complete, and proceed to the next milestone section.

---

## 13. Data Integrity & Immutability Rules

| Rule | Enforcement layer |
|------|------------------|
| Every journal entry must balance (debits = credits) | `JournalEngine.post()` before DB write |
| Journal entries can never be updated | PostgreSQL `no_update_journal_entries` rule + no PATCH route |
| Journal entries can never be deleted | PostgreSQL `no_delete_journal_entries` rule + no DELETE route |
| Journal lines can never be updated or deleted | PostgreSQL rules on `journal_lines` |
| Each journal line must have exactly one of debitZmw or creditZmw | DB CHECK constraint + engine validation |
| All amounts are non-negative | DB CHECK constraint + Zod schema validation |
| System accounts (`isSystem=true`) cannot be deactivated | Application guard in PATCH handler |
| Year-end closing entries are tagged `sourceType: 'period_close'` | `ClosingService` enforces this |
| All corrections are made via reversing entries, never edits | Documentation + no-edit API surface |

---

## 14. GAAP/IFRS Compliance Checklist

Run this checklist before tagging v1.0.0:

**Recognition & Measurement**
- [ ] Revenue recognised when birds are sold (`category = 'sales'`, `isIncome = true`), not when ordered
- [ ] Expenses recognised in the period incurred (`entryDate` = transaction date)
- [ ] Live bird inventory carried at cost (chick purchase + feed + vaccines), not fair value
- [ ] Mortality losses expensed immediately when they occur (DR 5050 / CR 1040)
- [ ] Equipment carried at cost (DR 1080); depreciation not yet implemented (Milestone H scope)

**Completeness & Accuracy**
- [ ] All `FinancialRecord` rows migrated to journal entries (migration verification query returns 0 errors)
- [ ] All `BatchExpense` rows (actual) migrated to journal entries
- [ ] All `OverheadCost` rows (actual) migrated to journal entries
- [ ] Trial balance `isBalanced === true` for all historical periods

**Period Matching**
- [ ] `entryDate` is always the economic event date, never the system date
- [ ] Year-end closing entries are dated December 31 of the closing year
- [ ] `periodLabel` is correctly set on all journal entries

**Audit Trail**
- [ ] Every journal entry has a unique, sequential `entryNumber` (JE-YYYY-NNNNNN)
- [ ] `postedBy` is recorded for all non-automated entries
- [ ] `sourceType` and `sourceId` trace every automated entry back to its operational record
- [ ] Reversing entries reference `reversesId` of the original

**Disclosure (Report-level)**
- [ ] Income statement distinguishes COGS from Operating Expenses (gross profit is explicitly stated)
- [ ] Balance sheet equation holds: Total Assets = Total Liabilities + Total Equity
- [ ] Cash flow statement uses indirect method; operating/investing activities are separated
- [ ] All amounts displayed in ZMW to 2 decimal places

---

## 15. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Historical migration creates imbalanced entries | Medium | High | Batched migration with per-record try/catch; verification SQL after each batch; `sourceType = 'migration'` for easy re-run filtering |
| `FinancialRecord.category` has no account mapping | Low | Medium | `AutoPostService` logs a warning and skips; unposted records are flagged in a daily check endpoint |
| Trial balance out of balance after migration | Medium | High | Verification query built into Milestone B checklist and Step 2 of close-out protocol |
| PostgreSQL immutability rules accidentally prevent emergency corrections | Low | Medium | Rule only prevents direct UPDATE/DELETE; application-level reversal still works. Document the reversal procedure in AGENTS.md |
| Year-end close run twice for the same year | Low | High | `ClosingService.yearEndClose()` checks for existing `period_close` journal entries for the target year before posting |
| Journal entry number collision on concurrent posts | Low | Medium | Use `prisma.$transaction` with `SELECT ... FOR UPDATE` on the sequence counter, or use a PostgreSQL sequence |
| Performance: trial balance slow for multi-year history | Medium | Medium | `LedgerBalance` materialised rows allow O(1) lookup per account per period; rebuilt on period close |
| Flutter role-check missing — viewer sees ledger | Low | Medium | Role is stored in JWT; `LedgerService` checks `authUser.role` before rendering nav items and calling endpoints |

---

## 16. Summary Roadmap

Each row ends with the close-out routine from [Section 12](#12-milestone-close-out-protocol): rebuild → test (pend until green) → commit/tag/push → next milestone.

```
Week  1-2  │  Prerequisite: Financial System Plan v1.1 fully deployed at v0.8.0
Week  2-4  │  Milestone A — Chart of Accounts + Journal Engine + Unit Tests     →  v0.9.0-alpha
Week  4-5  │  Milestone B — Historical Data Migration (single-entry → journal)  →  v0.9.1-alpha
Week  5-7  │  Milestone C — Ledger Service, Trial Balance & Journal API          →  v0.9.2-alpha
Week  7-8  │  Milestone D — GAAP-Compliant Statements from Ledger               →  v0.9.3-alpha
Week  8-9  │  Milestone E — Web Ledger Interface                                 →  v0.9.4-alpha
Week  9-10 │  Milestone F — Flutter Ledger Screens                              →  v0.9.5-alpha
Week 10-12 │  Milestone G — Hardening, Compliance Audit, v1.0.0 Release         →  v1.0.0
```

**Total estimated duration:** 10-12 weeks after v0.8.0 (1 developer, part-time)

**What comes after v1.0.0 (future plan — not in scope):**
- v1.1.0 — AP/AR aging reports, payment tracking, bank reconciliation
- v1.2.0 — Equipment depreciation schedules (straight-line)
- v1.3.0 — Tax line mapping (ZRA VAT, PAYE)
- v1.4.0 — Multi-entity reporting (if farm expands to multiple legal entities)

---

*End of Double-Entry Bookkeeping Implementation Plan — v1.0*
