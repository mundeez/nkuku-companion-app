# Changelog

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
