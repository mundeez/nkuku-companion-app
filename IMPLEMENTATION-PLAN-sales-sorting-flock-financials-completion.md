# Implementation Plan: Sales Sorting, Flock Card Financials, Flock Completion

## Decisions Confirmed

| Decision | Choice |
|----------|--------|
| Unrealised Profit | Proportional cost allocation: `outstanding - (avgCostPerBird × birdsOutstanding)` |
| Completion lock | Owner bypasses lock; manager/viewer get 403 on locked record types; sales PATCH (payment updates) allowed for owner/manager; owner actions audited via existing AuditLog |
| Field placement | All 5 fields on both flock card (list page) and Overview tab (detail page) |
| Journal cleanup | Full journal rebuild: drop rules → truncate → re-run migration → re-apply rules |
| Sorting | Client-side sorting (data already loaded); API also gets `sortBy`/`sortDir` params for future server-side use |
| Avg sales price | Total revenue ÷ total birds sold (weighted average) |
| Test flocks | 3 flocks: fully-paid sales, partial/outstanding sales, pending (not collected) |

---

## Phase 1: Backend — Flock Financial Aggregation (5 new computed fields)

**Files to modify:**
- `apps/api/src/modules/broiler-flocks/routes.ts` — GET `/` (list) and GET `/:id` (detail)

**New computed fields per flock:**

```
totalOutstandingPayments  = Σ (sale.totalAmountZmw - sale.amountPaidZmw) for all sales where outstanding > 0
actualRevenueCollected    = totalRevenue - totalOutstandingPayments
actualProfitLessOutstanding = actualProfit - totalOutstandingPayments
actualAverageSalesPrice   = totalRevenueFromSales / totalBirdsSold
unrealisedProfit          = totalOutstandingPayments - (avgCostPerBird × totalBirdsOutstanding)
```

Where:
- `totalRevenueFromSales` = Σ `sale.totalAmountZmw` across all sale records
- `totalBirdsSold` = Σ `sale.birdCount` across all sale records
- `avgCostPerBird` = `totalCost / totalBirdsSold` (guards against divide-by-zero)
- `totalBirdsOutstanding` = Σ `sale.birdCount × (outstanding / sale.totalAmountZmw)` per sale (proportional — partially paid sales count only their unpaid fraction of birds)

**Implementation approach:**
- Batch-load `SaleRecord` aggregates per flock (same pattern as existing mortality/financial batch loads in GET `/`)
- Add the 5 fields to the returned flock object alongside existing `totalCost`, `totalRevenue`, etc.
- For GET `/:id`, fetch sale aggregates for the single flock

**Type update:**
- `apps/web/src/lib/types.ts` — add 5 optional fields to `BroilerFlock` interface:
  ```typescript
  totalOutstandingPayments?: number;
  actualRevenueCollected?: number;
  actualProfitLessOutstanding?: number;
  actualAverageSalesPrice?: number;
  unrealisedProfit?: number;
  ```

---

## Phase 2: Backend — Sales API Sorting Support

**Files to modify:**
- `apps/api/src/modules/sale-records/routes.ts` — GET `/all`

**Changes:**
- Add optional `sortBy` and `sortDir` query params
- Supported `sortBy` values: `saleDate`, `flockName`, `customerName`, `birdCount`, `pricePerBirdZmw`, `totalAmountZmw`, `paymentStatus`
- Supported `sortDir`: `asc`, `desc` (default: `desc` by `saleDate`)
- Map sort fields to Prisma `orderBy` (flockName requires a relation sort or post-fetch sort)
- The UI will use client-side sorting by default (data already loaded), but the API supports server-side sorting for future use with large datasets

---

## Phase 3: Backend — Flock Completion Endpoint + Lock Logic

### 3a: New completion endpoint

**File:** `apps/api/src/modules/broiler-flocks/routes.ts`

**New endpoint:** `POST /api/v1/broiler-flocks/:id/complete`
- PreHandler: `authenticate`, `requireRole('owner', 'manager')`
- Sets `status = "completed"`
- If `soldDate` is null, sets it to today
- Returns the updated flock + a `warnings` object:
  ```json
  {
    "outstandingPayments": 1500.00,
    "outstandingSalesCount": 3,
    "message": "This flock has 3 outstanding sales totaling ZMW 1,500.00"
  }
  ```
- If flock is already completed, returns 409 Conflict

### 3b: Completion lock middleware

**New file:** `apps/api/src/modules/broiler-flocks/check-flock-locked.ts`

A reusable preHandler function that:
1. Extracts `flockId` from the request body or params
2. Loads the flock's `status`
3. If `status === "completed"`:
   - If `user.role === "owner"`: allow (action is auto-audited by existing AuditLog middleware)
   - If `user.role !== "owner"`: return 403 with `{ error: "FLOCK_COMPLETED", message: "This flock is completed. Only the owner can modify records." }`
4. If `status !== "completed"`: pass through

**Endpoints to add the lock check (POST/create + DELETE):**

| Module | Locked on completion |
|--------|---------------------|
| growth-records | POST, DELETE |
| feed-records | POST, DELETE |
| feed-purchases | POST, DELETE |
| water-records | POST, DELETE |
| mortality-events | POST, DELETE |
| vaccination-events | POST, DELETE |
| medication-records | POST, DELETE |
| environmental-records | POST, DELETE |
| financial-records | POST, DELETE |
| sale-records | POST (new sales locked), DELETE (locked) |
| sale-records PATCH | **NOT locked** — payment updates allowed for owner/manager |

### 3c: Audit logging for owner bypass

The existing AuditLog system already captures mutations. I'll verify that the audit middleware captures these actions and add explicit audit log entries in the completion endpoint itself (recording who completed the flock and when).

---

## Phase 4: Frontend — Sales Dashboard Sorting

**File:** `apps/web/src/app/sales/page.tsx`

**Changes:**
- Add `sortField` and `sortDir` state (`"saleDate" | "flockName" | "customerName" | "birdCount" | "pricePerBirdZmw" | "totalAmountZmw" | "paymentStatus"` and `"asc" | "desc"`)
- Make column headers clickable buttons with:
  - Sort indicator arrow (▲ asc / ▼ desc)
  - Active sort field highlighted
  - Click toggles: if same field → flip direction; if new field → default to asc (or desc for dates)
- Client-side sort function applied to the loaded sales array before render
- Comparison logic per field type:
  - Date: chronological
  - Number: numeric
  - String: locale-aware string comparison
  - Payment status: custom order (paid > partial > pending)

---

## Phase 5: Frontend — Flock Card + Detail Page New Financial Fields

### 5a: Flock card (list page)

**File:** `apps/web/src/app/broiler-flocks/page.tsx`

Add 5 new rows to the card's info section (after existing "Actual Profit" row):

```
Actual Revenue Collected    ZMW X (green if positive)
Total Outstanding Payments  ZMW X (red if > 0, amber if = 0)
Actual Profit Less Outstanding  ZMW X (green/red)
Actual Average Sales Price  ZMW X per bird
Unrealised Profit           ZMW X (blue — indicates potential)
```

### 5b: Flock detail Overview tab

**File:** `apps/web/src/app/broiler-flocks/[id]/page.tsx`

Add a "Sales & Outstanding Summary" section to the Overview tab showing the same 5 fields in a cleaner 2-column layout with icons.

---

## Phase 6: Frontend — Flock Completion Button

**File:** `apps/web/src/app/broiler-flocks/[id]/page.tsx`

**Changes:**
- Add a "Complete Flock" button in the page header (next to the status badge), visible only when:
  - `flock.status === "active"` (not already completed/cancelled)
  - `user.role === "owner" || user.role === "manager"`
- Clicking opens a confirmation dialog showing:
  - Flock name and current stats (birds, age, revenue)
  - **Outstanding payments warning** (if any): "This flock has N outstanding sales totaling ZMW X. You can still update payment records after completion, but other records will be locked for non-owners."
  - Confirm/Cancel buttons
- On confirm: calls `POST /api/v1/broiler-flocks/:id/complete`
- On success: shows toast, refreshes flock data, hides the button
- When flock is completed:
  - Show a "Completed" badge prominently
  - Show lock indicators (lock icon + tooltip) on locked tabs (Growth, Feed, Water, Mortality, Vaccination, Financial)
  - Sales tab remains unlocked (payment updates allowed)
  - If user is owner, show a small "Owner override active" hint on locked tabs (records can still be added, audited)

---

## Phase 7: Testing with 3 Temporary Flocks

### 7a: Create test flocks via API

Using the API directly (curl/scripts), create 3 flocks under the existing organization:

1. **TEST-Flock-Paid** — Active, chicks collected, 3 sales all fully paid
2. **TEST-Flock-Outstanding** — Active, chicks collected, 3 sales: 1 paid, 1 partial, 1 pending
3. **TEST-Flock-Pending** — Pending (chicks not collected), no sales

Each test flock gets:
- Growth records (2-3 entries)
- Feed records (1-2 entries)
- A mortality event (1 entry)
- Sales records (as described above, for the active flocks)
- Financial records (feed expense, vaccine expense)

All test flocks will be named with `TEST-` prefix for easy identification.

### 7b: Test all features

| Test | What to verify |
|------|---------------|
| Sales sorting | Click each column header, verify asc/desc toggle, verify sort indicator |
| Flock card fields | Verify 5 new fields appear on all 3 test flock cards with correct values |
| Detail page fields | Verify 5 new fields on Overview tab |
| Completion button | Complete TEST-Flock-Paid, verify status change, verify lock on records |
| Completion with outstanding | Complete TEST-Flock-Outstanding, verify warning dialog shows outstanding amount |
| Lock enforcement | As manager: try POST growth record on completed flock → 403. As owner: try POST growth record → success (audited) |
| Sales payment update | On completed flock, PATCH a sale's payment → success |
| Pending flock | Verify no sales data, fields show 0/empty, completion button works |

### 7c: Delete test flocks

- Delete all 3 test flocks via `DELETE /api/v1/broiler-flocks/:id`
- This cascades to remove their SaleRecords, FinancialRecords, GrowthRecords, etc.
- Journal entries are NOT cascaded (orphans remain — cleaned in Phase 8)

---

## Phase 8: Journal Cleanup — Full Rebuild

**Goal:** Remove all journal entries from test flocks and rebuild from remaining (real) flocks' FinancialRecords.

**Steps:**

1. **Drop immutability rules:**
   ```sql
   DROP RULE IF EXISTS no_update_journal_entries ON journal_entries;
   DROP RULE IF EXISTS no_delete_journal_entries ON journal_entries;
   DROP RULE IF EXISTS no_update_journal_lines ON journal_lines;
   DROP RULE IF EXISTS no_delete_journal_lines ON journal_lines;
   ```

2. **Truncate all journal entries and lines:**
   ```sql
   TRUNCATE journal_lines CASCADE;
   TRUNCATE journal_entries CASCADE;
   ```

3. **Re-run the migration script:**
   ```bash
   docker compose exec api npx tsx src/db/seeds/migrate-to-double-entry.ts
   ```
   This rebuilds all journal entries from the remaining FinancialRecords (which now only belong to the user's real flocks since test flock FinancialRecords were cascade-deleted).

4. **Re-apply immutability rules:**
   ```bash
   docker exec nkuku-companion-app-postgres-1 psql -U nkuku_user -d nkuku_db -f /docker-entrypoint-initdb.d/journal-immutability.sql
   ```

5. **Verify:**
   - Trial balance matches pre-test state
   - No journal lines reference deleted test flock IDs
   - All existing flocks' financial data is intact

---

## Phase 9: Build, Test, Commit, Push, Rebuild

1. Run `pnpm run typecheck` and `pnpm run lint` in both `apps/api` and `apps/web`
2. Run `docker compose exec api pnpm run test` (full test suite)
3. Fix any failures
4. Commit with descriptive message
5. Push to origin
6. Rebuild Docker containers (`docker compose down && docker compose up --build -d`)
7. Verify API health and web serving

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Test flocks accidentally modify real flocks | All test flocks created with `TEST-` prefix; never touch existing flocks by ID |
| Journal rebuild loses data | Truncate + re-run migration is idempotent; FinancialRecords are the source of truth and are untouched |
| Immutability rules dropped temporarily | Rules are re-applied immediately after rebuild; window is < 1 minute |
| Completion lock breaks existing workflows | Lock only applies to `completed` flocks; all existing flocks remain `active` |
| Sorting performance | Client-side sort on already-loaded data; no refetch needed; handles hundreds of records instantly |

---

## File Change Summary

| File | Change |
|------|--------|
| `apps/api/src/modules/broiler-flocks/routes.ts` | Add 5 computed financial fields to GET `/` and GET `/:id`; add POST `/:id/complete` endpoint |
| `apps/api/src/modules/broiler-flocks/check-flock-locked.ts` | **New** — reusable preHandler for completion lock |
| `apps/api/src/modules/sale-records/routes.ts` | Add `sortBy`/`sortDir` query params to GET `/all` |
| `apps/api/src/modules/growth-records/routes.ts` | Add lock preHandler to POST, DELETE |
| `apps/api/src/modules/feed-records/routes.ts` | Add lock preHandler to POST, DELETE |
| `apps/api/src/modules/feed-purchases/routes.ts` | Add lock preHandler to POST, DELETE |
| `apps/api/src/modules/water-records/routes.ts` | Add lock preHandler to POST, DELETE |
| `apps/api/src/modules/mortality-events/routes.ts` | Add lock preHandler to POST, DELETE |
| `apps/api/src/modules/vaccination-events/routes.ts` | Add lock preHandler to POST, DELETE |
| `apps/api/src/modules/medication-records/routes.ts` | Add lock preHandler to POST, DELETE |
| `apps/api/src/modules/environmental-records/routes.ts` | Add lock preHandler to POST, DELETE |
| `apps/api/src/modules/financial-records/routes.ts` | Add lock preHandler to POST, DELETE |
| `apps/api/src/modules/sale-records/routes.ts` | Add lock preHandler to POST, DELETE (NOT PATCH) |
| `apps/web/src/lib/types.ts` | Add 5 fields to `BroilerFlock` interface |
| `apps/web/src/app/sales/page.tsx` | Add sortable column headers with client-side sorting |
| `apps/web/src/app/broiler-flocks/page.tsx` | Add 5 new financial fields to flock card |
| `apps/web/src/app/broiler-flocks/[id]/page.tsx` | Add 5 fields to Overview tab; add Complete Flock button + confirmation dialog; add lock indicators |
