# Changelog

## [1.46.0-alpha] — 2026-10-30

### Mobile: flock lifecycle parity with web
- **Complete Flock** — flock detail now exposes the web's `POST /:id/complete`
  flow: a green "Complete Flock" button on the overview plus an app-bar menu
  action (owner/manager, active flocks only). Confirmation dialog warns about
  outstanding payments before completing; the API's warning message is shown
  after completion.
- **Owner status transitions** — "Change status" bottom sheet (owner only)
  offers Active / Sold / Completed / Cancelled via PATCH, matching the web
  status dropdown. `soldDate` is surfaced on the overview.
- **Completed-flock lock UX** — non-owners on a completed flock lose the
  add-record FAB and get a persistent lock banner ("records are read-only —
  the owner can still edit"), matching the web's lock icons on tabs. Sale
  payment edits stay available (the API only locks sale POST and birdCount
  changes).
- **Sales & Outstanding card** — the overview now shows Revenue collected,
  Outstanding payments, Profit less outstanding, Avg sale price/bird, and
  Unrealised profit using the computed fields already returned by
  `GET /broiler-flocks/:id` (previously dropped by the mobile model).
- **Status badge** — the overview shows the web-style Pending / Active /
  Completed / Sold / Cancelled chip instead of raw text.
- **Edit flock from detail** — app-bar menu item opens the existing flock
  edit form (previously only reachable from the flocks list popup menu).
- Sales tab: adds Paid and Outstanding stat cards (web shows 4; mobile
  showed 2), a payment-progress bar on each sale tile, and taps now open the
  SaleDetailSheet (payment breakdown + attachments + edit/delete) instead of
  jumping straight into the edit form — matching the web's detail drawer.

## [1.45.5-alpha] — 2026-10-29

### Mobile: grouped feed projection + web hardening
- Mobile Feed tab now renders the `types[]` grouped view like web: one card
  per feed type with a coverage progress bar (%, color by status), per-size
  "Req / Bought / Left" lines, "Spent · To go" money line, and the
  over-purchased badge. Falls back to the old stage table if `types` is
  absent (older API).
- Mobile feed purchase form: Bag Size becomes a dropdown of the selected
  stage's sibling sizes (same normalized type) with an "Other…" free entry;
  picking a size fills its list price.
- Web totals row: Status cell now shows the same money format as the type
  rows — an overall coverage bar (purchasedKg/requiredKg %) with
  "Spent ZMW x · To go ZMW y" underneath, replacing the "n / m kg secured" text.
- Web defensive guards: `feedProjection.types` is now accessed with optional
  chaining on the flock Feed tab, /feed page and purchase dialog — a stale
  cached projection response (pre-`types` field) no longer crashes the tab.
- Docs index: `/docs` no longer 404s — catch-all made optional (`[[...path]]`)
  with an index page listing the published markdown docs. Fixes the
  `/docs?_rsc` prefetch error seen in browser consoles.

## [1.45.4-alpha] — 2026-10-29

### Feed projection — grouped per-type table (product decisions applied)
- `/feed-projection` now returns a `types[]` view alongside `stages[]`: one row
  per feed type with per-size columns (required/purchased/remaining bags and
  projected cost for each configured bag size), `coveragePct`, `spentZmw`
  (actual money paid), `remainingCostZmw`, `overPurchasedKg` and kg totals.
  `stages[]` is unchanged so the mobile app keeps working.
- Web: new shared `FeedProjectionTable` component renders the grouped layout
  on the flock Feed tab and the /feed page — Remaining clamps at 0 with a
  green "over-purchased +Nkg" badge; Status is a coverage bar with the %
  inside plus "Spent ZMW x · To go ZMW y" underneath.
- Purchase dialog: Bag Size is now a dropdown of the type's configured sizes
  with an "Other…" free entry; choosing a size fills its list price.
- Integration tests: new describe block builds a supplier with 50kg + 25kg
  variants of one feed type and asserts the grouped response — single kg
  requirement, cross-size purchase credit, clamp + over-purchased flag.

## [1.45.3-alpha] — 2026-10-29

### Fix: feed projection — alternative bag sizes no longer summed
- `/feed-projection` now computes the requirement **once per feed type in kg**
  ("Starter", "Starter (25kg)" are one requirement), then expresses
  Required/Remaining in each bag size. Previously each variant computed its
  own requirement from the same kg need and totals summed 25kg + 50kg bags
  into meaningless counts (61 → now 21 in 50kg-equivalents on real data).
- **Cross-size credit**: buying any bag size credits the type's purchasedKg —
  3×50kg Starter reduces the 50kg remaining (5→2) *and* the 25kg remaining
  (9→3). Free-text purchases (no feedStageId) match by normalized stage name.
- Status is now type-level (same on both size rows); feed_records count as
  kg secured without inflating the physical purchased-bag count.
- Totals use each type's primary (largest) bag size for coherent units and
  add explicit `requiredKg` / `purchasedKg` / `remainingKg`.

## [1.45.2-alpha] — 2026-10-29

### Feed tab parity: projection & procurement on web flock detail
- Flock detail Feed tab now shows the **Feed Projection & Procurement** table
  (per-stage Required / Purchased / Remaining / Projected cost / Status badges
  + totals) above Feed Purchases — matching the mobile Feed tab layout.
- Demo seed: supplier now includes feed stages (Starter/Grower/Finisher +
  Day-old Chicks) so the projection renders on the demo org.

## [1.45.1-alpha] — 2026-10-29

### Fix: mobile feed purchases invisible on web flock Feed tab
- Mobile's Feed tab tracks **feed purchases** (procurement model), but the web
  flock detail Feed tab only showed the legacy daily `feed_records` log —
  entries added on mobile appeared to "not show" on web.
- Flock detail Feed tab now shows a **Feed Purchases** card (date, stage,
  supplier, bags, total cost) above the daily Feed Records table, with a
  "Manage purchases & projection" link to the full Feed page. Tab badge counts
  records + purchases.
- `/feed` page: Purchase History no longer hides when the supplier has no
  feed stages or the projection endpoint fails — it renders whenever
  purchases exist.

## [1.45.0-alpha] — 2026-10-29

### C-2 follow-up: demo data + real marketing screenshots
- `src/db/seeds/seed-demo-farm.ts` — idempotent seeder for the is_demo org:
  3 flocks (harvested Batch 41 with 3 sales + full cost story, active day-26
  Batch 42, day-6 Batch 43), growth/feed/water/mortality/vaccination records,
  supplier, alerts; then `migrate-to-double-entry` populates the journal so
  ledger/statement views show a real balanced trial balance (ZMW 41,660).
- 7 real screenshots captured via Playwright against production
  (dashboard, flock detail, sales, ledger, alerts, billing, mobile view) —
  WebP, ~40–60 KB each in `apps/web/public/screenshots/`.
- Marketing page: 6-tile screenshot grid with captions + phone-framed
  mobile shot in the "Built for the field" section — placeholders gone.
- Demo user `nkuku@zeendeefood.solutions` password set (demo login works).

## [1.43.0-alpha] — 2026-10-21

### P-6 + store launch — data residency, tenant lifecycle, release pipeline
- **Tenant export** — `GET /api/v1/organizations/export` (owner-only):
  gzip'd JSON of all org-scoped tables — flocks + all flock records, sales,
  journal entries + lines, ledger balances, suppliers, batches, documents
  metadata, subscriptions/invoices, members, member user identities (no
  password hashes). DPA data portability.
- **Tenant soft-delete + purge** — `POST /api/v1/organizations/delete`
  (owner-only, org-name confirmation) sets `deletedAt`/`purgeAfter`(+30d)
  and deactivates the org; `authenticate` now rejects org-inactive tokens
  immediately. Daily 01:30 purge cron hard-deletes all org data in FK-safe
  order, removes S3 objects, deactivates orphaned member users, and
  temporarily disables journal immutability rules to remove those rows.
- **Web Settings → Data & Privacy** (owner-only): export download button +
  delete-organization danger zone with name confirmation.
- **Portable compose**: bundled `minio` service behind `self-contained`
  profile — a fresh host needs no external Postgres/MinIO.
- **`release.yml`** — on `v*` tags: signed AAB + release APK (keystore via
  repo secrets, `versionCode` = run number), artifacts attached to the
  GitHub release; unsigned iOS build check on `macos-14`.
- Docs: `docs/RUNBOOK-tenant-migration.md`, `docs/STORE-LAUNCH.md`
  (Play Data Safety + iOS strict-mode posture documented).
- Migration `20261022000000_org_soft_delete` applied on prod.
- Verified: signed AAB builds locally (54.4 MB); api tsc + 68/68 unit
  tests; web tsc clean.

## [1.42.0-alpha] — 2026-10-21

### M-5 — Ledger parity: date ranges, mobile export, role gating
- **Web journal**: from/to date pickers wired to the M-1 `fromDate`/`toDate`
  params (matches the mobile journal filters that already existed).
- **Mobile trial balance**: share/export action downloads the CSV from
  `GET /api/v1/ledger/export/trial-balance` and hands it to the OS share
  sheet via `share_plus` — first mobile ledger export surface.
- **Role-gating audit + fixes** (mobile was lagging the API):
  - `users_screen`: invite FAB, edit, delete, and row-tap now owner-only
    (API enforces `requireRole('owner')` on all user mutations).
  - `overheads_screen`: add-FAB gated to owner/manager, delete gated to
    owner (matches `/overheads` route roles exactly).
  - Verified web + mobile journal mutations were already correctly gated
    (new entry: owner/manager; reversal: owner only).
- Web statement pages already expose CSV export links on
  income-statement/balance-sheet/cash-flow — confirmed working, no change.
- Validated: web tsc clean, mobile analyze 0 errors (31-issue baseline),
  55/55 tests, release APK builds (71.8 MB).

## [1.41.0-alpha] — 2026-10-21

### M-4 — Mobile billing awareness + forgot password
- **Plan card** on the mobile More/Settings screen: current plan name,
  billing status, and flocks/users usage vs. limits (∞ for unlimited),
  served by a new `BillingService` reading `GET /api/v1/billing/subscription`.
- **402 → upgrade sheet**: `ApiService` gains a Dio interceptor that detects
  HTTP 402 (plan-limit) responses globally and surfaces a bottom sheet with
  the server message and a usage bar — instead of a raw error. Guarded so
  parallel requests don't stack sheets.
- **Store-posture flag** `--dart-define=APP_STORE_MODE=strict|link`
  (default `link`): `strict` (iOS review posture) renders "Manage your plan
  on the web" as plain text; `link` renders a tappable "Upgrade on the web"
  button that opens the web `/billing` page via url_launcher. Web URL is
  derived from `APP_API_BASE_URL`.
- **Forgot password**: "Forgot password?" link on the login screen → new
  `forgot_password_screen.dart` → `POST /api/v1/account/password/reset`
  → always shows "check your email" (anti-enumeration). Reset itself stays
  on the web `/reset-password` page the emailed link opens.
- Validated: `flutter analyze` 0 errors (unchanged baseline), 55/55 tests,
  release APK builds (71.8 MB).

## [1.40.0-alpha] — 2026-10-21

### M-3 — Search toolbars across web + mobile
- Web: new shared `SearchInput` (debounced ~300ms, clear button, Escape
  clears) wired into flocks, alerts, suppliers, vaccine inventory, users,
  journal and sales — all pass `?q=` to the M-1 list endpoints.
- Mobile: new `DebouncedSearchBar` widget on the same 7 screens; services
  gained optional `q` params. Flock search bypasses the offline SWR cache;
  alerts offline fallback filters client-side so stale unfiltered results
  aren't shown while searching.
- Sales: `q` flows to both `/sale-records/all` and `/sale-records/dashboard`
  so the KPI cards stay consistent with the filtered list.
- Every list gets a "No results match your search" empty state when `q` is
  active. Validated: web tsc + build, mobile analyze (0 new issues) + 55/55
  tests.

## [1.39.0-alpha] — 2026-10-21

### C-2 — Marketing site + Umami + demo org flag
- `/` is now a full 10-section static marketing page (hero, trust strip,
  feature grid, how-it-works, screenshots, pricing preview, mobile, security
  cards, FAQ, final CTA) — screenshot slots are placeholders until the demo
  org data is populated.
- Umami analytics wired via `NEXT_PUBLIC_UMAMI_SRC` + `NEXT_PUBLIC_UMAMI_WEBSITE_ID`
  (build-arg'd through the web Dockerfile; absent = no script, zero cost).
- `Organization.isDemo` flag (migration applied on prod): demo orgs are
  excluded from billing cron (trials/suspend/invoices), admin metrics
  (counts, MRR, revenue, failed payments), and admin org lists.
- "Nkuku Demo Farm" created on prod as `is_demo=true`, owned by
  `nkuku@zeendeefood.solutions` (password placeholder — reset via
  forgot-password before first login).

## [1.38.0-alpha] — 2026-10-21

### P-5 — Deprecated financial-engine removal + legal pages
- API: `/api/v1/financial-engine/*` is gone. `modules/financial-engine` →
  `modules/finance` mounted under `/api/v1/ledger`; core services renamed
  `core/financial-engine` → `core/finance` (all imports updated). Duplicate
  statement endpoints + `/periods/close` dropped — `/api/v1/ledger/*` is the
  single financial API surface. Kept under ledger: `/summary`,
  `/monthly-trend`, `/flock-profitability`, `/audit-log`, `/export/*`,
  `/scheduled-reports*`, `/overheads*`, `/projections*`.
- Web: `/financials` and statement pages now redirect to `/ledger/*`
  (meta-refresh, static). Overheads, scheduled-reports and audit-log pages
  moved to `/ledger/{overheads,scheduled-reports,audit-log}` re-pointed at
  the new endpoints; navbar "Financials" item removed.
- Mobile: financial dashboard + overheads re-pointed to `/api/v1/ledger/*`.
- Legal pages live at `/legal/{terms,privacy,refunds,dpa}` (static,
  unauthenticated) + linked from the marketing footer — unblocks store
  submissions and merchant-account reviews.
- Tests: renamed + re-pointed integration/unit suites; removed the
  deprecation-header block (feature deleted). `grep financial-engine apps/`
  → 0 code refs.

## [1.37.0-alpha] — 2026-10-21

### M-2 — Per-flock sales filtering on mobile
- Flock detail → Sales tab now has a filter button (badge with active-count)
  opening the shared `SalesFilterSheet` with the flock picker hidden —
  date range, payment status, customer search, and sort field/direction.
- Active filters render as removable chips plus a one-tap Clear; empty
  state distinguishes "no records" from "no records match filters".
- Reuses `BroilerService.getSaleRecords/getSaleRecordSummary(flockId,
  filter:)` — the server-side filtering landed in M-1.
- Verified: flutter analyze 0 errors (baseline infos only), 55/55 tests.

## [1.36.0-alpha] — 2026-10-21

### M-1 — List API standardisation + search infrastructure
- New shared `list-query` helper (`src/core/list-query.ts`): `q`, `limit`,
  `offset`, `sortBy`, `sortDir`, `fromDate`, `toDate` — all optional so
  existing clients get identical responses until they opt in (M-2/M-3).
- Search fields: flocks (name, breed), alerts (title, message, flock),
  suppliers (name, contact), users (name, email), vaccine inventory (name,
  disease, supplier, batch number + expiry range), sale records (customer,
  phone, notes), journal (description, entry number + sortBy).
- Search uses case-insensitive contains; migration
  `20261021180000_list_search_trgm` adds `pg_trgm` + 12 GIN trigram
  indexes (applied to prod) so ILIKE %q% stays fast on large tables.
- sortBy is allowlist-gated per endpoint; unknown values keep the prior
  default ordering (no injection, no broken queries).
- Verified against prod DB: all OR/`is` where shapes execute; api rebuilt
  and healthy.

## [1.35.0-alpha] — 2026-10-21

### P-4 — Payment provider abstraction + dunning
- New `PaymentProvider` interface (`apps/api/src/core/billing/providers/`) with
  three adapters: **flutterwave** (existing, fallback), **lenco** (ZMW
  mobile-money push collections via Lenco/Broadpay API), **dpo** (DPO Pay
  hosted checkout + tokenisation for BWP).
- Currency-based routing with credential-aware fallback: ZMW → lenco, BWP →
  dpo, everything else → flutterwave; unconfigured providers fall back to
  flutterwave so an org is never stranded without a way to pay.
- ZMW orgs with a phone + operator (mtn/airtel/zamtel) get a mobile-money
  push collection instead of a redirect; missing details fall back to
  Flutterwave hosted checkout.
- `Invoice.provider` records which provider owns each invoice; webhooks and
  payment verification resolve the provider from the invoice, not a global.
- Dunning: open invoices trigger reminder emails at T-7 / T-1 / T+1 / T+5
  relative to due date, each sent exactly once via a `remindersSent` bitmask
  + `lastReminderAt`; reminders include the invoice payment link.
- `sendBillingReminderEmail` in the email service (EMAIL_DISABLED-safe).
- `POST /plans/:code/subscribe` accepts optional `momoOperator`; mock-pay
  endpoint now gated on ALL providers being in mock mode.
- Migration `20261021140000_billing_provider_dunning` adds `provider`,
  `remindersSent`, `lastReminderAt` to `invoices` (applied to prod).
- 12 new unit tests covering provider routing, mock checkout, and verification.

## [1.34.0-alpha] — 2026-10-21

### P-3: CI, backups, observability

#### Added — CI
- `.github/workflows/ci.yml`: three jobs — **API** (lint, typecheck, unit tests, then seeded Postgres service + `AUTH_RATE_LIMIT=0`/`TEST_MODE` + `migrate deploy` for integration tests), **Web** (lint, typecheck, build), **Mobile** (flutter analyze + test). Frozen-lockfile installs via pnpm workspace.

#### Added — backups & uptime
- `infra/scripts/backup.sh`: nightly `pg_dump` of `nkuku_db` from `shared-postgres` (custom format, verified non-empty ≥70 table-data entries) + MinIO `nkuku-documents` bucket mirror via `mc`; retention 14 daily + monthly first-of-month snapshots for a year.
- `infra/scripts/restore-drill.sh`: restores latest dump into a scratch DB and verifies row counts — **drill PASSED** against real backup.
- `infra/scripts/uptime-check.sh`: probes `/health?deep=1`, `/`, `/login` every 5 min (cron) with state-aware transitions — posts DOWN/recovered alerts to ntfy `nkuku-alerts`.
- Host cron installed: backup `30 3 * * *`, uptime `*/5 * * * *`.

#### Added — observability
- Deep health: `GET /health?deep=1` returns 200/503 with per-check results for Postgres, Redis, and MinIO/S3 (3 s per-check timeout). Plain `/health` unchanged for LB probes.
- Sentry wired (no-op without DSN): API `@sentry/node` init + 5xx capture in the global error handler; web `@sentry/nextjs` via `instrumentation.ts` (server) + `instrumentation-client.ts` (lazy client chunk — zero bundle cost when disabled); mobile `sentry_flutter` gated on `--dart-define=APP_SENTRY_DSN`.
- `SENTRY_*` env vars documented in `.env.example`.

#### Validation
- backup.sh run end-to-end (dump verified, MinIO mirror attempted); restore-drill green; uptime probes live-verified (all `ok`).
- API `tsc` clean; web `next build` green (shared JS unchanged at 103 kB); mobile analyze 0 errors, tests 55/55.

#### Pending input
- Sentry DSNs (account required) — code ships disabled until set.

## [1.33.0-alpha] — 2026-10-21

### P-2: Prisma migration baseline + compiled production API

#### Changed — database
- **Real Prisma migrations**: baseline `prisma/migrations/20261021000000_init` generated from the full schema (1638-line DDL) with `documents-search.sql` and `journal-immutability.sql` folded in — fresh DBs get search_vector, GIN index, immutability rules and CHECK constraints via `migrate deploy` alone.
- Baseline marked applied on production via `migrate resolve --applied` (zero-drift verified: `migrate diff` prod-vs-migrated-scratch → empty, after creating the missing `sale_records_organization_id_customer_name_idx` on prod).
- `prisma db push` is retired — AGENTS.md documents the `migrate dev`/`migrate diff` workflow.
- `journal-immutability.sql` CHECK constraints rewritten with valid `DO $$` blocks (the previous `ADD CONSTRAINT IF NOT EXISTS` is not valid Postgres and would fail on fresh application).

#### Changed — production runtime
- Prod API now runs **compiled TypeScript** (`node dist/main.js`): `pnpm run build` (tsc) added to the Dockerfile base stage; prod CMD/compose command updated.
- **`prisma db seed` removed from prod boot** (it ran on every start); seed is now manual via `node dist/db/seeds/main.js` in prod images (tsx not installed).

#### Ops
- Pre-change prod backup: `~/.godaddy_devin/backups/p2-baseline/nkuku-pre-p2-v1.dump` (custom format, verified via `pg_restore --list`). NOTE: prod DB lives on `shared-postgres`, not the bundled postgres container — corrected a misleading near-empty dump of the wrong DB.

#### Validation
- `migrate deploy` on a fresh scratch DB → clean; prod ↔ migrated-scratch `migrate diff` → empty.
- Prod api recreated: `migrate deploy` no-op at boot, server on `node dist/main.js`, `/health` 200 live.
- `tsc` build passes in Docker production stage; `prisma` CLI confirmed present in prod image.

## [1.32.0-alpha] — 2026-10-21

### C-1: Route split — public marketing group + authenticated app group

#### Changed
- Next.js route groups introduced: `app/(app)/` hosts all authenticated routes; `app/(marketing)/` hosts `/` (landing), `/login`, `/signup`, `/accept-invite`, `/forgot-password`, `/reset-password`, `/pricing`, `/docs/*`.
- The former dashboard at `/` moved to `/dashboard`. All 19 `router.push("/")` / `replace("/")` sites and the navbar logo now target `/dashboard`.
- App-only providers (`QueryProvider`, `UpgradePromptProvider`, `Navbar`, `SyncStatusIndicator`) moved from the root layout into `app/(app)/layout.tsx` — public routes no longer load QueryClient/IndexedDB machinery.
- New `app/(marketing)/layout.tsx`: public header (logo, Features/Pricing/Docs, Log in, Start free) + footer with legal-link placeholders and contact email.

#### Added
- Public landing page at `/` (static, ~109 kB first load): hero, 3-feature strip. Full 10-section marketing page lands in C-2.
- Logged-in visitors to `/` see a "Go to dashboard" CTA instead of an automatic redirect.
- `NEXT_PUBLIC_MARKETING_ENABLED=false` (build-time, Docker `ARG` + compose arg) makes `/` redirect to `/login` for white-label/self-hosted deployments; documented in `.env.example`.

#### Fixed
- `reset-password` page: `useSearchParams()` now wrapped in `<Suspense>` (was masked while the whole tree was dynamic; required once the page became statically prerendered under `(marketing)`).

#### Validation
- `tsc --noEmit` clean; `next lint` warnings only (pre-existing `<img>` / exhaustive-deps); `next build` green — all 41 routes generated, `/` static.
- Smoke-tested via `next start`: `/`, `/dashboard`, `/login`, `/pricing` → 200; marketing chrome present on `/`, absent app navbar.

## [1.31.0-alpha] — 2026-10-21

### P-1: Production domain cutover (zeendeefood.solutions) + infrastructure hardening

#### Changed — domain
- Completed the `deeztechnology.solutions` → `zeendeefood.solutions` move: web `metadataBase`, branding defaults (web + API), pricing contact (`nkuku@zeendeefood.solutions`), README, AGENTS.md, DEPLOYMENT_CHECKLIST, OAuth docs.
- Rebuilt and redeployed prod `api`/`web` images; OG metadata now resolves to the new domain.

#### Added — infrastructure & security
- `ntfy.zeendeefood.solutions` is live end-to-end: GoDaddy DNS A record, ISPConfig site (id 16), Let's Encrypt cert.
- **ntfy access control enabled** (`auth-default-access: deny-all`): anonymous publish to any topic now returns 403; anonymous read kept on `nkuku-alerts` for mobile SSE; API publishes via `NTFY_AUTH_TOKEN` bearer token.
- Security headers on both production vhosts: HSTS, CSP (frame-ancestors 'none'), X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- `infra/ispconfig/nginx-directives.conf` corrected: removed `upstream` blocks (illegal in ISPConfig server context — had caused a silent rollback of the previous update).

#### Fixed
- `BroilerFlock` web type: added `sold` status + `soldDate` (unblocks `next build` typecheck).
- `bulk-operations` integration test used nonexistent `alertType: 'custom'` → `'environmental'`.
- `pnpm-lock.yaml` regenerated — now covers `apps/web` (fixes frozen-lockfile installs).

#### Security / dependencies
- `fastify` 5.12.7, `nodemailer` 10.1.7 (bundled types; dropped `@types/nodemailer`), `@fastify/swagger-ui` 6.1.2, `mammoth` 1.13.0.
- pnpm overrides: `brace-expansion` (per-major pinned to patched), `fast-uri` ≥4.1.5, `postcss-selector-parser` ≥7.1.6, `source-map-js` ≥1.2.2.
- Residual (no fix published): `braces` (build-time DoS), `sprintf-js` via mammoth.
- `AGENTS.md` documents the GoDaddy/ISPConfig helper paths for future infra work.

#### Validation
- API: lint clean, typecheck clean, unit 56/56, integration 274/274 (fresh Postgres, seeded + migration data).
- Web: lint warnings only, `tsc` clean, production `next build` green in image.
- Mobile: `flutter analyze` 0 errors, 55/55 tests; release APK `nkuku-companion-v1.31.0-alpha` pending rebuild.
- Live: `/health` 200, `/api/v1/billing/plans` 200, ntfy publish→SSE verified, TLS valid to Jan 2027 both hosts.

#### Repo hygiene (in `638d02d`)
- 8 `.bak-premove` files removed; stray `{apps/` dir removed; 14 plan docs → `docs/plans/`; APKs archived to `~/DevWorkz/nkuku-releases/` (removed ~300 MB of tracked binaries).
