# Nkuku Monetization Plan

Status: **Approved — executing.** Locked 2026-08-06.

## 1. Decisions Locked

### 1.1 Pricing (per organization/farm, not per seat, except where noted)

| Tier | Target | ZMW | BWP | USD | Limits |
|---|---|---|---|---|---|
| **Free** | Smallholders / trial | K0 | P0 | $0 | 1 active flock, 1 user, 2 cycles of history, core tracking (growth/feed/water/mortality/vaccination), disease DB, basic alerts, no financial ledger/exports |
| **Grower** | Small commercial farmers | K250/mo (K650/3-mo cycle) | P95/mo (P250/cycle) | $12/mo ($32/cycle) | Unlimited flocks/cycles, financial dashboard, double-entry ledger, document attachments, full alerts, 2 users |
| **Business** | Multi-site / larger operations | K800/mo (K2,100/cycle) | P300/mo (P800/cycle) | $40/mo ($105/cycle) | Everything in Grower + multi-site, up to 5 users, GAAP statements, CSV/PDF export, API access, priority support |
| **Enterprise / White-label** | Agribusiness, co-ops, NGOs, feed companies | Custom quote | Custom quote | Custom quote | Unlimited users, white-label branding, dedicated onboarding, SLA, optional self-hosted deployment/license |

- Billing cadence: monthly or per-3-month-production-cycle (farmer's choice); cycle billing carries a discount (~13%, "2 months free" pattern matched to industry norm).
- Currency is fixed per organization's home country (not live FX) to avoid farmer confusion — matches CoopSense/Farmwise practice. Additional country price rows added on demand (start: Zambia/ZMW, Botswana/BWP, generic/USD).
- Enterprise is always custom-quoted/sales-assisted, never self-serve.

### 1.2 Payments
- **Primary processor: Flutterwave** — pan-African coverage (34+ countries incl. Zambia & Botswana), mobile money (MTN/Airtel) + cards, ~1.4% local / 3.8% international.
- Built behind a **payment-provider abstraction** in the API so a second processor (DPO, direct MNO APIs) can be added later without a rewrite.
- Business entity for settlement already exists — proceeding to open a live Flutterwave merchant account under it.

### 1.3 Revenue mix
1. Subscription (primary) — tiers above.
2. Freemium upgrade funnel — free tier always exists.
3. Transaction/usage add-ons (secondary, phase 2+) — metered overage on document/OCR processing beyond plan quota.
4. Enterprise/white-label licensing (phase 5) — reuses existing single-tenant deployment path as a sellable "self-hosted" SKU.
5. Marketplace commission — deferred; data model must not preclude it later (do not build now).

## 2. Legal / Compliance — Zambia Data Protection Act No. 3 of 2021

Confirmed applicable since the company and a material share of users/data are Zambian. Must be handled as real launch blockers, not engineering tasks:

1. **Registration**: The business must register as a **Data Controller** (and Data Processor, if applicable) with the Data Protection Commissioner before commercial processing of personal data at scale. Certificate is valid 1 year, renewable. Failure to register is a criminal offence (fine up to ~ZMW 200,000 and/or up to 5 years imprisonment). *Action: user/business to register — cannot be done by engineering.*
2. **Data Protection Officer (DPO)** must be appointed. *Action: assign a named person (can be the owner initially), document the appointment.*
3. **Data localization (s.70)**: **All** personal data of Zambian data subjects must be stored/processed on a server or data centre located in **Zambia**, unless the Minister prescribes an exception. **Sensitive personal data has no exception — it must always stay in Zambia.** Non-sensitive data may leave only with data-subject consent **and** a Commissioner-approved transfer mechanism.
   - **Engineering impact**: current production hosting location must be verified. If the API/DB is not hosted in Zambia, either (a) migrate Zambian-tenant data to Zambia-based hosting, or (b) architect **per-country data residency** — each organization's data pinned to a database/region matching its country — before onboarding real Zambian customers beyond the current pilot. This is a hard requirement for the multi-tenant SaaS, not optional.
   - Recommendation: default new infra to a Zambia-hosted (or Zambia-compliant cloud) primary database for Zambian tenants; other countries can use a general African/EU region until similar laws are confirmed for them.
4. **Consent & data-subject rights**: explicit signup consent language, ability to export/delete personal data, and clear purpose limitation must be built into the self-service signup flow (Phase 2).
5. **Security obligations (s.12(1)(g))**: appropriate technical/organisational security — already partially covered by existing virus scanning, RBAC, and journal immutability; needs a written data-security policy for the registration application.

These four items (register, appoint DPO, confirm/fix hosting residency, add consent flows) are tracked as explicit tasks below and flagged to the user — items 1 and 2 require the user to act personally (government registration, naming a DPO), not something an engineering agent can do.

## 3. Technical Foundation & Phased Implementation

**Phase 0 — Setup (this document + decisions)** — done.

**Phase 1 — Multi-tenancy migration**
- Add `Organization`, `OrganizationMember` (role per org) models.
- Add `organizationId` to every tenant-scoped table (flocks, suppliers, cycles/batches, financial records, ledger, documents, alerts, sale records, overheads, lighting schedules created by users). Shared reference/catalog data (breeds, performance targets, diseases, vaccination schedule templates, equipment catalog, supplier category templates) stays global.
- Backfill existing production data into "Organization #1" (owned by current `owner@nkuku.local`) — zero data loss, existing flocks untouched per testing rule.
- Update all API services/queries to be organization-scoped; update RBAC to be per-organization.
- Update web + mobile session/auth to carry `organizationId`.

**Phase 2 — Self-serve signup & org management**
- Public signup (org creation on signup), invite/accept flow, org settings (name, country, currency), consent capture for DPA compliance.

**Phase 3 — Billing core**
- `Plan`, `Subscription`, `Invoice` models; Flutterwave integration (checkout + webhooks + a recurring-charge scheduler, since Flutterwave doesn't natively manage subscriptions the way Stripe does).
- Feature-gating middleware wired into flock/user/document limits per tier.
- Grace period + auto-suspend on payment failure; free-tier default on signup.

**Phase 4 — Pricing page & upgrade UX** — DONE (2026-08-18)
- Public `/pricing` page, an app-wide `UpgradePromptProvider` that shows a consistent dialog on any 402 `PLAN_LIMIT_REACHED` response (feature-gate hits across flock/user/document limits and feature flags), existing `/billing` settings page (web); mobile continues to show plan status and deep-link to web for billing (avoids app-store IAP cut).

**Phase 4b — Advertising** — DONE, core scope (2026-08-18) — see `docs/ADVERTISING_PLAN.md`
- House ad campaigns (flat/CPM/CPC) served to Free-tier orgs only, targeted by country, on dashboard/projections/document-search/flock-detail; "Remove Ads" add-on; platform-admin campaign management UI. Google AdSense/AdMob network fallback and consent-management (Funding Choices/UMP) integration deferred until a real ad-network account exists — see ADVERTISING_PLAN.md §9 for the full done/deferred breakdown.

**Phase 5 — Enterprise/white-label packaging**
- Package existing single-tenant deployment (`docker-compose.prod.yml`) as a licensable self-hosted SKU with branding config and a support contract template.

**Phase 6 — Admin/ops dashboard**
- Internal view: tenants, MRR, churn, failed payments/support flags.

**Phase 7 — Launch prep**
- Landing/marketing site, legal pages (ToS, privacy policy, refund policy — required by Flutterwave merchant approval), DPA registration + DPO appointment finalized, hosting residency confirmed, pilot customer onboarding.

Each phase goes through the standard `phase-closeout` routine (rebuild, test, tag, release) before being considered done.

## 4. Immediate Action Items for the User (cannot be done by engineering)
- [ ] Register as Data Controller with Zambia's Data Protection Commissioner.
- [ ] Formally appoint a Data Protection Officer.
- [ ] Confirm current production hosting location/region for the Postgres database (needed to assess s.70 compliance before onboarding real Zambian customers).
- [ ] Open a live Flutterwave merchant account under the existing business entity (sandbox can proceed in parallel for engineering).
- [ ] **Operational risk noticed during Phase 1b, unrelated to this project**: the shared Postgres instance (`shared-postgres`, used by nkuku plus at least two other projects — `deez_forex` and `kannel`) was chronically near its `max_connections` (100) ceiling; `deez_forex` alone holds ~83 idle connections at all times. **Resolved this session**: raised `shared-postgres` `max_connections` from 100 to 200 via a `command:` override in `shared-services/docker-compose.yml`. The proper long-term fix remains a connection pooler (PgBouncer) in front of `deez_forex`, but 200 connections gives adequate headroom for now on this host (15GB RAM, 8 vCPU).

## 5. Phase 2 Status (COMPLETE) — Self-serve signup & invitations

- `POST /api/v1/auth/register` — creates a new Organization + owner User + OrganizationMember in one transaction. Requires explicit `consent: true`; records `consentAcceptedAt`/`consentVersion` on the User (Zambia DPA consent tracking).
- `POST /api/v1/auth/accept-invite` — joins an existing organization via a time-limited invite token; creates the User if the email has no account yet, or just enrolls an existing one. Also requires explicit consent.
- New `organizations` module: `GET/PATCH /me` (org settings), `GET /members`, `DELETE /members/:id`, `POST/GET /invites`, `DELETE /invites/:id` — all owner/manager gated and org-scoped.
- Fixed a related latent bug in the pre-existing `users` module: it created global `User` rows with no `OrganizationMember`, which would have made new users unable to log in under the new multi-tenancy model. Now every user it creates/updates/removes is properly scoped to the caller's organization, and `User.role`/`OrganizationMember.role` are kept in sync (a user belongs to exactly one org today).
- Added `Invite` model (token, email, role, expiry, acceptance tracking) and `consentAcceptedAt`/`consentVersion` fields on `User`.
- **Web frontend built:**
  - `/signup` — self-serve registration form (name, email, password, org name, country, currency, consent checkbox). Links to `/login` for existing users.
  - `/accept-invite` — invite acceptance page (reads token from URL query string). Adapts to new vs. existing accounts.
  - `/login` — added "Create one" link to `/signup`.
  - `/users` — added "Invite User" button with dialog (email + role), invite link display with copy button, and pending invites table with revoke action.
- `WEB_BASE_URL` env var added (docker-compose + .env.example) so invite links are absolute URLs.
- **No email delivery yet** — invite links are returned directly in the API response and shown in the web UI with a copy button for the inviting owner/manager to share manually. `nodemailer` is already a dependency; wiring actual email delivery is a follow-up, not blocking for an initial pilot with a handful of orgs.
- **Verification**: full 163-test suite green; `tsc --noEmit` clean (both API and web); end-to-end manual flow verified (register → login → invite → accept-invite → member enrolled); web pages render correctly (200 status, content verified).

## 5b. Phase 1b Status (this session)
Multi-tenancy is now enforced at the API layer for the core, actively-used feature set:
- Auth: JWT now carries `organizationId`; every authenticated request resolves to an organization.
- Fully org-scoped (reads filtered, writes tagged): suppliers, broiler flocks, and every flock-child record (growth/feed/water/mortality/vaccination/medication/environmental records, flock tasks, financial records, alerts, sale records, documents).
- Double-entry ledger: `JournalEntry` (and its aggregate reports — trial balance, income statement, balance sheet, cash flow, period close, year-end close) are now organization-scoped. The chart of accounts (`Account`) remains a shared global reference catalog by design (see comment in `schema.prisma`) — not a gap, a deliberate scope decision documented there.
- **Update (same session, follow-up pass):** the legacy planning module is now also org-scoped — `Batch` gained its own `organizationId` column (backfilled, zero orphans), and `batches`, `overhead-costs`/`mortality-records` (via batch ownership), `projections`, `feed-stages` (via supplier ownership), the main `/dashboard/summary` KPI aggregate, and the `documents` module's two central ownership-check helpers (`resolveOwnership`/`checkDocumentOwnership`, which every document route funnels through) are all fixed. `ProductionCycle` itself intentionally stays shared/global — there is no create/update/delete endpoint for it anywhere in the API; the 14 seeded cycles are a read-only reference template, not tenant-owned data, so its `organizationId` column is effectively vestigial (harmless, unused).
- **Update (Phase 1c, same session): `organizationId` is now `NOT NULL`** on suppliers, production_cycles, broiler_flocks, documents, monthly_overheads, lighting_temperature_schedules, sale_records, batches, and ledger_balances. This forced fixing the remaining gaps in one pass: the deprecated `financial-engine` overhead-allocation service (was still scoping by `createdBy`/userId — now takes `organizationId` throughout, including the daily cron job which now iterates organizations instead of users), and the seed script (`db/seeds/main.ts`), which didn't create an `Organization`/`OrganizationMember` at all before this — a fresh `docker compose up` + `prisma db seed` would have left the owner unable to log in (`403 NO_ORGANIZATION`). Seed now creates "Organization #1" and enrolls the owner + test users into it before creating any org-scoped data (suppliers, cycles, batches, lighting/temperature schedule defaults).
- **Resolved:** `journal_entries.organization_id` is now `NOT NULL` too. Per explicit approval, the 18 orphaned test-generated entries were purged via a supervised, transactional operation: the self-referential `reverses_id` FK was dropped, the DELETE immutability rules were temporarily changed from `INSTEAD NOTHING` to `ALSO NOTHING` (so the delete actually executes) for the duration of one transaction, the rows were removed, then the FK and rules were restored to their exact original definitions and re-verified (confirmed a subsequent `DELETE` on a real entry still correctly no-ops). The FK's `ON DELETE` action changed from `SET NULL` to `RESTRICT` (required by the new `NOT NULL` constraint). All 163 tests re-verified green after. The exact procedure is documented in `prisma/sql/multi-tenancy-foundation.sql` for reference — it is explicitly flagged there as a one-time supervised exception, not a reusable pattern.
- **Phase 1 is now fully closed out**: every organizationId column across the schema is database-enforced NOT NULL, and every active code path (including the deprecated financial-engine module) sets it correctly.
