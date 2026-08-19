# Changelog

## v1.17.1-alpha — 2026-08-19

### Security
- **AuditLog cross-tenant data leak fixed (CRITICAL).** The `AuditLog` table had no `organizationId`, so any authenticated owner/manager could query the entire audit log across all tenants and read `previousState`/`newState` JSON blobs containing full financial records.
  - `apps/api/prisma/schema.prisma`: added `organizationId` column to `AuditLog`, FK relation to `Organization`, index on `(organizationId, occurredAt)`, and `auditLogs AuditLog[]` back-relation on `Organization`.
  - Database: schema applied with `prisma db push --accept-data-loss`; 2315 existing rows backfilled from `organization_members`; `documents-search.sql` re-applied.
  - `apps/api/src/core/financial-engine/audit.service.ts`: `AuditEntry` now requires `organizationId`; `log()` writes it to every row; `query()` now takes `organizationId` and filters all rows by it.
  - Updated all 16 `audit.log()` call sites across `financial-records`, `feed-purchases`, `sale-records`, `documents`, and `financial-engine/period_close` routes.
  - `GET /api/v1/financial-engine/audit-log` now passes `authUser.organizationId` to `audit.query()` instead of an empty string.
  - New integration test: `apps/api/tests/integration/audit-log-isolation.test.ts` (3 tests) verifies an org can see only its own audit entries.

### Changed
- Version bump: `1.17.0-alpha` → `1.17.1-alpha` in `apps/api/package.json`, `apps/web/package.json`, `apps/mobile/pubspec.yaml`, and root `package.json`.

### Test Results
- 280/280 tests pass (24 test files: 56 unit + 224 integration).
- TypeScript typecheck: clean.
- Container health: API + web serving 200.

## v1.17.0-alpha — 2026-08-19

### Added
- **Bulk Operations API + UI across all records and alerts.**
  - New `POST /api/v1/{alerts,growth-records,feed-records,water-records,mortality-events,vaccination-events,financial-records}/bulk` endpoints.
  - Actions: `create`/`delete` for record modules; `mark_read`/`mark_resolved`/`delete` for alerts.
  - Org-scoped batching, max 500 records per request, owner-only delete.
  - `$transaction`-wrapped cascades for water/mortality/vaccination/feed to `financial-records`, with `sourceTable` tagging and `isSystemGenerated` flags.
  - Audit logging on `financial-records` bulk operations.
  - New integration tests in `apps/api/tests/integration/bulk-operations.test.ts` (23 tests).
  - Web: bulk selection UI on the alerts page and flock detail page, plus a new `checkbox.tsx` shadcn/ui component.
  - Mobile: `bulkDelete`/`bulkCreate` service methods and multi-select UI on `alerts_screen` and `flock_detail_screen`, with `record_card.dart` selection support.

### Changed
- `apps/api/package.json`: `1.16.0-alpha` → `1.17.0-alpha`
- `apps/web/package.json`: `0.4.0-alpha` → `1.17.0-alpha`
- `apps/mobile/pubspec.yaml`: `1.16.0-alpha` → `1.17.0-alpha`
- `package.json` (root): `1.16.0-alpha` → `1.17.0-alpha`

### Security
- Feed bulk `supplierId` validation is now organization-scoped (prevents cross-tenant supplier references).
- Water/mortality financial cascades now set `sourceTable` and `isSystemGenerated`.
- Mortality `currentCount` now uses an atomic decrement (fixes a race condition on concurrent bulk deletes).
- Alerts bulk delete is now owner-only, consistent with other modules (was owner+manager).
- `alerts/generate` is now resilient to per-flock failures and logs per-flock errors instead of failing the whole request.

### Fixed
- `flock-tasks/routes.ts`: performance refactor — replaced ~300–400 sequential `findFirst`/`create` calls with batched `findMany` + `createMany`, and fixed an implicit-`any` TypeScript error.
- `lighting-temperature-schedules/routes.ts`: minor query tweak.
- `vitest.config.ts`: set `fileParallelism=false` for integration tests that share one database; parallel execution was causing foreign-key violations.

### Known Limitations
- **CRITICAL (pre-existing):** `AuditLog` table lacks `organizationId`, enabling potential cross-tenant audit-log access. Not introduced this phase, but the `financial-records` bulk feature expands the surface area. A follow-up fix is strongly recommended.
- **MEDIUM:** `audit.log` calls in `financial-records` bulk are performed outside the `$transaction`. If audit logging fails, the DB mutation is still committed — a safer failure mode, but the audit trail could be incomplete.
- **HIGH (pre-existing):** Dependency vulnerabilities in `fastify@4.29.1`, `nodemailer@6.10.1`, `next@14.2.35`, and `postcss` — not introduced this phase; track separately.
- **LOW:** Bulk endpoints do not currently have per-user rate limiting; this is consistent with the existing codebase.

### Test Results
- Full suite: **277/277 tests pass**.
- Typecheck: clean.
- `flutter analyze`: 0 errors.

## v1.16.0-alpha — 2026-08-18

### Added
- **Phase 4 — Pricing page & upgrade UX.**
  - Public marketing `/pricing` page showing Free / Grower / Business tiers, ZMW/BWP/USD monthly pricing, and an Enterprise "Talk to us" call-to-action.
  - App-wide `UpgradePromptProvider` in the web root layout; dispatches a consistent "Upgrade your plan" dialog whenever the API returns `402 PLAN_LIMIT_REACHED`.
- **Phase 4b — Advertising & house ad campaigns.**
  - Prisma: new `AdCampaign`, `AdEvent`, `AdPricingModel`/`AdCampaignStatus`/`AdPlacement`/`AdPage`/`AdEventType` enums; new `User.isPlatformAdmin` boolean flag; `Organization` ↔ `AdEvent` relation.
  - Backend `core/ads/ad-serving.service.ts`: weighted-random house ad selection, country targeting, CPM/CPC spend metering, budget-cap auto-pause, and `shouldShowAds` (Free tier + no `remove_ads_addon`).
  - Backend `modules/ads/routes.ts`: `GET /api/v1/ads/serve`, `POST /api/v1/ads/:id/impression`, `GET /api/v1/ads/:id/click` (server-side redirect to `targetUrl`).
  - Backend `modules/ad-campaigns/routes.ts`: platform-admin CRUD + stats under `requirePlatformAdmin` (`GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`, `GET /:id/stats`).
  - Backend `core/billing/addons.ts`: stackable `remove_ads_addon` subscription (ZMW 40 / BWP 15 / USD 2 / month) that runs alongside the org's real plan.
  - Web `AdSlot` and `AdNativeCard` components with viewability-gated impression tracking and a persistent "Sponsored" disclosure label.
  - Web ad placements: dashboard banner, projections banner, `AttachmentPanel` native card every 5th document search result, flock detail Overview tab banner.
  - Mobile `AdService` + `AdSlot` widget; placements on dashboard and projections screens (house ads + inert network placeholder).
  - Web platform-admin surface at `/admin/ads` (list, create, edit, stats) linked from the user nav when `isPlatformAdmin` is true.
  - "Remove Ads" add-on card in the web billing settings page, wired to the existing Flutterwave checkout/cancel flow.

### Changed
- Version bumps for the cross-app monetization release:
  - `apps/api/package.json`: `1.15.10-alpha` → `1.16.0-alpha`
  - `apps/web/package.json`: `0.3.0-alpha` → `0.4.0-alpha`
  - `apps/mobile/pubspec.yaml`: `1.15.7-alpha` → `1.16.0-alpha`
  - `package.json` (root): `1.10.0-alpha` → `1.16.0-alpha`

### Security
- Click-fraud / budget-drain fix: `recordAdEvent` re-validates campaign eligibility (status, date window, page, country, org ad-eligibility) before counting any impression or click.
- Open-redirect fix: campaign `targetUrl` and `creativeImageUrl` restricted to `http(s)` schemes; no `javascript:`, `data:`, or `file:` URLs accepted.
- Add-on trial-expiry fix: `subscribeToAddon` now sets `trialEndsAt` so the daily billing cron sweeps unpaid add-ons to `past_due`/`suspended` instead of granting ad-free access indefinitely.
- Add-on checkout `redirectUrl` now uses the same same-origin/allowed-origin validation as plan checkout.
- `PATCH /ad-campaigns/:id` now re-validates the merged record for date ordering and pricing-model/rate consistency.
- `isPlatformAdmin` is now included in all login/register/OTP/social-auth response payloads so the admin UI client-side gating works.
- Country-targeting fail-closed: an org with no `country` no longer matches a targeted campaign.

### Fixed
- Billing plan-shadowing regression: `getOrCreateSubscription` and `updateSubscription` now scope queries to real plan codes, so a `remove_ads_addon` subscription can no longer masquerade as the org's tier.
- `processPaymentEvent` and `runDailyBillingCron` only update `Organization.planCode` for real plans, never add-ons.
- Daily billing cron now bills both plan and add-on active subscriptions, using `getPlan`/`getAddon` pricing.

### Also bundled (pre-existing uncommitted work)
- API cache-control headers on global reference routes (`breeds`, `diseases`, `vaccination-events/schedules`) to reduce repeat round-trips.
- Mobile: lightweight in-memory session cache (`ApiCache`) with invalidation on logout and after flock mutations; pull-to-refresh and refresh buttons bypass the cache via `forceRefresh`.
- Mobile: new `Skeleton` / `SkeletonListCard` / `SkeletonList` shimmer loading placeholders across dashboard, flocks, diseases, vaccination schedules, projections, flock detail, and alerts screens.
- Web: new `Skeleton` UI component and `loading.tsx` placeholders for root, `/broiler-flocks`, `/broiler-flocks/[id]`, and `/financials`.
- Mobile service fixes: `AuthService.logout` clears `ApiCache`; `DashboardService` and `BroilerService` use `ApiCache` with 30 s TTL for flocks and dashboard summary.

### Test Results
- Integration test run: `196/198` passing.
- New `tests/integration/ads.test.ts`: 16 tests passing (platform-admin gating, campaign CRUD + URL-scheme rejection, serve/targeting, paid-tier suppression, impression/click metering, paused-campaign re-validation, remove-ads add-on purchase/cancel, plan-shadowing regression).
- Two failures are pre-existing / unrelated to this phase:
  - `lighting-temperature.test.ts` — `returns current schedule item for a flock` (`expected null not to be null`); a known pre-existing failure.
  - `broiler-management.test.ts > Flock Tasks > generates daily checklist tasks` — 5 s timeout; passes in isolation and is unrelated to ads/billing changes.

## v1.15.10-alpha — 2026-08-16

### Fixed
- **Feed procurement showing 0 purchased bags despite feed having been purchased.** The flock card mini-list and feed-projection endpoint only counted `FeedPurchase` records (the new structured purchase system), ignoring existing `FeedRecord` entries that users had been recording all along. Both endpoints now aggregate `FeedRecord` entries as purchased bags, matching `feedType` → `stageName` (case-insensitive, with 25kg variant disambiguation) and converting `quantityKg` → bags using the stage's `unitSizeKg`. Batch-loaded in the list endpoint to avoid N+1 queries.

## v1.15.9-alpha — 2026-08-16

### Fixed
- **Email test failures resolved.** Set `EMAIL_DISABLED=true` in local `.env` (was `false`, causing SMTP 500 errors in dev mode). All 4 previously-failing account-management integration tests now pass. Full suite: 238/238 green.
- **ESLint installed and configured for both API and web.** API uses ESLint 9 with `typescript-eslint` flat config; web uses ESLint 8 with `eslint-config-next`. Fixed 9 lint errors: `@ts-ignore` → `@ts-expect-error` (3 files), `let` → `const` for non-reassigned variables (statements.service.ts), empty catch blocks (test cleanup), React Hooks order violation (navbar.tsx — moved early return after `useMemo` calls). Both `pnpm run lint` and `next lint` now pass with 0 errors.
- **Flock card per-stage mortality adjustment.** The flock list endpoint now applies the same mortality-by-stage logic as the full projection endpoint: `birdsAlive = initialCount − mortality events on/before the stage's dayRangeStart`. Batch-loaded mortality events per flock to avoid N+1 queries.

### Changed
- `apps/api` version: `1.15.8-alpha` → `1.15.9-alpha`
- `apps/api` devDependencies: added `eslint`, `@eslint/js`, `typescript-eslint`
- `apps/web` devDependencies: added `eslint@8`, `eslint-config-next`
- `apps/api/src/core/financial-engine/statements.service.ts`: `let` → `const` for `loans`, `invIn`, `finIn` (not reassigned); kept `let` for `invOut`, `finOut` (reassigned in loop)
- `apps/web/src/components/navbar.tsx`: moved `if (!user) return null` after all `useMemo` calls to fix Rules of Hooks violation

### Test Results
- 238/238 tests pass (was 234/238)
- API lint: 0 errors, 119 warnings (pre-existing unused vars)
- Web lint: 0 errors, warnings only (`<img>` vs `<Image />` — pre-existing)
- Web build: 36 pages, all compiled successfully

## v1.15.8-alpha — 2026-08-16

### Added
- **Sales dashboard nav fix.** The Sales page existed but was invisible on the desktop taskbar because the "Production" nav section was filtered out of `groupsForDesktop`. Sales now appears in the "Finances" dropdown, visible to owner/manager/sales_person roles.
- **Feed bag projections & purchase tracking.**
  - New `FeedPurchase` database table tracking bags of feed purchased per flock, linked to feed stages and suppliers, with organization tenancy.
  - New `feed-purchases` API module (`/api/v1/feed-purchases`) with CRUD endpoints. Each purchase auto-creates a `FinancialRecord` (category: feed) and auto-posts a double-entry journal entry (debit 5020 Feed COGS, credit 1010 Cash). Delete reverses the journal entry.
  - New `feed-projection` endpoint (`GET /api/v1/broiler-flocks/:id/feed-projection`) computing per-stage bags required (based on initialCount minus actual mortality up to the stage's dayRangeStart), bags purchased, and bags remaining, with complete/partial/not-started status.
  - Flock list endpoint (`GET /api/v1/broiler-flocks`) now includes a compact `feedProjection` array per flock for the card mini-list.
  - Flock feed tab (`/broiler-flocks/[id]/feed`) rewritten with a "Feed Projection & Procurement" card on top: per-stage table (required, purchased, remaining, projected cost, status), add/edit/delete purchase dialog, and purchase history table. Existing feed calculator and summary remain below.
  - Flock cards on `/broiler-flocks` now show a per-stage feed procurement mini-list with color-coded badges (green=complete, amber=partial, red=not started).
  - Cross-tenant ownership validation on `feedStageId` and `supplierId` in feed-purchases create/update to prevent information leakage.
- 17 new tests: 8 unit (feed projection calculation logic) + 9 integration (feed-projection endpoint, feed-purchases CRUD, auto-posted FinancialRecord, journal reversal on delete).

### Changed
- `apps/api` version: `1.14.5-alpha` → `1.15.8-alpha`
- `apps/web` version: `0.2.5-alpha` → `0.3.0-alpha`

### Security
- Fixed MEDIUM cross-tenant issue: `feedStageId`/`supplierId` in feed-purchases create/update now validated against the caller's organization.
- Pre-existing dependency vulnerabilities (vitest, fastify, nodemailer, etc.) noted but not addressed in this phase — separate remediation needed.

## v1.15.7-alpha — 2026-08-16

### Added
- **Phase 2 of the mobile modernization plan — Visual Modernization & Overflow Audit.**
  - New centralized Material 3 theme seeded from the brand green (`#1B5E20`) in `lib/theme/app_theme.dart`, with updated color scheme, typography scale, and component defaults.
  - Native splash screen configured via `flutter_native_splash` and refreshed launcher icons via `flutter_launcher_icons`, using the brand green background and the updated app icon asset.
  - Five new shared widgets in `lib/widgets/` to reduce duplication and enforce consistent visual treatment across screens.
  - App-wide overflow and truncation audit covering approximately 20 files, adding `Expanded`, `Wrap`, `FittedBox`, and `TextOverflow.ellipsis` handling to prevent `RenderFlex` overflow on small phones.

### Changed
- Mobile-only patch version bump: `apps/mobile/pubspec.yaml` `1.15.6-alpha` → `1.15.7-alpha`.
- `apps/api` and `apps/web` versions unchanged in this phase.

### Notes
- This is **Phase 2 of 5** of the mobile modernization plan documented in `.devin/plans/mobile-modernization-plan.md`. Phases 3–5 (performance, offline sync, QA) will follow in later sessions.

## v1.15.6-alpha — 2026-08-16

### Added
- **Phase 1 of the mobile modernization plan — Information Architecture & Navigation.**
  - New bottom navigation trimmed from 7 to 5 core destinations (Dashboard, Flocks, Alerts, Finance, More) to stop label crowding and truncation on smaller phones.
  - New `MoreScreen` replaces `SettingsScreen`, with grouped sections (Production, Operations, Planning, Admin, Appearance/Preferences, Account) and wiring for five previously orphaned screens: Projections, Expansion Plan, Suppliers, Disease Database, and Vaccination Schedules.
  - New `FinanceHubScreen` merges the Financial Dashboard and Ledger behind a single "Finance" bottom-nav entry via a segmented switcher, each screen keeping its own state and `AppBar`.
  - `FlockDetailScreen` consolidated from 13 flat tabs into 6 top-level groups — Overview, Growth (Growth/Feed/Water/Environment), Health (Mortality/Vaccination/Medication), Finance (Financial/Sales), Planning (Tasks/Calendar), Docs — using `SegmentedButton` sub-navigation inside multi-section groups instead of nested tab bars. FAB / add-record routing remapped to the new group + sub-section index.

### Changed
- Mobile-only patch version bump: `apps/mobile/pubspec.yaml` `1.15.5-alpha` → `1.15.6-alpha`.
- `apps/api` and `apps/web` versions unchanged in this phase.

### Notes
- This is **Phase 1 of 5** of the mobile modernization plan documented in `.devin/plans/mobile-modernization-plan.md`. Later phases (visual modernization, performance, offline sync, QA) will follow in subsequent sessions.

## v1.15.5-alpha — 2026-08-15

### Added
- **Current day/age highlighting on flock calendar and environment pages.**
  - Calendar page reads `ageDays` from the flock summary API, shows a "Current: Day X" indicator next to the hatch date, and highlights the matching day card with a primary ring and "Today" badge, scrolling it into view.
  - Environment page highlights the full lighting/temperature schedule row whose `ageDays` matches the flock's current age, adds a primary dot indicator on the current day cell, and smooth-scrolls the current row into view.

### Changed
- Patch version bumps for the release:
  - `apps/api/package.json`: `1.14.4-alpha` → `1.14.5-alpha`
  - `apps/web/package.json`: `0.2.4-alpha` → `0.2.5-alpha`
  - `apps/mobile/pubspec.yaml`: `1.15.4-alpha` → `1.15.5-alpha`

## v1.15.4-alpha — 2026-08-15

### Added
- **Modern global navbar and flock subnav redesign for the web dashboard.**
  - New grouped desktop navigation with primary underline active state.
  - Sticky frosted-glass navbar with logo image and "Nkuku" wordmark.
  - Command palette (`Cmd`/`Ctrl`+`K`) for quick page search across grouped navigation links (`apps/web/src/components/navbar/command-palette.tsx`).
  - Consolidated user dropdown with avatar, name/role display, settings, billing, theme toggle, and logout.
  - Live unread alert count badge on the notification bell.
  - Mobile slide-over navigation with grouped sections and user actions.
  - New shadcn-style UI components: `Sheet`, `Avatar`, and `DropdownMenu`.
  - Updated flock subnav with primary underline active state and horizontal scroll on narrow viewports.
  - `no-scrollbar` utility added to `apps/web/src/app/globals.css`.

### Changed
- Patch version bumps for the release:
  - `apps/api/package.json`: `1.14.3-alpha` → `1.14.4-alpha`
  - `apps/web/package.json`: `0.2.3-alpha` → `0.2.4-alpha`
  - `apps/mobile/pubspec.yaml`: `1.15.3-alpha` → `1.15.4-alpha`

## v1.15.3-alpha — 2026-08-15

### Fixed
- **Projected profit and revenue now use expected survivors instead of current flock count.**
  - `currentCount` is reduced by sales, culls, and other non-mortality events, which was inflating the projected loss and misrepresenting what the flock could earn if the remaining birds are sold.
  - API `/broiler-flocks` list now returns `projectedRevenue` and `projectedProfit` computed as `(initialCount - totalMortality) × salePriceZmw` (with target weight for per-kg break-even where applicable).
  - API `/financial-records/summary` now returns `projectedRevenue`, `projectedProfit`, and `projectedProfitPerBird` based on survivors.
  - Web flock list, flock detail, and financial projection page use the new API-provided fields or compute `(initialCount - totalMortality) × salePriceZmw`.
  - Actual profit (`totalRevenue - totalCost`) remains unchanged.

### Changed
- **Docker web container now binds to all interfaces.**
  - Set `HOSTNAME=0.0.0.0` for the web service in `docker-compose.yml` so the Next.js standalone server accepts connections on all container interfaces; previously it could bind to a single container IP and become unreachable from the host/nginx in multi-network setups.
- Patch version bumps for the bug-fix release:
  - `apps/api/package.json`: `1.14.2-alpha` → `1.14.3-alpha`
  - `apps/web/package.json`: `0.2.2-alpha` → `0.2.3-alpha`
  - `apps/mobile/pubspec.yaml`: `1.15.2-alpha` → `1.15.3-alpha`

## v1.15.2-alpha — 2026-08-15

### Changed
- style(mobile): applied `dart format` to the mobile mortality calculation files; no functional changes.
- Patch version bumps for the formatting release:
  - `apps/api/package.json`: `1.14.1-alpha` → `1.14.2-alpha`
  - `apps/web/package.json`: `0.2.1-alpha` → `0.2.2-alpha`
  - `apps/mobile/pubspec.yaml`: `1.15.1-alpha` → `1.15.2-alpha`

## v1.15.1-alpha — 2026-08-15

### Fixed
- **Mortality rate now reflects actual deaths vs. the starting flock count.**
  - Previously the rate was derived from `initialCount - currentCount`, which incorrectly included birds sold or culled and skewed the percentage.
  - API `/broiler-flocks` list and detail, `/dashboard` summary, and flock profitability now compute `totalMortality` and `mortalityRate` from recorded `MortalityEvent` aggregates.
  - Web flock list and detail consume the new `totalMortality` / `mortalityRate` backend fields.
  - Mobile `BroilerFlock` model and screens consume the new backend fields.
  - Added integration test coverage in `apps/api/tests/integration/broiler-management.test.ts`.

### Changed
- Patch version bumps for the bug-fix release:
  - `apps/api/package.json`: `1.14.0-alpha` → `1.14.1-alpha`
  - `apps/web/package.json`: `0.2.0-alpha` → `0.2.1-alpha`
  - `apps/mobile/pubspec.yaml`: `1.15.0-alpha` → `1.15.1-alpha`

## v1.15.0-alpha — 2026-08-09

### Added
- **Mobile charts (fl_chart):** Visual data visualization for the Flutter app, mirroring the web app's charts.
  - 8 reusable chart widgets in `apps/mobile/lib/widgets/flock_charts.dart`:
    - `GrowthChart` — weight vs breed target line chart (flock detail Growth tab)
    - `FcrChart` — FCR vs breed target with current-FCR marker (flock detail Growth tab)
    - `FeedChart` — daily feed consumption by stage (flock detail Feed tab)
    - `WaterChart` — water consumption & pH (flock detail Water tab)
    - `MortalityChart` — cumulative mortality line (flock detail Mortality tab)
    - `VaccinationChart` — scheduled vs completed vaccinations (flock detail Vaccination tab)
    - `FinancialChart` — revenue vs cost by category (flock detail Financial tab)
    - `EnvironmentChart` — temperature & humidity (flock detail Environment tab)
  - Dashboard: `_FlockProfitabilityChart` (net profit per flock bar chart) and `_AlertsSeverityChart` (alerts by severity).
  - Financial dashboard: replaced hand-rolled horizontal ListView "Monthly Trend" with a proper fl_chart revenue-vs-cost chart.
  - Flock detail now fetches breed performance targets (GET /api/v1/breeds/:id) for growth/FCR target overlays.

### Changed
- Mobile version bump: 1.14.0-alpha → 1.15.0-alpha.

## v1.14.0-alpha — 2026-08-08

### Added
- **Billing module with subscription plans, invoices & Flutterwave payment integration.**
  - Subscription plan catalog (Basic/Pro/Enterprise) with plan limits and feature gating.
  - Invoice lifecycle (draft → open → paid → void/cancel) with line items and due dates.
  - Flutterwave payment initiation and card/Mobile Money/bank redirect flows.
  - Payment events table for idempotent, traceable transaction recording.
  - Webhook handling for `charge.completed`, `subscription.cancelled` and related events.
  - Subscription lifecycle management (active, cancelled, expired, past-due, paused) with billing-period tracking and org-scoped queries.

### Fixed (Security)
- **All CRITICAL/HIGH/MEDIUM findings from the security audit have been remediated:**
  - **CRITICAL:** `docker-compose.prod.yml` missing Flutterwave environment variables — production would have run in mock mode; now `FLW_PUBLIC_KEY`, `FLW_SECRET_KEY`, `FLW_ENCRYPTION_KEY`, `FLW_WEBHOOK_SECRET` and `FLW_WEBHOOK_HASH` are required.
  - **CRITICAL:** Webhook signature verification fail-open when hash is unset; now uses `crypto.timingSafeEqual` and returns `401` when the secret/hash is missing or invalid.
  - **HIGH:** Payment amount and currency are now verified against the invoice before marking paid.
  - **HIGH:** `tx_ref` is cross-checked against the invoice `providerRef`.
  - **HIGH:** Idempotency is enforced on already-paid invoices to prevent duplicate credits.
  - **HIGH:** IDOR on `verify-payment` and `mock-pay` endpoints is closed by org-scoping all lookups.
  - **HIGH:** Webhook event type is validated against an allowlist before processing.
  - **HIGH:** Cancelled subscriptions can no longer be re-activated through invoice payment.
  - **MEDIUM:** Open redirect on `/subscribe?redirectUrl=...` is closed by validating the URL against a configured allowlist.
  - **MEDIUM:** Open invoices are automatically voided when a subscription is cancelled.
  - **MEDIUM:** `@unique` constraint added to `Invoice.providerRef` to prevent duplicate provider references.

### Test Summary
- 220 tests pass (48 unit + 172 integration).
- `tsc --noEmit` clean across API and web.
- API health endpoint returns `200 OK`.

### Known Limitations
- 47 pre-existing dependency advisories remain (Next.js 14.2.35, Fastify 4.x, nodemailer 6.x, postcss 8.4.31). Major version upgrades requiring compatibility review are deferred to a dedicated dependency-upgrade phase.
- Minor webhook header handling bug: when the `verif-hash` header is missing the API returns `500` instead of `401`. Low severity, tracked for a follow-up fix.
- Flutterwave mock mode is a fallback when `SECRET_KEY` is unset; production deployments must set all Flutterwave environment variables to avoid processing test transactions.

## v1.11.1-alpha — 2026-08-07

### Mobile — Phase 2 Self-Serve Signup & Invite Acceptance

**New screens:**
- SignupScreen: self-serve organization creation with country, currency, and consent checkbox (Zambia DPA No. 3 of 2021)
- AcceptInviteScreen: paste invite token or full URL; handles new-account (name+password required) and existing-account flows

**Auth service:**
- `AuthService.register()` — POST /api/v1/auth/register with org name, country, currency, consent
- `AuthService.acceptInvite()` — POST /api/v1/auth/accept-invite with token, optional name/password
- Shared `_dioError()` and `_httpError()` helpers for consistent error messages

**Bug fixes:**
- Fix 4xx error handling in login/register/acceptInvite: `validateStatus` allows <500 through without throwing DioException, so 401/409/400 responses were reaching `data['accessToken']` and crashing with a null-check error. Now checks `res.statusCode` before parsing the response body.
- Fix `attachment_section.dart` import: was referencing an untracked duplicate `records/document_form.dart`; now correctly imports the committed `screens/broiler/records/document_form.dart`

**Login screen:**
- Added "Don't have an account? Create one" link to SignupScreen

**Validation:**
- flutter analyze: PASS (no issues)
- flutter test: PASS (55 tests)
- flutter build apk --debug: PASS (157 MB)
- dart format: clean on all touched files
- Security: 0 dependency vulnerabilities (OSV scan of 135 packages)

**Known pre-existing security findings (out of scope, noted for future remediation):**
- Hard-coded default owner credentials in login_screen.dart
- Release builds signed with debug key
- JWT tokens stored in unencrypted SharedPreferences
- Android network config trusts user-installed CAs

## v1.11.0-alpha — 2026-08-07

### Added
- **Phase 2 — self-serve signup & invitations.**
  - `POST /api/v1/auth/register` — creates a new Organization + owner User + OrganizationMember in one transaction. Requires explicit `consent: true`; records `consentAcceptedAt`/`consentVersion` on the User (Zambia Data Protection Act No. 3 of 2021 consent tracking).
  - `POST /api/v1/auth/accept-invite` — joins an existing organization via a time-limited 256-bit invite token; creates the User if the email has no account, or enrolls an existing one. Wrapped in a Prisma transaction to prevent double-accept race conditions.
  - New `organizations` API module: `GET/PATCH /me` (org settings), `GET /members`, `DELETE /members/:id`, `POST/GET /invites`, `DELETE /invites/:id` — all owner/manager gated and org-scoped.
  - `Invite` model (token, email, role, expiry, acceptance tracking) and `consentAcceptedAt`/`consentVersion` fields on `User`.
  - Web `/signup` page — self-serve registration form (name, email, password, org name, country, currency, consent checkbox).
  - Web `/accept-invite` page — invite acceptance (reads token from URL query string; adapts to new vs. existing accounts).
  - Web `/users` page — "Invite User" dialog with invite link display + copy button, pending invites table with revoke action.
  - Web `/login` page — added "Create one" link to `/signup`.
  - `WEB_BASE_URL` env var for absolute invite links (docker-compose + .env.example).

### Changed
- **Users module** (`apps/api/src/modules/users/routes.ts`) — fixed a latent bug where it created global `User` rows with no `OrganizationMember`, which would have made new users unable to log in under the multi-tenancy model. Now every user it creates/updates/removes is properly scoped to the caller's organization, and `User.role`/`OrganizationMember.role` are kept in sync.

### Fixed
- **Security: JWT_SECRET fallback removed** (critical, pre-existing). The auth module previously fell back to `'dev_jwt_secret'` if `JWT_SECRET` was unset, allowing token forgery. The API now refuses to start if `JWT_SECRET` is not set.
- **Security: authenticate middleware fallback removed** (critical, pre-existing). When a token's `userId` didn't exist or was inactive, the middleware silently authenticated as the first active user (usually the owner). Invalid/inactive/deleted users now correctly get `401 INVALID_TOKEN`.
- **Security: accept-invite made atomic** (low). The invite lookup, user creation, membership creation, and invite update are now inside a single Prisma `$transaction`, preventing race conditions on concurrent requests with the same token.
- **Security: refresh token stored in Redis on accept-invite** (low). The `accept-invite` endpoint was not storing its refresh token in Redis, unlike `login` and `register`.

### Infrastructure
- **Shared Postgres `max_connections` raised 100→200.** `deez_forex` (an unrelated project on the same `shared-postgres` instance) was holding ~83 idle connections with no pooler, exhausting the 100-connection pool and blocking all tenants with "remaining connection slots reserved for roles with the SUPERUSER attribute". Raised via a `command:` override in `shared-services/docker-compose.yml`. The proper long-term fix is a PgBouncer pooler in front of `deez_forex`.
- `.gitignore` updated to exclude mobile APK/IPA/AAB build artifacts and `.playwright-mcp/` tooling state.

### Known Limitations
- No email delivery yet — invite links are returned in the API response and shown in the web UI with a copy button for manual sharing. `nodemailer` is already a dependency; wiring email delivery is a follow-up.
- No rate limiting on public auth endpoints (`/auth/register`, `/auth/login`, `/auth/accept-invite`). Recommended: `@fastify/rate-limit`.
- Access/refresh tokens stored in `localStorage` (XSS-exposed). Recommended: `HttpOnly` cookies.
- No email verification on registration.
- Dependency vulnerabilities identified by `pnpm audit` (Fastify 4.x, Next 14.2.35, nodemailer 6.x, postcss 8.4.31) — major version upgrades requiring compatibility review, deferred to a dedicated dependency-upgrade phase.
- CORS defaults to `true` (all origins) in development when `CORS_ORIGINS` is unset.

### Test Summary
- Full unit + integration suite (163 tests) green.
- `tsc --noEmit` clean (API + web).
- End-to-end manual flow verified: register → login → invite → accept-invite → member enrolled; double-accept correctly rejected; forged token for non-existent user correctly returns 401.

## v1.10.1-alpha — 2026-08-07 (retroactive tag)

### Notes
- Retroactive tag for commit `6ffdb76` which closed out Phase 1 (multi-tenancy foundation). Validated post-hoc: full 163-test suite green after rebuild (Postgres connection capacity issue that blocked earlier validation resolved by raising `shared-postgres` `max_connections` 100→200).

## v1.10.0-alpha — 2026-08-07

### Added
- **Phase 1c — database-enforced multi-tenancy.**
  - Set `organization_id` NOT NULL on `suppliers`, `production_cycles`, `broiler_flocks`, `documents`, `monthly_overheads`, `lighting_temperature_schedules`, `sale_records`, `batches`, and `ledger_balances`. All had zero orphaned rows; Prisma relations switched from optional `SetNull` to required `Restrict`.
- **Phase 1b follow-up — legacy planning module organization scoping.**
  - `Batch` gained its own `organizationId` column (backfilled into Organization #1; zero orphans verified) since it is tenant-owned execution data. `ProductionCycle` correctly remains shared as a read-only seeded reference catalog (14 cycles).
  - Org-scoped CRUD and queries: `batches`, `overhead-costs` and `mortality-records` (via batch ownership), projections `/calculate` and `/save` (via supplier + batch ownership), and `feed-stages` (via supplier ownership).
  - Added `organizationId` to documents at upload time and to the full-text search global-search fallback; added `organizationId` to the web `User` TypeScript type for correctness.

### Changed
- **Seed script (`db/seeds/main.ts`)** now creates "Organization #1" and enrolls the owner plus disabled test users as members; all seeded suppliers, production cycles, batches, and lighting-temperature defaults are tagged with it. Fresh deployments previously had no organization at all, which would have left the owner unable to log in (login now 403s with `NO_ORGANIZATION`).
- **Deprecated financial-engine overhead-allocation service** (MonthlyOverhead CRUD and the daily cron re-allocation job) now uses `organizationId` end-to-end. The daily cron now iterates organizations instead of users.

### Fixed
- **Cross-tenant data leaks.**
  - `/api/v1/dashboard/summary` was aggregating KPIs (flocks, alerts, financial records) across **all** organizations; it now filters by the authenticated user's organization.
  - The documents module's central `resolveOwnership` and `checkDocumentOwnership` helpers — used by every document route (`list`/`search`/`get`/`download`/`view`/`patch`/`delete`) — were checking `flock.createdBy` (individual user) instead of organization membership, and the `JournalEntry` branch did not check organization ownership at all. Both now enforce organization membership.

### Known Limitations
- `journal_entries.organization_id` deliberately stays nullable pending an explicit user decision on 18 pre-existing test-generated entries that have no organization. Fixing them requires temporarily suspending the immutability RULE on `journal_entries`, a financial-integrity control that should not be touched without approval. Documented as an explicit open item in `docs/MONETIZATION_PLAN.md`.

### Test Summary
- Full unit + integration suite (163 tests) green on two independent clean runs after Phase 1c.

## v1.9.0-alpha — 2026-08-07

### Added
- **Multi-tenancy schema foundation (Phase 1a).**
  - New `Organization`, `OrganizationMember`, and `Subscription` models plus supporting enums.
  - `organizationId` added to all tenant-scoped tables (`suppliers`, `production_cycles`, `broiler_flocks`, `documents`, `monthly_overheads`, `lighting_temperature_schedules`, `sale_records`, `accounts`, `journal_entries`, and flock-child records).
  - Shared catalog data (`breeds`, `performance targets`, `diseases`, `vaccination schedule templates`, `equipment catalog`) intentionally remains global/unscoped.
  - Chart-of-accounts and journal entry-number uniqueness re-scoped from global to per-organization.
  - `apps/api/prisma/sql/multi-tenancy-foundation.sql` backfills all existing production data into "Organization #1" using column DEFAULTs to avoid violating the immutability RULE on `journal_entries`.
  - New `docs/MONETIZATION_PLAN.md` documents the phased multi-tenancy/monetization roadmap.

### Changed
- **Org-scoped API layer (Phase 1b).**
  - JWT payload now carries `organizationId` resolved from `OrganizationMember` at login/refresh; `authenticate()` attaches it to every request.
  - New `apps/api/src/core/tenancy/scope.ts` provides `getOrganizationId()` and flock-ownership assertion helpers.
  - All core API modules now create/read/update/delete within the authenticated user's organization: suppliers, broiler flocks, growth/feed/water/mortality/vaccination/medication/environmental records, flock tasks, financial records, alerts, sale records, and documents. Several were previously filtering by `createdBy` (individual user), now corrected to organization-wide sharing for team/farm use.
  - Double-entry ledger: manual journal entries, auto-posted entries from `FinancialRecord`, reversals, year-end closing, and all financial reports (trial balance, income statement, balance sheet, cash flow, period close) now require and filter by `organizationId`.
  - `LedgerBalance` now includes `organizationId` so materialized period balances do not mix tenants.

### Fixed
- **`prisma db push` footgun with `search_vector`.** The PostgreSQL `tsvector` `search_vector` column on `documents` cannot be represented in Prisma, so `prisma db push --accept-data-loss` would silently drop it. The required re-apply step (`documents-search.sql`) is documented in `AGENTS.md`.
- **Chart-of-accounts uniqueness regression.** A briefly-introduced `@@unique` constraint on `Account` was reverted after it became clear it would require rewriting the entire double-entry service layer for no isolation benefit; the reasoning is captured in a `schema.prisma` comment.

### Known Limitations
- The legacy Milestone-1 planning module (`production_cycles`, `batches`, `expansion-plan`, `overhead-costs`) is **not yet org-scoped**.
- The deprecated `financial-engine` v0.8.0 endpoints are **not yet org-scoped**.
- Both are explicitly deferred in `docs/MONETIZATION_PLAN.md` Phase 1b and must be completed before Phase 2 self-serve signup.
- `organizationId` columns remain nullable pending Phase 1c, when all write paths (including deferred modules) are confirmed to populate them.

### Test Summary
- 163 tests pass (48 unit + 115 integration) on two independent clean runs.
- Zero data loss verified after backfill: all tenant tables show 0 orphaned (`organization_id IS NULL`) rows.

## v1.6.1-alpha — 2026-08-04

### Fixed
- **ClamAV auto-recovery.** The `initFailed` flag in `clamav.service.ts` now
  auto-resets after 30 seconds, allowing the scanner to recover without an
  API restart. Previously, if ClamAV was not ready on the first upload, all
  subsequent uploads would fail-closed until the API process restarted.
- **ClamAV image pinned.** `clamav/clamav-debian:latest` is now pinned to
  `clamav/clamav-debian@sha256:741e6c447241220e0792a901befcaec1d55a755c5097fc9cd88d7fd8be251a5c`
  in `docker-compose.yml` and `docker-compose.prod.yml`, eliminating
  supply-chain risk from a floating tag.
- **GAAP balance sheet equation (Assets = Liabilities + Equity).**
  - `auto-post.service.ts` now credits Cash (`1010`) instead of Accounts
    Payable (`2010`) for expense-category purchases, so liabilities are not
    overstated.
  - `gaap-statement.service.ts` now uses `negated()` for equity accounts
    instead of `abs()`, correctly treating debit balances (accumulated
    losses) as negative equity.
  - Added `apps/api/src/db/seeds/settle-ap-to-cash.ts` to settle existing
    AP/Accrued balances to Owner's Capital on deployments that were affected
    by the original mapping.
- **TypeScript errors eliminated.** Reduced from 168 pre-existing errors to 0:
  - Switched `import Decimal from 'decimal.js'` to named `import { Decimal }`
    across 9 financial/double-entry files.
  - Resolved `jsonwebtoken` overload errors with explicit `as any` casts on
    `expiresIn`.
  - Added explicit type annotations to remove implicit `any` errors in route
    handlers.
  - Fixed tuple destructuring in `gaap-statement.service.ts`.
  - Added `.js` extensions to relative imports in `seeds/main.ts` for Node16
    resolution.
  - Typed seed data arrays as `any[]` to avoid enum string-literal mismatches.

### Changed
- `AGENTS.md` test count updated to 163 (48 unit + 115 integration) and the
  new `settle-ap-to-cash.ts` backfill script is documented.

### Test Summary
- 163 tests pass (48 unit + 115 integration).
- TypeScript: 0 errors (`tsc --noEmit` clean).
- Web build: 30/30 pages compiled successfully.
- API health: healthy.

## v1.6.0-alpha — 2026-08-04

### Added
- **Document Attachments for Financial Transactions.** Receipts, invoices, and
  other supporting documents can now be attached to `FinancialRecord`,
  `JournalEntry`, and `SaleRecord` (backward-compatible `BroilerFlock`
  documents remain supported).
  - MinIO/S3 storage backend using the shared `pom-minio` container, a
    dedicated `nkuku-app` service account, and the `nkuku-documents` bucket.
  - Generalized documents API module with generic ownership, MinIO
    upload/download, attachment count limits, full-text search, and virus
    scanning.
  - `FinancialRecord`, `JournalEntry`, and `SaleRecord` `GET /:id` endpoints
    now include associated documents.
  - ClamAV virus scanning container plus `clamav.service`, fail-closed by
    default.
  - OCR and text extraction on upload for PDF, DOCX, images (tesseract.js),
    and CSV; extracted text is indexed in a PostgreSQL `tsvector` column for
    fast full-text search.
  - Web `AttachmentPanel` component embedded in the financial records page,
    journal detail page, and sales page.
  - Mobile `AttachmentSection` widget and generalized `DocumentForm` embedded
    in the journal detail and financial record forms.
  - Backfill script `apps/api/src/db/seeds/migrate-documents-to-s3.ts` for
    migrating existing local documents into S3.
  - 47 unit tests (6 files) and 18 new integration tests for documents on
    financial transactions.

### Security
- Ownership filtering on global document search.
- Role check on journal document access.
- Path-traversal protection on legacy file endpoints.
- MinIO secret removed from `AGENTS.md`; the `infra/minio/setup-nkuku-account.sh`
  setup script now requires `NKUKU_SECRET_KEY` to be supplied via environment
  (no default secret in version control).
- `.env` is gitignored — real `S3_SECRET_KEY`, `JWT_SECRET`, and database
  credentials must stay in `.env` and never be committed.

### Migration Notes
- Apply Prisma schema changes with `docker compose exec api npx prisma migrate deploy`.
- Enable the full-text search column/index by running:
  `docker compose exec api psql "$DATABASE_URL" -f /app/prisma/sql/documents-search.sql`
- Backfill legacy documents with:
  `docker compose exec api npx tsx src/db/seeds/migrate-documents-to-s3.ts`

### Test Summary
- 47 unit tests pass.
- 115 integration tests; 1 pre-existing `gaap balance sheet` failure remains
  (not introduced by this phase).

### Notes
- API package version advanced from `0.1.0-alpha` to `0.2.0-alpha` to mark
  the new documents backend.

## v1.5.4-alpha — 2026-08-03

### Added
- **Harvest Date & Days to Harvest on mobile app.** Mirrors the web
  app changes on the Flutter mobile app:
  - Flock list cards now show a harvest date row with calendar icon,
    formatted date, and color-coded days-remaining label.
  - Flock detail overview tab shows Harvest Date and Days to Harvest
    lines (with color coding) between Age and Status.
  - BroilerFlock model gained `harvestDate`, `daysToHarvest`, and
    `harvestDateStr` computed getters.

## v1.5.3-alpha — 2026-08-03

### Changed
- **Removed prominent harvest stat cards from flock detail page.** Per
  user request, the two large harvest cards at the top of the flock
  detail page have been removed. Harvest info remains in the header
  subtitle and in the Flock Summary card in the Overview tab.

## v1.5.2-alpha — 2026-08-03

### Changed
- **Harvest fields now prominent at top of flock detail page.** The
  Harvest Date and Days to Harvest cards were previously buried in the
  Flock Summary card below the fold. Added two prominent stat cards at
  the top of the page (before Birds/Mortality/Revenue), styled with
  primary-colored borders and CalendarDays icons.
- **Switched web container to production build.** The dev server's JS
  chunks are not content-hashed, so ISPConfig nginx's `expires 365d`
  caching on `/_next/static` caused browsers to load stale JS after
  redeploys. Production build uses content-hashed filenames that bust
  cache correctly.

## v1.5.1-alpha — 2026-08-03

### Fixed
- **NetworkError on production site.** The `.env` file had
  `NEXT_PUBLIC_API_URL=http://localhost:30001`, which got embedded in
  client-side JS. When users visited the production site, their browsers
  tried to fetch API data from `http://localhost:30001` on their own
  machines — causing NetworkError and mixed-content blocking (HTTPS page
  requesting HTTP resource). Fixed by setting `NEXT_PUBLIC_API_URL` to
  empty so the browser uses same-origin relative URLs (`/api/v1/...`),
  which ISPConfig nginx proxies to the backend.

## v1.5.0-alpha — 2026-08-03

### Added
- **Harvest Date & Days to Harvest on broiler flock cards.** Each flock
  card on /broiler-flocks now shows two new fields:
  - Harvest Date: the date when the flock reaches targetAge (default 42
    days) of age, computed as startDate + targetAge.
  - Days to Harvest: remaining days until harvest (targetAge - ageDays).
  Both show "Pending collection" when chicks aren't collected yet. Days
  to Harvest is color-coded: red when due/overdue, orange within 7 days.
- **Harvest info on flock detail page.** The header subtitle now includes
  the harvest date and days remaining. The Flock Summary card in the
  Overview tab also shows both fields.

## v1.4.7-alpha — 2026-08-03

### Changed
- **Cost Breakdown chart — clean design, slightly bigger.** Reverted the
  label nudging hack from v1.4.6. Back to the clean two-line label design
  (two <text> elements, no x offset manipulation). Increased chart height
  from 300→340px for a bigger pie while keeping outerRadius at 80 — the
  value that fits all labels within the 304px SVG width without hacks.

## v1.4.6-alpha — 2026-08-03

### Changed
- **Cost Breakdown chart — slightly larger.** Increased chart height
  from 300→360px and outerRadius from 80→82 for a bigger pie. Nudged
  right-side labels 4px inward to keep all two-line labels within the
  SVG bounds. Label font size unchanged at 11px — no truncation.

## v1.4.5-alpha — 2026-08-03

### Fixed
- **Cost Breakdown chart — two-line labels now render correctly.** The
  previous <tspan dy> approach produced lines only 13px apart, making them
  appear as one line. Switched to two separate <text> elements inside a <g>:
  category name (bold) at y-8, ZMW amount (muted) at y+8, giving 16px
  separation — clearly two distinct lines.

## v1.4.4-alpha — 2026-08-03

### Fixed
- **Cost Breakdown chart — two-line labels.** Reverted to the original
  inline pie label design but split each label into two lines: category
  name on top, ZMW amount on the bottom. This halves the horizontal width
  of each label (e.g. "chick purchase" + "ZMW 7700" instead of
  "chick_purchase: ZMW 7700" on one line), preventing truncation without
  shrinking the chart. Uses custom label render with two `<tspan>` elements.

## v1.4.3-alpha — 2026-08-03

### Fixed
- **Cost Breakdown chart — vaccines label truncation.** With 5 categories
  the legend wrapped to 4 rows (~80px). The 320px chart height left the
  last item "vaccines: ZMW 346" clipped at the SVG bottom edge. Increased
  chart height to 380px, reduced outerRadius to 80, moved cy to 35%.

## v1.4.2-alpha — 2026-08-03

### Fixed
- **Mobile CRUD gaps.** Filled three missing CRUD functionalities:
  - Documents: added PATCH endpoint and edit form for document metadata
    (category, recordType).
  - Alerts: added DELETE endpoint and delete button with confirmation dialog.
  - Flock Tasks: added FAB and create dialog for manual task creation
    (API already supported POST).
- **ageDays calculation.** The API list (GET /api/v1/broiler-flocks) and
  detail (GET /api/v1/broiler-flocks/:id) endpoints were not returning
  ageDays, causing all flocks to show "Day 0" in the mobile app. Both
  endpoints now compute ageDays from startDate. Flocks without a startDate
  show "Pending" instead of "Day 0".
- **Overhead category mapping.** The overhead allocation service was passing
  OverheadCategory enum values (e.g. 'labour', 'vaccination', 'electricity')
  directly as FinancialRecord.category, which expects FinancialCategory enum
  values (e.g. 'labor', 'vaccines', 'utilities'). This caused a 500 error
  when creating monthly overheads. Added a mapping table.
- **Cost Breakdown chart truncation.** The "Cost Breakdown by Category" pie
  chart on /financials used inline labels that overflowed the SVG container
  by up to 145px, truncating category names and amounts. Replaced with a
  proper Legend component that wraps within the chart bounds.

### Changed
- Docker Compose restored to use shared external PostgreSQL and Redis
  services (shared-net network) instead of local containers.
- Mobile flock list card shows "Pending" for flocks without a startDate.

### Test Summary
- 129/129 backend tests pass (11 test files)
- Flutter analyze: no issues
- All containers healthy (api, web, nginx, ntfy)

## v1.4.1-alpha — 2026-08-03

### Fixed
- **Flaky alert generation test.** The `generates alerts including
  vaccination and task alerts` integration test was failing because the
  test flock's `collectionDate` was hardcoded to `2026-06-01`, making the
  flock ~63 days old. The vaccination schedule only has items up to day
  21, and the alert generation looks for schedule items within a ±2 day
  window of the flock's current age — so no `vaccination_due` alerts were
  generated for the old flock.
- The test now creates a separate flock with a dynamic `collectionDate`
  of today, guaranteeing the flock is day 0 and the Marek's/Newcastle
  vaccines (scheduled at age 0) always trigger `vaccination_due` alerts.
  The flock is cleaned up after the test. This follows the project
  guideline of creating new flocks for testing rather than modifying
  existing ones.
- Test count: 129 (was 127).

### Files Modified
- `apps/api/tests/integration/broiler-management.test.ts`
- `package.json` (version bump)

### Test Summary
- 129 backend tests pass (11 test files, all green, verified across
  multiple consecutive runs).

## v1.4.0-alpha — 2026-08-03

### Added
- **Supplier price history / audit trail.** Every time a feed stage's
  `unitPriceZmw` or `unitSizeKg` is updated via `PATCH /api/v1/feed-stages/:id`,
  the API now automatically records the old and new values, who made the
  change, and when — in a new `FeedStagePriceHistory` table.
- **Price history API endpoints:**
  - `GET /api/v1/feed-stages/:id/price-history` — history for a single stage
  - `GET /api/v1/suppliers/:id/price-history` — history for all stages of a
    supplier (includes stage name, old/new price, old/new unit size,
    changed-by, changed-at)
- **Price history UI on Suppliers page.** Each supplier card now has a
  history icon button that opens a dialog showing the full audit trail:
  stage name, old price, new price (with diff highlighted green/red), unit
  size changes, and timestamp.
- Added `FeedStagePriceHistory` TypeScript interface.

### Database Changes
- New table: `feed_stage_price_history` (id, feed_stage_id, old/new
  unit_price_zmw, old/new unit_size_kg, changed_by, changed_at). Applied
  via `prisma db push`. No data migration needed — the table starts empty
  and populates on future price changes.

### Files Modified
- `apps/api/prisma/schema.prisma` — new `FeedStagePriceHistory` model
- `apps/api/src/modules/feed-stages/routes.ts` — auto-record on PATCH + GET history
- `apps/api/src/modules/suppliers/routes.ts` — supplier-level GET history
- `apps/web/src/app/suppliers/page.tsx` — price history dialog + button
- `apps/web/src/lib/types.ts` — `FeedStagePriceHistory` interface
- `package.json` (version bump)

### Test Summary
- 126 backend tests pass (1 pre-existing flaky alert-generation test fails
  independently of this change — confirmed by stashing changes and re-running).
- Web production build passes (typecheck + lint via `next build`).

### Notes
- Historical financial records were already snapshotted at creation time
  (feed record `costZmw` and financial record `amountZmw` are copies, not
  live references). This feature adds visibility into *when* and *how*
  supplier prices changed, complementing the existing snapshot behavior.
- The price history table starts empty — it only records changes made
  from now on. Past price changes (before this feature) are not
  retroactively logged.

## v1.3.3-alpha — 2026-08-02

### Changed
- **Renamed profit labels to revenue/profit correctly.** Both the flock list
  cards and the flock detail dashboard now distinguish between revenue and
  profit:
  - **Projected Revenue** = sale price per bird × remaining birds
  - **Projected Profit** = projected revenue − total costs
  - **Actual Revenue** = sales income recorded so far (no costs subtracted)
  - **Actual Profit** = actual revenue − total costs
- Flock detail dashboard cards now show revenue as the headline figure with
  profit shown beneath it (color-coded green/red).
- Flock list cards now show all four figures: Sale Price/Bird, Projected
  Revenue, Projected Profit, Actual Revenue, Actual Profit.
- Added testing guideline to `AGENTS.md`: never modify existing flocks for
  testing — always create new flocks specifically for test runs.

### Files Modified
- `apps/web/src/app/broiler-flocks/[id]/page.tsx`
- `apps/web/src/app/broiler-flocks/page.tsx`
- `AGENTS.md`
- `package.json` (version bump)

### Test Summary
- 127 backend tests pass (12 unit + 115 integration).
- Web production build passes (typecheck + lint via `next build`).

## v1.3.2-alpha — 2026-08-02

### Changed
- **Flock list cards: financial summary.** Each flock card on the
  `/broiler-flocks` page now shows Sale Price/Bird, Projected Profit
  (sale price × remaining birds), and Actual Profit (revenue − costs from
  financials) in addition to the existing Birds/Mortality rows.
- **Flock detail dashboard: Actual Profit card.** Added an "Actual Profit"
  card next to the "Projected Profit" card at the top of the flock detail
  page. It shows revenue minus costs from recorded financial transactions
  (green when positive, red when negative, 0.00 when no sales yet).
- **API: flock list endpoint** (`GET /api/v1/broiler-flocks`) now includes
  minimal `financialRecords` (amountZmw, isIncome, category) so the
  frontend can compute actual profit per flock without extra requests.
- Added optional `financialRecords` to the `BroilerFlock` TypeScript
  interface.

### Files Modified
- `apps/api/src/modules/broiler-flocks/routes.ts`
- `apps/web/src/app/broiler-flocks/page.tsx`
- `apps/web/src/app/broiler-flocks/[id]/page.tsx`
- `apps/web/src/lib/types.ts`
- `package.json` (version bump)

### Test Summary
- 127 backend tests pass (12 unit + 115 integration).
- Web production build passes (typecheck + lint via `next build`).

## v1.3.1-alpha — 2026-08-02

### Changed
- **Flock dashboard: projected profit card.** Replaced the financials-based
  "Profit (ZMW)" card on the flock detail page with a "Projected Profit"
  card. It now calculates projected profit as
  `projected sale price per bird × remaining birds (currentCount)`,
  instead of deriving profit from recorded financial transactions.
- Added an inline input field on the card to enter/save the projected sale
  price per bird. The value persists via the existing `salePriceZmw` field
  on `BroilerFlock` (PATCH `/api/v1/broiler-flocks/:id`). Viewers see the
  value read-only; owners/managers can edit and save.
- Added `salePriceZmw` to the `BroilerFlock` TypeScript interface
  (`apps/web/src/lib/types.ts`).

### Files Modified
- `apps/web/src/app/broiler-flocks/[id]/page.tsx`
- `apps/web/src/lib/types.ts`
- `package.json` (version bump)

### Notes
- No backend or database schema changes — `salePriceZmw` already existed on
  the `BroilerFlock` Prisma model and was already accepted by the PATCH
  endpoint.
- The Overview tab's "Flock Summary" still shows Total Cost / Total Revenue
  from financials for reference; only the top dashboard card changed.
