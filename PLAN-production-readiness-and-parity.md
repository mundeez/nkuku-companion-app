# PLAN — Production Readiness, Subscription Launch & Web/Mobile Parity

**Date:** 2026-10-20
**Baseline:** `main` @ `8f3886d` (v1.30.5-alpha) + uncommitted domain rename
**Status:** APPROVED 2026-10-20 — ready to execute, starting with P-1
**Supersedes:** `docs/plans/Mobile_Web_Gap_Analysis_and_Implementation_Plan.md` (2026-07-10, fully executed) for the parity scope; extends `docs/MONETIZATION_PLAN.md` Phase 7 for launch scope.

---

## 0. Decisions locked (2026-10-20 Q&A)

| Topic | Decision |
|---|---|
| Production domain | `nkuku.zeendeefood.solutions` (+ `ntfy.zeendeefood.solutions`). Finish the cutover. |
| Sequencing | **Production foundation first**, then parity. Every parity change ships through CI + migrations. |
| Sales filter gap | Both: (a) add filter/sort to the **mobile per-flock Sales tab**, and (b) **UX/bug audit** of existing filters on both platforms. |
| Search scope | Flocks, Alerts, Suppliers, Vaccine inventory, Customers (sales), Journal, Users — all need server-side search + pagination first. |
| Mobile distribution | **Google Play + Apple App Store.** |
| Mobile billing | **Deep-link to web** (no IAP). Plan status + 402 handling in-app; checkout in browser. iOS build must be store-rule-compliant (see §5.3). |
| Data residency (Zambia DPA s.70) | **Launch on current Hetzner (EU) host, migrate later.** Accepted as a documented legal risk for pilot/early customers. Plan includes prep (tenant export, portable compose) but not the move. |
| Payment provider | **Approved:** multi-provider — Lenco primary for ZMW mobile money, DPO Pay for cards/BWP, Flutterwave kept as fallback adapter (§2). |
| Deprecated `/financials/*` statements | **Approved:** redirect to `/ledger/*`; rebuild only the `/financials` dashboard + overheads on ledger data. |
| Store-steering posture | **Split (corrected 2026-10-20):** iOS build = strict (plan status + "manage on the web" text, no tappable link, no prices). Android build = plan status **plus a tappable "Upgrade on the web" link** to `/pricing`; Google policy risk accepted by the user (Zambia/Botswana are not in Google's external-offers programme). Implemented via `--dart-define=STORE=ios|android` in M-4. |
| P-2 maintenance window | **Approved.** Verified backup (pulled forward from P-3) is a hard prerequisite. |
| Versioning | `v2.0.0-rc.*` after Workstream A; `v2.0.0` at store launch. |
| Repo hygiene | **Approved:** historical plan `.md` → `docs/plans/`; APKs out of the repo. |
| Marketing site | **Approved (2026-10-20):** `/` becomes a public product marketing page; dashboard moves to `/dashboard`; `/login` is the app entry. C-1 after P-1, C-2 after P-5. Logged-in visitors to `/` see marketing + "Go to dashboard". Contact: `nkuku@zeendeefood.solutions` + business WhatsApp (number TBD by user). Analytics: self-hosted Umami. Screenshot source: see Q-C4 (§7). |

---

## 1. Current-state audit (what actually exists today)

### 1.1 Done since the July plan (do not rebuild)
Multi-tenancy (NOT NULL org scoping), self-serve signup + invites + email, RBAC, Flutterwave billing core (plans / subscriptions / invoices / webhook / daily cron with 7-day grace → suspend), feature gating (402 `PLAN_LIMIT_REACHED`), `/pricing` + `/billing` + upgrade dialog (web), ads + remove-ads add-on, admin ops dashboard, enterprise branding/licence, offline-first (web: TanStack Query + IndexedDB; mobile: Drift + sync queue), mobile CRUD for every flock record type, mobile bottom-nav shell, dark mode, ntfy push, document attachments (MinIO + ClamAV + OCR), security hardening (rate limiting, audit log, mass-assignment guards), sales filtering on global sales (web + mobile) and per-flock sales (web only).

### 1.2 Web ↔ Mobile gaps (confirmed from code)

| # | Area | Web | Mobile | Sev |
|---|---|---|---|---|
| G1 | Per-flock Sales tab filter/sort | `SalesFilterBar` + server sort | **None** (`_buildSalesTab` shows summary + plain list) | High |
| G2 | Billing / plan awareness | `/pricing`, `/billing`, 402 → `UpgradePromptProvider` | **Zero.** No plan status, no 402 handling, no upgrade CTA (contradicts MONETIZATION_PLAN §Phase 4 claim) | **Blocker for paid launch** |
| G3 | Forgot / reset password | `/forgot-password`, `/reset-password` | **Missing** | High |
| G4 | Search | Diseases + document FTS only | Diseases only | High (both) |
| G5 | Flock list filter (status/breed) + search | Client-side counts only, no controls | None | High (both) |
| G6 | Alerts search + server pagination | Severity filter only | Filter only | Med (both) |
| G7 | Suppliers / Users / Vaccine inventory search | None | None | Med (both) |
| G8 | Journal search (description / entry no.) | Filters only | Source-type filter only | Med (both) |
| G9 | Financial statements on deprecated `financial-engine` | 18 refs (`/financials/*` pages) | 6 refs | Med — remove before Sunset 2027-01-01 |
| G10 | Export / share | CSV on statements + ledger | **None** (no share-sheet export) | Med |
| G11 | Date-range pickers on ledger statements | Yes | Partial | Low |
| G12 | Scheduled reports, audit log, year-end close, admin ops | Yes | Not present | **Intentional** (web-only) |

### 1.3 API-side root causes
Only `sale-records`, `journal`, `ledger` support server-side `limit/offset`, `sortBy`, `fromDate/toDate`. Every other list (`broiler-flocks`, `alerts`, `suppliers`, `vaccine-inventory`, `users`) returns the full set — so search/filter on those must be built at the API first, then surfaced on both clients.

### 1.4 Production-readiness gaps

| # | Gap | Evidence | Risk |
|---|---|---|---|
| P1 | **No CI/CD** | `.github/workflows/` empty | Nothing gates `main`; releases are manual |
| P2 | **No Prisma migrations** | `apps/api/prisma/migrations/` absent; schema applied via `db push`. Prod `CMD` runs `prisma migrate deploy` (no-op) then `prisma db seed` **on every container start** | Schema drift, destructive `--accept-data-loss` risk, seed side-effects on prod |
| P3 | **No database / MinIO backups** | No backup service or cron in `docker-compose.prod.yml` | Total data loss on volume failure |
| P4 | No error tracking / metrics / uptime | No Sentry/OTel/Prometheus in any `package.json`/`pubspec.yaml` | Silent failures; no SLA evidence for Business tier |
| P5 | Prod API runs `tsx src/main.ts` | `docker-compose.prod.yml:101` | Slower cold start, dev tooling in prod image |
| P6 | Deprecated `financial-engine` still live | 18 web + 6 mobile refs; Sunset header 2027-01-01 | Two sources of truth for financials |
| P7 | Uncommitted domain rename + leftovers | 7 modified files, 8 `*.bak-premove`, stray `{apps/` dir, 13 APKs in `apps/mobile/`, 14 plan `.md` in root | Repo hygiene; accidental commit of binaries |
| P8 | No web E2E tests | `test:e2e` script exists, no Playwright config/specs | Regressions in offline/billing flows undetected |
| P9 | Mobile tests thin | 7 test files / 55 tests for a 45-screen app | Same |
| P10 | Legal pages absent | No ToS / Privacy / Refund pages (signup links to nothing concrete) | **Blocker:** required by Flutterwave/DPO/Lenco merchant approval, Play Console, App Store, and Zambia DPA |
| P11 | Billing is Flutterwave-coupled | `billing.service.ts` imports `flutterwave.service.ts` directly; `provider: 'flutterwave'` literals | Provider swap = refactor (small: ~200 lines) |
| P12 | Subscription renewals are "invoice + pay-link"; no reminder emails/push | `runDailyBillingCron` generates invoices and suspends — no dunning comms | Churn from silent expiry |
| P13 | Zambia DPA registration / DPO / residency | MONETIZATION_PLAN §4 items unchecked; host is Hetzner EU | Legal (user-owned); engineering prep only in this plan |

---

## 2. Payment provider research & recommendation

### 2.1 Constraint that shapes everything
**No Zambian MNO (MTN/Airtel/Zamtel) offers tokenised recurring debit for mobile money.** Every provider below requires a customer-authorised push/USSD prompt per charge. Therefore subscriptions in ZMW are necessarily **"invoice → pay-prompt → confirm"**, which is exactly what `billing.service.ts` already models (invoice + `paymentLink` + webhook + grace period). True "set-and-forget" recurring is only possible on **cards** via tokenisation (DPO Pay supports this; Flutterwave does for cards too but lists no local-card acquiring for Zambia).

### 2.2 Candidates (Zambia-first, Botswana second)

| Provider | ZM MoMo (MTN/Airtel/Zamtel) | ZM cards | Botswana | Recurring | Dev experience | Indicative fees (verify) | Notes |
|---|---|---|---|---|---|---|---|
| **Flutterwave** (current code) | Yes (all 3) | **Not listed** for ZM merchants (pricing page shows "–") | No MoMo; cards only via intl | Cards only | Good REST, hosted checkout, webhooks, sandbox | **3% MoMo**, 4.8% intl | Pan-African brand; ZM merchants = MoMo-only; regulatory friction in some markets historically |
| **Lenco (by Broadpay)** | Yes (all 3) | Yes (Visa/MC) | No (ZM + MW only) | No (push per charge) | **Best**: REST + webhooks + sandbox + official `lenco-node` SDK | **1% MoMo**, 3.5% local card, 3.8% intl (lenco.co/zm/pricing). *Conflicts with 2024 help-centre table (3.5% MoMo) — must confirm in writing* | Bank of Zambia-licensed PSP; Zambian company; settlement to Lenco business account |
| **Lipila (Hobbiton)** | Yes (all 3) | Yes | No | No | Good: REST, `x-api-key`, callbacks, docs.lipila.dev | Not published; tiered settlement fees (K5–K200) | Zambian licensed aggregator; fees opaque |
| **DPO Pay (Network International)** | MTN + Airtel (no Zamtel) | Yes | **Yes** (cards, EFT; offices in Gaborone) | **Yes — card tokenisation (`AllowRecurrent`)** | Older XML API (v6), hosted page, 20+ countries | Negotiated per merchant; rolling reserve on cards | Only candidate covering **both** ZM and BW; Lusaka office |
| **Pesapal** | Yes | Yes | No | Limited | REST, plugins | Not published | East Africa + ZM/MW/ZW |
| **MTN MoMo API (direct)** | MTN only | No | No | No | Painful go-live KYC (community threads), sandbox flaky | 1–4% negotiated | Only worth it at high volume; one operator |
| Paystack | — | — | — | — | — | — | **Not available in Zambia** (NG/GH/ZA/KE/CI only) |
| ZynlePay / Kazang / Boldrails | Yes | Partial | No | No | Thin docs / PDF APIs | Unknown | Not recommended as primary |

### 2.3 Recommendation
1. **Finish the provider abstraction** (`PaymentProvider` interface: `initiateCheckout`, `verify`, `verifyWebhook`, `parseWebhook`; per-provider adapter files; `provider` column already exists on `Subscription`/`Invoice`/`PaymentEvent`). Route by **org currency**: `ZMW → lenco`, `BWP/USD → dpo`, fallback `flutterwave`. ~1 milestone of work (§3 P-4).
2. **Primary for Zambia: Lenco.** Rationale: lowest MoMo fee (1% vs Flutterwave 3% — on a K250/mo Grower plan that's K2.50 vs K7.50 per renewal), Zambian-licensed, cleanest developer surface (official Node SDK, sandbox test numbers, webhook signatures), and it also gives you **payouts** (useful later for any supplier/marketplace feature). Risk: Zambia+Malawi only; pricing discrepancy to confirm.
3. **Botswana + cards + true recurring: DPO Pay.** Only option that covers BWP natively and supports card tokenisation for hands-free renewals. Risk: XML API and negotiated pricing; onboard in parallel, not blocking ZM launch.
4. **Keep Flutterwave** as an already-built adapter/fallback. Do not delete; it's the fastest path if Lenco onboarding stalls.
5. **Do not** pursue direct MNO APIs or Paystack.

**User actions required (§6):** open Lenco business account + request written fee schedule; open DPO Pay merchant account (ZM + BW); decide whether to keep the Flutterwave application alive.

---

## 3. Workstream A — Production foundation (ships first)

Each milestone ends with the standard `phase-closeout` (rebuild → full tests → tag → release). Tags: `v1.31.0-alpha` … then `v2.0.0-rc.N` → `v2.0.0`.

### P-1 ✅ *(done)* — Domain cutover + repo hygiene  *(small)*
- Commit the 7-file `zeendeefood.solutions` rename; grep for any remaining `deeztechnology` in code/docs/compose/`infra/`.
- Delete 8 `*.bak-premove` files and the stray `{apps/` directory; move the 13 APKs out of the repo (they're gitignored but on disk) to `~/DevWorkz/nkuku-releases/`; move historical plan `.md` files into `docs/plans/` (keep `AGENTS.md`, `README.md`, `CHANGELOG.md`, this file in root).
- ISPConfig: new vhost(s) for `nkuku.` and `ntfy.zeendeefood.solutions`, paste `infra/ispconfig/nginx-directives.conf`, enable Let's Encrypt; 301 from old domain for a transition window.
- Update `WEB_BASE_URL`, `CORS_ORIGINS`, `NTFY_BASE_URL` in prod `.env`; rebuild; verify `/health`, web 200, ntfy SSE, invite links, billing `redirectUrl` allow-list.
- Rebuild release APK with new `APP_API_BASE_URL`; verify Android `network_security_config.xml`.
- **Verify:** `curl https://nkuku.zeendeefood.solutions/health`; login on web + mobile; ntfy test publish.

### P-2 ✅ *(done)* — Prisma migrations baseline + safe startup  *(medium, highest-risk item in the plan)*
- Generate a **baseline migration** from the live prod schema (`prisma migrate diff --from-empty --to-schema-datamodel … --script` → `migrations/0_baseline/migration.sql`), append the hand-written SQL (`journal-immutability.sql`, `documents-search.sql`, `multi-tenancy-foundation.sql` where still applicable) as subsequent migrations, then `prisma migrate resolve --applied 0_baseline` on prod and dev DBs.
- Change prod `CMD` to `prisma migrate deploy && node dist/main.js` — **remove `db seed` from startup**; make seeding an explicit, idempotent `pnpm db:seed` run only on fresh installs. Compile TS in the Docker build (`pnpm build`), drop `tsx` from the runtime image.
- Fix `infra/scripts/migrate.sh` (currently calls `migrate dev`).
- Document the new flow in `AGENTS.md`; add a CI check that fails if `schema.prisma` changes without a migration.
- **Verify:** fresh `docker compose up` from empty volume reaches `/health`; prod `migrate deploy` is a no-op after resolve; `prisma migrate diff` between prod DB and schema is empty.

### P-3 ✅ *(done)* — CI/CD, backups, observability  *(medium)*
- **GitHub Actions:** `ci.yml` — API lint/typecheck/vitest (Postgres + Redis service containers), web lint/typecheck/build, mobile `flutter analyze` + `flutter test`; `release.yml` on tag — build images, build signed AAB (keystore from GH secrets), attach artifacts to the GitHub Release.
- **Backups:** add a `pg-backup` sidecar (e.g. `prodrigestivill/postgres-backup-local`) with daily dumps, 14-day retention, `rclone`/MinIO off-box copy; weekly MinIO bucket mirror; a documented + tested **restore drill**.
- **Observability:** Sentry (API via `@sentry/node`, web via `@sentry/nextjs`, mobile via `sentry_flutter`); pino structured logs already present → ship to a file with rotation; `/health` extended to check DB, Redis, MinIO, ClamAV; external uptime ping (UptimeRobot/Better Stack) on `/health` and web root → ntfy alert.
- `fastify-helmet` security headers if not already present; confirm rate limits on `/auth/*`, `/billing/webhook`.
- **Verify:** CI green on a no-op PR; backup file appears + restore into a scratch DB passes integration tests; Sentry receives a test event from all three apps.

### P-4 ✅ *(done)* — Payment provider abstraction + Lenco adapter + dunning  *(medium)*
- Extract `PaymentProvider` interface; move Flutterwave into `providers/flutterwave.ts`; add `providers/lenco.ts` (collections/mobile-money, verify, webhook signature) and a `providers/mock.ts` for tests. Router by org currency (env-overridable `BILLING_PROVIDER_ZMW=lenco`).
- Webhook routes per provider: `/billing/webhook/:provider`. Idempotency on `providerRef` (unique already) — add a `PaymentEvent` dedupe on `(provider, providerTxnId)`.
- **Dunning:** cron sends reminder (email + ntfy push) at T-7, T-1, T+1, T+5 of `currentPeriodEnd`; "Pay now" deep-link to the invoice's `paymentLink`; owner-visible banner on web + mobile when `past_due`.
- Mobile-money UX: collect `phone` + `operator` at checkout (web form), show "approve on your phone" waiting state with polling → success.
- Integration tests: provider router, Lenco webhook verify, dunning schedule, idempotent double-webhook.
- **Verify:** Lenco sandbox E2E: subscribe → prompt → webhook → `active`; failed payment → `past_due` → reminders → suspend after 7 days; Flutterwave path still green.

### P-5 ✅ *(done)* — Deprecated financial-engine removal + legal pages  *(medium)*
- Web: migrate `/financials/{income-statement,balance-sheet,cash-flow}` to `/api/v1/ledger/*` (or redirect to `/ledger/*`); migrate `/financials` dashboard KPIs and overheads to ledger-backed endpoints; delete `financial-engine` API module + scheduler once zero clients remain (keep `ScheduledReport` feature, re-point to ledger).
- Mobile: same for the 6 refs (`financials/*_screen.dart`).
- **Legal pages** (web, public, also served as in-app webviews on mobile): `/terms`, `/privacy`, `/refund-policy`, `/data-protection` (DPO contact, Zambia DPA rights, data-location disclosure as accepted in §0). Link from signup consent, footer, Play/App Store listings. *Copy to be supplied/reviewed by the user — engineering provides structure + placeholders.*
- **Verify:** `grep -r financial-engine apps/` → 0; statements on web/mobile match `/ledger` numbers for a seeded org; legal routes 200 unauthenticated.

### P-6 ✅ *(done)* — Data-residency prep (no move)  *(small)*
- Per-tenant **data export** endpoint (owner-only; JSON + CSV zip of all org-scoped tables + documents manifest) — also satisfies DPA "right to portability".
- Per-tenant **delete** (soft-delete with 30-day purge job) — DPA "right to erasure".
- Make `docker-compose.prod.yml` fully portable (no host-specific `shared-net`/`pom-minio` assumptions; MinIO as its own service with env switch) so a Zambia-hosted replica is a `git clone && docker compose up`.
- Document a migration runbook (`docs/RUNBOOK-tenant-migration.md`).

---

## 4. Workstream B — Web/Mobile parity (ships after P-2/P-3 are green)

### M-1 ✅ *(done)* — API list-endpoint standardisation  *(medium; unblocks everything below)*
- Shared `ListQuerySchema` (`q`, `limit`≤100, `offset`, `sortBy`, `sortDir`, `fromDate`, `toDate`) + `buildListWhere` helper (reuse the `sale-records` pattern).
- Apply to: `broiler-flocks` (q on name/breed/supplier; filter `status[]`, `breedId`, `housingType`, `chicksCollected`), `alerts` (q on message/flock; filter `severity[]`, `status`, `type`), `suppliers` (q on name/contact), `vaccine-inventory` (q on vaccine name/batch; filter `status`, `expiringWithinDays`), `users`/`organizations/members` (q on name/email; filter role), `journal` (q on description/entryNumber), `sale-records` (ensure `customer` search covers name+phone — already does; add `sortBy=customer`).
- Response shape `{ data, total, limit, offset }` **behind a `?paginated=1` flag for one release** to avoid breaking the offline caches, then flip default and remove the flag (both clients updated in the same release — same approach as v1.28).
- Postgres indexes: `pg_trgm` GIN on `broiler_flocks.name`, `suppliers.name`, `alerts.message`, `journal_entries.description`, `users.email/name`.
- Integration tests per endpoint (search hit/miss, pagination bounds, sort stability, org isolation).

### M-2 ✅ *(done)* — Sales filter parity + UX audit  *(small/medium)*
- **Mobile per-flock Sales tab:** reuse `SalesFilterSheet` + `SalesFilter` model with `flockId` pinned; add sort (date/amount/customer/payment status), active-filter chips, load-more; KPIs reflect filtered set (as web does).
- **Audit (both platforms), fix what fails:** date-range inclusive bounds, filter persistence across tab switches, clear-all resets pagination, debounce on customer search, empty states, filter state survives offline reload, KPI/list consistency, sort indicator visible, URL-encoded filter state on web (shareable/bookmarkable).
- Widget tests for the sheet; Playwright spec for web filter bar.

### M-3 ✅ *(done)* — Search everywhere  *(medium)*
- **Web:** reusable `ListToolbar` (search input + filter popover + sort select + pagination) used on `/broiler-flocks`, `/alerts`, `/suppliers`, `/vaccine-inventory`, `/users`, `/ledger/journal`; URL-synced state.
- **Mobile:** reusable `SearchFilterBar` widget (AppBar search + filter bottom-sheet + sort) on `FlocksScreen`, `AlertsScreen`, `SuppliersScreen`, `VaccineInventoryScreen`, `UsersScreen`, `JournalListScreen`; offline: search falls back to local Drift `LIKE` over cached rows with a "showing cached results" hint.
- Customer lookup: typeahead on sale form (web + mobile) hitting `sale-records?customer=` distinct names/phones.

### M-4 ✅ *(done)* — Mobile billing awareness + auth parity  *(medium; required before store launch)*
- `BillingService` (`GET /billing/subscription`); **Plan card** in `AccountSettingsScreen` (plan, status, period end, usage vs limits, `past_due` warning).
- Global Dio interceptor: 402 `PLAN_LIMIT_REACHED` → `UpgradeSheet` (what limit, which plan unlocks it) → "Manage on web" opens `WEB_BASE_URL/pricing` via `url_launcher`.
- **Store switch:** `--dart-define=STORE=ios` hides prices and the external link, showing only "Manage your subscription on the web" text (Apple 3.1.1/3.1.3 risk acknowledged in §5.3). `STORE=android` (and sideloaded builds) show the tappable "Upgrade on the web" link to `/pricing`.
- Forgot/reset password screens (reuse web API); "Change password" in account settings if missing.
- Suspended-org handling: read-only banner + CTA instead of generic errors.
- Widget tests: 402 → sheet; plan card renders each status.

### M-5 ✅ *(done)* — Reporting parity: ledger date ranges + share/export  *(small)*
- Mobile: date-range pickers on trial balance / income statement / balance sheet / cash flow / account ledger (match web); share CSV/PDF via `share_plus` (gated by `csv_pdf_export` feature like web).
- Web: nothing new; confirm `csv_pdf_export` gating is enforced server-side on `/ledger/export/*`.

---

## 4b. Workstream C — Public marketing site & app route split  *(web only)*

**Current behaviour (verified):** `apps/web/src/app/page.tsx` *is* the dashboard; unauthenticated visitors to `/` are bounced to `/login` (`page.tsx:90`); every post-login redirect targets `/` (19 `push("/")` sites); `Navbar` already renders nothing when there is no user; `BrandingProvider` supplies `appName`/`tagline`/`logoUrl`/`primaryColor` for white-label tenants; `public/og-image.png`, `logo.svg`, `site.webmanifest` already exist.

### C-1 ✅ *(done)* — Route split: `/` public, `/dashboard` app  *(small)*
- Move `app/page.tsx` → `app/dashboard/page.tsx` (+ `loading.tsx`); replace all `router.push("/")` / `href="/"` app-internal targets with `/dashboard` (login, signup, accept-invite, social callbacks, billing callback, navbar logo, auth-provider logout stays `/login`).
- Introduce Next.js **route groups**: `app/(marketing)/` with its own lightweight layout (public header: logo, Features, Pricing, Docs, Login, "Start free" CTA; footer: legal links from P-5, contact, © ) and `app/(app)/` keeping the existing layout chain (`AuthProvider` → `UpgradePromptProvider` → `QueryProvider` → `Navbar` → `SyncStatusIndicator`). `/login`, `/signup`, `/accept-invite`, `/forgot-password`, `/reset-password`, `/pricing`, `/docs/*`, and the P-5 legal pages move under `(marketing)` so they share the public chrome. Behaviour of every page is unchanged — only the wrapping layout differs.
- Authenticated users visiting `/` **see the marketing page with a "Go to dashboard" button** (standard SaaS pattern) rather than an auto-redirect — avoids loops and lets logged-in users reach pricing/docs.
- **White-label / self-hosted (enterprise SKU):** `NEXT_PUBLIC_MARKETING_ENABLED=false` makes `/` a 307 → `/login`. Default `true` for the SaaS host.
- Mobile: no change (`WEB_BASE_URL/pricing` deep-link from M-4 still valid). API email templates: invite/reset links already target `/accept-invite` and `/reset-password` — verify none link to `/`.
- **Verify:** Playwright: anonymous `/` → 200 marketing (no redirect); anonymous `/dashboard` → `/login`; login → lands on `/dashboard`; `NEXT_PUBLIC_MARKETING_ENABLED=false` → `/` redirects; `grep -rn 'push("/")' src` → 0 app-internal hits.

### C-2 ✅ *(done)* — Marketing page content & SEO  *(medium)*
Single long-form page at `/` (SSG, no client data fetching except the pricing block), sections in order:
1. **Hero** — headline + sub-headline (draft: *"Run a profitable broiler farm from your phone"* / *"Track every flock, feed bag, bird sold and kwacha — online or offline — built for Zambian and Southern African farmers"*), primary CTA "Start free" → `/signup`, secondary "Sign in" → `/login`; store badges (Play/App Store) wired to real listing URLs once live, hidden until then; hero screenshot (web dashboard + mobile side-by-side).
2. **Problem → outcome strip** — three cards: *know your real cost per bird*, *stop losses early (mortality, FCR, withdrawal periods)*, *get paid and keep the books straight*.
3. **Feature grid** (8 tiles, each mapped to an existing module): Flock tracking vs Ross 308/Cobb 500 targets · Feed projections & bag purchasing · Mortality, medication & withdrawal safety · Vaccination calendar & reminders · Environment (lighting/temperature schedule) · Sales & payment tracking · Double-entry ledger & GAAP statements · Offline-first mobile with sync + push alerts.
4. **"Works where you farm"** — offline, low-data (API compression/ETag already shipped), mobile money payments, ZMW/BWP.
5. **Screenshots carousel** — 6–8 captures (web + mobile, light + dark) taken from a dedicated demo org (never real flocks — AGENTS.md rule).
6. **Pricing summary** — reuse the `/pricing` plan cards component (reads `/billing/plans`), with "Compare plans" → `/pricing`. Strict store posture does not apply to the web.
7. **Who it's for** — smallholder / commercial / agribusiness & co-ops (→ enterprise contact).
8. **Testimonials** — placeholder slots (hidden until real quotes supplied).
9. **FAQ** (accordion, 8 items: offline? data ownership/export (P-6)? mobile money? cancel anytime? multi-user? data location (honest disclosure per §0)? support channel? breeds supported?).
10. **Final CTA + footer** — legal links (P-5), Docs (`/docs`), contact (email/WhatsApp — user to supply), social links, language note (English only for now).

**Technical:**
- SEO: `metadata` export (title/description/canonical/OG/Twitter using existing `og-image.png`), `app/sitemap.ts`, `app/robots.ts` (disallow `/dashboard`, `/admin`, `/billing`, `/ledger`, `/broiler-flocks`…), JSON-LD `SoftwareApplication` + `Organization`, `<html lang="en">`.
- Performance: static render, `next/image` for screenshots (AVIF/WebP), no QueryProvider/IndexedDB on marketing routes, Lighthouse ≥ 90 on Performance/SEO/Accessibility/Best-practices (mobile preset) as the acceptance bar.
- Branding: reads the same `BrandingConfig` so a white-labelled host (if marketing is enabled) shows its own name/logo/colour.
- Analytics: **self-hosted Umami** (approved) — `umami` service in `docker-compose.prod.yml` (own Postgres schema on the nkuku DB or a small sidecar DB), proxied at `analytics.zeendeefood.solutions` via ISPConfig; tracking script only on `(marketing)` routes, never inside the app; cookie-less so no consent banner.
- Contact: `nkuku@zeendeefood.solutions` (mailto) + WhatsApp click-to-chat (`wa.me/<number>`, number TBD) in header CTA area and footer; enterprise "Talk to us" form posts to the same mailbox via the existing nodemailer transport.
- Accessibility: semantic landmarks, keyboard-navigable carousel/accordion, contrast checked in both themes.
- Tests: Playwright smoke (sections present, CTAs route correctly, pricing block renders plans from API), Lighthouse CI step in `ci.yml` for `/`.

**Copy & assets:** engineering drafts all copy from the feature set above; user reviews/edits before launch. Screenshots captured by engineering from the demo org. Logo/brand assets already in `public/`.

**Dependencies:** P-5 (legal pages for footer/FAQ), P-3 (CI for Lighthouse/Playwright gates). C-1 can ship before P-5 with footer links pointing at placeholder legal pages.

---

## 5. Mobile store launch (parallel track, after M-4)

### 5.1 Google Play
- Signed **AAB** via CI (`release.yml`), `versionCode` auto-increment from tag; Play Console app, internal → closed → production tracks; Data Safety form (collects email/phone/name, financial data; encrypted in transit; deletion path = P-6 tenant delete); privacy policy URL (P-5); content rating; target API level current.
- Release notes generated from `CHANGELOG.md`.

### 5.2 Apple App Store
- Needs a macOS build host (user's Mac, or a GH-hosted `macos-14` runner in `release.yml` with `fastlane match`-style signing); Apple Developer Program enrolment; bundle id `com.nkuku.nkukuMobile` already set; App Privacy "nutrition label"; Sign in with Apple is already a dependency (required if Google/Facebook login is offered on iOS — it is).
- TestFlight → App Review. Expect 1–2 review rounds.

### 5.3 Store-policy risks (explicit)
- **Apple 3.1.1:** linking out to purchase a digital subscription is only allowed for "reader" apps or where the US/EU/JP anti-steering rulings apply. Safest: iOS build shows plan status + "manage on the web" **without a tappable link or prices** (the `STORE=ios` switch in M-4). If Apple still objects, fallback is StoreKit IAP for iOS only — scoped as a contingency, not planned.
- **Google:** external links for subscriptions are permitted under User Choice Billing / external-offers programmes in many regions but Zambia/Botswana are not currently in them. **User decision (2026-10-20): ship the Android build with the tappable link and accept the policy risk.** Mitigation: the link is one `--dart-define` flip away from strict if Play review objects; CI builds both variants so a strict AAB is always available.
- Ads (free tier): both stores require the Data Safety/App Privacy declarations to mention ads; house ads only (no AdMob SDK) keeps this simple.

---

## 6. User action items (cannot be done by engineering)
- [ ] Zambia Data Protection Commissioner registration as Data Controller; appoint + document a DPO (unchanged from MONETIZATION_PLAN §4).
- [ ] Open **Lenco** business account; request written collection fee schedule (resolve the 1% vs 3.5% MoMo discrepancy) and sandbox credentials.
- [ ] Open **DPO Pay** merchant account (Zambia and Botswana entities); request API credentials + recurring/tokenisation enablement.
- [ ] Decide fate of the Flutterwave application (keep as fallback or close).
- [ ] Supply/approve legal copy: Terms, Privacy, Refund policy, Data-protection notice (engineering provides drafts/placeholders).
- [ ] Google Play Console developer account; Apple Developer Program enrolment; access to a macOS build machine or approval for GH macOS runners.
- [ ] Sentry account (free tier is fine) and uptime monitor account.
- [ ] Confirm ISPConfig access for the two new vhosts and DNS for `zeendeefood.solutions`.

---

## 7. Open questions

All questions are **resolved** (recorded in §0).

- **Q-C4 — resolved (a):** a dedicated **demo organisation on production** ("Nkuku Demo Farm", free tier, owned by `nkuku@zeendeefood.solutions`) seeded with fictional flocks/feed/sales/ledger data, used for marketing screenshots, as a live demo login for prospects, and as the target for post-deploy Playwright smoke tests. Requires `Organization.isDemo` flag (excluded from admin MRR/churn metrics, billing cron, and ad serving) — added in C-2. Real flocks are never touched (AGENTS.md rule).

**Pending inputs (non-blocking):** business WhatsApp number for the marketing page (placeholder until supplied).

---

## 8. Sequencing & dependencies

```
P-1 domain+hygiene ─► C-1 route split (/ public, /dashboard app) ─┐
(backup pulled in) ─────────────────────────────────────────────── ├─► P-2 migrations ─► P-3 CI/backups/observability ─┐
                                                                   ┘                                                   │
                                                                        ┌──────────────────────────────────────────────┘
                                                                        ├─► P-4 providers+dunning ─► P-5 engine removal + legal ─► C-2 marketing content ─► P-6 residency prep
                                                                        │
                                                                        └─► M-1 API lists ─► M-2 sales parity ─► M-3 search ─► M-4 mobile billing+auth ─► M-5 reports
                                                                                                                                      │
                                                                                                                                      └─► 5. Store launch (needs P-5 legal pages, C-2 store badges)
```
Workstreams A (P-4…P-6), B (M-1…M-5) and C-2 can run interleaved once P-3 is green; M-4, P-5 and C-2 are all prerequisites for store submission.

## 9. Verification protocol (every milestone)
1. `docker compose down && docker compose up --build -d` (data preserved)
2. API: `pnpm lint && pnpm typecheck && pnpm test` (≥330 passing, +new)
3. Web: `pnpm lint && pnpm typecheck && pnpm build` (+Playwright smoke from P-3 onward)
4. Mobile: `flutter analyze && flutter test && flutter build apk --release --dart-define=APP_API_BASE_URL=https://nkuku.zeendeefood.solutions`
5. Manual: never modify existing real flocks — create test flocks/orgs (AGENTS.md rule)
6. `phase-closeout`: changelog, version bump (api/web/mobile in lockstep), tag, GitHub Release
