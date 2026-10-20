# Implementation Plan: Supplier-Aware Feed Records with Auto-Pricing & Bag Capacity

## Overview
Enhance the feed record add/edit dialog so users can:
1. Select from existing configured suppliers or enter a custom supplier
2. When an existing supplier is selected, display the supplier's **bag capacity** (e.g., 50kg, 25kg) and allow the user to enter the **number of bags** for auto-cost calculation
3. The feed cost (`costZmw`) is automatically computed: `bags × unitPriceZmw`
4. The total quantity in kg is also auto-computed: `bags × unitSizeKg`

---

## Current State Audit

### Data Model
| Model | Key Fields | Relation |
|-------|-----------|----------|
| `Supplier` | `name`, `isDefault`, `isActive` | has many `FeedStage`s |
| `FeedStage` | `stageName`, `unitSizeKg`, `unitPriceZmw`, `intakePerBirdKg`, `dayRangeStart`, `dayRangeEnd` | belongs to `Supplier` |
| `FeedRecord` | `recordDate`, `feedType` (starter\|grower\|finisher), `feedBrand`, `quantityKg`, `costZmw` | belongs to `BroilerFlock` |

**Seeded Suppliers:** NUTRI FEED (default), NOVATEK, TIGER FEED, BROWN BROILERS with TIGER FEED, ZAM FEED.

**Example pricing (NUTRI FEED Starter):** 50kg bag @ ZMW 785

### Current Frontend Feed Form Fields
- Date, Feed Type (starter/grower/finisher), Quantity (kg), Cost (ZMW)
- `feedBrand` exists in DB but is not exposed in the form

### Current APIs
- `GET /api/v1/suppliers` — returns all suppliers with `feedStages` array
- `POST/PATCH /api/v1/feed-records` — accepts `feedBrand` but it's optional and hidden

---

## Phase 1: Database & API (Estimated: 2 hours)

### 1.1 Add `supplierId` to `FeedRecord`

**File:** `apps/api/prisma/schema.prisma`

```prisma
model FeedRecord {
  id         String   @id @default(uuid()) @db.Uuid
  flockId    String   @map("flock_id") @db.Uuid
  supplierId String?  @map("supplier_id") @db.Uuid   // NEW
  recordDate DateTime @map("record_date") @db.Date
  feedType   FeedType
  feedBrand  String?  @map("feed_brand") @db.VarChar(100)
  quantityKg Decimal  @map("quantity_kg") @db.Decimal(10, 3)
  costZmw    Decimal? @map("cost_zmw") @db.Decimal(14, 2)
  notes      String?  @db.Text
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  flock      BroilerFlock @relation(fields: [flockId], references: [id], onDelete: Cascade)
  supplier   Supplier?    @relation(fields: [supplierId], references: [id], onDelete: SetNull)  // NEW

  @@index([flockId, recordDate])
  @@map("feed_records")
}
```

Also add `feedRecords FeedRecord[]` relation to `Supplier` model.

**Migration command:**
```bash
docker compose exec api npx prisma migrate dev --name add_supplier_to_feed_record
```

### 1.2 Add Feed Price & Bag Capacity Lookup Endpoint

**File:** `apps/api/src/modules/suppliers/routes.ts`

Add endpoint that returns bag capacity and price for a given supplier + feed type:

```typescript
app.get('/:id/feed-price', { preHandler: [authenticate] }, async (request, reply) => {
  const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
  const { feedType } = z.object({
    feedType: z.enum(['starter', 'grower', 'finisher']),
  }).parse(request.query);

  const supplier = await prisma.supplier.findFirst({
    where: { id },
    include: { feedStages: true },
  });
  if (!supplier) return reply.status(404).send({ error: 'NOT_FOUND' });

  // Case-insensitive match: "starter" -> "Starter"
  const stage = supplier.feedStages.find(
    (s) => s.stageType === 'feed' && s.stageName.toLowerCase() === feedType
  );

  if (!stage) {
    return reply.status(404).send({ error: 'NO_PRICE_FOUND', message: `No ${feedType} price configured for ${supplier.name}` });
  }

  return {
    supplierName: supplier.name,
    stageName: stage.stageName,
    unitSizeKg: Number(stage.unitSizeKg),      // e.g. 50
    unitPriceZmw: Number(stage.unitPriceZmw),  // e.g. 785
    pricePerKg: Number((Number(stage.unitPriceZmw) / Number(stage.unitSizeKg)).toFixed(2)),
  });
});
```

### 1.3 Update Feed Record Schemas & Handlers

**File:** `apps/api/src/modules/feed-records/routes.ts`

Update `FeedRecordCreateSchema`:

```typescript
const FeedRecordCreateSchema = z.object({
  flockId: z.string().uuid(),
  supplierId: z.string().uuid().optional(),
  recordDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  feedType: z.enum(['starter', 'grower', 'finisher']),
  feedBrand: z.string().optional(),
  quantityKg: z.number().positive(),
  costZmw: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});
```

Update POST handler to auto-derive `feedBrand` from supplier:

```typescript
// In POST handler, after parsing:
let feedBrand = data.feedBrand;
if (data.supplierId && !feedBrand) {
  const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
  feedBrand = supplier?.name ?? null;
}
```

Update GET list to include supplier name:

```typescript
return prisma.feedRecord.findMany({
  where: { flockId },
  orderBy: { recordDate: 'asc' },
  include: { supplier: { select: { name: true } } },
});
```

Update `GET /summary` to include supplier breakdown:

```typescript
const supplierBreakdown = await prisma.feedRecord.groupBy({
  by: ['feedBrand'],
  where: { flockId },
  _sum: { quantityKg: true, costZmw: true },
});
```

### Phase 1 Close-Out

1. [ ] **Rebuild all Docker containers:** `docker compose up --build -d`
2. [ ] **Run comprehensive tests:**
   ```bash
   docker compose exec api pnpm run test
   ```
   - If any test fails, halt and fix before proceeding.
3. [ ] **Push to GitHub:**
   ```bash
   git add -A
   git commit -m "feat(api): add supplierId to FeedRecord, add GET /suppliers/:id/feed-price endpoint

   - Prisma migration: add nullable supplierId to feed_records table
   - New endpoint returns bag capacity (unitSizeKg) and bag price (unitPriceZmw)
   - Feed record create/patch now accept and persist supplierId
   - Auto-derive feedBrand from supplier name when not provided
   - Include supplier relation in feed record list queries

   Generated with [Devin](https://devin.ai)
   Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>"
   git push origin main
   ```
4. [ ] **Proceed to Phase 2 only when green.**

---

## Phase 2: Frontend Development (Estimated: 3 hours)

### 2.1 Fetch Suppliers on Page Load

**File:** `apps/web/src/app/broiler-flocks/[id]/page.tsx`

Add suppliers state and fetch:

```tsx
const [suppliers, setSuppliers] = useState<Supplier[]>([]);

// In loadAll():
apiFetch<Supplier[]>("/api/v1/suppliers").then(setSuppliers).catch(() => {});
```

Pass `suppliers` to `SimpleRecordTab` for the `feed` type.

### 2.2 Redesign Feed Record Form

Replace the current feed form with a supplier-aware layout:

#### Field Configuration

```tsx
feed: {
  title: "Feed Records",
  icon: TrendingUp,
  endpoint: "/api/v1/feed-records",
  fields: [
    { key: "recordDate", label: "Date", type: "date" },
    { key: "supplierId", label: "Supplier", type: "supplier-select" },
    { key: "feedType", label: "Feed Type", type: "select", options: ["starter", "grower", "finisher"] },
    // The following fields are conditionally shown based on supplier selection
    { key: "bagCount", label: "Number of Bags", type: "number", conditional: "hasSupplier" },
    { key: "quantityKg", label: "Total Quantity (kg)", type: "number" },
    { key: "costZmw", label: "Total Cost (ZMW)", type: "number" },
  ],
},
```

#### Supplier-Select Handler

When a supplier is selected (not "custom"):

```tsx
if (f.type === "supplier-select") {
  return (
    <select
      key={f.key}
      className="w-full border rounded-md p-2 bg-background"
      value={val || ""}
      onChange={async (e) => {
        const supplierId = e.target.value;
        const newForm = { ...form, [f.key]: supplierId };

        if (supplierId && supplierId !== "custom") {
          // Fetch bag capacity and price
          try {
            const priceData = await apiFetch<any>(
              `/api/v1/suppliers/${supplierId}/feed-price?feedType=${form.feedType || "starter"}`
            );
            // Store bag info in form state for display
            newForm._bagSizeKg = priceData.unitSizeKg;
            newForm._bagPriceZmw = priceData.unitPriceZmw;
            newForm.feedBrand = priceData.supplierName;

            // If bag count already entered, recalculate
            const bags = Number(newForm.bagCount) || 0;
            if (bags > 0) {
              newForm.quantityKg = Number((bags * priceData.unitSizeKg).toFixed(2));
              newForm.costZmw = Number((bags * priceData.unitPriceZmw).toFixed(2));
            }
          } catch {
            newForm._bagSizeKg = null;
            newForm._bagPriceZmw = null;
          }
        } else {
          newForm._bagSizeKg = null;
          newForm._bagPriceZmw = null;
        }
        setForm(newForm);
      }}
    >
      <option value="">Select supplier...</option>
      {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
      <option value="custom">Custom (Other)</option>
    </select>
  );
}
```

#### Bag Count Field

Shown only when a real supplier is selected:

```tsx
{form._bagSizeKg && (
  <div>
    <label className="text-sm font-medium">Bag Size: {form._bagSizeKg}kg @ ZMW {form._bagPriceZmw}/bag</label>
    <input
      type="number"
      min="0"
      step="1"
      className="w-full border rounded-md p-2"
      value={form.bagCount || ""}
      placeholder={`Enter number of ${form._bagSizeKg}kg bags`}
      onChange={(e) => {
        const bags = Number(e.target.value) || 0;
        const bagSize = form._bagSizeKg || 0;
        const bagPrice = form._bagPriceZmw || 0;
        setForm({
          ...form,
          bagCount: bags,
          quantityKg: Number((bags * bagSize).toFixed(2)),
          costZmw: Number((bags * bagPrice).toFixed(2)),
        });
      }}
    />
    <p className="text-xs text-muted-foreground mt-1">
      Auto: {form.quantityKg || 0}kg @ ZMW {form.costZmw || 0}
    </p>
  </div>
)}
```

#### Custom Supplier Input

Shown only when "Custom" is selected:

```tsx
{form.supplierId === "custom" && (
  <div>
    <label className="text-sm font-medium">Custom Supplier Name</label>
    <input
      className="w-full border rounded-md p-2"
      value={form.feedBrand || ""}
      placeholder="e.g., Local Market"
      onChange={(e) => setForm({ ...form, feedBrand: e.target.value })}
    />
  </div>
)}
```

### 2.3 Update `renderRecord` Display

Show supplier name and bag info on each feed record card:

```tsx
if (type === "feed") return (
  <span className="capitalize">
    {r.feedBrand ? `${r.feedBrand} | ` : ""}
    {r.feedType}: {r.quantityKg}kg
    {r.costZmw && ` | ZMW ${r.costZmw}`}
  </span>
);
```

### 2.4 Pre-Populate on Edit

When editing, if the record has a `supplierId`, re-fetch the price data and pre-fill `bagCount`:

```tsx
function openEdit(record: any) {
  const prefill: any = {};
  // ... existing field prefill logic ...

  // If record has a supplier, calculate bag count
  if (record.supplierId && record.quantityKg && record._bagSizeKg) {
    prefill.bagCount = Math.round(Number(record.quantityKg) / record._bagSizeKg);
  }

  setForm(prefill);
  setEditingRecord(record);
  setFormOpen(true);
}
```

### Phase 2 Close-Out

1. [ ] **Rebuild all Docker containers:** `docker compose up --build -d`
2. [ ] **Run comprehensive tests:**
   ```bash
   docker compose exec api pnpm run test
   docker compose exec web pnpm run build  # Verify frontend builds
   ```
   - Manual UI verification: open browser, navigate to flock feed tab, verify supplier dropdown, bag count, auto-calculation
   - If any test or UI issue fails, halt and fix before proceeding.
3. [ ] **Push to GitHub:**
   ```bash
   git add -A
   git commit -m "feat(frontend): supplier-aware feed records with bag capacity auto-pricing

   - Add supplier dropdown to feed add/edit dialog (existing + custom)
   - When supplier selected, fetch bag size (unitSizeKg) and bag price (unitPriceZmw)
   - Bag count input auto-calculates total kg and total cost
   - Custom supplier option shows manual name/cost entry
   - Edit dialog pre-populates bag count from stored quantity
   - Display supplier name on feed record cards

   Generated with [Devin](https://devin.ai)
   Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>"
   git push origin main
   ```
4. [ ] **Proceed to Phase 3 only when green.**

---

## Phase 3: UI/UX Polish (Estimated: 1 hour)

### 3.1 Visual Feedback
- Show a small badge/text below the bag count field: `"NUTRI FEED Starter: 50kg bag @ ZMW 785"`
- If price lookup fails, show warning: `"Price not configured for this supplier + type — enter manually"`
- When cost is auto-calculated, make the cost field read-only with a tooltip: `"Auto-calculated from supplier pricing. Click 'Override' to edit."`

### 3.2 Cost Override Toggle
- Add a small "Override cost" checkbox next to the cost field
- When checked, the cost field becomes editable
- When unchecked, cost is auto-calculated from bag count

### 3.3 Record Card Enhancement
- Display the supplier name prominently on each feed record card
- Show bag count if available (computed: `quantityKg / bagSizeKg`)

### 3.4 Summary Dashboard Enhancement
- In the flock overview summary card, show: `"Total Feed by Supplier: NUTRI FEED 150kg, TIGER FEED 100kg"`

### Phase 3 Close-Out

1. [ ] **Rebuild all Docker containers:** `docker compose up --build -d`
2. [ ] **Run comprehensive tests:**
   ```bash
   docker compose exec api pnpm run test
   docker compose exec web pnpm run build
   ```
   - Manual UI/UX verification: verify tooltips, override toggle, card display, summary
   - If any issue fails, halt and fix before proceeding.
3. [ ] **Push to GitHub:**
   ```bash
   git add -A
   git commit -m "feat(ui): polish supplier feed pricing with override toggle and visual feedback

   - Add bag size display badge under supplier selection
   - Cost override checkbox for manual price entry
   - Enhanced feed record cards with supplier name
   - Summary dashboard shows feed breakdown by supplier
   - Error states for missing supplier/feed-type price configs

   Generated with [Devin](https://devin.ai)
   Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>"
   git push origin main
   ```
4. [ ] **Proceed to Phase 4 only when green.**

---

## Phase 4: Testing (Estimated: 1.5 hours)

### 4.1 Backend Integration Tests

**File:** `apps/api/tests/integration/broiler-management.test.ts`

Add tests:
- [ ] `GET /api/v1/suppliers/:id/feed-price?feedType=starter` returns `unitSizeKg`, `unitPriceZmw`, `pricePerKg`
- [ ] Same endpoint returns 404 when supplier has no matching feed stage
- [ ] POST feed record with `supplierId` stores it and auto-sets `feedBrand`
- [ ] GET feed records list includes `supplier: { name }` in response
- [ ] PATCH feed record can update `supplierId`
- [ ] Feed summary includes `supplierBreakdown`

### 4.2 Frontend Manual Test Checklist
- [ ] Supplier dropdown lists all seeded suppliers + "Custom"
- [ ] Selecting NUTRI FEED + Starter shows: `"50kg bag @ ZMW 785"`
- [ ] Entering 2 bags auto-fills: 100kg quantity + ZMW 1570 cost
- [ ] Changing feed type (e.g., Starter -> Grower) updates bag price
- [ ] "Custom" selection shows custom name input + manual cost entry
- [ ] Edit dialog pre-fills supplier, bag count, quantity, and cost correctly
- [ ] Cost override checkbox enables manual cost editing
- [ ] Record card displays supplier name
- [ ] Summary shows feed breakdown by supplier
- [ ] All other record types (growth, water, etc.) still work normally

### 4.3 Regression Tests
- [ ] All existing 31 backend tests still pass
- [ ] Flock creation, edit, delete still work
- [ ] All 6 record types (growth, feed, water, mortality, vaccination, financial) CRUD still works

### Phase 4 Close-Out

1. [ ] **Rebuild all Docker containers:** `docker compose up --build -d`
2. [ ] **Run comprehensive test suite:**
   ```bash
   docker compose exec api pnpm run test
   ```
   - All 31+ tests must pass.
   - If any test fails, halt, fix, re-run until green.
3. [ ] **Push to GitHub:**
   ```bash
   git add -A
   git commit -m "test: add integration tests for supplier feed pricing

   - Test GET /suppliers/:id/feed-price endpoint for all feed types
   - Test feed record create with supplierId auto-sets feedBrand
   - Test feed record list includes supplier name
   - Verify regression: all existing tests still pass

   Generated with [Devin](https://devin.ai)
   Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>"
   git push origin main
   ```
4. [ ] **Proceed to Phase 5 only when green.**

---

## Phase 5: Deployment & Final Verification (Estimated: 30 min)

1. [ ] Run Prisma migration in production environment
2. [ ] Run `docker compose -f docker-compose.prod.yml up --build -d`
3. [ ] Verify in browser on production domain:
   - [ ] Supplier dropdown populates
   - [ ] Bag count auto-calculates cost and quantity
   - [ ] Custom supplier entry works
   - [ ] Edit pre-fills correctly
4. [ ] Final commit and version tag:
   ```bash
   git tag -a v0.2.2 -m "feat: supplier-aware feed records with auto-pricing and bag capacity"
   git push origin v0.2.2
   ```
5. [ ] Update `CHANGELOG.md` or release notes

### Phase 5 Close-Out

1. [ ] **Final rebuild and restart:** `docker compose -f docker-compose.prod.yml up --build -d`
2. [ ] **Final test run:** `docker compose exec api pnpm run test`
3. [ ] **Push final tag and release notes to GitHub**
4. [ ] **Close implementation — mark all tasks complete.**

---

## Files to Modify

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add `supplierId` to `FeedRecord`, `feedRecords` to `Supplier` |
| `apps/api/src/modules/suppliers/routes.ts` | Add `GET /:id/feed-price` endpoint |
| `apps/api/src/modules/feed-records/routes.ts` | Update schema, POST/PATCH handlers, GET includes supplier |
| `apps/web/src/app/broiler-flocks/[id]/page.tsx` | Supplier selector, bag count, auto-calculation UI |
| `apps/web/src/lib/types.ts` | Add `Supplier` and `FeedStage` types if missing |
| `apps/api/tests/integration/broiler-management.test.ts` | Add supplier feed price tests |

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Supplier has no price for selected feed type | Show error message + allow manual entry |
| `feedBrand` already has legacy data | Keep nullable; new records populate from supplier |
| User changes supplier after entering bag count | Re-calculate cost and quantity automatically |
| User changes feed type after supplier selected | Re-fetch price data, recalculate |
| Prisma migration on existing data | `supplierId` is nullable, no data loss |
| Bag count leads to fractional kg | Round to 2 decimal places, store as Decimal |
| Network failure fetching price | Fallback to manual entry mode |
