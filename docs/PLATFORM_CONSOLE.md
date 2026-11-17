# Platform Console (Super Admin) — Operations & Security Guide

The platform console is the staff-only back-office for managing tenants,
billing, support, catalogue/content, feature flags, announcements, and
platform analytics. It is deliberately separate from the tenant app:

- **Staff identity** is a `StaffUser` row — never a tenant `User`. Staff
  JWTs carry audience `platform` and are signed with `PLATFORM_JWT_SECRET`
  (falls back to `${JWT_SECRET}-platform`). Tenant tokens are rejected on
  `/api/v1/platform/*` and vice versa.
- **Surfaces:**
  - Web console: `apps/admin-web` (Next.js) at
    `https://admin.nkuku.deeztechnology.solutions`
  - Mobile console: `apps/admin-mobile` (Flutter,
    `solutions.deeztechnology.nkuku_admin`) — internal distribution only
    (sideload / Play internal testing). No Play Store public release.
- **API:** everything lives under `/api/v1/platform/*` in
  `apps/api/src/modules/platform/`.

## 1. Roles & permissions (plan §3 matrix)

Permissions are enforced server-side by `requireStaff(...)` /
`requirePermission(...)` in `apps/api/src/core/staff-auth/permissions.ts`.
Client-side gating in admin-web/admin-mobile is UX only — the API is
authoritative.

| Permission | super_admin | support | finance | content_editor | marketing | auditor |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| platform.dashboard.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| tenants.read | ✓ | ✓ | ✓ | – | – | ✓ |
| tenants.impersonate | ✓ | ✓ | – | – | – | – |
| tenants.support_ops | ✓ | ✓ | – | – | – | – |
| tenants.suspend / reactivate | ✓ | – | ✓ | – | – | – |
| tenants.delete | ✓ | – | – | – | – | – |
| billing.read | ✓ | ✓ | ✓ | – | – | ✓ |
| billing.override | ✓ | – | ✓ | – | – | – |
| billing.plans.write | ✓ | – | ✓ | – | – | – |
| support.tickets.read/write | ✓ | ✓ | – | – | – | read |
| comms.log.read / comms.resend | ✓ | ✓ | ✓ | – | ✓ | read |
| catalogue.write | ✓ | – | – | ✓ | – | – |
| announcements.write | ✓ | – | – | – | ✓ | – |
| ads.write | ✓ | – | – | – | ✓ | – |
| flags.write | ✓ | – | – | – | – | – |
| analytics.read | ✓ | – | ✓ | – | ✓ | ✓ |
| audit.read | ✓ | – | – | – | – | ✓ |
| staff.manage | ✓ | – | – | – | – | – |
| system.ops | ✓ | – | – | – | – | – |

`super_admin` holds `*` (all present and future permissions). Each staff
member has exactly one role — there are no per-user permission grants.

### Re-authentication (dangerous actions)

Permissions in `REAUTH_REQUIRED_PERMISSIONS` additionally require a fresh
re-auth claim (`reauthAt` ≤ 5 minutes) on the access token:
impersonation, tenant suspend/reactivate/delete, support ops, billing
override, plans write, flags write, staff.manage, system.ops.

- Web: `withReauth()` wraps dangerous mutations (password or TOTP dialog).
- Mobile: `ensureReauth()` in `apps/admin-mobile/lib/reauth.dart`.
- API: `POST /api/v1/platform/auth/reauth` re-mints the token; a fresh
  login also counts as re-auth.

## 2. Authentication flow

1. `POST /auth/login` (email+password, `authRateLimit`) → ticket.
   - First login: `requiresTotpEnrollment` → enrol via
     `/auth/totp/enroll` + `/auth/totp/confirm` (QR + recovery codes shown
     once).
   - Enrolled: `/auth/totp/verify` with TOTP or a single-use recovery code.
2. Access token: 15 min JWT (`aud=platform`). Refresh token: 30-day
   rotating session (`POST /auth/refresh`, reuse = revoked family).
3. `POST /auth/bootstrap` consumes the one-time invite token to set the
   initial password, then continues to TOTP enrolment.

## 3. Environment variables

| Variable | Purpose |
|---|---|
| `PLATFORM_JWT_SECRET` | Staff JWT signing secret (fallback `${JWT_SECRET}-platform`) |
| `PLATFORM_ALLOWED_CIDRS` | Comma-separated IPv4 CIDRs/exact IPs allowed to call `/api/v1/platform/*`. Empty = allow all (dev only — set in prod) |
| `PLATFORM_ALLOWLIST_BYPASS_TOTP` | `true` lets a valid super_admin JWT bypass the IP allowlist; every bypass is audit-logged (`security.allowlist_bypass`). Keep `false` unless needed |
| `PLATFORM_DENIED_ALERT_THRESHOLD` | 403s per IP per 5 min that trigger an ntfy `platform-ops` alert (default 20; `0` disables) |
| `PLATFORM_SUPER_ADMIN_EMAIL` | Email used by the bootstrap seed for the first super_admin |
| `PLATFORM_CONSOLE_BASE_URL` | Base URL embedded in staff invite emails |
| `AUTH_RATE_LIMIT` | Per-IP auth-endpoint limit per minute (default 10; covers login/TOTP/reauth/bootstrap) |
| `NTFY_BASE_URL` / `NTFY_AUTH_TOKEN` | Staff alerting channel (`platform-ops` topic) |

## 4. Runbooks

### Invite a new staff member
1. Sign in to the admin console as `super_admin`.
2. Staff → Invite: email, name, role.
3. The invite email contains a one-time `/set-password?token=…` link
   (24 h). In dev/test (`EMAIL_DISABLED`) the link is returned as
   `devInviteUrl` in the API response.
4. Invitee sets a password → forced TOTP enrolment → stores recovery
   codes → lands on the console.

### Offboard a staff member
Staff → select member → **Disable**. This revokes all sessions
immediately; the account cannot log in. For stronger assurance also
rotate `PLATFORM_JWT_SECRET` if a token may be compromised (invalidates
ALL staff tokens — everyone re-logs in).

### Break-glass: reset a staff member's TOTP
Staff → **Reset TOTP**. Clears the TOTP secret + recovery codes and
revokes sessions; the target re-enrols on next login.
- Resetting a **super_admin** requires a *different* super_admin actor
  (two-person rule, enforced by `SECOND_ADMIN_REQUIRED`).
- Self-disable and disabling/demoting the last active super_admin are
  refused (`SELF_DISABLE`, `LAST_SUPER_ADMIN`).

### Quarterly staff-access review
1. As `auditor` or `super_admin`: `GET /api/v1/platform/staff/access-review.csv`
   (also reachable from the console where surfaced).
2. Review: role appropriateness, `isActive`, `totpEnrolled`,
   `lastLoginAt`, `activeSessions`, `unusedRecoveryCodes`.
3. The export itself writes a `staff.access_review_export` audit event.
4. Disable or downgrade anyone who no longer needs access.

### IP allowlist change
1. Update `PLATFORM_ALLOWED_CIDRS` in the environment.
2. Restart the API container. The allowlist is enforced by the
   `platformIpAllowlist` onRequest hook on every `/platform` route
   (nginx also restricts the admin host — keep both in sync).
3. If locked out entirely: the bypass requires `super_admin` + valid JWT
   + `PLATFORM_ALLOWLIST_BYPASS_TOTP=true`; prefer fixing CIDRs instead.

### Denied-call alerts
Every HTTP 403 on `/api/v1/platform/*` is counted per client IP in Redis
(5-minute window). At `PLATFORM_DENIED_ALERT_THRESHOLD` (default 20) a
priority-4 ntfy alert is published to `platform-ops`. Investigate the
source IP in the platform audit log; repeated 403s usually mean probing,
a stale client, or a role/permission mismatch.

### Secret rotation
- `PLATFORM_JWT_SECRET`: rotate → all staff sessions invalidated; staff
  re-authenticate (TOTP still enrolled).
- `JWT_SECRET`: rotating it also rotates the platform fallback secret —
  prefer setting `PLATFORM_JWT_SECRET` explicitly before rotating
  `JWT_SECRET`.

## 5. Audit trail

All sensitive platform actions append to `platform_audit_events`
(append-only): staff invite/disable/role/TOTP-reset, impersonation
start/end, tenant suspend/reactivate/delete, billing overrides, plan &
price changes, flag changes, support replies, allowlist bypasses, and
access-review exports. Query via `GET /api/v1/platform/audit-events`
(`audit.read`) in the console.

## 6. Pen-test checklist (OWASP ASVS L2 — console scope)

Auth & session:
- [ ] Staff password + mandatory TOTP; recovery codes single-use, hashed
- [ ] Access token 15 min / refresh 30 d rotating; reuse detection revokes family
- [ ] Audience separation: tenant JWT rejected on `/platform`, staff JWT rejected on tenant routes
- [ ] `authRateLimit` on login/TOTP/reauth/bootstrap (per-IP)
- [ ] Re-auth freshness (≤5 min) enforced server-side for dangerous permissions

Access control:
- [ ] IP allowlist on every `/platform` route (+ nginx admin host rule)
- [ ] Permission checks server-side on every route; client gating is cosmetic
- [ ] Last-super-admin and self-disable guards
- [ ] Two-person rule for super_admin TOTP reset

Data protection:
- [ ] TOTP secrets encrypted at rest (`totpSecretEnc`)
- [ ] Recovery codes stored as SHA-256 hashes, shown once
- [ ] Audit events append-only; no update/delete endpoints
- [ ] CSV exports audited

Monitoring:
- [ ] Denied-call (403) alerting to `platform-ops`
- [ ] Cron failure + payment webhook failure alerts via ntfy
- [ ] Quarterly access-review export exercised at least once

Known accepted risks:
- IP allowlist bypass for super_admin (audited escape hatch)
- ntfy alerts are best-effort (fire-and-forget; ntfy outage = silent)
- Admin-mobile is internal-distribution only; no MDM/attestation

## 7. Mobile console notes

- Package `solutions.deeztechnology.nkuku_admin`; API base URL is a
  compile-time constant in `lib/api.dart`.
- Release builds require `android/key.properties` + a release keystore
  (same pattern as the tenant app — see `apps/mobile/android/`).
- CSV import is web-only; analytics CSV is copied to clipboard instead.
- Impersonation start/deep-link handling is web-only for now.
