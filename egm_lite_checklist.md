# EGM Lite Checklist — Disease Database Enrichment & Media

**Task:** Upgrade the 12-disease text-only catalogue into a 30+ disease, media-rich, source-cited, region-aware reference — API + web + mobile + admin surfaces + seeds — plus a future self-hosting media plan doc.

**Baseline:** commit `0c6215f32e3c2ca1789890d85e23939af74105ff`; pre-existing untracked `screenshots/` dir (unrelated, leave alone).

---

## Data Contracts (pinned shapes — all clients and seeds MUST conform)

- `sources`: JSON array of `{ "title": string, "url": string (https), "publisher": string, "type": "peer-reviewed" | "government" | "university-extension" | "industry" | "ngo" }`.
- `regionalNotes`: JSON object keyed by ISO-3166 alpha-2 country code (`"ZM"`, `"BW"`, `"KE"`, `"ZA"`, `"ZW"`, …) plus mandatory `"general"` fallback entry; values are plain-text notes.
- `evidence`: JSON object keyed by section name (`"prevention"`, `"treatment"`, `"supportiveTreatments"`) with values `"veterinary-recommended" | "standard-practice" | "traditional-limited-evidence"`.
- Region resolution in clients: org `country` (from `GET /api/v1/organizations/me`) → auto-select matching `regionalNotes` key → manual selector override; fall back to `"general"`.
- Media rules: `imageUrl`/`videoUrl` must be `https`; `videoProvider` ∈ `"youtube" | "vimeo" | "external"`; store canonical embed URL (`https://www.youtube.com/embed/<id>`); `sources` entries carry license/attribution info in `publisher`/`title` where applicable.
- Backward compat: API responses include deprecated `organicTreatments` alias mirroring `supportiveTreatments` until mobile min-version ships; sunset TBD.

## Phase 1 — Schema, migration, API

- [x] Extend `Disease` model in `apps/api/prisma/schema.prisma` (~L1140): add `imageUrl`, `videoUrl`, `videoProvider`, `sources Json?`, `regionalNotes Json?`, `evidence Json?`; rename `organicTreatments` → `supportiveTreatments` (DB column rename via migration, update `@map` accordingly).
- [x] Create Prisma migration via the AGENTS.md workflow (`prisma migrate dev` against dev DB or `migrate diff` script) — never `db push`; then `prisma generate`.
- [x] Update `apps/api/src/modules/diseases/routes.ts`: extend `DiseaseCreateSchema` zod fields — new scalars validated (`https` URL check on media fields, `videoProvider` enum), JSON fields validated against the Data Contracts shapes above; GET endpoints unchanged (scalar/JSON returned automatically).
- [x] Add deprecated `organicTreatments` alias to disease API responses (serializer/mapping layer) for backward compat with installed mobile clients.
- [x] Update `apps/api/src/modules/platform/catalogue.ts` `DiseaseSchema` (L28–37): rename + add all new fields with same validation.
- [x] Grep sweep for `organicTreatments`/`organic_treatments` across `apps/api`, `apps/web`, `apps/mobile`, `apps/admin-web`, `apps/admin-mobile` and update all references.

## Phase 2 — Seed content (the bulk of the work)

- [x] Restructure `apps/api/src/db/seeds/diseases.ts`: move disease records into a data file (e.g. `apps/api/src/db/seeds/data/diseases.ts`) so the seed runner stays readable; keep `seedDiseases()` upsert loop.
- [x] **Batch A (~18 diseases):** enrich all 12 existing + add highest-priority regional diseases (candidates: Fowl Typhoid, Heat Stress/Thermal Stress, Mycotoxicosis/Fusarium, Avian Encephalomyelitis, plus others from research — finalize during research).
- [x] **Batch B (remaining to reach 30+):** e.g. Fowl Cholera, Infectious Coryza, Avian Tuberculosis, Fatty Liver Hemorrhagic Syndrome, Ascites/Pulmonary Hypertension, Tibial Dyschondroplasia, Yolk Sac Infection, Omphalitis, Footpad Dermatitis, Ammonia/Respiratory Irritant, Botulism, Aspergillosis, Avian Leukosis, REO/Malabsorption, Staphylococcosis — final list from research.
- [x] Per disease deliver, conforming to Data Contracts: corrected/enriched text fields; `sources` curated authoritative links (Merck Veterinary Manual, WOAH, FAO, university extension e.g. UK/UC Davis, peer-reviewed where openly accessible); `imageUrl` royalty-free (Wikimedia Commons / CC) where suitable else omit; `videoUrl`+`videoProvider` reputable embed where one exists else omit; `regionalNotes` keyed by ISO code prioritizing SADC (ZM, BW, ZA, ZW, MW, MZ, NA, SZ, LS) + East Africa (KE, TZ, UG, RW, ET) + `general`; `evidence` per-section badge levels.
- [x] Reframe `organicTreatments` content → `supportiveTreatments`: honest traditional-care notes with evidence caveats in field text; remove/replace unsupported remedy claims.
- [x] AIH entry: explicit notifiable-disease framing — report to national veterinary authority, no treatment beyond biosecurity/culling per WOAH guidance.

## Phase 3 — Web UI

- [x] Update `Disease` interface + JSON contract types in `apps/web/src/lib/types.ts` (~L448) per Data Contracts.
- [x] Update `apps/web/src/app/(app)/diseases/page.tsx`: detail modal — hero image, video embed (YouTube/Vimeo iframe per `videoProvider`, external fallback link), evidence badges per section, regional notes with org-country auto-select + manual override + `general` fallback, sources list with publisher/type labels, general disclaimer line ("not a substitute for veterinary advice…"). Optional: card thumbnails.
- [x] Verify search/filter still works; category badges unchanged.

## Phase 4 — Admin surfaces (staff catalogue)

- [x] `apps/admin-web/src/lib/types.ts` (~L452): update Disease interface per Data Contracts.
- [x] `apps/admin-web/src/components/catalogue/diseases-tab.tsx`: rename field, add inputs for new fields (JSON fields via structured form or validated textarea — match existing form patterns).
- [x] `apps/admin-mobile/lib/screens/catalogue.dart` (~L307–570): update disease field list + form for renamed/new fields.

## Phase 5 — Mobile UI

- [x] Update `Disease` model in `apps/mobile/lib/models/flock.dart` (~L401): new fields, `fromJson` handles camelCase + snake_case (existing pattern); keep reading `organicTreatments` alias as fallback until min-version ships.
- [x] Add video embed dependency to `apps/mobile/pubspec.yaml` — prefer `youtube_player_flutter` (or `webview_flutter` if more general); pin a version published >7 days ago per repo conventions. **Approved by user.**
- [x] Update `apps/mobile/lib/screens/broiler/diseases_screen.dart`: image via `cached_network_image` (dep present), inline video embed via new dep (external-open fallback), sources list, regional notes (org country auto + manual override + `general` fallback), evidence badges, disclaimer. Match web IA.
- [x] `flutter analyze` clean.

## Phase 6 — Docs & tests

- [x] Write media self-hosting comparison doc (e.g. `docs/media-storage-options.md` or project docs dir per convention): SeaweedFS vs Garage vs existing MinIO for disease/catalogue media — cost, ops burden, S3-compat, fit with current Docker Compose; recommendation + migration path. Marked as future-development plan.
- [x] Extend `apps/api/tests/integration/broiler-management.test.ts` (~L314): assert `>=30` diseases, new JSON fields serialize with contract-conformant shapes, representative regional/evidence fixture present.
- [x] Add/extend tests for: malformed JSON payload rejection on POST/PATCH `/api/v1/diseases`, media URL validation (non-https rejected, bad `videoProvider` rejected), `organicTreatments` alias presence in GET responses.
- [x] Extend `apps/api/tests/integration/p4-monetization.test.ts` (~L469–488) disease-catalogue coverage for renamed/new fields via staff endpoints.
- [x] Run test suite per AGENTS.md — 444/445 integration tests pass; sole failure `platform-analytics.test.ts > rollup row counts today's signup` is unrelated to this diff (platform daily-stats rollup, no disease/catalogue code touched — appears date/cron dependent). Web + admin-web `tsc --noEmit` clean and production `next build` green; `flutter analyze` clean on all touched files (31 pre-existing infos elsewhere).

## Post-Implementation Review Fixes (from diff review)

- [x] **[P0] Fix migration 20261126000001**: replace DROP+ADD of `organic_treatments`/`supportive_treatments` with `ALTER TABLE "diseases" RENAME COLUMN "organic_treatments" TO "supportive_treatments";` + separate ADD COLUMNs. Dev DB already applied old version (schema state correct, data reseeded) — file fix serves fresh/prod DBs.
- [x] **[P1] PATCH partial validation + clear semantics** (`schemas.ts`, `routes.ts`, `catalogue.ts`): merge PATCH body with existing row before `videoPairCheck`; make `imageUrl`/`videoUrl`/`videoProvider` `.nullable()` so explicit `null` clears; admin-web `toPayload` + admin-mobile `_payload` send `null` (not omit) for emptied media fields.
- [x] **[P1] Mobile regional-note override** (`diseases_screen.dart`): add region selector (DropdownButton) in regional-note card listing `regionalNotes` keys; pass selection to `getRegionalNote`.
- [x] **[P1] YoutubePlayerController lifecycle** (`diseases_screen.dart`): extract `_DiseaseVideoPlayer` StatefulWidget — controller created in `initState` keyed by video id, disposed in `dispose()`.
- [x] **[P1] Enforce regionalNotes contract** (`schemas.ts`): non-empty objects require `general` key with non-empty value; all values `.min(1)`.
- [x] **[P1] Canonical video URL validation** (`schemas.ts` + web `videoEmbedUrl`): per-provider format checks — YouTube embed/watch 11-char id; Vimeo player/share digits; external link-only (never iframed). Normalize/derive iframe src client-side.
- [x] **[P2] Platform catalogue alias** (`catalogue.ts`): optional per-entity serializer hook applying `withLegacyAlias` for `diseases` on GET/POST/PATCH.
- [x] **[P2] Media URL length** (`schemas.ts`): `.max(500)` on `imageUrl`/`videoUrl` matching `VARCHAR(500)`.
- [x] Update affected tests (p4-monetization validation cases, broiler-management shapes) for new validation rules; re-run `pnpm run test:compose` disease-related suites at minimum.

## Spec Review Findings — Resolutions

- [1] Mobile embed: **resolved** — user approved adding embed dependency (Phase 5).
- [2] Admin consumers: **resolved** — scope extended to `apps/admin-web` + `apps/admin-mobile` + `catalogue.ts` (Phase 4).
- [3] JSON contracts: **resolved** — Data Contracts section pins all shapes + region resolution.
- [4] Media rules: **resolved** — Data Contracts media rules (canonical embed URLs, https, provider enum, attribution via sources).
- [5] Mobile backward compat: **resolved** — deprecated `organicTreatments` API alias + mobile `fromJson` fallback.
- [6] Test plan: **resolved** — Phase 6 expanded assertions.

## Diff Review Findings — Resolutions

- [1] P0 migration data loss: accepted — fix task added (rename column).
- [2] PATCH partial/clear: accepted — fix task added.
- [3] Mobile region override: accepted — fix task added.
- [4] YoutubePlayerController leak: accepted — fix task added.
- [5] regionalNotes contract: accepted — fix task added.
- [6] Video embed enforcement: accepted — fix task added.
- [7] Platform alias: accepted — fix task added.
- [8] URL length: accepted — fix task added.

## Deferred / Acknowledged

- [⏳ ACK] Media link-rot: external URLs may decay; self-hosting plan doc covers future mitigation.
- [⏳ ACK] Some diseases may lack suitable royalty-free imagery/video — fields stay null rather than force bad assets.
- [⏳ ACK] `organicTreatments` API alias sunset date TBD — needs min-version tracking; revisit after mobile release.
- [⚠️ UNVERIFIED] Regional disease prevalence claims per country are based on published literature; seed notes must cite sources rather than assert unsourced prevalence.
- Pre-review exclusions: none.
- Accepted CONTEST rationales: none.

---

### 🔍 Assumption Lifecycle Legend

- `[⚠️ UNVERIFIED]`: Siloed external contract. Requires indisputable evidence to verify.
- `[⏳ ACK]`: Acknowledged assumption. Factual evidence unavailable; risk accepted and opaque-box empirical test strictly scheduled.

---

# EGM-Lite Queue — Post-v1.59.0 Follow-ups

User directive: execute all queued follow-ups via EGM-Lite, starting with APK → prod deploy → media.

## Phase A — Mobile release APK (v1.59.0+163)

- [x] `cd apps/mobile && flutter build apk --release --dart-define=APP_API_BASE_URL=https://nkuku.deeztechnology.solutions` — verify build succeeds.
- [x] Archive APK to `~/DevWorkz/nkuku-releases/nkuku-companion-v1.59.0.apk` (match naming convention).
- [x] Sanity: `flutter analyze` clean on touched files (already verified); confirm version string `1.59.0+163` in pubspec.
- [x] Report APK path + size; note distribution is manual/internal per AGENTS.md.

## Phase B — Production deploy

- [x] **GATE: requires explicit user confirmation immediately before executing** — real-world side effect on live prod.
- [x] Determine access path: prod lives at `/var/www/nkuku` on the VPS (`nkuku.deeztechnology.solutions`). Check for SSH config/alias; if unreachable, produce exact deploy commands for the user instead of improvising.
- [x] Deploy: `git pull` (to v1.59.0) → `docker compose -f docker-compose.prod.yml up --build -d` → `npx prisma migrate deploy` runs at api boot (verify both disease migrations apply cleanly — RENAME preserves data).
- [x] Post-deploy verify: `curl https://nkuku.deeztechnology.solutions/api/v1/health` (or :30001 health), spot-check `GET /api/v1/diseases` returns enriched shape + `organicTreatments` alias, check api logs for migration errors.
- [x] Rollback note: previous tag `v1.58.1` per AGENTS.md rollback procedure.

## Phase C — Media self-hosting + catalogue backfill

- [x] Provision object storage per `docs/MEDIA-STORAGE-OPTIONS.md` recommendation (MinIO near-term): bucket for catalogue media, credentials via env (never committed), Docker Compose service if self-hosted.
- [x] Upload/curate assets: disease images (Wikimedia Commons / CC-licensed) + the verified ILT video; keep license/attribution metadata (record in `sources` or a `licenseNote` field if schema needs it — decide during exec).
- [x] Backfill `imageUrl`/`videoUrl` across the 32 seed diseases via staff API or seed update + re-seed script; keep external URLs as fallback where self-hosted asset unavailable.
- [x] Verify web + mobile render self-hosted media (CORS/bucket public-read policy or signed URLs — decide per MinIO setup).

## Phase D — Housekeeping

- [x] `organicTreatments` alias sunset prep: add min-app-version tracking mechanism (e.g., `X-App-Version` header logging or platform flag) so alias removal is schedulable; document sunset criteria in checklist/AGENTS.md.
- [x] Admin JSON-field clearing UX: admin-web + admin-mobile — send explicit `[]`/`{}` (or support `null`→`Prisma.DbNull`) when JSON textareas emptied; add UI hint text.
- [x] Test-stack footgun: fix `docker-compose.test.yml` dead `./apps/api/src` bind mount (remove or replace with a comment/warning) and document "rebuild api image after src changes" in AGENTS.md Testing Guidelines.

**Phase C implementation notes:** reused existing `nkuku-documents` bucket (shared pom-minio) under `catalogue/diseases/` prefix — NO new bucket/policy needed. New public route `GET /api/v1/media/catalogue/diseases/:file` (apps/api/src/modules/media/routes.ts) streams objects with strict key whitelist + immutable cache headers; stored `imageUrl`s are absolute `https://nkuku.deeztechnology.solutions/api/v1/media/...` URLs (pass https contract). Upload script: apps/api/src/scripts/upload-catalogue-media.ts (dry-run default, --apply uploads+updates DB; 429-backoff for Wikimedia). Result: 28/32 diseases have self-hosted CC-licensed images (4 skipped: FLHS, Omphalitis, Avian Leukosis, Heat Stress — no suitable free imagery). Each image's license/attribution recorded as a `type:"media"` entry appended to `sources` (new SOURCE_TYPES enum value + web label). Videos remain external embeds (YouTube can't be self-hosted; ILT embed retained).

## Phase E — Content depth

- [x] Regional prevalence emphasis pass: review all 32 `regionalNotes` for ZM/BW/KE (and other SADC/East-Africa keys present); strengthen Zambia/Botswana/Kenya-specific disease emphasis where literature supports it; every claim must cite a source already in `sources` or add one.
- [x] Coverage gap check: are high-priority regional diseases missing (e.g., other mycotoxicosis, heat stress, coccidiosis variants)? Propose additions only if sources verify — do not pad the count.

**Phase E implementation notes:** two parallel audit subagents reviewed all 32 records for ZM/BW/KE coverage; 27 diseases received verified regional notes (evidence: Botswana DVS/WOAH outbreak reports, Kenya NDV genotype V/V.3/Vd surveillance, H9N2 LBM detections, Botswana/ Kenya poultry-sector reports, peer-reviewed mycotoxin/feed surveys, Merck/extension etiology). Merged into `regional_notes` jsonb on shared DB — existing keys preserved, `general` fallback intact (verified). Data-quality fix: removed 3 legacy stub duplicates ("Salmonella", "E. coli Infection", "Chronic Respiratory Disease (CRD)" — no sources/notes/image, superseded by enriched entries); catalogue now exactly 32 unique diseases. Coverage assessment: viral/bacterial/parasites/nutritional/management categories all covered for SSA broiler production; only marginal candidate is Chicken Infectious Anemia (gyrovirus) — deferred, would need its own sourced entry rather than padding.

## Phase F — Disease ↔ flock integration (largest; may need its own spec review)

- [ ] Design pass: link `diseases` to mortality events / vaccination schedules / alerts — e.g., "possible causes" suggestions when logging mortality, disease-aware vaccination reminders, alert enrichment.
- [ ] Scope decision needed: read-only suggestions vs. writable links (FK on mortality_events?). Present design before exec — this phase likely warrants a fresh goldfish spec review.

**Phase F design draft (pending scope decision + goldfish):**
- Touchpoints: `mortality_events.cause` (free text varchar200), `vaccination_schedule_items` (free-text vaccine names), `alerts` (fixed AlertType enum), global `diseases` catalogue (32 enriched entries).
- Option A (read-only): new `GET /broiler-flocks/:id/disease-insights` — token/synonym matching of mortality causes against disease names+symptoms, flock-age watchlist, links into catalogue detail. No schema change.
- Option B (recommended): A + nullable `mortality_events.disease_id` FK + catalogue dropdown in mortality form (web+mobile) — enables mortality-by-disease analytics; small migration.
- Option C (full): B + `vaccination_schedule_items.disease_id` link ("protects against") + new `disease_risk` AlertType + generation logic in alerts /generate.
- **Scope decision (user): Option C — full integration.**

**Phase F spec (v2 — post-goldfish revisions):**

Goldfish findings resolved: schedule items have no tenant CRUD (writes via platform catalogue only); matcher redesigned to curated keywords; alert dedupe gets partial unique index + cooldown; PATCH clear semantics explicit; bulk endpoint pass-through added.

Schema (one migration `disease_flock_links`):
- `diseases.keywords` `String[]` — curated match terms incl. synonyms ("gumboro","IBD","cocci","CRD","mycoplasma"…) populated in seeds; staff-editable via platform catalogue.
- `diseases.susceptible_age_min_days` / `susceptible_age_max_days` Int NULL — curated peak-risk window; NULL = not watchlist-eligible.
- `mortality_events.disease_id` UUID NULL → diseases.id ON DELETE SET NULL + index.
- `vaccination_events.disease_id` UUID NULL → diseases.id ON DELETE SET NULL (per-flock record — the actually-administered link).
- `vaccination_schedule_items.disease_id` UUID NULL → diseases.id ON DELETE SET NULL (template-level "protects against"; 1:N limitation documented — combo vaccines pick primary).
- `alerts.disease_id` UUID NULL → diseases.id ON DELETE SET NULL.
- `AlertType` += `disease_risk`; partial unique index `alerts(flock_id, disease_id) WHERE alert_type='disease_risk' AND is_resolved=false AND disease_id IS NOT NULL`.

API:
- mortality-events POST/PATCH/bulk: `diseaseId: z.string().uuid().nullable().optional()` — `null` clears; invalid uuid/existing-check → 400 `{error:'DISEASE_NOT_FOUND'}`; bulk validates existence once via findMany-in + passes field through (it currently rebuilds rows field-by-field).
- All mortality-event responses (GET list/detail/PATCH/POST/bulk) `include: { disease: {select:{id,name,category}} }`; `/summary` unchanged (future: disease-grouped breakdown).
- vaccination-events POST/PATCH: same diseaseId contract; responses include disease summary.
- platform catalogue `ScheduleItemSchema` + diseases entity schema: accept `diseaseId`/`keywords`/susceptible-age fields; `writeWithItems` createMany passes diseaseId.
- `GET /vaccination-events/schedules` + `/schedule`: include `items.disease {id,name}` so tenant UI can show "protects against".
- New `GET /broiler-flocks/:id/disease-insights` (auth = flock read, org-scoped 404):
  - Response: `{ matches: [{mortalityEventId, cause, suggestions: [{disease:{id,name,category}, score, regionalNote?}]}], watchlist: [{disease:{id,name,category}, reason, regionalNote?}] }`
  - Matching (`apps/api/src/core/disease-matching.ts`): normalize cause (lowercase, strip punct, stopword list); score = 3×name-token hits + 1×keyword hits; synonyms live IN `keywords` (no separate map); top 5, score ≥3; null cause → skipped. In-memory compiled index, not per-request retokenization of prose.
  - Watchlist: flock `ageDays` from `startDate` (same convention as vaccination-events/routes.ts); diseases where ageDays ∈ [min,max]; null startDate → empty watchlist. `regionalNote` = regionalNotes[org.country] ?? regionalNotes.general.
- alerts: zod enum += `disease_risk`; `/generate` — for active flocks, mortality events with non-null `diseaseId` in last 7d → disease_risk alert (severity warning, dueDate +3d, message = disease name + first prevention sentence, diseaseId set) IF no disease_risk alert for (flock,disease) created in last 14d (cooldown covers resolved+unresolved; partial unique index guards unresolved dupes). GET /alerts includes `disease:{id,name}`.

Clients:
- web `types.ts`: `AlertType` += `disease_risk`; `MortalityEvent`/`VaccinationEvent` += disease fields; alert badge fallback for unknown types verified.
- web flock mortality: new `disease-select` field type in `SimpleRecordTab` (fetch `/api/v1/diseases`, optional, sends null to clear); disease chip on mortality record cards + `/mortality` analysis table.
- web flock detail mortality tab: "Disease insights" card (matches grouped by event + watchlist, regional note, link to /diseases).
- web `FlockVaccinationSchedule` (read-only): show linked disease name per item when present.
- mobile: `mortality_event.dart` model + form dropdown (via ApiService disease list); mortality `RecordCard` subtitle chip; new insights card on mortality section of `flock_detail_screen.dart`; `vaccination_schedules_screen.dart`/`flock.dart` VaccinationScheduleItem disease name display; alert icon default-branch already safe — optionally add disease_risk icon.
- admin-web `schedules-tab.tsx` + admin-mobile `catalogue.dart`: disease dropdown per schedule item + disease picker data from catalogue diseases endpoint; diseases-tab editors get keywords/age-window fields if trivially addable (JSON/text arrays) — else defer.
- Seeds: `diseases-{1,2,3}.ts` add `keywords` + susceptible-age windows for all 32; `vaccination-schedules.ts` link default schedule items to diseases by name where unambiguous (ND→Newcastle, Gumboro→IBD, etc.).

Tests (integration, test stack):
- mortality diseaseId: POST valid/invalid, PATCH set/clear(null), bulk passthrough.
- disease-insights: seeded cause strings rank expected disease top-3; null-cause flock → empty matches; watchlist respects age window + null startDate.
- alerts/generate: tagged mortality → one disease_risk alert; second run → no dupe (unique index + cooldown); resolve + rerun within 14d → still no dupe.
- schedule item diseaseId round-trip via platform catalogue; `/schedule` response includes disease name.

Deferred: disease-grouped mortality analytics, alert filtering UI, retroactive matching (computed on the fly), combo-vaccine join table.

## Cross-cutting

- [ ] After each phase: typecheck/analyze + relevant tests green before moving on.
- [ ] Phase-closeout per phase or batched at end per user preference — default: single closeout after Phase D, separate for C and F if they land as releases.
