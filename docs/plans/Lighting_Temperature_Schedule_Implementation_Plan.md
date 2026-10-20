# Lighting & Temperature Schedule — Implementation Plan

**Version:** 1.0.0
**Date:** 2026-07-09
**Scope:** Add Ross 308 lighting and temperature/brooding schedule support to the Nkuku Companion App (API + Web + Mobile), gated by user approval. No code changes have been made yet.

---

## 1. Goals and Non-Goals

### Goals
- Provide flock-specific, age-based Ross 308 lighting and temperature/brooding targets from day 0 to depletion.
- Surface the schedule in the existing web Environment page, the Management Calendar, and the printable calendar.
- Generate daily environment tasks from the schedule so they appear in the daily checklist.
- Replace/upgrade the current simple environmental-threshold alert logic with schedule-driven thresholds.
- Keep the reference doc (`docs/environment/Ross308_Zambia_Lighting_Temperature_Guide.md`) in sync with in-app data.

### Non-Goals
- No closed-loop IoT control of lights/heaters in this milestone.
- No per-house climate modeling beyond whole-house/spot-brooding selection.
- No new financial ledger entries (environment records are operational, not financial).

---

## 2. Existing Feature Audit

### Vaccine schedule pattern (the model to mirror)
- **Schema:** `VaccinationSchedule` + `VaccinationScheduleItem` (breed-optional, `ageDays`, `sortOrder`).
- **Seed:** `apps/api/src/db/seeds/vaccination-schedules.ts` hard-codes Ross 308 Zambia, Ross 308 Comprehensive, and Standard Broiler schedules.
- **API:** `GET /api/v1/vaccination-events/schedules`, `GET /api/v1/vaccination-events/schedule?flockId=...`
- **Flock age calc:** `ageDays = Math.floor((today - startDate) / 86,400,000)` (repeated in `/summary`, `/schedule`, alert generator).
- **Task generation:** `POST /api/v1/flock-tasks/generate` iterates `0..targetAge` and creates `FlockTask` rows when `item.ageDays === ageDays`.
- **Web UI:** Flock detail vaccination tab, dedicated `/broiler-flocks/[id]/tasks` checklist, `/broiler-flocks/[id]/calendar` + `/calendar/print`.
- **Mobile UI:** `VaccinationSchedulesScreen`, vaccination tab inside `FlockDetailScreen`.

### Existing environment infrastructure
- **Schema:** `EnvironmentalRecord` already logs `temperatureC`, `humidityPct`, `lightHours`, etc.
- **API:** Full CRUD at `/api/v1/environmental-records`.
- **Web UI:** `/broiler-flocks/[id]/environment` page exists and records readings.
- **Alerts:** `alerts/routes.ts` already generates `environmental_threshold` alerts using a rough age/temp map (`≤7→32°C`, `≤14→30°C`, etc.).
- **Mobile:** No environment screen exists yet.

### Reference-doc integration
- The vaccine reference doc (`docs/vaccines/Ross308_Zambia_Broiler_Management_Guide.md`) is **not rendered in-app**. It is a project artifact only.
- The printable calendar footer currently cites Aviagen/UNZA guidance inline.

---

## 3. Proposed Data Model

### Option A — Extend vaccination schedule (rejected)
Add `type` enum to `VaccinationScheduleItem` (`vaccine` | `environment`) and reuse the same tables.
- **Why rejected:** Vaccines and environment have very different semantics (event-driven vs continuous targets, different required fields). Mixing them makes the vaccine-specific API/UI brittle and confusing.

### Option B — Generic `FlockSchedule` with polymorphic items (rejected)
Create a normalized generic schedule model that supports vaccine, lighting, temperature, and future schedule types.
- **Why rejected:** Higher refactoring risk; would require migrating existing vaccination schedules and updating all API/UI consumers. Better reserved for a future consolidation milestone.

### Option C — New `LightingTemperatureSchedule` + `LightingTemperatureScheduleItem` (recommended)
Create dedicated tables mirroring the vaccine pattern but with environment-specific fields.

```prisma
model LightingTemperatureSchedule {
  id          String   @id @default(uuid()) @db.Uuid
  breedId     String?  @map("breed_id") @db.Uuid
  name        String   @db.VarChar(100)
  isDefault   Boolean  @default(false) @map("is_default")
  description String?  @db.Text
  housingType HousingType @default(whole_house) @map("housing_type")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  items LightingTemperatureScheduleItem[]

  @@unique([name])
  @@map("lighting_temperature_schedules")
}

enum HousingType {
  whole_house
  spot_brooding
}

model LightingTemperatureScheduleItem {
  id                String   @id @default(uuid()) @db.Uuid
  scheduleId        String   @map("schedule_id") @db.Uuid
  ageDays           Int      @map("age_days")
  lightHours        Decimal? @map("light_hours") @db.Decimal(4, 2)
  darkHours         Decimal? @map("dark_hours") @db.Decimal(4, 2)
  lightIntensityLux Int?     @map("light_intensity_lux")
  darkIntensityLux  Int?     @map("dark_intensity_lux")
  targetTempC       Decimal? @map("target_temp_c") @db.Decimal(5, 2)
  targetTempMinC    Decimal? @map("target_temp_min_c") @db.Decimal(5, 2)
  targetTempMaxC    Decimal? @map("target_temp_max_c") @db.Decimal(5, 2)
  targetRhMinPct    Int?     @map("target_rh_min_pct")
  targetRhMaxPct    Int?     @map("target_rh_max_pct")
  notes             String?  @db.Text
  sortOrder         Int      @map("sort_order")
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt         DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  schedule LightingTemperatureSchedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)

  @@index([scheduleId, sortOrder])
  @@index([scheduleId, ageDays])
  @@map("lighting_temperature_schedule_items")
}
```

#### Why one row per day is recommended over range rows
- Vaccine schedule uses exact `ageDays` match, so per-day items reuse the same lookup pattern.
- Temperature step-downs are small and non-linear; per-day rows avoid runtime interpolation and make the schedule explicit and auditable.
- Range rows would require a new `BETWEEN` lookup and make the printable calendar less straightforward.

**Seed strategy:** A new `apps/api/src/db/seeds/lighting-temperature-schedules.ts` will insert one row per day (0..42) for whole-house and one for spot-brooding, derived directly from `docs/environment/Ross308_Zambia_Lighting_Temperature_Guide.md`.

---

## 4. Proposed API Changes

### New endpoints
- `GET /api/v1/lighting-temperature-schedules` — list schedules with items (analogous to `/vaccination-events/schedules`).
- `GET /api/v1/lighting-temperature-schedules/current?flockId=...` — return the schedule item for the flock's current `ageDays`.
- `GET /api/v1/broiler-flocks/:id/environment-schedule` — full day-by-day schedule for the flock (used by calendar/print).

### Modified endpoints
- `POST /api/v1/flock-tasks/generate` — add environment tasks (e.g., "Set brooder temperature to 32°C", "Ensure 23 hours light") when `ageDays` matches schedule items.
- `POST /api/v1/alerts/generate` — replace the hard-coded temperature/humidity thresholds with schedule-driven lookups from `LightingTemperatureScheduleItem`.
- `GET /api/v1/broiler-flocks/:id/summary` — include `temperatureC`, `rhPct`, `lightHours`, `lightIntensityLux`, and `darkHours` per day for the calendar/print views.

### No changes to existing environment CRUD
- `/api/v1/environmental-records` keeps its current schema and validation. It will be the source of actual readings compared against schedule targets.

---

## 5. Proposed UI Changes

### Web

#### Option A — Extend vaccine schedule screen (rejected)
- Rejected because environment is not a vaccine; mixing them would overload the vaccine tab and calendar with non-vaccine data.

#### Option B — New top-level "Environment Schedule" page (rejected)
- Rejected because the existing `/broiler-flocks/[id]/environment` page already owns environment context; splitting it would fragment the user flow.

#### Option C — Enhance existing Environment page + calendar (recommended)
1. **Environment page (`/broiler-flocks/[id]/environment`)**
   - Add a "Today's Targets" card showing light hours, dark hours, intensity, target temp, and RH range for the current flock age.
   - Add a full schedule table below the reading list (collapsible or tabbed).
   - Show a visual indicator when the latest reading is inside/outside the target range.

2. **Flock detail overview tab**
   - Add a small "Environment Targets" tile linking to the environment page.

3. **Management Calendar + Print**
   - Add columns to `FlockCalendarDay`: Target Temp (°C), RH Range, Light/Dark Hours, Light Intensity.
   - The printable calendar should include these columns and a footer citing the new reference doc.

4. **Daily Checklist (`/broiler-flocks/[id]/tasks`)**
   - Generated environment tasks already appear under `FlockTaskCategory.environment` ("Check temperature and humidity 2x daily"). Extend generation to include age-specific tasks like:
     - Day 0: Preheat house to 30°C, litter 28–32°C, 23h light.
     - Day 7: Step down to 4–6 hours darkness, reduce intensity to 5–10 lux.
     - Day 10/14/18/21: Lighting tasks already captured by stable grow-out values; no action unless schedule changes.

### Mobile

#### Option A — Add environment tab to `FlockDetailScreen` (recommended for consistency)
- Reuses existing `FlockDetailScreen` tab structure.
- Shows current readings and today's schedule targets.
- A separate "Full Schedule" view lists day-by-day targets.

#### Option B — New standalone `EnvironmentScreen` (future)
- Could be added later if the flock detail tab becomes too crowded.

---

## 6. Day-by-Day Interpolation Logic

### Recommendation: no runtime interpolation
- Seed the schedule with one row per day (0..42), populating every field.
- Lookups use exact `ageDays` matching, identical to vaccine schedule matching.
- This makes the schedule self-documenting and avoids floating-point rounding issues.

### If range rows are preferred later
- A service function `getItemAtAge(scheduleId, ageDays)` would find the row where `startDay <= ageDays <= endDay`.
- Temperature would be read directly from the matched row; no linear interpolation is needed because published guides give block targets.
- If a future feature needs smooth minute-level curves, interpolation can be added then without schema changes.

### Existing date logic to reuse
- `ageDays` calculation: `(today - startDate) / 86,400,000` (already used in 5+ places).
- `taskDate` calculation: `startDate + ageDays * 86,400,000` (used in `flock-tasks/routes.ts`).

---

## 7. Migration / Rollback Considerations

### This milestone is additive
- New tables only; no changes to existing `vaccination_schedules`, `environmental_records`, `flock_tasks`, or `broiler_flocks` columns.
- Existing alert logic will be replaced in-place, but alert rows remain unchanged.

### Deployment steps
1. Schema change via Prisma:
   ```bash
   docker compose exec api npx prisma db push
   docker compose exec api npx prisma generate
   docker restart nkuku-companion-app-api-1
   ```
2. Seed new schedules:
   ```bash
   docker compose exec api npx tsx src/db/seeds/lighting-temperature-schedules.ts
   ```
   Or add the call to `main.ts` and run `npx prisma db seed`.
3. Rebuild web container:
   ```bash
   docker compose down && docker compose up --build -d
   ```
4. Run test suite:
   ```bash
   docker compose exec api pnpm run test
   ```

### Rollback
1. Revert Prisma schema and code changes.
2. Drop new tables manually if needed:
   ```sql
   DROP TABLE IF EXISTS lighting_temperature_schedule_items;
   DROP TABLE IF EXISTS lighting_temperature_schedules;
   ```
3. Revert `flock-tasks/routes.ts` and `alerts/routes.ts` to previous versions.
4. Re-deploy previous container image or git tag.

### Milestone tagging suggestion
- This is a self-contained operational enhancement. Suggested tag: `v0.4.1-alpha` or bundled with other operational features as `v0.5.0-alpha`.

---

## 8. Testing Plan

### Unit / integration tests
- Seed produces exactly 43 rows per schedule (days 0–42) for both whole-house and spot-brooding.
- `GET /api/v1/broiler-flocks/:id/environment-schedule` returns correct targets for a known `startDate`.
- Alert generator creates `environmental_threshold` alerts when the latest `EnvironmentalRecord` deviates from schedule targets.
- `POST /api/v1/flock-tasks/generate` creates environment tasks on expected days.
- Existing vaccine schedule tests continue to pass unchanged.

### Web tests (manual / E2E)
- Environment page displays today's targets for an active flock.
- Printable calendar includes lighting/temperature columns.

### Mobile tests (manual)
- Flock detail environment tab shows current targets.

---

## 9. Open Questions / Assumptions Needing Sign-Off

1. **Scope priority:** Should we ship Web first and mobile environment tab in a follow-up, or require both in this milestone?
2. **Housing type:** Should the app store a `housingType` on `BroilerFlock` so it can automatically choose whole-house vs spot-brooding targets, or default to whole-house with a note that spot-brooding targets are also available?
3. **Schedule editing:** Should users be able to customize the lighting/temperature schedule per farm, or should it be read-only reference data (like vaccine schedules currently are)?
4. **Alert replacement:** Should the existing rough threshold alert logic be fully replaced by schedule-driven thresholds, or kept as a fallback?
5. **Reference doc in UI:** Should the app link to or embed the new `docs/environment/Ross308_Zambia_Lighting_Temperature_Guide.md`, or keep docs separate?
6. **Breed scope:** For now the schedule will be Ross 308 only. Should there be a generic fallback for non-Ross breeds, or should the feature be hidden until other breed schedules are added?
7. **Continuous values:** Do we want to allow partial-hour light/dark (e.g., 18.5h light) or keep whole-hour values?

---

## 10. Recommended Next Step

Approve the plan above (especially Option C for data model and Option C for Web UI), confirm answers to the open questions, and I will proceed with implementation in a feature branch or direct milestone commit, following the milestone close-out protocol in `AGENTS.md`.
