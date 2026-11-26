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
