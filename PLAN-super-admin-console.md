# Plan — Super Admin & Platform Console

Status: **APPROVED 2026-11-09** — all open points resolved below. Companion to `PLAN-production-readiness-and-parity.md`
(fulfils Monetization Plan Phase 6 "Admin/ops dashboard" and extends it).

## 0. Decisions already taken (interactive session, 2026-11-09)

| Topic | Decision |
|---|---|
| Test pollution in prod | Supervised purge **and** isolate the test suite onto its own DB |
| Staff model | Role set: `super_admin`, `support`, `finance`, `content_editor`, `marketing`, `auditor` |
| Impersonation | Full act-as, guarded (no password/MFA/billing/deletes), reason required, 30-min token, banner, dual audit |
| Admin hardening | TOTP 2FA mandatory for staff · named admin accounts (retire `owner@nkuku.local` as platform admin) · re-auth for dangerous actions · IP allowlist on `/api/v1/platform/*` |
| Tenant actions | Plan override/comp · suspend/reactivate · account support ops · GDPR org delete |
| Content mgmt | Reference catalogue · plans & pricing · announcements · feature flags |
| Ops & support | System health panel · support inbox · growth analytics · email/SMS log |
| Surfaces | **Separate** admin web app (`admin.nkuku.zeendeefood.solutions`) **and** separate admin Flutter app, internal distribution only (Play internal track + sideload), full parity with web (phased) |
| Order | Prerequisites → tenant ops → support/health → content/plans/flags → analytics → mobile admin app (trails each web phase) |

## 1. Findings that shape the plan

1. **A read-only platform console already exists** behind `User.isPlatformAdmin`:
   `apps/api/src/modules/admin-ops/routes.ts` (`/api/v1/admin/{metrics,organizations,organizations/:id,failed-payments,audit-logs,license,branding}`),
   `apps/api/src/modules/ad-campaigns`, and web pages under `apps/web/src/app/(app)/admin/**`.
   These become the seed of the new console; the tenant web app loses its `/admin` routes once the
   separate console is live.
2. **Production DB is polluted by integration tests.** Tests run inside the API container against the
   live DB (`API_URL = http://localhost:3001`, no test DB). Measured 2026-11-09: ~785 test orgs,
   ~720 `@example.com` users, **74 test users with `isPlatformAdmin = true`**, 5 `sales-test-manager-*`
   members inside the real farm org, ~580 fixture subscriptions. Real tenants: `Nkuku Companion Farm
   (Org #1)` and `Nkuku Demo Farm`. Every platform metric is currently fiction and the 74 dormant
   super-admins are a live security exposure.
3. **Platform admin identity is the seeded `owner@nkuku.local`**, no MFA. No TOTP library in the API.
4. Reference data (breeds, performance targets, vaccination schedules, diseases, feed-stage catalog),
   plans (`core/billing/plans.ts`) and feature availability are **code/seed-only** — changing any of
   them is a redeploy.
5. Existing `AuditLog` is tenant-scoped (`organizationId NOT NULL`, `AuditAction` = create/update/
   delete/period_close). It cannot represent platform-level actions (no actor type, no reason, no
   impersonation link, no cross-tenant rows). A separate append-only `platform_audit_events` table is
   needed; tenant-visible echoes of impersonated actions still go into `AuditLog`.
6. Cron already exists (`node-cron` in `main.ts`: 01:00 billing, 01:30 dunning, 02:00 cleanup) and
   Sentry is wired — the health panel can read last-run markers and error rate rather than inventing a
   scheduler.

## 2. Goals / non-goals

**Goals**
- One internal console (web + mobile) to run the business: tenants, billing, support, content, health.
- Least privilege via staff roles; every admin mutation attributable, reasoned, and reversible where possible.
- Zero contamination between staff identity and tenant RBAC; zero admin surface in the public tenant apps.
- Prod data believable: real metrics, no fixture tenants.

**Non-goals (this plan)**
- Public-facing status page, SSO/SAML for staff, data warehouse/BI export, multi-region.
- Native in-app purchases (unchanged — web billing deep-link stays).

## 3. Staff roles & permission matrix (the "other users" recommendation)

Permissions are explicit strings checked by `requirePermission('…')`; roles are bundles. A staff member
has exactly one role (plus `super_admin` may hold the `break_glass` capability). Staff accounts are
**separate `StaffUser` rows**, not tenant `User`s — a staff member who also farms uses a normal tenant
account for that.

| Permission | super_admin | support | finance | content_editor | marketing | auditor |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| `platform.dashboard.read` (KPIs, health) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `tenants.read` (list/detail/members/usage) | ✓ | ✓ | ✓ | – | – | ✓ |
| `tenants.impersonate` | ✓ | ✓ | – | – | – | – |
| `tenants.support_ops` (reset owner pw, force logout, resend verification, change owner) | ✓ | ✓ | – | – | – | – |
| `tenants.suspend` / `tenants.reactivate` | ✓ | – | ✓ | – | – | – |
| `tenants.delete` (GDPR, 2-step) | ✓ | – | – | – | – | – |
| `billing.read` (subs, invoices, dunning, MRR/churn) | ✓ | ✓ | ✓ | – | – | ✓ |
| `billing.override` (plan comp, trial extend, limit override, credit) | ✓ | – | ✓ | – | – | – |
| `billing.plans.write` (edit plan prices/limits/features) | ✓ | – | ✓ | – | – | – |
| `support.tickets.read/write` (inbox, assign, reply, close) | ✓ | ✓ | – | – | – | read |
| `comms.log.read` / `comms.resend` | ✓ | ✓ | ✓ | – | ✓ | read |
| `catalogue.write` (breeds, targets, vaccination templates, diseases, feed stages) | ✓ | – | – | ✓ | – | – |
| `announcements.write` | ✓ | – | – | – | ✓ | – |
| `ads.write` (existing campaigns module) | ✓ | – | – | – | ✓ | – |
| `flags.write` (global/per-org feature flags) | ✓ | – | – | – | – | – |
| `analytics.read` (growth, cohorts, conversion) | ✓ | – | ✓ | – | ✓ | ✓ |
| `audit.read` (platform audit events) | ✓ | – | – | – | – | ✓ |
| `staff.manage` (invite/role/disable staff, reset their TOTP) | ✓ | – | – | – | – | – |
| `system.ops` (re-run cron, purge caches, backup status, maintenance mode) | ✓ | – | – | – | – | – |

Intended humans: **super_admin** = you (+ one backup); **support** = whoever answers farmers;
**finance** = bookkeeper/accountant (bank reconciliation of subscriptions, comps, refunds);
**content_editor** = agronomist/vet who owns schedules and breed data; **marketing** = ads,
announcements, growth numbers; **auditor** = read-only for an accountant/investor/compliance review.

Hard rules:
- `super_admin` cannot remove the last `super_admin`; disabling your own account is refused.
- TOTP reset for a staff member requires **another** `super_admin` (break-glass, audited).
- Dangerous permissions (`tenants.*` writes, `billing.override`, `billing.plans.write`, `flags.write`,
  `staff.manage`, `system.ops`, `tenants.impersonate`) require a fresh re-auth (password or TOTP) within
  the last 5 minutes — enforced server-side via a `reauthAt` claim.

## 4. Architecture

```
apps/
  api/            + modules/platform/**   (new; /api/v1/platform/* — staff-only)
                  + core/staff-auth/**    (StaffUser, TOTP, sessions, permissions, re-auth)
                  + core/platform-audit/** (append-only events)
                  (/api/v1/admin/* kept for one release as aliases, then removed)
  web/            - app/(app)/admin/**    (removed once console live)
                  + impersonation banner + "acting as" handling
  admin-web/      NEW Next.js app — admin.nkuku.zeendeefood.solutions (own cookie domain, own CSP)
  admin-mobile/   NEW Flutter app — com.deeztechnologysolutions.nkukuadmin, own keystore,
                  Play internal track only, same API
  mobile/         + announcements banner, + maintenance-mode screen, + support "Contact us" form
packages/
  platform-types/ NEW shared TS types for platform API (admin-web + web)
infra/            nginx vhost for admin host; IP allowlist at nginx AND Fastify layer
```

**Staff auth** is a separate JWT audience (`aud: "platform"`); tenant endpoints reject it and
platform endpoints reject tenant tokens. Staff login = email + password + TOTP (enrolment forced on
first login). Sessions in Redis with device + IP; `staff.manage` can revoke.

**Impersonation**: `POST /platform/tenants/:orgId/impersonate { targetUserId, reason, ticketId? }`
→ platform-audit event written *first*; mints a tenant JWT with extra claims
`{ impersonation: { staffId, sessionId, expiresAt } }`, TTL 30 min, non-refreshable. Tenant app
shows a persistent banner ("Acting as …, ends in …, reason …") with an End button. Tenant `authenticate`
blocks routes tagged `denyImpersonation` (password/MFA/email change, billing checkout/cancel, org
delete, member delete, journal reversal, starting another impersonation). Every tenant mutation
during the session writes `AuditLog` with `newState.__impersonatedBy = staffId` so the tenant can
see support activity in their own log.

**Platform audit** (`platform_audit_events`, append-only via the same `CREATE RULE` approach used
for journals): `actorStaffId, actorRole, action, targetType, targetId, organizationId?, reason?,
before, after, ip, userAgent, requestId, impersonationSessionId?, occurredAt`. Retained indefinitely.

**IP allowlist**: `PLATFORM_ALLOWED_CIDRS` env (comma list). Enforced in nginx for the admin host and
again in a Fastify `onRequest` hook for `/api/v1/platform/*` (defence in depth; mobile admin app users
connect via the farm office static IP or a VPN — documented).

## 5. Data model additions (Prisma)

- `StaffUser { id, email, name, passwordHash, role StaffRole, totpSecretEnc, totpEnabledAt,
  isActive, lastLoginAt, createdBy, … }`, `StaffSession`, `StaffRecoveryCode`.
- `PlatformAuditEvent` (above).
- `ImpersonationSession { id, staffId, organizationId, targetUserId, reason, ticketId?, startedAt,
  endedAt, expiresAt, ip }`.
- `TenantOverride { organizationId, planCode?, limitsJson?, compUntil?, reason, createdBy, expiresAt }`
  — `getEffectivePlanCode()` consults this first.
- `Organization.suspendedAt, suspendedReason, suspendedMessage`.
- `Plan` + `PlanVersion` tables replacing `plans.ts` constants (price, limits, features, effectiveFrom;
  existing subs pin to a version) — `plans.ts` becomes a cached loader.
- `Announcement { title, body, level, audience(all|plan|orgIds|country), startsAt, endsAt, surfaces(web|mobile) }`
  + `AnnouncementDismissal`.
- `FeatureFlag { key, description, defaultOn }` + `FeatureFlagOverride { key, organizationId, on }`.
- `SupportTicket { organizationId, userId, subject, body, status, priority, assignedStaffId, channel }`
  + `SupportMessage` (+ attachments reuse `Document`).
- `CommsLog { channel(email|sms|push), to, template, status, providerId, error, organizationId?, sentAt }`
  — written by `email.service.ts`, the Kannel SMS path and FCM.
- Reference catalogue tables gain `updatedBy/updatedAt/version` and lose nothing (already exist);
  seeds become **upsert-if-absent** so admin edits survive redeploys.
- `CronRun { job, startedAt, finishedAt, status, summary }` for the health panel.

## 6. Phases

Each phase ends with the standard closeout (build, tests, tag, release notes). Mobile-admin parity for
a phase ships in the **following** phase so web is the proving ground.

### P0 — Prod hygiene & test isolation (prerequisite, no new features)
- Dry-run report → backup → supervised transactional purge of: orgs with only `@example.com`/`*.local`-test
  members and the known test-name patterns (`Reuse/Verify/OTP Test Farm`, `Audit Test Org *`,
  `Lifecycle Farm *`, `Test Financial Org`), their users, subs, invoices, flocks, journals (journal
  immutability rules temporarily relaxed inside the one transaction, as documented in
  `multi-tenancy-foundation.sql`); remove the 5 test managers from the real org; clear
  `isPlatformAdmin` on all `@example.com` users. Report counts before/after; AR/TB re-verified for the
  real org (should be untouched: 13,830 / balanced).
- Test isolation: `docker-compose.test.yml` with its own Postgres (`nkuku_test`) + Redis; API test
  target reads `DATABASE_URL_TEST`; vitest globalSetup runs `prisma migrate deploy` + minimal seed on the
  test DB and the API under test binds to port 3002; CI already uses a service DB — align it.
  Guard: API refuses to start test suites when `DATABASE_URL` host is the prod container.
- Fix the fixture leaks found today (unique names, cleanup in `afterAll`).

### P1 — Staff identity & security foundation
- `StaffUser`/sessions/TOTP (`otplib`), recovery codes, forced enrolment, re-auth claim, permission
  middleware, IP allowlist hook, `PlatformAuditEvent` + append-only rule, staff-management endpoints.
- Seed your named `super_admin` from env (`PLATFORM_SUPER_ADMIN_EMAIL`), one-time bootstrap token;
  set `owner@nkuku.local.isPlatformAdmin = false`; `isPlatformAdmin` column deprecated (kept one release
  for the alias routes).
- Tests: permission matrix table-driven, TOTP flow, re-auth expiry, allowlist, last-super-admin guard.

### P2 — Admin web console shell + tenant ops (web)
- `apps/admin-web` (Next.js, shadcn, same design tokens, dark-mode): login (pw + TOTP), shell nav by
  permission, dashboard (ported + real numbers), tenants list (search/filter/sort/paginate — same
  server-side pattern as sales), tenant detail (members, usage vs limits, subs, invoices, flocks summary,
  audit tail, support tickets), **actions**: plan override/comp (reason + expiry), suspend/reactivate
  (message shown to tenant users), support ops (reset owner pw → emails link; force logout; resend
  verification; change owner), GDPR delete (export ZIP first, typed-name confirm, re-auth).
- **Impersonation** end-to-end incl. tenant web banner + `denyImpersonation` route tags + dual audit.
- Tenant apps: suspended-org screen (web + mobile), impersonation banner (web; mobile not needed —
  impersonation opens tenant web).
- Remove `/admin` from `apps/web` (keep redirect to admin host for one release).

### P3 — Support inbox, comms log, system health (web)
- Tickets: in-app "Contact support" on tenant web + mobile (subject/body/attachment, auto-captures
  org/user/app version/device); console inbox with filters, assignment, canned replies, email
  notification both ways, "impersonate from ticket" (pre-fills reason).
- `CommsLog` writers + viewer + resend.
- Health panel: `/platform/health` aggregating `/health` deps, Redis/MinIO/ClamAV pings, `CronRun`
  last-run/age, Sentry error-rate (API), DB size, last backup age (reads the backup marker file),
  disk free; red/amber/green; `system.ops` buttons: re-run billing/dunning cron now, toggle maintenance
  mode (tenant apps show a notice; writes 503 except staff).
- Push alerts to staff (FCM topic `platform-ops`) for: cron failure, health red, payment webhook
  failures, new P1 ticket — consumed by the admin mobile app in P6.

### P4 — Content & configuration (web)
- Reference catalogue editors (breeds + performance targets grid import/export CSV, vaccination
  schedule templates with the Day-1 display convention, diseases, feed-stage catalog) with versioning
  and "affects N active flocks" warnings before publish.
- Plans & pricing: `Plan/PlanVersion` UI, preview of who's affected, effective-date scheduling;
  `plans.ts` loader + cache invalidation.
- Announcements: composer, targeting, schedule, preview; tenant web + mobile banner with dismissal.
- Feature flags: list, global default, per-org override, kill-switch; `hasFeature()` consults flags
  after plan check; mobile/web fetch `/me/flags` at login and on resume.

### P5 — Growth & finance analytics (web)
- Materialised daily rollups (`platform_daily_stats`) via 00:30 cron: signups, activations (first
  flock), WAU/MAU, MRR by plan, new/expansion/churned MRR, failed-payment recovery rate, country split,
  plan conversion funnel, retention cohorts (signup-month × months active). Charts (recharts, as today),
  CSV export. Demo org and staff excluded everywhere.

### P6 — Admin mobile app (Flutter) — parity waves
- `apps/admin-mobile`: own package/keystore, biometric unlock + TOTP, IP-allowlist aware error UX.
- Wave 1 (= P2+P3 parity): dashboard, health, alerts (push), tenants list/detail + actions with re-auth,
  support inbox, comms log, impersonate (deep-links to tenant web with the impersonation token).
- Wave 2 (= P4+P5 parity): catalogue editing (mobile-friendly forms; CSV import stays web-only and is
  labelled so), plans, announcements, flags, analytics.
- Distribution: Play **internal testing** track + signed APK in `nkuku-releases/`; documented
  staff-onboarding runbook (install, enrol TOTP, allowlist IP/VPN).

### P7 — Hardening & docs
- Pen-test checklist against the console (OWASP ASVS L2 items for auth/session/access control),
  rate limits on staff login/TOTP, alerting on repeated denied `/platform` calls, quarterly
  staff-access review export, `docs/PLATFORM_CONSOLE.md` (roles, runbooks, break-glass), update
  `ADMIN_GUIDE.md`, `AGENTS.md`.

## 7. Security controls checklist

Staff ≠ tenant identities · TOTP mandatory · recovery codes · re-auth ≤5 min for dangerous actions ·
IP allowlist (nginx + app) · separate JWT audience · short impersonation TTL, non-refreshable, banner,
reason, dual audit, denylisted routes · append-only platform audit with before/after · no secrets/PII
dumps in audit payloads · last-super-admin guard · two-person TOTP reset · GDPR delete requires export +
typed confirmation · all staff endpoints rate-limited · CSP/HSTS on admin host · security headers tests.

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Purge deletes something real | Dry-run report reviewed by you; backup; transactional; explicit allowlist of the two real orgs; AR/TB re-verified after |
| Plans moving from code → DB breaks billing | `PlanVersion` pinning; loader falls back to code constants if table empty; integration tests on checkout/renew paths |
| Impersonation misuse | Reason + ticket link, TTL, denylist, dual audit, tenant-visible log; weekly impersonation digest to super_admins |
| Allowlist locks you out while travelling | Break-glass: VPN endpoint documented; `PLATFORM_ALLOWLIST_BYPASS_TOTP=true` lets a super_admin with TOTP pass from any IP for 1 h (audited) — **confirm you want this escape hatch** |
| Two more apps to maintain | Shared `platform-types` package; admin-web reuses tenant web UI kit; mobile parity trails web by one phase |

## 9. Resolutions (approved 2026-11-09)

1. Role matrix approved as written — `tenants.suspend` stays with finance, not support.
2. Allowlist escape hatch **approved**: super_admin + TOTP may bypass the IP allowlist for 1 h (audited).
3. Named super_admin to seed: **admin@zeendeefood.solutions**.
4. Impersonation denylist **kept as designed** (assumption — §5 was left open in the approval):
   password/MFA/email changes, billing checkout & cancellation, org delete, member delete,
   journal reversal, nested impersonation. Extendable via `denyImpersonation` route tags.
5. P0 purge approved with the dry-run → explicit "apply" → backup gate intact.
