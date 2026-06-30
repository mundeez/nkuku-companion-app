# Implementation Plan — Integrate Ross 308 Zambia Broiler Research into Nkuku Companion App

**Date:** 2026-06-30  
**Target Repository:** `/home/mundeez/DevWorkz/nkuku-companion-app`  
**Source Assets:**  
- `Ross308_Zambia_Broiler_Management_Guide.md`  
- `Ross308_Broiler_Management_System.xlsx`  
- `Ross308_Printable_Calendar.xlsx`  
- `References.md`  

**Objective:** Convert the static research, schedule, and tracking Excel workbooks into persistent, interactive features inside the Nkuku broiler-management module.  

---

## 1. What the Source Assets Contain

### 1.1 Management Guide
A 40 KB evidence-based guide covering:
- Ross 308 breed overview for Zambia / Southern Africa.
- Disease profiles for Newcastle Disease (ND), Infectious Bronchitis (IB), IBD/Gumboro, Marek's, Coccidiosis, ILT, Fowl Pox, Avian Influenza, Salmonella, E. coli, Mycoplasma/CRD, and Necrotic Enteritis.
- Two vaccination protocols:
  1. **Hatchery-based (preferred)** — day-old ND+IB spray, IBD immune-complex, Marek's, optional coccidiosis vaccine.
  2. **On-farm-only** — Marek's sourcing note, ND+IB at 5–7 d, Gumboro at 14–16 d, ND at 18–21 d, optional IBD/ND boosters.
- Medication stewardship, withdrawal periods, and non-antibiotic supportive care.
- Brooding, nutrition, water, ventilation, lighting, and heat-stress management.
- Emergency response protocols.
- Ross 308 performance targets (weight, FCR, feed/water intake) from Aviagen 2022.

### 1.2 Excel Workbook (`Ross308_Broiler_Management_System.xlsx`)
12 sheets that map directly to app concepts:

| Sheet | Purpose | Nkuku Mapping |
|-------|---------|---------------|
| `Dashboard` | Flock age, days to market, mortality, expected weight/feed/water, reminders, upcoming vaccinations. | Flock dashboard + alert engine. |
| `PerfData` | Daily Ross 308 performance targets (0–49 d). | `performance_targets` table seed. |
| `Hatch Calculator` | Event timeline from hatch to market. | New calendar/timeline endpoint. |
| `Vaccination Calendar` | Day, vaccine, disease, route, booster, completed flag, batch/expiry/administrator. | `vaccination_events` + `vaccination_schedules`. |
| `Daily Checklist` | Day-by-day tasks, feed, temperature, humidity, health checks. | New `daily_checklist` / `flock_tasks` feature. |
| `Weekly Weights` | Weekly weight sample + growth chart. | `growth_records` + chart. |
| `Feed Tracking` | Daily feed type, quantity, cost, feed per bird. | `feed_records`. |
| `Water Tracking` | Daily water, pH, temp, cost. | `water_records` (already exists). |
| `Mortality Log` | Daily deaths, cumulative, chart. | `mortality_events` + chart. |
| `Medication Register` | Treatment, dose, withdrawal, vet info. | New `medication_records` table. |
| `Vaccine Inventory` | Stock, batch, expiry, supplier. | New `vaccine_inventory` table. |
| `Farm Records` | Brooder temp, humidity, ventilation, litter, light. | New `environmental_records` table. |

### 1.3 Printable Calendar
A single 0–49 day calendar with: vaccinations, feed-phase changes, daily management tasks, and stress/health support. This should become a **printable report page** in the web app.

### 1.4 References
Citations with confidence levels, URLs, and access dates. These should be surfaced in a **Research / Knowledge base** section or inline tooltips in the app.

---

## 2. Current Nkuku App State (Milestone 2)

### Existing Database
- `breeds` (Ross 308 primary, Cobb 500).
- `performance_targets` — 57 Ross 308 + 9 Cobb 500 daily rows.
- `broiler_flocks`, `growth_records`, `feed_records`, `water_records`, `mortality_events`, `vaccination_events`, `financial_records`, `alerts`, `diseases`, `vaccination_schedules`, `vaccination_schedule_items`.
- `FinancialCategory` enum, `AlertType` enum, `AlertSeverity` enum.

### Existing Seeds
- `broiler-breeds.ts`
- `ross308-performance.ts` (57 rows)
- `cobb500-performance.ts`
- `diseases.ts` (10 diseases)
- `vaccination-schedules.ts` (Standard Botswana + Ross 308 Comprehensive)

### Existing API Modules
- `broiler-flocks`, `growth-records`, `feed-records`, `water-records`, `mortality-events`, `vaccination-events`, `financial-records`, `alerts`, `diseases`, `breeds`.

### Existing Web Pages
- Dashboard (broiler stats cards).
- `/broiler-flocks` list.
- `/broiler-flocks/[id]` tabbed detail (overview, growth, feed, water, mortality, vaccination, financial).
- `/diseases`, `/alerts`.

---

## 3. Gap Analysis

| Capability | Source Asset | Nkuku Status | Gap |
|------------|------------|--------------|-----|
| Ross 308 performance data (0–49 d) | `PerfData` sheet | 57 rows (0–56 d) | Data matches; enrich with water-intake targets. |
| Zambia-specific disease context | Guide | 10 generic diseases | Expand disease seeds with Zambia-specific notes, ND genotype VII.2, heat-stress links. |
| Hatch-to-market timeline | `Hatch Calculator` | Not implemented | Add flock-level calendar/timeline API + UI. |
| Daily checklist | `Daily Checklist` | Not implemented | Add `flock_tasks` or `daily_checklists` table + UI. |
| Medication register | `Medication Register` | `FinancialRecord` only | Add `medication_records` table with withdrawal tracking. |
| Vaccine inventory | `Vaccine Inventory` | Not implemented | Add `vaccine_inventory` table. |
| Environmental records | `Farm Records` | Not implemented | Add `environmental_records` table. |
| Zambia vaccination schedule | `Vaccination Calendar` sheet | Ross 308 Comprehensive exists | Add a **Zambia Ross 308** schedule with correct ages and products. |
| Upcoming vaccinations dashboard | `Dashboard` | Basic schedule matching | Add `nextDueDate` driven alert logic. |
| Printable calendar | `Printable Calendar` | Not implemented | Add `/broiler-flocks/[id]/calendar` print view. |
| Research references | `References.md` | Not implemented | Add `/docs` or inline reference popovers. |
| Feed-phase change tracking | Excel feed sheet | Not implemented | Add `feed_phase` concept + alerts. |
| Heat-stress / season adjustments | Guide | Not implemented | Add environmental thresholds and alert generation. |

---

## 4. Proposed Implementation Phases

### Phase 1 — Data & Schema Foundation (1–2 days)
1. **Expand `performance_targets` seed** to include water-intake target per day (1.8 × feed intake from workbook).
2. **Update disease seeds** with Zambia-specific evidence, ND genotype VII.2, IBD MDA guidance, organic treatments, and vaccination linkage.
3. **Add new Prisma tables:**
   - `medication_records`
   - `vaccine_inventory`
   - `environmental_records`
   - `flock_tasks` (daily checklist)
   - Optional: `vaccination_batches` (stock batch per event).
4. **Add new enums:**
   - `MedicationRecordCategory`: antibiotic, coccidiostat, electrolyte, vitamin, probiotic, other.
   - `VaccineInventoryStatus`: available, in_use, expired, depleted.
   - `FlockTaskStatus`: pending, completed, skipped.
   - `FlockTaskCategory`: vaccination, feed, water, environment, health, biosecurity.
5. **Add new `AlertType` values:** `medication_due`, `withdrawal_due`, `vaccine_expiry`, `environmental_threshold`.
6. **Add new `FinancialCategory` value:** `vaccine_inventory` (if buying inventory separately).
7. **Update `vaccination_schedules.ts`** to add a `Ross 308 Zambia Schedule` with the exact ages from the workbook:
   - Day 1: Marek's, ND+IB spray, IBD immune-complex, coccidiosis vaccine.
   - Day 10: IB + ND booster.
   - Day 14: IBD live (D78) if no immune-complex.
   - Day 21: ND booster.
   - Day 28: ND booster (if kept > 42 d).

### Phase 2 — Backend API Enhancements (2–3 days)
1. **Update `vaccination-events/routes.ts`**
   - Support `batchNumber` and `expiryDate` fields.
   - Add `GET /schedule?flockId=` Zambia-specific schedule.
   - Add `POST /complete` that marks a scheduled item as done and creates a `VaccinationEvent` + financial record.
2. **New `medication-records` module**
   - CRUD endpoints: `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`.
   - Auto-create `FinancialRecord` with `category = 'medication'`.
   - Auto-generate withdrawal alert when `withdrawalDays` is set.
3. **New `vaccine-inventory` module**
   - CRUD endpoints.
   - Auto-create `FinancialRecord` on purchase.
   - Link to `vaccination_events` via `vaccineInventoryId`.
   - Expiry alert generation.
4. **New `environmental-records` module**
   - CRUD endpoints: temperature, humidity, ammonia, ventilation, light hours, litter score.
   - Alert generation when temperature/humidity out of breed targets.
5. **New `flock-tasks` module**
   - Generate daily checklist based on flock age + schedule.
   - Mark tasks complete / skipped.
   - Endpoints: `GET /?flockId=`, `POST /`, `PATCH /:id`.
6. **Update `alerts/routes.ts`**
   - Extend `generate` logic to include:
     - Vaccination due (already partly present).
     - Feed transition (already partly present; add finisher transition Day 25).
     - Medication withdrawal.
     - Vaccine expiry.
     - Environmental threshold.
     - Daily checklist tasks.
7. **Enhance `broiler-flocks/routes.ts`**
   - Add `GET /:id/timeline` returning hatch-to-market events (vaccines, feed changes, target dates).
   - Add `GET /:id/summary` for printable calendar data.
   - Add `GET /:id/performance` returning expected weight, feed, water for current age.

### Phase 3 — Frontend Enhancements (3–4 days)
1. **Flock detail page (`/broiler-flocks/[id]/page.tsx`)**
   - Add new tabs: **Tasks**, **Environment**, **Medication**, **Calendar**, **Print**.
   - Re-use existing generic record-list component if available.
2. **Tasks tab**
   - Auto-generated daily checklist per flock age.
   - Quick-complete buttons.
   - Color-coded categories.
3. **Environment tab**
   - Form: temperature, humidity, ammonia, light hours, litter score.
   - Line chart (temperature/humidity over time).
   - Alert banner if last reading is outside target.
4. **Medication tab**
   - Form: product, category, dose, start date, withdrawal days, vet prescription.
   - Show withdrawal countdown and alert status.
5. **Calendar tab**
   - Day-grid (0 → targetAge) showing vaccines, feed phases, tasks.
   - Export to PDF / print.
6. **Print view**
   - `/broiler-flocks/[id]/calendar/print` — clean CSS, landscape, no nav.
7. **Dashboard cards**
   - Add: upcoming vaccination count, open task count, environmental alerts.
8. **Disease database page**
   - Add Zambia-specific badges and " linked vaccines" suggestions.
   - Add "Reference" popover linking to `References.md`.

### Phase 4 — Reports & Printables (1–2 days)
1. **Printable vaccination + management calendar**
   - Replicate `Ross308_Printable_Calendar.xlsx` as HTML/CSS print page.
   - Use Next.js route `/broiler-flocks/[id]/calendar/print`.
   - Add a `Print` button to the Calendar tab.
2. **Flock summary PDF** (optional)
   - Use `react-to-print` or `@react-pdf/renderer` to export a single flock report.
3. **Research / References page**
   - `/docs/references` or `/knowledge/references` rendering `References.md`.

### Phase 5 — Testing & Validation (2 days)
1. **Prisma migration tests**
   - `docker compose exec api npx prisma db push` on a fresh database.
   - Run `npx prisma db seed` and verify seed counts.
2. **Unit tests**
   - Alert generation logic.
   - Timeline / checklist generation.
   - Withdrawal date calculation.
3. **Integration tests**
   - CRUD for medication, environmental, vaccine inventory records.
   - Schedule retrieval and completion flow.
   - Financial record auto-creation.
4. **Frontend tests**
   - Calendar tab renders without error.
   - Print view loads.
   - Task completion updates state.
5. **End-to-end smoke test**
   - Create a Ross 308 flock, generate alerts, complete a vaccination, record environment, print calendar.

---

## 5. Detailed Task Breakdown

### 5.1 Database Migration

```sql
-- New table: medication_records
model MedicationRecord {
  id              String   @id @default(uuid()) @db.Uuid
  flockId         String   @map("flock_id") @db.Uuid
  recordDate      DateTime @map("record_date") @db.Date
  productName     String   @map("product_name") @db.VarChar(100)
  category        MedicationCategory
  dose            String?  @db.VarChar(100)
  route           String?  @db.VarChar(50)
  startDate       DateTime @map("start_date") @db.Date
  endDate         DateTime? @map("end_date") @db.Date
  withdrawalDays  Int?     @map("withdrawal_days")
  withdrawalDate  DateTime? @map("withdrawal_date") @db.Date
  costZmw         Decimal? @map("cost_zmw") @db.Decimal(14,2)
  veterinarian    String?  @db.VarChar(100)
  notes           String?  @db.Text
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  flock           BroilerFlock @relation(fields: [flockId], references: [id], onDelete: Cascade)
  @@map("medication_records")
}

enum MedicationCategory {
  antibiotic
  coccidiostat
  electrolyte
  vitamin
  probiotic
  acidifier
  phytogenic
  other
}

-- New table: vaccine_inventory
model VaccineInventory {
  id           String   @id @default(uuid()) @db.Uuid
  name         String   @db.VarChar(100)
  disease      String?  @db.VarChar(100)
  supplier     String?  @db.VarChar(100)
  batchNumber  String   @map("batch_number") @db.VarChar(100)
  quantityDoses Int     @map("quantity_doses")
  expiryDate   DateTime @map("expiry_date") @db.Date
  status       VaccineInventoryStatus @default(available)
  costZmw      Decimal? @map("cost_zmw") @db.Decimal(14,2)
  notes        String?  @db.Text
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@map("vaccine_inventory")
}

enum VaccineInventoryStatus {
  available
  in_use
  expired
  depleted
}

-- New table: environmental_records
model EnvironmentalRecord {
  id              String   @id @default(uuid()) @db.Uuid
  flockId         String   @map("flock_id") @db.Uuid
  recordDate      DateTime @map("record_date") @db.Date
  timeOfDay       String?  @map("time_of_day") @db.VarChar(20)
  temperatureC    Decimal? @map("temperature_c") @db.Decimal(5,2)
  humidityPct   Decimal? @map("humidity_pct") @db.Decimal(5,2)
  ammoniaPpm    Decimal? @map("ammonia_ppm") @db.Decimal(5,2)
  lightHours    Decimal? @map("light_hours") @db.Decimal(4,2)
  litterScore     Int?     @map("litter_score") // 1-5
  ventilationNote String? @map("ventilation_note") @db.Text
  notes           String? @db.Text
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  flock           BroilerFlock @relation(fields: [flockId], references: [id], onDelete: Cascade)
  @@map("environmental_records")
}

-- New table: flock_tasks
model FlockTask {
  id          String      @id @default(uuid()) @db.Uuid
  flockId     String      @map("flock_id") @db.Uuid
  taskDate    DateTime    @map("task_date") @db.Date
  ageDays     Int         @map("age_days")
  category    FlockTaskCategory
  title       String      @db.VarChar(200)
  description String?     @db.Text
  isCompleted Boolean     @default(false) @map("is_completed")
  isSkipped   Boolean     @default(false) @map("is_skipped")
  completedAt DateTime?   @map("completed_at") @db.Timestamptz(6)
  notes       String?     @db.Text
  createdAt   DateTime    @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime    @updatedAt @map("updated_at") @db.Timestamptz(6)

  flock       BroilerFlock @relation(fields: [flockId], references: [id], onDelete: Cascade)
  @@map("flock_tasks")
}

enum FlockTaskCategory {
  vaccination
  feed
  water
  environment
  health
  biosecurity
  management
}
```

**Schema changes to existing tables:**
- `VaccinationEvent`: add `batchNumber`, `expiryDate`, `vaccineInventoryId` (optional).
- `PerformanceTarget`: add `targetWater` (Decimal).
- `AlertType`: add `medication_due`, `withdrawal_due`, `vaccine_expiry`, `environmental_threshold`, `task_due`.

### 5.2 Seed Data Updates

1. **`ross308-performance.ts`**
   - Add `targetWater` per day using the 1.8× feed-intake rule from the workbook.
   - Ensure data extends to Day 56 (already exists).

2. **`diseases.ts`**
   - Expand existing Newcastle Disease entry with Zambia genotype VII.2 note.
   - Expand IBD entry with MDA / Deventer formula note.
   - Add new diseases: Infectious Bronchitis, Necrotic Enteritis, Chronic Respiratory Disease (if not already covered by CRD).
   - Add `zambiaContext` field to disease schema (optional) or append to `prevention`.

3. **`vaccination-schedules.ts`**
   - Add `Ross 308 Zambia Schedule` (or rename to `Ross 308 Zambia — Hatchery` and `Ross 308 Zambia — On-Farm`).
   - Seed exact ages and products from the workbook.

4. **`main.ts`**
   - Import and call new seed functions if created.

### 5.3 Backend Modules

#### `medication-records/routes.ts`
```
GET    /api/v1/medication-records?flockId=...
POST   /api/v1/medication-records
PATCH  /api/v1/medication-records/:id
DELETE /api/v1/medication-records/:id
```
- Auto-create `FinancialRecord` with `category = 'medication'`.
- Auto-calculate `withdrawalDate` from `startDate + withdrawalDays`.

#### `vaccine-inventory/routes.ts`
```
GET    /api/v1/vaccine-inventory
POST   /api/v1/vaccine-inventory
PATCH  /api/v1/vaccine-inventory/:id
DELETE /api/v1/vaccine-inventory/:id
```
- Auto-update `status` to `expired` when `expiryDate < today`.
- Auto-create financial record on purchase.

#### `environmental-records/routes.ts`
```
GET    /api/v1/environmental-records?flockId=...
POST   /api/v1/environmental-records
PATCH  /api/v1/environmental-records/:id
DELETE /api/v1/environmental-records/:id
```

#### `flock-tasks/routes.ts`
```
GET    /api/v1/flock-tasks?flockId=...&date=...
POST   /api/v1/flock-tasks/generate  // generate tasks for a flock
PATCH  /api/v1/flock-tasks/:id
```
- Generate tasks from:
  - Vaccination schedule items.
  - Feed phase transitions (starter→grower, grower→finisher).
  - Daily routine tasks (temperature check, feed/water check, mortality record, litter inspection).

#### `broiler-flocks/routes.ts` additions
```
GET /api/v1/broiler-flocks/:id/timeline
GET /api/v1/broiler-flocks/:id/summary
GET /api/v1/broiler-flocks/:id/performance
```

### 5.4 Frontend Pages

- `/broiler-flocks/[id]/tasks` — daily checklist.
- `/broiler-flocks/[id]/environment` — environmental records + chart.
- `/broiler-flocks/[id]/medication` — medication register + withdrawal countdown.
- `/broiler-flocks/[id]/calendar` — interactive calendar.
- `/broiler-flocks/[id]/calendar/print` — printable calendar.
- `/docs/references` — research references (optional).

### 5.5 Alert Generation Logic

Update `alerts/routes.ts` `POST /generate`:

```
For each active flock:
  ageDays = today - startDate

  // Vaccination due
  for each scheduled item where ageDays >= item.ageDays - 1 and <= item.ageDays + 1:
    if not completed in vaccinationEvents:
      create/upsert alert vaccination_due

  // Feed transitions
  if ageDays == feedTransitionDay: alert feed_transition
  if ageDays == 25 (configurable): alert feed_transition finisher

  // Medication withdrawal
  for each medication record with withdrawalDate == today + 1:
    create alert withdrawal_due

  // Vaccine expiry
  for each vaccine inventory item with expiryDate <= today + 7:
    create alert vaccine_expiry

  // Environmental threshold
  for each environmental record in last 24h:
    if temperatureC or humidityPct outside age-specific target:
      create alert environmental_threshold

  // Daily tasks
  for each pending flock_task due today:
    create alert task_due
```

---

## 6. Migration Plan

1. **Create branch** `feat/ross308-zambia-integration`.
2. **Prisma migration** (or `db push` for dev):
   ```bash
   cd /home/mundeez/DevWorkz/nkuku-companion-app
   docker compose exec api npx prisma migrate dev --name ross308_zambia_features
   ```
3. **Seed updates**:
   ```bash
   docker compose exec api npx prisma db seed
   ```
4. **Restart API** to register new modules.
5. **Test all new endpoints** with curl/Postman.
6. **Run frontend build**:
   ```bash
   docker compose exec web pnpm run build
   ```
7. **Run tests**:
   ```bash
   docker compose exec api pnpm run test
   ```
8. **Tag release** `v0.3.0-ross308-zambia` after validation.

---

## 7. Testing & Acceptance Criteria

| Feature | Acceptance Criteria |
|---------|---------------------|
| Zambia vaccination schedule | `GET /api/v1/vaccination-events/schedule?flockId=...` returns Day 1, 10, 14, 21, 28 items for a Ross 308 flock. |
| Daily checklist | Tasks are auto-generated for a new flock; user can mark complete. |
| Medication register | Creating a medication record with withdrawal days creates an alert and a financial record. |
| Environmental records | Recording out-of-range temperature creates an environmental alert. |
| Vaccine inventory | Expiring vaccine creates an alert within 7 days of expiry. |
| Flock calendar | Calendar page shows vaccines, feed transitions, and daily tasks. |
| Print calendar | `/broiler-flocks/[id]/calendar/print` renders a clean printable page. |
| Dashboard | Cards display upcoming vaccinations, open tasks, and environmental alerts. |
| Full test suite | `docker compose exec api pnpm run test` passes. |

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Large schema migration on production data | Use `prisma migrate dev` locally; test against a copy of production data before applying. |
| Existing schedule mismatch | Keep the existing `Standard Broiler Schedule` and `Ross 308 Comprehensive Schedule`; add new Zambia schedules without breaking old ones. |
| Front-end tab overload | Group tasks/environment/medication into collapsible tabs; use icons. |
| Alert noise | Only generate alerts for today ± 2 days and deduplicate by `flockId + alertType + dueDate`. |
| Print view styling | Use Tailwind `print:*` modifiers and test from browser print dialog. |

---

## 9. Out-of-Scope (Future Work)

- Machine-learning disease prediction.
- SMS/WhatsApp alert delivery.
- Offline mobile checklist (Milestone 3).
- Direct integration with hatchery ERP systems.
- Automated feed-order recommendations.

---

## 10. References

- Source assets: `Ross308_Zambia_Broiler_Management_Guide.md`, `Ross308_Broiler_Management_System.xlsx`, `Ross308_Printable_Calendar.xlsx`, `References.md`.
- Nkuku architecture: `AGENTS.md` in repository root.
- Primary breed source: Aviagen Ross 308/308 FF Broiler Performance Objectives 2022.

---

**Next Step:** Approve this plan, then begin Phase 1 (schema + seed updates).
