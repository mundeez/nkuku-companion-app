# Implementation Plan — Flock Data & Management Corrections

## Scope
Review and correct the 3 remaining flocks (Flock A - July 2026, Flock B - July 2026, Flock A - August 2026) so that status, target parameters, housing, vaccination, medication, lighting/temperature, and environmental data are aligned with Ross 308 management guidelines and Lusaka/Zambia disease risk profile.

**Status:** Awaiting user approval. Do not execute until approved.

---

## 1. Current State Summary

| Flock | Start | Age (today) | Status | Housing | Target age/weight | Birds | Key issues |
|-------|-------|-------------|--------|---------|-------------------|-------|------------|
| Flock A - July 2026 | 2026-07-10 | 68 days | active | spot_brooding | 42 / 2.5 kg | 0 / 80 | Flock finished but still "active"; housing type wrong; no env. records |
| Flock B - July 2026 | 2026-08-01 | 46 days | active | whole_house | 42 / 2.5 kg | 6 / 80 | Flock is in final sale window; no env. records |
| Flock A - August 2026 | 2026-08-24 | 23 days | active | whole_house | (not set) | 277 / 280 | No target set; no env. records; Fowl Pox window approaching (day 28 = 2026-09-21) |

**Common data gaps:**
- `environmental_records`: 0 rows for any flock.
- `medication_records`: 0 rows for any flock.
- `lighting_temperature_schedules`: only 1 default `whole_house` schedule; no `spot_brooding` or `transition` schedule.
- Vaccination names are inconsistent and `next_due_date` is rarely populated.
- No `fowl_pox` or `infectious_bronchitis` vaccination entries.

---

## 2. Objectives

1. Correct flock master data (status, housing, targets).
2. Standardise and complete the vaccination program for Lusaka Province.
3. Add the prophylactic medication/coccidiosis program.
4. Add a twice-daily environmental logging protocol.
5. Create a spot-to-whole-house lighting/temperature schedule.
6. Backfill missing records where practical and create workflow templates for future flocks.

---

## 3. Flock Master-Data Corrections

### 3.1 Flock A - July 2026
- `status` → `completed`
- `housing_type` → `whole_house` (was `spot_brooding`; brooding ends by day 7–10)
- `current_count` → `0` (already 0; verify no further updates)

### 3.2 Flock B - July 2026
- `status` → `sold` or `completed` (user: "final sale / almost completed")
- `target_age` / `target_weight` remain `42` / `2.5` (already set)
- **Do not set `sold_date` now**; user will update when the final 6 birds are actually sold.

### 3.3 Flock A - August 2026
- `target_age` → `42`
- `target_weight` → `2.5`
- `status` remains `active`
- `current_count` → `277` (already correct)

**SQL template:**
```sql
BEGIN;

UPDATE broiler_flocks
SET status = 'completed', housing_type = 'whole_house'
WHERE name = 'Flock A - July 2026';

UPDATE broiler_flocks
SET status = 'sold'
WHERE name = 'Flock B - July 2026';

UPDATE broiler_flocks
SET target_age = 42, target_weight = 2.500
WHERE name = 'Flock A - August 2026';

COMMIT;
```

---

## 4. Vaccination Program — Lusaka/Zambia Aligned

### 4.1 Rationale
- Lusaka Province has documented circulation of virulent **Newcastle Disease (NDV genotype VII.2)** and very virulent **Infectious Bursal Disease (Gumboro/IBD)**.
- Regional programs (Zimbabwe AGRITEX, MSD SA, Merck Vet Manual) support ND primary at day 14 and booster at day 21 in high-challenge areas.
- Gumboro first dose day 10–14, booster day 16–21 is standard.
- **Fowl Pox** is **optional**. Give only if flock will be kept beyond 8 weeks, if mosquitoes/wild birds are present, or if fowl pox lesions have been seen on the farm. Administered day 28 via wing-web stab.
- **Infectious Bronchitis (IB)** is **optional** for broilers. Common in integrated operations but not always needed for small-scale Zambian broilers unless respiratory disease/IB has been diagnosed. Usually combined with first ND (day 14) via drinking water or coarse spray.

### 4.2 Proposed Standard Schedule for Future Flocks

| Day | Disease | Vaccine / Product | Route | Notes |
|-----|---------|-------------------|-------|-------|
| 1 | Anti-stress | Chick formula / vitamin-electrolyte | Drinking water | On arrival |
| 10 | Gumboro (IBD) | Intermediate strain (e.g., Nobilis Gumboro D78) | Drinking water | First dose |
| 14 | Newcastle + **Infectious Bronchitis (optional)** | LaSota + Mass. strain | Drinking water / coarse spray | IB optional; skip if no IB history |
| 18 | Gumboro (IBD) | Intermediate strain | Drinking water | Booster |
| 21 | Newcastle | LaSota / Clone 30 | Drinking water | Booster |
| 22 | Performance tonic | Poultry tonic / multivitamin | Drinking water | 7-day course |
| 28 | **Fowl Pox (optional)** | Fowl Pox vaccine | Wing-web stab | Optional: if > 8 weeks or endemic risk |

**Why Fowl Pox is optional:** Broilers sold before 8 weeks rarely need it. Only give if the farm has seen fowl pox scabs, if mosquitoes are abundant, or if birds are being kept into week 7+.

**Why IB is optional:** Infectious Bronchitis is more critical in layers and long-lived birds. In short-cycle Zambian broilers, it is often skipped unless a vet has diagnosed IB or the hatchery recommends it.

### 4.3 Corrections for Existing Flocks

#### Flock A - August 2026 (23 days old)
- **Add Fowl Pox** due on **2026-09-21** (day 28) via wing-web stab (user confirmed).
- **Skip Infectious Bronchitis** for this flock; day-14 ND already given. Schedule IB as optional for future flocks only.
- Normalise existing vaccine names: `Newcastle Vaccine`, `Gumboro Vaccine`, `Poultry Tonic` → consistent naming.

#### Flock B - July 2026 (46 days old)
- No further vaccinations required; Fowl Pox window has passed.
- Mark vaccination events as complete; ensure `next_due_date` is null or final.

#### Flock A - July 2026 (completed)
- No action; historical records kept as-is.

---

## 5. Medication / Coccidiosis Program

### 5.1 Approach
User selected the **prophylactic program** common in southern Africa. This plan records it but flags the need for veterinary prescription and withdrawal compliance to support antimicrobial stewardship (per Lusaka/Copperbelt CAZAAP/ICARS AMR work).

### 5.2 Prophylactic Schedule (to be logged in `medication_records`)

**Best-practice notes for Lusaka/Zambia:**
- Antimicrobial resistance (AMR) is a documented problem in Lusaka/Copperbelt broiler farms. Use antibiotics **only when justified** and under veterinary prescription.
- Coccidiosis is endemic. In-feed ionophores (salinomycin, monensin, lasalocid) or coccidiosis vaccines are the mainstays of control.
- Anti-stress vitamins/electrolytes are beneficial on arrival and around vaccinations.
- Always observe **withdrawal periods** before slaughter/sale.

| Day | Product (examples used in Zambia) | Category | Typical dose / route | Typical withdrawal (days) | Notes |
|-----|-----------------------------------|----------|----------------------|---------------------------|-------|
| 1–3 | Multivitamin + electrolytes (e.g., stress pack, chick formula) | vitamin | Water, 3 days | 0 | Anti-stress; on arrival and after transport |
| 2–6 | **Oxytetracycline 20%** or **amoxicillin soluble powder** (vet-prescribed) | antibiotic | Water, 3–5 days (dose per label) | 7–10 | Prophylactic; only if vet recommends |
| 12–15 | **Amprolium soluble** or **diclazuril** | coccidiostat | Water or feed (per label) | 5–7 | First coccidiosis control course |
| 28–31 | **Sulfaquinoxaline sodium** or **toltrazuril** | coccidiostat | Water or feed (per label) | 10–14 | Rotate active ingredient |
| 33–37 | **Enrofloxacin 10%** or **doxycycline** (vet-prescribed) | antibiotic | Water, 3–5 days (per label) | 7–10 | For diagnosed respiratory/digestive flare-up; not routine |
| 42 | **Piperazine citrate** or **levamisole** (vet-prescribed) | anthelmintic | Water (per label) | 10–14 | Optional dewormer before sale |

**Important:**
- These are **reference ranges**, not prescriptions. Product labels, water volume, and bird body weight determine the exact dose.
- All antibiotics require a veterinary prescription under responsible-use and Zambian veterinary guidelines.
- Withdrawal periods vary by product; confirm the exact withdrawal on the label or with your vet.
- If a flock is on **coccidiostat-containing feed** from the supplier, do not double-dose with water coccidiostats.

### 5.3 Mobile/Web Form Updates
- Add `withdrawal_days` and `withdrawal_date` validation to the medication form.
- Warn if a sale is attempted before `withdrawal_date` has passed.

---

## 6. Environmental Monitoring Protocol

### 6.1 Frequency
**Twice daily** for `Flock A - August 2026` and all future active flocks:
- Morning (08:00–10:00)
- Evening (18:00–20:00)

### 6.2 Targets (Ross 308 whole-house; adjust for Lusaka heat and cold)

Lusaka nights can drop to **10°C or lower** in the cold season. For Flock A - August 2026 (day 23) and any flock facing a cold snap, keep **night-time supplementary heating (infrared bulbs)** until ambient nights stay above **15–18°C** and birds are well-feathered (day 28–35). Do not rely on the standard grow-out table alone when the house cannot hold 18–20°C overnight.

| Age (days) | Day temp (°C) | Night temp (°C) | RH (%) | Light (h) | Dark (h) | Light intensity (lux) | Ammonia (ppm max) | Litter score |
|------------|---------------|-----------------|--------|-----------|----------|----------------------|-------------------|--------------|
| 0–3 | 30 | 30 | 60–70 | 23 | 1 | 30–40 | < 10 | 1–2 |
| 4–7 | 27–28 | 27 | 50–60 | 21.25–23 | 0.75–2.75 | 30–40 | < 15 | 2 |
| 8–21 | 22–26 | 20–24 | 50–60 | 19 | 5 | 5–10 | < 20 | 2–3 |
| 22–35 | 20–23 | 18–21 | 50–60 | 19 | 5 | 5–10 | < 20 | 3 |
| 36–catch | 20–21 | 18–20 | 50–60 | 23 | 1 | 5–10 | < 20 | 3 |

**Cold-snap actions:**
- Keep infrared bulbs on at night until the house holds 18°C without them.
- Reduce ventilation to minimum, but still control ammonia (< 20 ppm).
- Add extra litter to insulate floor and absorb moisture.
- Check birds at night: huddling means too cold; panting means too hot.
- Provide 23 hours of light and 1 hour dark during severe cold to keep feed intake up.

### 6.3 Backfill for Flock A - August 2026
Because the flock is already 23 days old, we cannot backfill real environmental data. Instead:
- Add a mobile/web reminder/notification for twice-daily entry.
- Optionally seed the schedule with `target_*` values so the user can compare actual vs. target.

### 6.4 Data Corrections
No historical changes required; new records are created going forward.

---

## 7. Lighting / Temperature Schedule

### 7.1 Create `Ross 308 Spot-to-Whole-House Transition` schedule
A new `lighting_temperature_schedules` row with `housing_type = 'spot_brooding'` and items for the brooding area edge and house ambient zones.

| Age (days) | Zone | Target temp (°C) | Temp min | Temp max | Light (h) | Dark (h) | Lux | Notes |
|------------|------|------------------|----------|----------|-----------|----------|-----|-------|
| 0 | Brooder edge | 32 | 31 | 33 | 23 | 1 | 30–40 | Spot brooding |
| 0 | House ambient | 30 | 29 | 31 | 23 | 1 | 30–40 | Whole-house equivalent |
| 3 | Brooder edge | 30 | 29 | 31 | 23 | 1 | 30–40 | |
| 7 | Brooder edge | 28 | 27 | 29 | 21 | 3 | 30–40 | Begin expanding ring |
| 10 | Whole house | 27 | 26 | 28 | 20 | 4 | 10–20 | Rings removed |
| 14 | Whole house | 25 | 24 | 26 | 19 | 5 | 5–10 | |
| 21 | Whole house | 22 | 21 | 23 | 19 | 5 | 5–10 | |
| 28 | Whole house | 21 | 20 | 22 | 19 | 5 | 5–10 | |
| 35–catch | Whole house | 20 | 19 | 21 | 23 | 1 | 5–10 | Pre-catch |

### 7.2 Link Flocks to Schedules
- `Flock A - July 2026` → `whole_house` (after correction).
- `Flock B - July 2026` → `whole_house`.
- `Flock A - August 2026` → `whole_house` (already correct).
- Future flocks can select `spot_brooding` for the first 7–10 days, then transition.

---

## 8. Feed Transition Day Validation

Current `feed_transition_day = 18` and `finisher_day = 29` match the NUTRI FEED program:
- Starter: 0–18 days
- Grower: 19–28 days
- Finisher: 29–42 days

No change required. For Flock A - August 2026 (day 23), the flock is currently on **Grower** feed until 2026-09-21, then switches to **Finisher**. Add a mobile/web feed-stage reminder.

---

## 9. Implementation Phases

### Phase 1 — Master Data (no risk)
- Update flock statuses, housing, targets.
- Verify no unintended triggers (financial/auto-post).

### Phase 2 — Reference Data
- Add `spot_brooding` lighting/temperature schedule.
- Add standard vaccination templates in the app (optional, not DB mutation).
- Add medication record templates with withdrawal validation.

### Phase 3 — Flock-Specific Vaccination Corrections
- Normalise vaccine names.
- Add Fowl Pox for Flock A - August 2026 if approved.
- Populate `next_due_date` for incomplete vaccination series.

### Phase 4 — Medication & Environmental Logging
- Add prophylactic medication records for current and future flocks.
- Enable twice-daily environmental record reminders.
- Begin user data entry.

### Phase 5 — Verification
- Re-run orphan/integrity checks.
- Test mobile/web forms.
- Confirm withdrawal-date warnings block pre-withdrawal sales.

---

## 10. Open Items for User Confirmation

1. **Fowl Pox for Flock A - August 2026** — confirmed for 2026-09-21 (day 28) wing-web stab.
2. **Infectious Bronchitis** — skipped for Flock A - August 2026; scheduled as optional for future flocks.
3. **Cold-snap heating** — confirmed: keep night-time infrared bulbs until ambient nights stay above 15–18°C.
4. **Flock B - July 2026 sale date** — wait until actual sale; do not set `sold_date` now.
5. **Exact antibiotic/coccidiostat products** — the plan uses reference products common in Zambia; final doses must be confirmed on product label or by your vet.

---

## 11. Risks & Caveats

- I am not a licensed veterinarian. All vaccination and medication protocols must be confirmed by your local poultry vet before administration.
- AMR is a documented concern in Lusaka broiler production; routine prophylactic antibiotic use should be minimised and vet-prescribed.
- Fowl Pox and IB are optional depending on farm history and local vet advice.
- Incorrect environmental data can cause heat/cold stress; twice-daily logging is only valuable if it drives management action.

---

## 12. File Reference
Generated: 2026-09-16  
Pending: user approval and vet confirmation.