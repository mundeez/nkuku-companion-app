# Mobile / Web Gap Analysis & Implementation Plan

**Date:** 2026-07-10
**Scope:** `apps/mobile` (Flutter 3.x) vs `apps/web` (Next.js 14)
**Reference:** Live web app at https://nkuku.deeztechnology.solutions

---

## 1. Executive Summary

The mobile app is currently a **read-only companion** for a subset of broiler data, while the web app is the full operational and financial management platform. The biggest blockers are:

- Mobile dashboard does **not** use the production `/api/v1/dashboard/summary` endpoint, so charts and broiler KPIs are missing.
- Mobile has **no CRUD for daily broiler operations** (flocks, growth, feed, water, mortality, vaccination, medication, environmental records, tasks).
- Mobile has **no role-based UI gating** (owner/manager/viewer); every logged-in user sees the same screens.
- Mobile has **no dark/light mode**, **no alerts**, **no vaccine inventory**, **no supplier CRUD**, **no user management**, **no settings**.
- Mobile financial statements still call the deprecated `/api/v1/financial-engine/*` endpoints; the web already provides GAAP equivalents under `/api/v1/ledger/*`.

### Gap Counts

| Category                     | Blocker | Major | Minor | Total |
|------------------------------|---------|-------|-------|-------|
| Missing functionality        | 6       | 8     | 2     | 16    |
| UI/appearance inconsistency  | 1       | 2     | 3     | 6     |
| Broken/partial implementation| 2       | 3     | 1     | 6     |
| **Total**                    | **9**   | **13**| **6** | **28**|

---

## 2. Web Feature / UI Inventory

### Global / Shell
- Next.js 14 + Tailwind + shadcn/ui; responsive top navbar with mobile hamburger menu.
- Theme toggle (light / dark / system) in navbar and `/settings`.
- JWT auth with 24h expiry; role-based redirects (`owner`, `manager`, `viewer`).
- Logo `logo.png` at `h-10 w-auto` in navbar, `w-full h-auto` on login.

### Navigation
Dashboard, Broiler Flocks, Diseases, Alerts, Vaccine Inventory, Suppliers, Projections, Expansion Plan, Financials, Ledger, Users (owner only).

### Dashboard (`/`)
- KPIs: Active Flocks, Total Birds, Mortality Rate, Net Profit, Profit/Bird, Open Alerts.
- Charts: Monthly Revenue vs Cost (Bar), Cost Breakdown (Pie), Alerts by Severity (Pie), Flock Profitability (Bar).
- Lists: Recent alerts, top open alerts.

### Broiler Flocks
- `/broiler-flocks`: full CRUD, breed/supplier selection, housing type, chick collection, status badges.
- `/broiler-flocks/[id]`: tabs Overview, Growth, Feed, Water, Mortality, Vaccination, Financial, Chicks; role-based add/edit/delete records.
- Sub-pages: Calendar, Calendar/Print, Environment, Tasks, Growth, Mortality, Feed, Financial, Medication.
- Operations supported: growth records, feed records, water records, mortality events, vaccination events, medication records, financial records, environmental records, flock tasks.

### Diseases (`/diseases`)
- Searchable/filterable database, detail modal with symptoms, prevention, treatment, organic options.

### Alerts (`/alerts`)
- List with severity filter, generate, mark read, resolve.

### Vaccine Inventory (`/vaccine-inventory`)
- CRUD with expiry warnings, status badges.

### Suppliers (`/suppliers`)
- Full CRUD, inline unit-price editing, drag-and-drop stage reordering, templates.

### Users (`/users`)
- Full CRUD, owner-only access.

### Projections (`/projections`)
- Supplier-based projection calculator with bar chart.

### Expansion Plan (`/expansion-plan`)
- Cycles and batches with revenue targets.

### Financials (`/financials`)
- Dashboard with KPIs, monthly trend, flock profitability, projections toggle.
- Statements: Income Statement, Balance Sheet, Cash Flow (via `/api/v1/financial-engine/*`).
- Overheads CRUD + allocate.
- Audit log.
- Export to CSV.

### Ledger (`/ledger/*`)
- Trial balance, chart of accounts, account ledger, journal list, journal detail, new journal entry, year-end close.
- GAAP Income Statement, Balance Sheet, Cash Flow (via `/api/v1/ledger/*`).

### Settings (`/settings`)
- Theme, primary breed, currency, notification preferences.

---

## 3. Mobile App Feature / UI Inventory

### Global / Shell
- Flutter 3.x Material 3; `ThemeData.fromSeed(Colors.green)`; no dark/light toggle.
- JWT auth via `AuthService` with `SharedPreferences`; no role-based UI gating.
- Hardcoded production base URL in `api_service.dart`.
- Navigation: `DashboardScreen` pushes `MaterialPageRoute` to each feature.

### Dashboard (`DashboardScreen`)
- Stats: Suppliers, Cycles, Batches (calls `/api/v1/suppliers` and `/api/v1/expansion-plan`).
- Quick-action tiles: Run Projection, Suppliers, Expansion Plan, Broiler Flocks, Vaccination Schedules, Disease Database, Financials, Ledger.
- **Does not call `/api/v1/dashboard/summary`. No charts.**

### Broiler Flocks
- `FlocksScreen`: read-only list; message says "Create one from the web app."
- `FlockDetailScreen`: 4 tabs — Overview, Environment, Vaccination, Health.
  - No growth, feed, water, mortality, financial, chicks, medication, or task tabs.
  - No record creation/edit/delete.
  - Environment tab only shows schedule targets; no environmental record logging.

### Vaccination Schedules (`VaccinationSchedulesScreen`)
- Read-only schedule list.

### Diseases (`DiseasesScreen`)
- Read-only list with search and category filter.

### Suppliers (`SuppliersScreen`)
- Read-only expansion list with feed stages.

### Expansion Plan (`ExpansionPlanScreen`)
- Read-only cycles/batches.

### Projections (`ProjectionsScreen`)
- Supplier-based calculator with bar chart.

### Financials
- `FinancialDashboardScreen`, `IncomeStatementScreen`, `BalanceSheetScreen`, `CashFlowScreen`, `OverheadsScreen`.
- Uses **deprecated** `/api/v1/financial-engine/*` endpoints.
- Overheads has create/delete only.
- Statements use the old financial-engine shape, not the GAAP ledger shape.

### Ledger
- `LedgerDashboardScreen`, `TrialBalanceScreen`, `ChartOfAccountsScreen`, `AccountLedgerScreen`, `JournalListScreen`, `JournalDetailScreen`.
- Uses correct `/api/v1/ledger/*` endpoints.
- Read-only; no journal entry creation, no year-end close.

### Login (`LoginScreen`)
- Logo at `height: 80`; no theme toggle.

### Missing Entirely
Alerts, Vaccine Inventory, Users, Settings, Calendar/Print, Flock Tasks, Medication records, Growth/Feed/Water/Mortality record CRUD, Flock CRUD.

---

## 4. Gap Table

| # | Feature | Web | Mobile | Classification | Severity | Effort | Risk / Dependency |
|---|---------|-----|--------|----------------|----------|--------|-------------------|
| 1 | Dashboard KPIs & charts (`/api/v1/dashboard/summary`) | Full | Missing; shows old supplier/cycle/batch stats | Missing functionality | **Blocker** | M | Shared API exists; mainly UI rebuild |
| 2 | Dark / light mode | Full | Missing | Missing functionality | **Blocker** | S | Add `ThemeProvider` + Material `ThemeData` |
| 3 | Role-based UI gating (owner/manager/viewer) | Full | Missing; all users see same screens | Missing functionality | **Blocker** | S | Security; affects every CRUD screen |
| 4 | Create / edit / delete broiler flocks | Full | Missing; message says use web app | Missing functionality | **Blocker** | M | Needs breed/supplier selection forms |
| 5 | Growth record CRUD | Full | Missing entirely | Missing functionality | **Blocker** | M | Per-flock form + API |
| 6 | Feed record CRUD | Full | Missing entirely | Missing functionality | **Blocker** | M | Per-flock form + supplier feed-stage selection |
| 7 | Water record CRUD | Full | Missing entirely | Missing functionality | **Blocker** | M | Per-flock form + API |
| 8 | Mortality event CRUD | Full | Missing entirely | Missing functionality | **Blocker** | M | Per-flock form + cause dropdown |
| 9 | Vaccination event CRUD | Full | Missing; only schedules are read-only | Missing functionality | **Blocker** | M | Needs vaccine inventory linkage |
| 10 | Medication record CRUD | Full | Missing; mobile has read-only "Health" tab | Missing functionality | **Major** | M | Per-flock form + withdrawal days |
| 11 | Environmental record CRUD | Full | Missing; mobile only shows schedule targets | Missing functionality | **Major** | M | Form with temp/humidity/ammonia/light |
| 12 | Flock tasks (generate, complete, skip) | Full | Missing entirely | Missing functionality | **Major** | M | API exists; list + toggle UI |
| 13 | Management calendar view | Full | Missing entirely | Missing functionality | **Major** | M | Reuse `/api/v1/broiler-flocks/:id/summary` |
| 14 | Alerts list / generate / resolve | Full | Missing entirely | Missing functionality | **Major** | M | API exists; list + action buttons |
| 15 | Vaccine inventory CRUD | Full | Missing entirely | Missing functionality | **Major** | M | Full form + expiry logic |
| 16 | Suppliers CRUD (incl. price edit) | Full | Mobile read-only | Missing functionality | **Major** | L | Forms, inline editing, templates |
| 17 | Users CRUD | Full | Missing entirely | Missing functionality | **Major** | M | Owner-only screen |
| 18 | Settings (theme, breed, currency, notifications) | Full | Missing entirely | Missing functionality | **Major** | M | New screen + preferences storage |
| 19 | Mobile navigation pattern | Top navbar + tabs | Push-only; no bottom nav or drawer | UI inconsistency | **Major** | M | Intentional platform change recommended |
| 20 | Financial statements use GAAP ledger endpoints | `/api/v1/ledger/*` | Mobile uses deprecated `/api/v1/financial-engine/*` | Broken/partial | **Major** | M | Migrate to `LedgerService` |
| 21 | Journal entry creation | Web has `/ledger/journal/new` | Mobile read-only | Missing functionality | **Major** | M/L | Multi-line form with balance validation |
| 22 | Year-end close wizard | Web has `/ledger/close` | Missing | Missing functionality | **Major** | M | Complex workflow; likely web-only |
| 23 | Logo sizing / brand consistency | `w-full h-auto` login, `h-10` navbar | `height: 80` login, `height: 32` AppBar | UI inconsistency | Minor | S | Asset already shared |
| 24 | Dashboard layout difference | 6 KPI cards + 4 charts | 3 stat cards + action tiles | UI inconsistency | Major | M | Part of dashboard parity work |
| 25 | Drift / SQLite dependencies | Not used on web | Listed in `pubspec.yaml` but unused in code | Broken/partial | Minor | S | Remove or implement offline sync |
| 26 | CSV export / print calendar | Web CSV + print | Missing | Missing functionality | Minor | S/M | Use share sheet on mobile |
| 27 | Base URL hardcoded to production | Configurable via env | `const _baseUrl = 'https://nkuku.deeztechnology.solutions'` | Broken/partial | Major | S | Build config risk |
| 28 | Token expiry auto-redirect | Web handles 401 | Mobile `onError` just forwards error | Broken/partial | Major | S | Auth interceptor fix |

---

## 5. Recommended Intentional Divergences

| Area | Recommendation | Rationale |
|------|---------------|-----------|
| **Navigation** | Bottom nav bar or drawer instead of top navbar | Mobile platform convention; web top nav is too tall on phones |
| **Year-end close wizard** | Web-only | Complex multi-step wizard with irreversible journal entries; too risky on small screens |
| **Audit log** | Web-only or admin-only mobile view | Read-heavy tabular data; managers/viewers rarely need it in the field |
| **Print calendar** | Web-only; mobile uses native share | Printing is poor on mobile; share PDF/image instead |
| **Supplier stage reordering** | Simple edit-mode reorder buttons, not drag-and-drop | Drag-and-drop is awkward on small screens |
| **CSV export** | Use `share_plus` to send generated CSV | Mobile has no "Downloads" folder workflow like desktop |
| **Journal entry creation** | Simplified 2+ line form, no full chart picker | Keep it usable; complex account trees can be collapsible |
| **Dashboard charts** | Simpler 2–3 charts vs. web's 4 | Screen real estate; prioritize the two most actionable charts |

---

## 6. Milestone Breakdown

Ordering is by dependency and stated priority: **daily broiler operations first**, with foundational work (auth/RBAC/theme/dashboard) shipping first.

---

### Milestone M3-1 — Foundation, Auth & Dashboard Parity

**Goal:** Make the mobile app safe, branded, and useful at a glance.

**Scope**
- Add role-aware UI gating (`owner`, `manager`, `viewer`) from `AuthService.user`.
- Implement light/dark theme toggle and `ThemeProvider`.
- Fix token expiry handling: detect 401/403 and redirect to `LoginScreen`.
- Rebuild `DashboardScreen` to call `/api/v1/dashboard/summary` and show the same 6 KPIs + simplified charts (`fl_chart` already in dependencies).
- Add a bottom navigation bar so users can reach all top-level features without returning to the dashboard.
- Normalize logo sizing (`BoxFit.contain`, shared `logo.png`).
- Fix build-time base URL via `--dart-define` (`APP_API_BASE_URL`).

**Files / modules**

| File | Change |
|------|--------|
| `lib/main.dart` | Add `ThemeProvider`, wire `BottomNavBar` |
| `lib/services/auth_service.dart` | Expose `role` field, add 401 interceptor |
| `lib/services/api_service.dart` | Replace hardcoded URL with `String.fromEnvironment` |
| `lib/screens/dashboard_screen.dart` | Rebuild KPIs + charts from `/dashboard/summary` |
| `lib/screens/login_screen.dart` | Normalize logo sizing |
| `lib/providers/theme_provider.dart` | **New** — `ChangeNotifier` wrapping `ThemeMode` |
| `lib/widgets/bottom_nav.dart` | **New** — persistent bottom navigation |

**Rollback:** Revert `dashboard_screen.dart` to supplier/cycles/batches version; keep theme/auth files.

**Verification**
- Unit test `AuthService` role parsing.
- Widget test dashboard loading state and KPI display.
- Manual check: owner vs viewer sees different actions.

---

### Milestone M3-2 — Daily Broiler Operations CRUD (Priority)

**Goal:** Let users create and manage flocks and daily operational records from the field.

**Scope**
- Flock list: FAB to create/edit flocks (name, breed, supplier, start date, initial count, target weight/age, feed transition day, finisher day, housing type, chick price).
- Flock detail: add tabs for **Growth**, **Feed**, **Water**, **Mortality**, **Vaccination**, and **Financial Records** (keep existing Overview/Environment/Vaccination/Health; rename/merge where needed).
- Implement forms for each record type:
  - **Growth:** age, weight, sample size.
  - **Feed:** date, feed type, quantity kg, cost (auto from supplier feed stage), flock.
  - **Water:** quantity litres, pH, notes.
  - **Mortality:** count, age, cause, notes.
  - **Vaccination:** vaccine, batch, age, date, notes.
  - **Financial:** amount, category, income/expense toggle, date.
- Hide delete/edit for viewers; restrict delete to owner.

**Files / modules**

| File | Change |
|------|--------|
| `lib/screens/broiler/flocks_screen.dart` | Add FAB, delete/edit actions |
| `lib/screens/broiler/flock_detail_screen.dart` | Expand to 8 tabs |
| `lib/screens/broiler/flock_form_screen.dart` | **New** |
| `lib/screens/broiler/records/growth_record_form.dart` | **New** |
| `lib/screens/broiler/records/feed_record_form.dart` | **New** |
| `lib/screens/broiler/records/water_record_form.dart` | **New** |
| `lib/screens/broiler/records/mortality_event_form.dart` | **New** |
| `lib/screens/broiler/records/vaccination_event_form.dart` | **New** |
| `lib/screens/broiler/records/financial_record_form.dart` | **New** |
| `lib/models/flock.dart` | Extend with all fields |
| `lib/services/broiler_service.dart` | **New** — typed API calls for all record types |

**Rollback:** Keep old read-only screens as `*_readonly.dart` copies during development; swap back if forms fail.

**Verification**
- Integration tests: each record POST / PATCH / DELETE against API.
- Physical device check: form validation, keyboard types, date pickers.

---

### Milestone M3-3 — Broiler Operations Continued (Medication, Environment, Tasks, Calendar)

**Goal:** Complete the operational workflow around flock care.

**Scope**
- **Medication** tab/screen with CRUD (product, category, dose, route, withdrawal days).
- **Environmental record logging** in the existing Environment tab (temp, humidity, ammonia, light hours, litter score).
- **Tasks** screen per flock: generate, complete, skip.
- **Calendar** view per flock — day cards with feed phase, vaccines, environment, tasks.
- Share calendar as PDF/image via `share_plus`.

**Files / modules**

| File | Change |
|------|--------|
| `lib/screens/broiler/flock_detail_screen.dart` | Add Medication + Tasks tabs |
| `lib/screens/broiler/medication_screen.dart` | **New** |
| `lib/screens/broiler/tasks_screen.dart` | **New** |
| `lib/screens/broiler/calendar_screen.dart` | **New** |
| `lib/models/medication_record.dart` | **New** |
| `lib/models/flock_task.dart` | **New** |

**Rollback:** Disable new tabs by setting `TabController.length` back to the previous value.

**Verification**
- End-to-end: create flock → add feed → add mortality → generate tasks → mark complete → view calendar.

---

### Milestone M3-4 — Alerts, Suppliers & Vaccine Inventory

**Goal:** Bring operational support tools to mobile.

**Scope**
- `AlertsScreen`: list, filter by severity, generate, resolve, mark read.
- `VaccineInventoryScreen`: full CRUD with expiry warning chips.
- `SuppliersScreen`: add create/edit/delete, inline price editing, simple stage management (reorder buttons, not drag-and-drop).
- Push notifications powered by a self-hosted **ntfy** instance (`https://ntfy.deeztechnology.solutions`). The API publishes alert messages to per-user ntfy topics; mobile listens via an SSE subscription and uses `flutter_local_notifications` to surface local notifications while the app is foregrounded or backgrounded.

**Infrastructure**
- Add an `ntfy` service to both `docker-compose.yml` and `docker-compose.prod.yml` using the official `binwiederhier/ntfy` image.
- Dev compose exposes ntfy internally on the `nkuku_public` network and publishes to host port `30085:80` for browser/client access.
- Prod compose binds ntfy to `127.0.0.1:30085:80` and relies on the existing reverse proxy (ISPConfig) to route `https://ntfy.deeztechnology.solutions` to it.
- API environment variables: `NTFY_BASE_URL` (defaults to `http://ntfy` in dev, `https://ntfy.deeztechnology.solutions` in prod) and `NTFY_DEFAULT_TOPIC`.
- Persist ntfy messages/cache in a Docker volume (`ntfy_data`).

**Files / modules**

| File | Change |
|------|--------|
| `lib/screens/alerts_screen.dart` | **New** |
| `lib/screens/vaccine_inventory_screen.dart` | **New** |
| `lib/screens/suppliers_screen.dart` | Add CRUD actions |
| `lib/models/supplier.dart` | Extend with editable fields |
| `lib/services/notification_service.dart` | **New** — ntfy topic registration, SSE subscription, local notification display, and permission handling |

**Rollback:** Revert `suppliers_screen.dart` to current read-only version if editing breaks.

**Verification**
- Integration tests for alerts and vaccine inventory CRUD.
- Notification permission prompt smoke test on Android and iOS.
- Verify the ntfy service is healthy at `http://ntfy:80` (dev) / `https://ntfy.deeztechnology.solutions` (prod).
- Publish a test message through the API and confirm it appears as a local notification on the device.

---

### Milestone M3-5 — Financial & Ledger Parity

**Goal:** Align mobile financial reporting with the web's double-entry ledger.

**Scope**
- Migrate `IncomeStatementScreen`, `BalanceSheetScreen`, `CashFlowScreen` from `/api/v1/financial-engine/*` to `/api/v1/ledger/*` via `LedgerService`.
- Keep `FinancialDashboardScreen` on `/api/v1/financial-engine/*` for now but handle deprecation headers gracefully.
- Add date-range pickers to ledger statements.
- Add **New Journal Entry** screen: simplified multi-line form with live debit = credit validation.
- Add date filters to `AccountLedgerScreen`.

**Files / modules**

| File | Change |
|------|--------|
| `lib/screens/financials/income_statement_screen.dart` | Migrate to `LedgerService` |
| `lib/screens/financials/balance_sheet_screen.dart` | Migrate to `LedgerService` |
| `lib/screens/financials/cash_flow_screen.dart` | Migrate to `LedgerService` |
| `lib/screens/ledger/account_ledger_screen.dart` | Add date filters |
| `lib/screens/ledger/journal_entry_form_screen.dart` | **New** |
| `lib/services/ledger_service.dart` | Extend with statement date params |

**Rollback:** Keep financial-engine screens as a fallback; toggle via a feature flag if ledger endpoints fail.

**Verification**
- Compare mobile statement totals to web `/ledger/*` statements for the same period.
- Unit test journal entry balance validation (debit must equal credit).

---

### Milestone M3-6 — Admin, Settings & Polish

**Goal:** Close the remaining administrative and UX gaps.

**Scope**
- `UsersScreen` (owner only): user CRUD.
- `SettingsScreen`: theme, primary breed, currency, notification preferences.
- Keep `drift` / `sqlite3_flutter_libs`; pin versions and add a placeholder **Milestone M3-7 — Offline Sync** for future implementation.
- Full `flutter test` run; fix any failures.
- Final physical device audit (owner / manager / viewer role smoke test).

**Files / modules**

| File | Change |
|------|--------|
| `lib/screens/users_screen.dart` | **New** |
| `lib/screens/settings_screen.dart` | **New** |
| `lib/main.dart` | Wire settings screen, confirm build-time URL config |
| `pubspec.yaml` | Pin drift / sqlite3 versions; add M3-7 offline-sync note |
| `android/app/build.gradle` / `ios/Flutter/Release.xcconfig` | Add `--dart-define` build args |

**Rollback:** Revert `pubspec.yaml` if version pinning causes build failures.

**Verification**
- `flutter test` full suite — zero failures.
- Role smoke test: create user as owner, login as manager, verify viewer cannot delete.

---

## 7. Effort Key

| Label | Meaning |
|-------|---------|
| S | Small — 1 day or less |
| M | Medium — 2–4 days |
| L | Large — 5+ days |

---

## 8. Decisions Made

| Question | Decision |
|----------|----------|
| Intentional divergences | Accept all four: Year-end close and Audit log web-only; Print calendar replaced by native share; Supplier reordering uses buttons instead of drag-and-drop. |
| Offline support / Drift | Keep `drift` / `sqlite3_flutter_libs`; pin versions and add a future offline-sync milestone. |
| Year-end close | Web-only. |
| Journal entry creation on mobile | Simplified form (2+ lines, basic account picker). |
| Notification delivery | Self-hosted ntfy (`https://ntfy.deeztechnology.solutions`) for push notifications; mobile uses SSE + `flutter_local_notifications`. Firebase dependencies removed.

---

## 9. Next Action

Proceed with **Milestone M3-1 — Foundation, Auth & Dashboard Parity**.

---

*Generated by Devin — gap analysis based on full inspection of `apps/web` and `apps/mobile` codebases.*
