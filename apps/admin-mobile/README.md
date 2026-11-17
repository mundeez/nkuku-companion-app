# Nkuku Admin

Staff console companion app for the Nkuku platform (super admin /
support / finance / content_editor / marketing / auditor roles).
Internal distribution only — Play internal track + sideload.

## Features

- **Auth** — staff email+password → mandatory TOTP (enrolment on first
  login), refresh-token session, logout.
- **Overview** — growth KPIs (MRR, subscription funnel, signups,
  WAU/MAU, dunning) + platform health RAG strip.
- **Tenants** — search + plan/status list → org dossier.
- **Support** — ticket inbox → thread with public replies, internal
  notes and lifecycle actions.
- **Manage** — P4/P5 parity with admin-web:
  - Catalogue: diseases, breeds, vaccination schedules, performance
    targets, supplier-category templates (mobile forms; CSV import is
    web-only).
  - Plans & pricing: limits, features, per-currency price matrix.
  - Announcements: composer with severity/audience/schedule targeting.
  - Feature flags: defaults + tri-state plan and org overrides.
  - Analytics: daily rollups, charts, retention cohorts, CSV copy.
- **Ops** — cron freshness board, impersonation sessions, comms log.

Dangerous writes prompt for a fresh re-auth (password or TOTP, ≤5 min)
— same rule as the web console.

## Build

```bash
flutter pub get
flutter analyze
flutter test

# Android (API base URL is baked in at build time)
flutter build apk --release \
  --dart-define=APP_API_BASE_URL=https://nkuku.deeztechnology.solutions
```

Platform routes live under `/api/v1/platform` on the tenant API host.
See `PLAN-super-admin-console.md` §6 P6 for the parity-wave scope.
