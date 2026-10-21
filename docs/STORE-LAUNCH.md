# Store launch guide — Google Play + Apple App Store

## Android (Google Play)

The release workflow (`.github/workflows/release.yml`) builds a **signed AAB**
on every `v*` tag when these repository secrets are set:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 apps/mobile/android/release.keystore` |
| `KEYSTORE_PASSWORD` | `storePassword` from `android/key.properties` |
| `KEY_ALIAS` | `keyAlias` from `key.properties` |
| `KEY_PASSWORD` | `keyPassword` from `key.properties` |

Artifacts (AAB + APK) are attached to the GitHub release automatically.
`versionCode` = GitHub run number (monotonically increasing — Play requirement).

Play Console checklist:

- App: `com.nkuku.nkuku_mobile`, default language English
- **Data safety**: collects email/phone/name; financial data; encrypted in
  transit; **deletion path**: in-app Settings → Delete organization
  (30-day purge) — declare it
- **Privacy policy URL**: `https://nkuku.zeendeefood.solutions/legal/privacy`
- Content rating questionnaire, target API level current
- Track: internal → closed → production
- Build the store APK/AAB with default `--dart-define=APP_STORE_MODE=link`
  (upgrade sheet links to web billing)

## iOS (Apple App Store)

Requires: Apple Developer Program ($99/yr) + a signing identity.

- Bundle id `com.nkuku.nkuku_mobile` — already configured
- `release.yml` includes an unsigned iOS build check on `macos-14` to catch
  compile regressions; for submission run a signed build on a Mac or add a
  `fastlane match` step with `APPLE_CERT_*`/`MATCH_*` secrets
- **Build with `--dart-define=APP_STORE_MODE=strict`** — the 402 upgrade
  sheet then shows "Manage your plan on the web" as plain text with no
  external purchase link (App Store guideline 3.1.1 posture)
- Sign in with Apple is already a dependency (required since Google/Facebook
  login is offered)
- App Privacy nutrition label mirrors the Play Data Safety form
- Flow: TestFlight → App Review (expect 1–2 rounds)
