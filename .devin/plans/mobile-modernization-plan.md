# Mobile App Modernization & Performance Plan

Status: **Complete — all 5 phases implemented and released (v1.15.6-alpha through v1.24.0-alpha)**
Owner: Devin
Scope: `apps/mobile` (primary), `apps/web` + `apps/api` (performance only)
Related prior work: `navbar-redesign-plan.md` (web navbar redesign, released as v1.15.4-alpha)
Related prior planning: `Mobile_Web_Gap_Analysis_and_Implementation_Plan.md` (originally
placeholdered "Milestone M3-7 — Offline Sync" with no defined scope; this plan now
gives it a concrete design and folds it in as Phase 4 — see §7.4)

---

## 1. Objective

Modernize and beautify the Flutter mobile app's visual design and information
architecture, fix concrete layout/overflow/truncation bugs, and improve
loading/response speed across **both** the mobile app and the web app (including
backend/API where it is the real bottleneck). Web navigation was already
redesigned in a prior phase (v1.15.4-alpha); this plan brings the mobile app
to a comparable standard and extends performance work to the whole stack.

## 2. Decisions Confirmed With User

| Topic | Decision |
|---|---|
| Mobile design direction | **Material 3 native**, with a refreshed green-based palette/typography (not a literal port of the web's card/navbar look) |
| Flock Detail tabs (13 today) | Group into fewer categories; **also add a "Planning" group** to mobile, mirroring the web's nav groups |
| Bottom navigation (7 items today) | Trim to **4–5 primary destinations + a "More" entry** |
| Orphaned screens (Projections, Expansion Plan, Suppliers, Diseases, Vaccination Schedules) | **Wire all of them in**, grouped like the web nav (Production / Operations / Finance / Planning / Admin) |
| Local/offline caching | Lightweight in-memory/session caching in Phase 3 (§5.1); **plus** the previously-placeholdered `M3-7 Offline Sync` milestone is now given a concrete design and included as **Phase 4** of this plan (§7.4), using the `drift`/`sqlite3_flutter_libs` deps already pinned in `pubspec.yaml` for exactly this purpose |
| Flock Detail data loading | Keep eager loading (all tabs fetched up front) but **fix the sequential `await` calls to run in parallel** |
| Rollout | **Multiple phases**, each independently validated and closed out |
| Overflow/truncation audit | **Full app-wide audit**, not just the issues already found |
| Branding | **Refresh the palette** (still green-based) and typography scale, not just layout |
| Web performance | **In scope** for this plan (not a separate follow-up) |
| Validation matrix | Small phone + tablet breakpoints; **refresh app icon and splash screen** too |

## 3. Findings From Investigation (why this work is needed)

### 3.1 Navigation / information architecture gaps
- `BottomNavShell` (`lib/widgets/bottom_nav.dart`) has **7 destinations** (Dashboard,
  Flocks, Alerts, Vaccines, Finance, Ledger, More/Settings). On smaller phones,
  Material 3's `NavigationBar` compresses/wraps labels under this many items.
- **Five fully-built screens are completely unreachable** — not linked from the
  bottom nav or Settings screen at all:
  - `screens/projections_screen.dart`
  - `screens/expansion_plan_screen.dart`
  - `screens/suppliers_screen.dart`
  - `screens/broiler/diseases_screen.dart`
  - `screens/broiler/vaccination_schedules_screen.dart`
  - `settings_screen.dart` even lists "Vaccination Schedules" and "Disease
    Database" as **plain static `ListTile`s with no `onTap`** — dead UI.
- `FlockDetailScreen` (`lib/screens/broiler/flock_detail_screen.dart`) has a
  **13-tab `TabBar`** (Overview, Growth, Feed, Water, Mortality, Vaccination,
  Financial, Environment, Medication, Tasks, Calendar, Sales, Docs) — this is
  the most likely source of "navbar covering/truncating text": with 13 tabs at
  once, labels get compressed, icons dominate, and on narrow screens some tab
  labels are effectively unreadable.

### 3.2 Concrete overflow / truncation bugs (representative, not exhaustive — full audit is in scope)
- `screens/broiler/flocks_screen.dart` (flock list cards): a `Row` of 3 `Chip`s
  (bird count / age / mortality %) and a second `Row` (harvest date + countdown)
  have **no `Wrap`/`Expanded`/overflow handling** — long flock or breed names,
  or narrow devices, will clip content or throw `RenderFlex` overflow.
- Only **9 usages of `TextOverflow.ellipsis`** exist across the entire mobile
  codebase (78 Dart files) — most `Text` widgets have no overflow strategy at
  all, meaning long supplier names, flock names, document filenames, etc. can
  overflow their containers instead of truncating gracefully.
- Similar unconstrained `Row`s of chips/labels likely exist in `flock_detail_screen.dart`
  (13 tabs already fixed in a prior patch for the "Today" badge, but other rows
  in Overview/Financial/Sales tabs need the same review).

### 3.3 Performance gaps
- `FlockDetailScreen._loadData()` fires **10 requests in `Future.wait` (good)**,
  but then makes **6 more requests sequentially with individual `await`s**
  (`getGrowthAnalysis`, `getFeedSummary`, `getWaterRatio`, `getMortalitySummary`,
  `getVaccinationScheduleStatus`, `getFinancialSummary`, plus `getSaleRecordSummary`)
  — a single screen open triggers ~17 HTTP round-trips, several of which block
  each other unnecessarily.
- No image/network response caching library is present (no `cached_network_image`,
  no shimmer/skeleton package) — all loading states are full-screen
  `CircularProgressIndicator`s.
- `drift` + `sqlite3_flutter_libs` are already pinned in `pubspec.yaml` "for
  future M3-7 Offline Sync" but are **completely unused** today — no local
  persistence exists yet. This plan now gives M3-7 a concrete design (§5.4)
  and schedules it as Phase 4.
- Web pages (`app/page.tsx`, `app/broiler-flocks/[id]/page.tsx`, etc.) show
  plain `Loading...` text instead of skeletons, and some pages fire many
  independent `apiFetch(...).then(setX)` calls that each trigger their own
  re-render instead of batching state updates.
- No route-level `loading.tsx` / `Suspense` boundaries in the Next.js app —
  navigation between pages shows a blank flash before the "Loading..." text
  appears.

### 3.4 Assets
- No `flutter_native_splash` (or equivalent) configured — app likely shows a
  blank/white splash today.
- App icon (`assets/app_icon_1024.png`) is already used by `flutter_launcher_icons`;
  in scope for a visual refresh alongside the palette work, not a functional change.

---

## 4. Proposed Information Architecture

### 4.1 Bottom navigation (7 → 5)
| Slot | Destination |
|---|---|
| 1 | Dashboard |
| 2 | Flocks |
| 3 | Alerts |
| 4 | Finance *(entry point into Finance + Ledger, tabbed or segmented)* |
| 5 | More |

Moved into **More** (grouped, mirroring the web's Production / Operations /
Finance / Planning / Admin taxonomy):

| Group | Items |
|---|---|
| Production | Vaccine Inventory, Suppliers, Disease Database |
| Operations | Vaccination Schedules |
| Finance | Ledger *(if not promoted to a bottom-nav slot)* |
| **Planning** *(new)* | Projections, Expansion Plan |
| Admin | User Management *(owner only, already gated)* |
| Account | Account & Security, Theme, Notifications, Logout *(existing Settings content)* |

Exact grouping/labels will be finalized during Phase 1 implementation and
shown in a follow-up screenshot before moving to Phase 2.

### 4.2 Flock Detail tabs (13 → ~6 grouped tabs)
| New tab | Consolidates |
|---|---|
| Overview | Overview |
| Growth & Environment | Growth, Feed, Water, Environment |
| Health | Mortality, Vaccination, Medication |
| Finance | Financial, Sales |
| Planning | Tasks, Calendar |
| Docs | Docs |

Each grouped tab keeps its sub-sections as an inner segmented control or
sectioned scroll view (not further nested `TabBar`s, to avoid the same crowding
problem one level down). This reduces the top-level `TabBar` from 13 items to
6, which fit comfortably without label compression on all target screen sizes.

---

## 5. Performance Plan

### 5.1 Mobile
- Convert `FlockDetailScreen._loadData()`'s six sequential `_safeCall` awaits
  into a second `Future.wait(...)` batch (alongside the existing 10-request
  batch), cutting the critical path from ~7 round-trips to 2 batched round-trips.
- Add a small in-memory response cache (TTL ~60s) in `ApiService`/`BroilerService`
  for read endpoints hit repeatedly during a session (flock list, dashboard
  summary, breed/vaccination schedule static data) so backing out and back
  into a screen doesn't always re-fetch from the network.
- Add `cached_network_image` for any network-loaded images (profile photos,
  document thumbnails) to avoid re-downloading on every rebuild.
- Replace full-screen `CircularProgressIndicator` loading states with
  skeleton/shimmer placeholders shaped like the eventual content (reduces
  perceived load time).
- **Not in this phase:** full on-disk offline sync via `drift` — that now has
  its own dedicated design and phase (§5.4, Phase 4) rather than being bolted
  onto the performance phase. This phase's in-memory caching is deliberately
  kept separate and simple (session-only, no persistence) so it doesn't
  overlap with Phase 4's persistent cache/outbox.

### 5.2 Web
- Add route-level `loading.tsx` skeleton components for the highest-traffic
  pages: dashboard, broiler-flocks list, broiler-flocks detail, financials.
- Replace ad-hoc `<div>Loading...</div>` states with a shared `<Skeleton />`
  component (Tailwind pulse animation) for visual consistency.
- Batch independent `apiFetch(...).then(setX)` calls on the flock detail page
  into a single `Promise.allSettled([...])` + one `setState` batch to cut
  down on redundant re-renders.
- Verify Next.js image usage (if any) and enable optimization where applicable.

### 5.3 Backend/API (only where it's the real bottleneck)
- Audit `/api/v1/broiler-flocks/:id/summary` (builds a `targetAge`-day —
  typically 42 — computed calendar per request, including per-day string
  branching for health-support text) — this is pure computation with no DB
  calls per day, so cost is CPU not I/O; will profile before deciding whether
  memoization is worth it.
- Verify indexes exist on frequently-filtered Prisma columns (`flockId`,
  `organizationId`) on high-traffic tables (`growth_records`, `feed_records`,
  `financial_records`, `mortality_events`) — add missing indexes via a Prisma
  migration if any are found lacking.
- Add `Cache-Control` headers (short TTL, e.g. 5 min) on genuinely static
  reference endpoints (breeds, vaccination schedules, disease database) that
  rarely change, to let clients avoid refetching every screen open.
- No speculative backend rewrites — changes here are gated on confirming an
  actual bottleneck exists (see Phase 3 validation).

### 5.4 Offline Sync (M3-7) — concrete design

The gap-analysis doc only ever placeholdered this as "pin `drift`/`sqlite3_flutter_libs`,
implement later." This plan now gives it a real scope, sized to the actual
use case (field staff recording data in poultry houses with poor/no signal),
without turning into a full bidirectional sync engine.

**Local schema (via `drift`)** — mirrors the subset of server data needed for
offline viewing and recording, keyed by server IDs:
- `flocks` (list + detail fields needed for Overview/summary tabs)
- `growth_records`, `feed_records`, `water_records`, `mortality_events`,
  `vaccination_events`, `environmental_records` (the record types field staff
  actually log day-to-day)
- `alerts` (read-only, for offline visibility)
- `dashboard_summary` (single-row cache of the last successful fetch)
- `pending_mutations` (outbox: queued creates made while offline)

**Read path (cache-then-network):**
- On every successful GET for a cached entity, upsert the response into the
  local `drift` tables.
- On screen load: render instantly from local cache if present, then refresh
  from network in the background and update the UI when the network response
  lands (stale-while-revalidate). If there's no network, the cached view is
  the final state and a persistent "Offline — showing cached data from
  \<timestamp\>" banner is shown.

**Write path (queued outbox, v1 scope = creates only):**
- Supported offline: creating growth/feed/water/mortality/vaccination/
  environmental records — i.e. exactly the "field data entry" actions that
  motivate offline support for a farm app.
- Not supported offline in v1 (explicitly deferred, forms disabled with a
  "requires connection" notice when offline): edits, deletes, financial
  records/sales, document uploads, and anything with cross-entity side effects
  (e.g. mortality events adjusting `currentCount` server-side) — these need
  server-computed state and are higher-risk to reconcile offline.
- Offline creates are written to local `drift` tables immediately (so they
  appear in-app right away, marked with a small "pending sync" indicator) and
  queued in `pending_mutations`.
- A connectivity listener (new dependency: `connectivity_plus`) triggers replay
  of `pending_mutations` in order (oldest first) as soon as connectivity
  returns; each successful replay removes its outbox row and reconciles the
  local record with the server-assigned ID/fields.
- Conflict handling: server is always the source of truth. Since these are
  append-only "record" creates (not edits of shared mutable state), there is
  no merge logic needed — a replayed create either succeeds or surfaces a
  clear error in a "Sync Issues" screen for manual retry/discard.

**Storage housekeeping:**
- Cap cached history per flock/entity (e.g. last 100 records or 90 days,
  whichever is larger) to bound local DB growth.
- Add a "Clear local cache" action in Settings (does not affect the outbox —
  pending unsynced records are never silently discarded).

**Explicitly out of scope for this pass:** two-way sync of edits/deletes made
on other devices while offline, offline financial/sales/document workflows,
and background sync (sync only happens while the app is foregrounded).

---

## 6. Visual Modernization

- Refresh the Material 3 color scheme: keep green as the seed but tune
  `ColorScheme.fromSeed` tonal palette, add consistent elevation/surface tints,
  and define a shared `TextTheme` (currently relies on Material 3 defaults with
  ad hoc `TextStyle` overrides scattered per screen).
- Extract repeated ad hoc UI into shared widgets: stat chips, section headers,
  empty states, and card layouts (currently duplicated with slightly different
  styling across `flocks_screen.dart`, `flock_detail_screen.dart`, `dashboard_screen.dart`,
  etc.) — this both improves consistency and makes the overflow fixes reusable.
- Full app-wide overflow/truncation audit: every `Row`/`Text` combination that
  can receive variable-length data (names, descriptions, chip labels) gets
  wrapped in `Expanded`/`Flexible` and/or given `TextOverflow.ellipsis` with an
  appropriate `maxLines`, or moved into a `Wrap` where truncation would lose
  important info (e.g. the chip row on flock cards).
- App icon and splash screen refresh: introduce `flutter_native_splash` wired
  to the refreshed palette/logo; regenerate launcher icons via the already
  present `flutter_launcher_icons` config with the refreshed artwork.

---

## 7. Phased Rollout

Each phase ends with its own validation (analyze/build/tests) and a
`phase-closeout` (version bump, tag, release) before moving to the next, so
progress can be reviewed incrementally.

### Phase 1 — Information Architecture & Navigation
- Trim bottom nav to 5 destinations + grouped "More" screen.
- Wire in the 5 orphaned screens (Projections, Expansion Plan, Suppliers,
  Diseases, Vaccination Schedules) under the new grouped More menu, including
  the new **Planning** group.
- Restructure `FlockDetailScreen`'s 13 tabs into ~6 grouped tabs with inner
  sub-sections.
- No visual restyle yet — structural/navigation change only, existing widget
  styling is preserved so this phase is low-risk and reviewable on its own.

### Phase 2 — Visual Modernization & Overflow Audit
- Refresh color palette/typography.
- App-wide overflow/truncation audit and fixes (flock cards, flock detail
  sub-sections, suppliers, diseases, projections, and any other screens with
  variable-length text).
- Shared widget extraction (stat chips, section headers, empty states).
- App icon + splash screen refresh.
- Validate on a small-phone breakpoint (~360×640 logical px) and a tablet
  breakpoint (~768×1024 logical px), both light and dark theme.

### Phase 3 — Performance (Mobile + Web + API)
- Mobile: parallelize `FlockDetailScreen` sequential summary calls, add
  session-level in-memory caching, add `cached_network_image`, add
  skeleton/shimmer loading states.
- Web: skeleton loading states, route-level `loading.tsx`, batch flock-detail
  fetches.
- API: index audit + fix, static-endpoint cache headers, profile the calendar/
  summary endpoint and memoize only if profiling shows it's worth it.

### Phase 4 — Offline Sync (M3-7)
- Add `connectivity_plus` and wire up the `drift` schema described in §5.4
  (flocks, growth/feed/water/mortality/vaccination/environmental records,
  alerts, dashboard summary, pending-mutations outbox).
- Implement cache-then-network reads with an "Offline — showing cached data"
  banner, and offline creates (record types only, per §5.4) queued in the
  outbox with a "pending sync" indicator.
- Implement outbox replay on reconnect, plus a "Sync Issues" screen for
  failed replays.
- Add "Clear local cache" to Settings and enforce the storage cap.
- Validate explicitly: airplane-mode view of a previously-opened flock,
  airplane-mode creation of a growth/mortality/feed record, then reconnect
  and confirm the record syncs and matches on web.

### Phase 5 — QA, Regression & Closeout
- Full `flutter analyze` + release/debug builds; web `typecheck` + production
  build; API unit/integration test suite.
- Manual pass: small phone + tablet, light + dark theme, all restructured
  navigation paths (bottom nav, More groups, flock detail tabs), and the
  offline scenarios from Phase 4.
- Final `phase-closeout`: version bump across `apps/api`, `apps/web`,
  `apps/mobile`, changelog entry, tag, GitHub release.

---

## 8. Out of Scope

- Two-way sync of edits/deletes made on other devices while offline,
  background sync, and offline financial/sales/document workflows (see §5.4
  for the exact offline-sync boundary).
- Any change to business logic/calculations (mortality, profit projections,
  etc.) — this plan is UI/IA/performance only.
- iOS-specific visual polish beyond what Flutter's Material 3 widgets already
  provide consistently (no current iOS build/signing pipeline referenced in
  this repo).

## 9. Risks & Assumptions

- Restructuring the bottom nav and flock detail tabs changes muscle-memory
  navigation paths for existing users — mitigated by keeping the most-used
  destinations (Dashboard, Flocks, Alerts) in their current bottom-nav
  positions.
- Backend/API performance changes (Phase 3) are scoped to be low-risk
  (indexes, cache headers) — no schema or calculation logic changes.
- Screen-size validation will be done via Flutter's device simulator/emulator
  at target logical resolutions; a physical low-end device is not assumed to
  be available.
- Offline sync (Phase 4) is scoped to "record creation" only, deliberately
  excluding edits/deletes and financial/sales/document workflows — this keeps
  conflict resolution simple (append-only outbox, server-wins) but means
  those actions will still show a "requires connection" notice when offline;
  flagged here explicitly so it isn't mistaken for a full offline mode.
- `flutter_secure_storage` continues to hold auth tokens; the new local
  `drift` database only stores operational farm data already visible in-app,
  not credentials.

---

## 10. Approval

Please review and confirm before implementation begins:
- [ ] Bottom nav destination list (§4.1) and More-menu grouping
- [ ] Flock Detail tab grouping (§4.2)
- [ ] Phased rollout order (§7, now 5 phases) — proceed phase by phase with
      review points
- [ ] Performance scope (§5.1–5.3) — in-memory/session caching, web skeletons,
      API index/cache-header audit
- [ ] Offline Sync scope and design (§5.4 / Phase 4) — read caching + queued
      record-creation only; edits/deletes/financial/sales/docs stay
      online-only for this pass
