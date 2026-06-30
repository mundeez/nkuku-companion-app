# Nkuku Companion App — Operational-to-Financial Integration Plan

**Version:** 1.0 · **Date:** 2026-06-27  
**Prerequisite:** `Financial_System_Implementation_Plan.md` v0.3.2-alpha fully implemented  
**Target release:** v0.4.0-alpha  
**Platforms:** Fastify/Prisma API · Next.js 14 Web · Flutter 3.x Mobile

---

## 1. Executive Summary

The financial dashboard currently only reflects manually-entered `FinancialRecord` rows. Operational reality (feed given, vaccines administered, chicks placed, mortality) lives in separate tables and never reaches the ledger. This plan wires every operational broiler event into the financial system automatically, adds a proportional overhead allocator for labour & utilities, and produces a unified **Actuals + Projections** dashboard.

---

## 2. Guiding Principles

1. **Single source of truth for actuals** — `FinancialRecord` is the ledger. Operational tables feed it; nothing is double-entered.
2. **Projections are clearly labeled** — Any auto-calculated or planned figure shown on the dashboard is visually distinct from realized (cash) actuals.
3. **Proportional fairness** — Overheads (labour, utilities) are distributed to active flocks by **active-days** in the period.
4. **Daily recalculation** — A background job recalculates and re-allocates overheads every 24h so the dashboard is always current.
5. **Immutable audit trail** — Auto-generated records are marked `isSystemGenerated = true`. They can be reversed in aggregate (re-calc) but individual rows are never silently mutated.

---

## 3. Schema Changes

### 3.1 FinancialRecord enhancements

```prisma
model FinancialRecord {
  id                String              @id @default(uuid()) @db.Uuid
  flockId           String              @map("flock_id") @db.Uuid
  sourceRecordId    String?             @map("source_record_id") @db.Uuid
  sourceTable       String?             @map("source_table") @db.VarChar(50)   // 'feed_records', 'vaccination_events', 'overhead_allocations', etc.
  recordDate        DateTime            @map("record_date") @db.Date
  category          FinancialCategory
  description       String              @db.VarChar(200)
  amountZmw         Decimal             @map("amount_zmw") @db.Decimal(14, 2)
  isIncome          Boolean             @default(false) @map("is_income")
  isSystemGenerated Boolean             @default(false) @map("is_system_generated")
  isProjection      Boolean             @default(false) @map("is_projection")   // true for harvest-value estimates
  notes             String?             @db.Text
  createdAt         DateTime            @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt         DateTime            @updatedAt @map("updated_at") @db.Timestamptz(6)

  flock             BroilerFlock        @relation(fields: [flockId], references: [id], onDelete: Cascade)

  @@index([flockId, recordDate])
  @@index([sourceRecordId])
  @@index([isSystemGenerated])
  @@map("financial_records")
}
```

> **Migration note:** Add `sourceTable`, `isSystemGenerated`, `isProjection` columns. Existing rows default to `isSystemGenerated = false`, `isProjection = false`.

### 3.2 New model: MonthlyOverhead

Stores the raw overhead cost entry for a calendar month (entered by owner/manager). The allocator turns this into daily `FinancialRecord` rows per flock.

```prisma
model MonthlyOverhead {
  id          String           @id @default(uuid()) @db.Uuid
  yearMonth   String           @map("year_month") @db.VarChar(7)   // "2026-06"
  category    OverheadCategory @map("category")
  description String?          @db.VarChar(200)
  amountZmw   Decimal          @map("amount_zmw") @db.Decimal(14, 2)
  contractType String          @map("contract_type") @db.VarChar(20) // monthly | weekly | daily | once_off
  recordedAt  DateTime         @default(now()) @map("recorded_at") @db.Timestamptz(6)
  createdBy   String           @map("created_by") @db.Uuid

  user        User             @relation(fields: [createdBy], references: [id])

  @@unique([yearMonth, category, description])
  @@map("monthly_overheads")
}
```

### 3.3 New model: FlockOverheadAllocation (audit trail)

Optional but recommended: stores the daily snapshot of how overheads were split so the math is reproducible.

```prisma
model FlockOverheadAllocation {
  id            String   @id @default(uuid()) @db.Uuid
  monthlyOverheadId String @map("monthly_overhead_id") @db.Uuid
  flockId       String   @map("flock_id") @db.Uuid
  allocationDate DateTime @map("allocation_date") @db.Date
  daysActiveInMonth Int  @map("days_active_in_month")
  totalActiveFlockDays Int @map("total_active_flock_days")
  allocatedAmount Decimal @map("allocated_amount") @db.Decimal(14, 2)
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  @@index([flockId, allocationDate])
  @@map("flock_overhead_allocations")
}
```

---

## 4. Auto-Generation Rules (Operational → FinancialRecord)

A new `OperationalFinancialBridgeService` listens (or is called synchronously) when operational records are created.

| Source Table | Trigger Event | FinancialRecord mapping |
|--------------|---------------|------------------------|
| `feed_records` | `POST /api/v1/feed-records` | `category: 'feed'`, `amountZmw: costZmw`, `isIncome: false`, `sourceTable: 'feed_records'` |
| `vaccination_events` | `POST /api/v1/vaccination-events` | `category: 'vaccines'`, `amountZmw: costZmw`, `isIncome: false`, `sourceTable: 'vaccination_events'` |
| `mortality_events` | `POST /api/v1/mortality-events` | **No cost row** (already counted via reduced bird count; do not duplicate) |
| `growth_records` | `POST /api/v1/growth-records` | **No cost row** (purely physical measurement) |
| `water_records` | `POST /api/v1/water-records` | **No cost row** (captured via utilities overhead) |
| `broiler_flocks` | `POST /api/v1/broiler-flocks` | `category: 'chick_purchase'`, `amountZmw: initialCount × chickPriceZmw` (user explicitly picks supplier & price), `isIncome: false`, `sourceTable: 'broiler_flocks'` |
| `broiler_flocks` | Status changes to `sold` or `closed` | `category: 'sales'`, `amountZmw: finalCount × avgSalePrice` (user provides sale price), `isIncome: true`, `sourceTable: 'broiler_flocks'` |
| `broiler_flocks` | Status changes to `sold` or `closed` | `category: 'sales'`, `amountZmw: finalCount × avgSalePrice`, `isIncome: true`, `sourceTable: 'broiler_flocks'` |

**Deletion / update behavior:**
- If an operational record is **deleted**, the bridge soft-deletes (or hard-deletes) the linked `FinancialRecord` where `sourceTable` and `sourceRecordId` match.
- If an operational record is **updated** (e.g., feed cost corrected), the bridge updates the linked `FinancialRecord` amount.
- This is handled inside the existing route handlers via `prisma.$transaction`.

---

## 5. Overhead Allocation Engine

### 5.1 Monthly input
Owner/manager enters a `MonthlyOverhead` row via the web/mobile UI:
- **Category:** labour, electricity, water, litter, transport_to_market, other
- **Amount (ZMW)**
- **Contract type:** monthly / weekly / daily / once_off *(stored for info only; amount is the ground truth)*
- **Month:** `YYYY-MM`

### 5.2 Allocation algorithm (runs daily at 02:00)

```
For each MonthlyOverhead row for the current month:
  1. Find all flocks where:
     - createdBy = owner
     - status IN ('active', 'sold', 'closed')
     - flock.startDate <= end_of_month
     - (flock.soldDate IS NULL OR flock.soldDate >= start_of_month)

  2. For each flock, compute:
     daysActive = MIN(flock.soldDate, end_of_month) - MAX(flock.startDate, start_of_month)
     (clip to >= 0)

  3. totalActiveFlockDays = SUM(daysActive across all flocks)

  4. If totalActiveFlockDays == 0: skip (no active flocks)

  5. Delete all existing FinancialRecord rows for this month where:
     - category = overhead.category
     - isSystemGenerated = true
     - sourceTable = 'overhead_allocations'
     - recordDate within the month

  6. For each flock:
     allocatedAmount = monthlyOverhead.amountZmw × (daysActive / totalActiveFlockDays)
     Create FinancialRecord:
       flockId: flock.id
       recordDate: end_of_month  (or distribute daily — see 5.3)
       category: overhead.category
       description: "Overhead allocation — {overhead.description} — {month}"
       amountZmw: allocatedAmount
       isIncome: false
       isSystemGenerated: true
       sourceTable: 'overhead_allocations'
```

### 5.3 Daily vs monthly distribution

**Option A (recommended):** Post one `FinancialRecord` per flock per overhead per month, dated the **last day of the month**. This is simpler and matches how most farm accounting works (month-end accruals).

**Option B:** Post one `FinancialRecord` per flock per overhead **per day**, each with `amount = monthlyAmount / daysInMonth`. This gives finer-grained P&L by day but creates more rows. If daily granularity is desired, use Option B.

> **Decision:** Use **Option A** (month-end lump) for v0.4.0. Option B can be added later as a configuration toggle.

---

## 6. Revenue Engine

### 6.1 Manual sales entries
When a user posts a `FinancialRecord` with `isIncome: true` and `category: 'sales'`, it is treated as **realized revenue** and shown in the Actuals section.

### 6.2 Auto-projected harvest value
For every flock with `status = 'active'`, a daily background job computes:

```
projectedRevenue = flock.currentCount × flock.targetWeight × marketPricePerKg
```

Where `marketPricePerKg` is:
1. User-configurable global default (stored in a new `AppSetting` table or env var)
2. Or overridden per-flock via a `projectedSalePriceZmw` field on `BroilerFlock`

This creates a **single** `FinancialRecord` per active flock per day:
- `isProjection = true`
- `isSystemGenerated = true`
- `category = 'sales'`
- `recordDate = today`
- Existing projection rows for that flock are deleted and re-created daily (so only the latest projection survives).

> **Visual rule on dashboard:** Projection rows are rendered with a dashed border, "ESTIMATED" badge, and a lighter opacity.

---

## 7. Planning Data Integration

The expansion plan (`ProductionCycle`, `Batch`) contains `revenueTargetZmw`. These are **planning targets**, not actuals.

### 7.1 Display rule
On the financial dashboard, show a "Planning Targets" card (or toggle) that displays:
- Total planned revenue for the current year from `Batch.revenueTargetZmw`
- Comparison: Actual YTD Revenue vs Planned YTD Revenue

These figures are fetched live from `/api/v1/expansion-plan` and are **never** written into `FinancialRecord`. They appear only in the UI overlay.

---

## 8. Daily Recalculation Job

A `FinancialRecalculationService` runs via `node-cron` at `0 2 * * *` (02:00 daily).

```typescript
class FinancialRecalculationService {
  async runDaily() {
    await this.refreshOverheadAllocations();   // Step 5
    await this.refreshHarvestProjections();      // Step 6.2
    await this.refreshOperationalBridge();       // Re-sync any missed operational rows
  }
}
```

**Idempotency:** Every generation method first deletes its own `isSystemGenerated = true` footprint for the target period, then re-creates. This makes the job safe to re-run.

---

## 9. API Changes

### 9.1 New endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/financial-engine/overheads` | owner/manager | List MonthlyOverhead rows |
| `POST` | `/api/v1/financial-engine/overheads` | owner/manager | Create MonthlyOverhead |
| `DELETE` | `/api/v1/financial-engine/overheads/:id` | owner | Delete MonthlyOverhead (triggers re-allocation) |
| `POST` | `/api/v1/financial-engine/recalculate` | owner/manager | Manual trigger for daily recalc |
| `GET` | `/api/v1/financial-engine/projections` | any | List current harvest projections per flock |

### 9.2 Modified endpoints

- `POST /api/v1/feed-records` — after create, call bridge to insert `FinancialRecord`
- `POST /api/v1/vaccination-events` — after create, call bridge
- `POST /api/v1/broiler-flocks` — after create, call bridge for chick purchase
- `PATCH /api/v1/broiler-flocks/:id` — if status changes to `sold` or `closed`, call bridge for sales entry
- `DELETE` on above — cascade to linked `FinancialRecord`

---

## 10. Web Frontend Changes

### 10.1 New page: `/financials/overheads`
- Table of `MonthlyOverhead` entries
- Form: Month picker, category dropdown, amount, contract type, description
- Show allocation preview before save ("Flock A: K150, Flock B: K50")

### 10.2 Dashboard enhancements (`/financials`)
- **Actuals tab:** Revenue, Cost, Profit from real `FinancialRecord` rows (`isProjection = false`)
- **Projections tab:** Harvest value estimates (`isProjection = true`)
- **Combined tab:** Both shown together; projections are faded/labelled
- **Planning overlay:** Toggle to show expansion-plan targets as dotted-line targets on the revenue chart

### 10.3 Broiler flock financial page
- Already updated in v0.3.2-alpha with statement links
- Add "Operational Costs" section showing auto-generated feed, vaccine, overhead rows

---

## 11. Flutter Mobile Changes

### 11.1 New screen: `OverheadsScreen`
- List monthly overhead entries
- Simple form to add a new overhead (month, category, amount)
- Show per-flock allocation breakdown

### 11.2 Financial dashboard screen updates
- Add toggle: "Show projections"
- When ON, projected harvest revenue is added to KPI cards with `(est.)` suffix

---

## 12. Test Plan

| Suite | Tests |
|-------|-------|
| Unit | Allocation algorithm with 2 flocks, 3 weeks + 1 week = correct K150 / K50 split |
| Unit | Bridge: feed record creation → FinancialRecord with correct amount |
| Unit | Bridge: flock status `sold` → sales FinancialRecord |
| Unit | Daily recalc: idempotency (run twice = same result) |
| Integration | POST feed-record → financial dashboard reflects new cost within 1s |
| Integration | POST monthly-overhead → dashboard shows split correctly |
| Integration | Delete operational record → linked FinancialRecord removed |

---

## 13. Milestones

| Milestone | Deliverable | Est. effort |
|-----------|-------------|-------------|
| **A** | Schema migration (`sourceTable`, `isSystemGenerated`, `isProjection`, `MonthlyOverhead`, `FlockOverheadAllocation`) | Small |
| **B** | Operational bridge service + route hooks (feed, vaccine, flock create/sold) | Medium |
| **C** | Overhead allocation service + API routes + web form | Medium |
| **D** | Harvest projection service + daily cron job | Small |
| **E** | Dashboard combined actuals/projections view + planning overlay | Medium |
| **F** | Flutter overhead screen + projection toggle | Small |
| **G** | Full test suite + seed migration + deploy | Medium |

---

## 14. Risk Register

| Risk | Mitigation |
|------|------------|
| Auto-generated rows clutter the manual financial records view | Filter default views to `isSystemGenerated = false`; add a "Show system entries" toggle |
| Overhead re-allocation deletes old rows, breaking historical reports | Keep `FlockOverheadAllocation` audit rows; reports can be regenerated |
| Market price for projections is guesswork | Make it configurable per-flock and per-season; show confidence band |
| Daily cron failure goes unnoticed | Add cron health to `/health` endpoint; log to `AuditLog` on failure |

---

## 15. Summary

After this plan is implemented:
- **Feed, vaccines, chick purchases** appear in the financial ledger automatically.
- **Labour, electricity, water** are entered once per month and split fairly across active flocks by days active.
- **Revenue** comes from real sales entries; active flocks also show a projected harvest value.
- **Planning targets** from the expansion plan appear as dotted-line benchmarks on charts.
- **Everything recalculates daily** at 02:00 so the dashboard is never stale.
