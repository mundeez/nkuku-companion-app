# PLAN — Next Steps: Store Launch, Payments, Residency & Feature Work

**Date:** 2026-11-17
**Baseline:** `main` @ `00fd4be` (v1.56.0) — production-readiness plan and
super-admin console plan both fully executed.
**Status:** DRAFT — awaiting approval before execution.

---

## 0. Context

Everything in `PLAN-production-readiness-and-parity.md` (P-1…P-6, M-1…M-5,
C-1/C-2) and `PLAN-super-admin-console.md` (P1–P7) is shipped. v1.56.0 is
deployed and verified live. This plan covers the four remaining strategic
tracks. They are ordered by dependency and risk; Tracks A and B can run
in parallel, C is ops/legal, D is opportunistic.

---

## Track A — Tenant app store launch (Play + App Store)

**Goal:** public distribution of `apps/mobile` on Google Play and Apple
App Store. Deep-link billing model already shipped (M-4): no IAP, plan
status in-app, checkout on web. iOS build is strict store-compliant
(`--dart-define=STORE=ios`); Android may show a tappable upgrade link
(`STORE=android`).

### A-1 — Store assets & metadata (small, mostly non-code)
- App icons (adaptive icon foreground/background), feature graphic
  (1024×500), screenshots per device class, short/full descriptions.
- Privacy policy URL (required by both stores) — extend the P-5 legal
  pages with a store-grade privacy policy covering mobile data
  ( Drift local DB, push tokens, device IDs).
- Data-safety form answers (Play) / App Privacy answers (App Store):
  map exactly what the app collects (account email, flock data,
  diagnostics). Keep answers honest — no analytics SDK is present.
- Content rating questionnaire (both stores).

### A-2 — Release engineering (small)
- Version bump strategy: `version: X.Y.Z+build` in `apps/mobile/pubspec.yaml`;
  build numbers must increase monotonically per store.
- Play: signed AAB (`apps/mobile/android/release.keystore` exists),
  internal → closed → production tracks.
- iOS: requires a Mac/Xcode or CI macOS runner — **blocked on hardware**;
  evaluate Codemagic/GitHub Actions macOS vs. a local Mac session.
- Store listing deeplinks: `nkuku://` scheme already? verify; add
  Android App Links / iOS Universal Links for `/billing` deep-link
  handoff if not present.

### A-3 — Pre-launch hardening (small/medium)
- Force-update mechanism: min-supported-version check on app start
  (API `/health`-style endpoint or config flag) so a bad release can be
  remotely gated.
- Crash reporting: currently none — add Sentry Flutter or rely on
  Play vitals/App Store diagnostics; decide before launch.
- Run the M-4 store-policy audit once more against the final binary
  (no prices/links on iOS build).

**Exit criteria:** approved on both stores (or Play-only if iOS hardware
stays blocked, documented decision).

---

## Track B — Payment providers: Lenco primary + DPO Pay (medium)

**Goal:** implement the approved multi-provider decision from the
readiness plan §2 — Lenco as primary for ZMW mobile money, DPO Pay for
cards/Botswana, Flutterwave retained as fallback adapter. P-4 shipped the
provider abstraction; this track adds the concrete adapters.

### B-1 — Provider adapter interface audit (small)
- Review `apps/api/src/core/billing/` provider abstraction; confirm
  webhook verification, refund/void, subscription lifecycle mapping are
  provider-agnostic.

### B-2 — Lenco adapter (medium)
- API integration: payment initiation (mobile money prompt), webhook or
  polling verification, signature validation.
- ZMW pricing matrix wiring; plan-price → Lenco amount mapping.
- Sandbox → production credential flow; secrets via env only.

### B-3 — DPO Pay adapter (medium)
- Card + BWP coverage; checkout redirect/tokenization flow.
- Webhook IP allowlist + hash verification per DPO docs.

### B-4 — Cutover & safety (small/medium)
- Provider selection per currency/country (config, not code forks).
- Dual-run period: Flutterwave stays live until Lenco/DPO pass a
  real-money pilot transaction.
- Dunning cron already handles failed renewals — verify it works per
  provider failure semantics.

**Exit criteria:** pilot tenant pays via Lenco (ZMW) and DPO (card/BWP);
Flutterwave fallback verified; docs updated.

---

## Track C — Data-residency migration prep (small now, move later)

**Goal:** keep the "migrate later" decision cheap. Zambia DPA s.70 risk
is accepted for pilot; this track only removes blockers.

### C-1 — Tenant data export (medium)
- Full-tenant export endpoint/script: all org-scoped rows + MinIO
  documents + audit trail, in a documented, restorable format.
- Verify export → fresh-tenant import round-trip on the test stack.

### C-2 — Portability pack (small)
- `docker-compose` profile or documented env-override set so the whole
  stack (api/web/admin-web/postgres/redis/minio/ntfy/clamav) can run on
  a Zambian host unchanged.
- DNS/TLS runbook for the move (ISPConfig → new host or standalone
  nginx+certbot).

### C-3 — Decision checkpoint
- Trigger criteria for the actual move: e.g., first paying Zambian
  enterprise customer, or legal review outcome. Document the decision
  owner and review date in this file when approved.

---

## Track D — Feature work queue (opportunistic, pick per sprint)

Ordered by estimated value; each is independently shippable.

| # | Item | Size | Notes |
|---|------|------|-------|
| D-1 | Mobile impersonation deep-link parity | S | P6 left this web-only: admin-mobile can start impersonation but can't deep-link into tenant app. Needs a one-time handoff token + tenant-app route. |
| D-2 | Offline-sync hardening | M | `docs/plans/PLAN-offline-sync.md` exists — audit what's done vs. remaining (Drift + sync queue already shipped; conflict-resolution edge cases remain). |
| D-3 | Platform console: impersonation session UX on mobile | S | With D-1, surface active-impersonation banner/end-session in admin-mobile ops tab. |
| D-4 | Admin-web: access-review CSV download button | XS | Endpoint exists (v1.56.0); just a UI link on the audit page. |
| D-5 | Staff onboarding runbook automation | XS | Invite email already works; add a `docs/RUNBOOK-staff-onboarding.md` quick-card or wizard notes. Mostly done in PLATFORM_CONSOLE.md — polish only. |
| D-6 | Marketing-site analytics verification | XS | Umami self-hosted was approved (C-2); verify it's actually receiving events in prod. |

---

## 5. Cross-cutting rules (apply to every track)

- Every phase ends with the `phase-closeout` routine (validate →
  commit → tag → release).
- Store-affecting changes require the M-4 store-policy audit re-run.
- Payment changes require a real-money pilot before removing the
  Flutterwave fallback.
- No secrets in repo; provider credentials via env/secret store only.
- Test-stack rule stands: integration tests only against
  `docker-compose.test.yml`, never dev/prod data.

## 6. Suggested sequencing

1. **A-3 + A-1** (force-update, privacy policy, assets) — unblocks store submission.
2. **A-2** Play track first (no hardware blocker); iOS when Mac/CI exists.
3. **B-1 → B-2** Lenco adapter in parallel with store review waits.
4. **C-1** tenant export ahead of any residency decision.
5. **D-queue** fills gaps between reviews.

## 7. Open questions for approval

1. Track order OK, or payments before store launch?
2. iOS: is there access to a Mac / budget for Codemagic, or Play-only
   for now?
3. Lenco vs DPO order — Lenco first (ZMW primary market) assumed.
4. Who owns the residency move decision and review date?
5. Crash reporting: Sentry self-hosted (already run GlitchTip!) vs.
   Play/App-store-native diagnostics only?
