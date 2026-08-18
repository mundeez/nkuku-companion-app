# Nkuku Advertising Plan (Phase 4b)

Status: **Implemented (2026-08-18) — core scope shipped, see §9 for what's done vs. deferred.**
Parent doc: `docs/MONETIZATION_PLAN.md` (this is a sibling phase, inserted as **Phase 4b**, after Phase 3 — Billing core, alongside/before Phase 4 — Pricing page).

## 0. Decisions locked from Q&A with user (2026-08-18)

| Decision | Choice |
|---|---|
| Platform scope | Web (Next.js) **and** Mobile (Flutter, Android/iOS) |
| Ad supply model | **Hybrid**: house ads (sold directly to agri-suppliers/feed/vaccine/equipment vendors) prioritized, falling back to Google AdSense (web) / AdMob (mobile) to fill unsold inventory |
| Ad formats | Banner strips + native inline cards (no interstitials — rejected as too intrusive for a data/finance-adjacent tool) |
| Who sees ads | Free tier only. Grower/Business/Enterprise are ad-free (existing plan hierarchy) |
| Ad-free upsell | New low-price **"Remove Ads" add-on** for Free-tier orgs that don't want to upgrade fully — small recurring charge (~K30–50/mo), stacks on top of Free tier without changing its feature limits |
| House ad admin | Full CRUD admin UI (new platform-admin surface — first of its kind in this app) |
| Ad network account | Not yet created — build behind a feature flag/env var so it activates once Google approves the AdSense/AdMob account; ship house-ads-only first |
| Consent/CMP | Google Funding Choices (web) + UMP SDK (mobile) — required by Google policy anyway, also strengthens Zambia DPA consent posture |
| House ad billing model | **Both**: flat sponsorship-fee campaigns and metered CPM/CPC campaigns, selectable per campaign |
| House ad targeting | Targeted by org `country`/`currency` (falls back to "all countries" if campaign has no target set) |
| Frequency/density | 1 banner slot per page (dashboard, projections, document search results, flock detail) + 1 native card inserted every 5–10 items in list-style results (document search results, projections comparison rows where applicable) |
| Roadmap placement | New **Phase 4b** in `MONETIZATION_PLAN.md`, independent of Phase 4 (pricing page) — only truly depends on Phase 3 (billing core), which is already built |

## 1. Why this design (industry best practice notes)

- **Freemium ads-on-free-tier-only** is the standard SaaS/utility-app pattern (Spotify, Duolingo, Notion-adjacent tools) — ads fund the free tier and are a visible incentive to upgrade, without punishing paying customers.
- **House ads before network ads** maximizes relevance and CPM for a vertical (poultry/agri) audience where a generic ad network has thin fill and low relevance; it also avoids third-party data sharing for orgs that opt out of consent (house ads carry no tracking pixel by default).
- **Native cards capped at 1-in-5/10** and **1 banner per page** match established guidance (Google's "Better Ads Standards", App Store/Play Store ad-density review guidelines) — avoids interstitials and pop-ups, which are explicitly flagged as disruptive ad experiences and risk app store rejection for finance-adjacent apps.
- **CMP (Funding Choices/UMP) is not optional** once Google ad products are integrated — Google requires publishers to use an IAB-registered CMP for regions with GDPR-like consent laws, and it's good practice to extend that same consent signal to house ads and to the Zambia DPA consent trail already in `User.consentAcceptedAt`/`consentVersion`.
- **Country/currency targeting** reuses fields that already exist on `Organization` — zero new schema needed for targeting logic, and it matches how real agri suppliers operate regionally (a Zambian feed supplier doesn't want impressions wasted on Botswana orgs).
- **Both flat and CPM/CPC billing** models are common in direct ad sales to SMB advertisers: flat-fee is what a supplier with no ad-tech sophistication expects ("sponsor this month"), CPM/CPC is what a more data-driven advertiser wants — offering both maximizes house-ad conversion.

## 2. Data model changes (Prisma)

New models, additive only — no changes to existing tenant tables besides one new relation on `Organization`.

```prisma
// ── ADVERTISING ──────────────────────────────────
enum AdPricingModel {
  flat
  cpm
  cpc
}

enum AdCampaignStatus {
  draft
  active
  paused
  completed
}

enum AdPlacement {
  banner
  native
}

enum AdPage {
  dashboard
  projections
  document_search
  flock_detail
}

// Platform-level (NOT organization-scoped) — sold by Nkuku to advertisers,
// who may or may not themselves be Nkuku customers (advertiserOrgId optional).
model AdCampaign {
  id               String           @id @default(uuid()) @db.Uuid
  advertiserName   String           @db.VarChar(150)
  advertiserOrgId  String?          @map("advertiser_org_id") @db.Uuid // optional link if advertiser is also a Supplier/Organization
  creativeImageUrl String           @map("creative_image_url") @db.Text
  targetUrl        String           @map("target_url") @db.Text
  altText          String           @db.VarChar(200)
  placement        AdPlacement
  pages            AdPage[]         @map("pages")
  countryTargets   String[]         @map("country_targets") // ISO-3166-1 alpha-2; empty = all countries
  pricingModel     AdPricingModel   @map("pricing_model")
  flatFeeAmount    Decimal?         @map("flat_fee_amount") @db.Decimal(12, 2)
  cpmRate          Decimal?         @map("cpm_rate") @db.Decimal(10, 4)  // price per 1000 impressions
  cpcRate          Decimal?         @map("cpc_rate") @db.Decimal(10, 4)  // price per click
  currency         String           @default("ZMW") @db.Char(3)
  budgetCap        Decimal?         @map("budget_cap") @db.Decimal(12, 2) // for cpm/cpc campaigns; null = uncapped
  spendToDate      Decimal          @default(0) @map("spend_to_date") @db.Decimal(12, 2)
  priorityWeight   Int              @default(1) @map("priority_weight") // higher = more likely to be picked among eligible house ads
  startDate        DateTime         @map("start_date") @db.Timestamptz(6)
  endDate          DateTime         @map("end_date") @db.Timestamptz(6)
  status           AdCampaignStatus @default(draft)
  impressionsCount Int              @default(0) @map("impressions_count")
  clicksCount      Int              @default(0) @map("clicks_count")
  createdBy        String           @map("created_by") @db.Uuid
  createdAt        DateTime         @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt        DateTime         @updatedAt @map("updated_at") @db.Timestamptz(6)

  events AdEvent[]

  @@index([status, startDate, endDate])
  @@map("ad_campaigns")
}

enum AdEventType {
  impression
  click
}

// Lightweight event log for metering (cpm/cpc billing) and reporting.
// Partition/prune candidate later if volume grows; not tenant data.
model AdEvent {
  id             String      @id @default(uuid()) @db.Uuid
  adCampaignId   String      @map("ad_campaign_id") @db.Uuid
  organizationId String?     @map("organization_id") @db.Uuid // nullable: house ad can be served to logged-out/marketing pages later
  eventType      AdEventType @map("event_type")
  page           AdPage      @map("page")
  occurredAt     DateTime    @default(now()) @map("occurred_at") @db.Timestamptz(6)

  campaign AdCampaign @relation(fields: [adCampaignId], references: [id], onDelete: Cascade)

  @@index([adCampaignId, eventType, occurredAt])
  @@map("ad_events")
}
```

**Remove-ads add-on** — no new model needed. Reuse the existing `Subscription`/`Invoice` machinery: an org can hold **two** active `Subscription` rows simultaneously — its real plan (`planCode: 'free'`) and an add-on row (`planCode: 'remove_ads_addon'`, its own `Invoice`s via the existing Flutterwave flow). `plans.ts` gets a new non-selectable pseudo-plan entry purely for pricing metadata; `getEffectivePlanCode` continues to drive feature gating unchanged, and a new `hasAddon(prisma, organizationId, 'remove_ads_addon')` helper checks for an active add-on subscription row.

**Platform admin access** — no existing concept in the codebase (checked: no superadmin/platform-admin role anywhere). Add a minimal `User.isPlatformAdmin Boolean @default(false)` column (manually flipped in DB for the 1-2 people who manage ad sales; not self-serve, not exposed in signup). This is intentionally the smallest possible primitive — Phase 6 ("Admin/ops dashboard") already on the roadmap can build on the same flag rather than duplicating it.

## 3. Backend (apps/api)

### New modules
- `src/core/ads/plans-addon.ts` — `remove_ads_addon` pricing metadata + `hasAddon()` helper.
- `src/core/ads/ad-serving.service.ts`:
  - `selectHouseAd(prisma, { page, placement, organizationId })` — filters active campaigns (status=active, startDate<=now<=endDate, budget not exhausted, country target matches org.country or empty), weighted-random pick by `priorityWeight`.
  - `shouldShowAds(prisma, organizationId)` — `true` only if effective plan is `free` AND no active `remove_ads_addon` subscription.
  - `recordEvent(prisma, { campaignId, organizationId, eventType, page })` — increments `impressionsCount`/`clicksCount`, updates `spendToDate` for cpm/cpc campaigns, auto-pauses campaign if `spendToDate >= budgetCap`.
- `src/modules/ads/routes.ts` (public-ish, auth-required, org-scoped by caller):
  - `GET /api/v1/ads/serve?page=&placement=` → `{ source: 'house', campaign: {...} } | { source: 'network', networkUnit: {...} } | { source: 'none' }`. Returns `none` if `shouldShowAds` is false — frontend renders nothing.
  - `POST /api/v1/ads/:id/impression` — fire-and-forget beacon.
  - `GET /api/v1/ads/:id/click` — logs click, 302-redirects to `targetUrl` (keeps `targetUrl` out of client-side click-fraud tampering and gives accurate CPC counting).
- `src/modules/ad-campaigns/routes.ts` (platform-admin only, gated by `requirePlatformAdmin` preHandler checking `User.isPlatformAdmin`):
  - `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id` (soft: sets status=completed), `GET /:id/stats` (impressions/clicks/spend time series from `AdEvent`).
- `src/core/billing/feature-gate.ts` — add `requirePlatformAdmin` preHandler alongside existing ones.
- Network integration is env-flag gated: `ADSENSE_ENABLED`, `ADMOB_ENABLED` (default false) — `selectHouseAd` fallback to `source: 'network'` only checked when the relevant flag is true and no house ad matched.

### Tests
- Unit: `ad-serving.service.test.ts` — targeting logic (country match/empty), weighted selection distribution, budget cap auto-pause, `shouldShowAds` matrix (free/no-addon → true; free/with-addon → false; paid tiers → false).
- Integration: `ad-campaigns.test.ts` (admin CRUD + RBAC 403 for non-platform-admin), `ads-serve.test.ts` (serve endpoint respects plan/addon/country, impression/click endpoints update counters).

## 4. Web frontend (apps/web)

- `src/components/ads/AdSlot.tsx` — client component: calls `GET /api/v1/ads/serve`, renders house creative (`<img>` + click-tracked link) or a Google AdSense `<ins>` unit (loaded only if `source: 'network'`) or nothing. Fires impression beacon on mount (IntersectionObserver-gated, so only counts if actually scrolled into view — standard viewability practice).
- `src/components/ads/AdNativeCard.tsx` — inline card variant styled to visually match surrounding list items but with a persistent "Sponsored" label (FTC/industry disclosure best practice — required, not optional).
- `src/components/ads/ConsentBanner.tsx` — Google Funding Choices snippet, loaded once at root layout; gates ad rendering until consent resolved for regions where required.
- Placements:
  - `/` (dashboard) — one `AdSlot` banner below the KPI summary row.
  - `/projections` — one `AdSlot` banner between the input form and the results/chart section.
  - `AttachmentPanel.tsx` document search results — `AdNativeCard` inserted after every 5th result in `searchResults` list.
  - `broiler-flocks/[id]` detail tabs — one `AdSlot` banner at the bottom of the Overview tab.
- `src/app/account/billing` (or wherever billing-settings lives) — add "Remove Ads" add-on card next to plan upgrade options for Free-tier orgs, wired to existing Flutterwave checkout flow pattern used for plan upgrades.
- New platform-admin-only pages under `/admin/ads` (list, create/edit campaign form, stats view) — hidden from nav unless `user.isPlatformAdmin`.

## 5. Mobile frontend (apps/mobile)

- `lib/widgets/ad_slot.dart` — calls the same `/api/v1/ads/serve` endpoint; renders house creative via `Image.network` + `InkWell` (click endpoint), or a Google Mobile Ads (AdMob) `BannerAd`/`NativeAd` widget when `source: 'network'`.
- `google_mobile_ads` Flutter package + platform setup (AndroidManifest `APPLICATION_ID` meta-data, iOS `Info.plist` `GADApplicationIdentifier`) — added but inert until `ADMOB_ENABLED` flag + real unit IDs are supplied.
- UMP SDK (`user_messaging_platform` or via `google_mobile_ads`'s built-in consent API) for the consent flow, requested at app start before any ad request.
- Placements: `dashboard_screen.dart` (banner), `projections_screen.dart` (banner), document search results within flock records (native card every 5-10 items), `flocks_screen.dart` list bottom banner.
- "Remove Ads" surfaced read-only on mobile with a deep link to the web billing page (matches the existing pattern of "mobile shows plan status, deep-links to web for billing" to avoid app-store IAP cut — explicitly already decided in `MONETIZATION_PLAN.md` §Phase 4).

## 6. Compliance & legal follow-ups (tracked, not purely engineering)

- Privacy Policy must be updated to disclose ad-network data sharing (Google) before AdSense/AdMob account application — Google requires a live privacy policy URL as part of account approval.
- Funding Choices/UMP consent messages must reference the specific ad partners in use (Google's ATP - Additional Consent Providers list) — configured in Google's admin console, not custom code.
- Zambia DPA: extend existing consent versioning (`User.consentVersion`) to cover an "advertising/analytics" consent purpose distinct from the core-service consent already captured at signup, so a user can accept core Terms but decline ad personalization (still sees ads, but non-personalized/contextual only — Google supports "non-personalized ads" mode for exactly this).
- "Sponsored" disclosure label on all house ad units — required for advertising-standards compliance in most jurisdictions (avoids deceptive-advertising exposure).
- **Action item for user**: apply for Google AdSense (web) and AdMob (mobile) accounts now, since approval can take days-to-weeks; house ads can launch independently in the meantime.

## 7. Rollout sequence

1. **Schema + backend core** — Prisma migration (`AdCampaign`, `AdEvent`, `User.isPlatformAdmin`), `ad-serving.service.ts`, `ads` + `ad-campaigns` API modules, `remove_ads_addon` pricing metadata, unit + integration tests.
2. **Platform admin UI (web)** — `/admin/ads` CRUD so real house campaigns can be created before touching consumer-facing surfaces.
3. **Consumer ad surfaces (web)** — `AdSlot`/`AdNativeCard` components, Funding Choices consent banner, wire into dashboard/projections/document-search/flock-detail.
4. **Remove Ads add-on billing (web)** — billing-settings UI + Flutterwave recurring charge reuse.
5. **Mobile** — `google_mobile_ads` integration, UMP consent, `AdSlot` widget, same placements.
6. **Network fallback activation** — once Google accounts are approved, flip `ADSENSE_ENABLED`/`ADMOB_ENABLED` and supply real unit IDs via env/secrets (no code change needed).
7. **Phase closeout** — full test suite, `docker compose up --build`, tag `v1.1.0-phase-4b` (or next appropriate version), update `MONETIZATION_PLAN.md` to mark Phase 4b complete.

## 8. Open assumptions (flag if wrong)

- "Search results" in scope = the document full-text search results inside `AttachmentPanel` (`GET /api/v1/documents/search`) — there is no other global search feature in the app today.
- "Projections" in scope = the feed-cost projection tool at `/projections` (web) and `projections_screen.dart` (mobile) — not the legacy `expansion-plan` cycles feature.
- No interstitials/full-screen ads anywhere, per explicit rejection above — if reviewers want more aggressive monetization later, that's a separate future decision, not bundled into this phase.
- `isPlatformAdmin` will be granted manually via a one-off DB update to the current owner account (or a seed flag), not via any self-serve UI — this is intentionally out of scope for this phase.

## 9. Implementation status (2026-08-18)

**Delivered:**
- Schema: `AdCampaign`, `AdEvent`, `AdPricingModel`/`AdCampaignStatus`/`AdPlacement`/`AdPage`/`AdEventType` enums, `User.isPlatformAdmin`. Migrated via `prisma db push` on the live dev DB (documents full-text search column re-applied per the standard post-`db push` step).
- Backend: `core/ads/ad-serving.service.ts` (targeting, weighted selection, budget-cap auto-pause, `shouldShowAds`), `modules/ads/routes.ts` (serve/impression/click), `modules/ad-campaigns/routes.ts` (platform-admin CRUD + stats), `core/billing/addons.ts` (`remove_ads_addon` as a second, independent `Subscription` row stacking on top of the org's real plan — reuses the existing Flutterwave checkout flow), `requirePlatformAdmin` gate in `feature-gate.ts`. Billing add-on endpoints added under `/api/v1/billing/addons/*`.
- **Bug found & fixed during implementation**: `getOrCreateSubscription`/`updateSubscription` in `billing.service.ts` originally picked the org's *most recently created* `Subscription` row regardless of type — once an add-on purchase existed, it would shadow the org's real plan subscription (breaking `getEffectivePlanCode` and all feature-gating for that org). Fixed by scoping both lookups to `planCode IN (real plan codes)`; covered by a regression assertion in `tests/integration/ads.test.ts`.
- Web: `AdSlot` (banner) and `AdNativeCard` (native) components with Sponsored disclosure + viewability-gated impression tracking; wired into `/` (dashboard), `/projections`, `AttachmentPanel` document search results (every 5th result), and the flock detail Overview tab. `UpgradePromptProvider` (Phase 4) shows a consistent 402 `PLAN_LIMIT_REACHED` dialog app-wide. Public `/pricing` marketing page. "Remove Ads" add-on card in `/billing`. Platform-admin `/admin/ads` list/create/edit/stats pages, linked from the user menu when `user.isPlatformAdmin`.
- Mobile: `AdService`/`AdSlot` widget wired into the dashboard and projections screens (house ads + inert network placeholder). `flutter analyze` clean on all new/changed files.
- Tests: new `tests/integration/ads.test.ts` (16 tests: platform-admin gating, campaign CRUD + URL-scheme rejection, house-ad serving/targeting/paid-tier suppression, impression/click metering + stats, server-side re-validation on paused campaigns, remove-ads add-on purchase/cancel + trial-expiry field, and its non-interference with the org's real plan). Full API suite: 253-254/254 passing depending on run (1 consistently pre-existing failure in `lighting-temperature.test.ts`; 2 additional intermittent flakes seen in `broiler-management.test.ts` and `ledger-api.test.ts` under full-suite parallel load that pass in isolation and are unrelated to this work — confirmed via `git diff` that no changes in this phase touch those modules).

**Security review findings & fixes (2026-08-18, via `security-auditor` subagent):**
- **Fixed — click/impression counting for ineligible campaigns**: `recordAdEvent` now re-validates (status=active, within date window, page match, country-eligible, org still ad-eligible) before counting anything, closing a click-fraud/budget-drain path where any authenticated user could hit `/ads/:id/impression`/`/click` with an arbitrary campaign id.
- **Fixed — open redirect via `targetUrl`/`creativeImageUrl`**: campaign URLs are now restricted to `http(s)` schemes (`z.string().url()` alone accepts `javascript:`/`data:`/`file:`), since the click endpoint performs a same-origin-trusted 302 redirect to `targetUrl`.
- **Fixed — "Remove Ads" add-on had no trial expiry**: `subscribeToAddon` now sets `trialEndsAt` on the add-on's `Subscription` row so the existing daily billing cron sweeps an unpaid add-on back to `past_due`/`suspended` instead of granting ad-free access indefinitely.
- **Fixed — add-on checkout `redirectUrl` wasn't origin-validated**: now reuses the same same-origin/allowed-origin check as plan checkout.
- **Fixed — `PATCH /ad-campaigns/:id` could leave a campaign in an inconsistent state**: partial updates are now re-validated against the merged (existing + patch) record for date ordering and pricing-model/rate consistency.
- **Fixed — `isPlatformAdmin` wasn't returned by any auth endpoint**: added to all login/register/OTP/social-auth response payloads so the web admin UI's client-side gating actually works (server-side `requirePlatformAdmin` was always correctly enforced regardless).
- **Fixed — ad-campaign country-targeting fail-open on unknown org country**: an org with no country now never matches a *targeted* campaign (previously it would incorrectly still match).
- **Deferred (documented, not a silent gap)**: full anti-click-fraud (per-session/per-serve dedup + rate limiting) is not implemented — the eligibility re-check meaningfully narrows abuse to "an authenticated user can repeatedly click/view a currently-eligible real campaign," not "any campaign at all." A broader systemic billing gap was also found and flagged to the user rather than fixed here (pre-existing, not introduced by this phase): `runDailyBillingCron` extends `active` non-free subscriptions into their next billing period even if the prior invoice was never paid — this affects the whole billing system, not just ads/add-ons, and needs a dedicated fix + test pass of its own.
- **Dependency audit**: `pnpm audit` flagged high/critical advisories on `next`, `fastify`, `nodemailer`, `postcss`, `@fastify/static`, `find-my-way`, and dev-only `vitest` — none newly introduced by this phase (all pre-existing pinned versions); flagged to the user as a separate dependency-upgrade task, not fixed here to avoid an unplanned, unrelated version bump in this change.

**Deferred / not yet built (flagged, not silently dropped):**
- Google Funding Choices (web) / UMP SDK (mobile) consent integration — deferred until an actual AdSense/AdMob account exists (§7 rollout step 6); house ads carry no third-party tracking so this isn't a launch blocker for house-ads-only operation.
- `google_mobile_ads` package and native Android/iOS project wiring — not added yet (no AdMob account, and native project file changes need a real device/emulator build to verify). The mobile `AdSlot` widget already renders an inert "Advertisement" placeholder for the `network` source so the integration point exists.
- Mobile placements for `document_search` and `flock_detail` pages (only `dashboard` and `projections` wired on mobile so far) — same `AdService`/`AdSlot` can be dropped into those screens directly when prioritized.
- Metered CPM/CPC invoicing/reconciliation loop for advertisers (spend tracking and auto-pause at budget cap are implemented; a periodic "invoice the advertiser for last period's spend" job is not — flat-fee campaigns need no such job, so this only affects cpm/cpc campaigns).
- Country-based ad-serving is tested at the "0 or 1 target country" level; multi-country campaigns work via the array field but haven't been exercised beyond the single-country test case.
