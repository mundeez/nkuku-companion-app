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

**Phase 4 — Pricing page & upgrade UX**
- Public pricing page, in-app upgrade prompts at free-tier limits, billing settings page (web); mobile shows plan status and deep-links to web for billing (avoids app-store IAP cut).

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
