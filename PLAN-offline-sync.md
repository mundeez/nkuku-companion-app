# Offline-First Data Layer & Performance Optimization Plan

**Status:** APPROVED — Ready for execution
**Date:** 2026-09-05
**Scope:** Mobile (Flutter) + Web (Next.js) + API (Fastify)

## Approved Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Web caching library | **TanStack Query** — offline mutation queue + IndexedDB persistence are critical |
| 2 | Mobile connectivity detection | **connectivity_plus** — proactive instant offline detection |
| 3 | ETag implementation | **@fastify/etag global** — automatic 304s on all endpoints, zero per-route code |
| 4 | Offline write scope | **All 12 entity types** — consistent UX, sync infra already handles all types |
| 5 | Web persistence | **IndexedDB** — true offline support across page reloads |
| 6 | Ledger/journal caching | **No caching** — financial accuracy trumps load speed |
| 7 | Release strategy | **Two phased releases** — API+mobile first, then web+polish |
| 8 | Background sync interval | **Every 5 min (foreground only)** — balance freshness vs. battery |

---

## 1. Current State Assessment

### What exists today

**Mobile:**
- `flutter_secure_storage`-based offline cache (`offline_cache.dart`) — stores flocks, alerts, and dashboard as encrypted JSON blobs
- In-memory session cache (`api_cache.dart`) — 60s TTL, no persistence
- Sync queue with 12 entity types (`sync_service.dart`) — replays mutations when connectivity returns
- Ping-based connectivity detection (`connectivity_service.dart`)
- **Drift/SQLite database already defined but NOT activated** — `apps/mobile/lib/database/tables.dart` has 11 tables, `app_database.dart` has full CRUD methods, but no service uses it
- `drift` and `sqlite3_flutter_libs` are already in `pubspec.yaml`

**Web:**
- No caching layer at all — every page fetches fresh data via `apiFetch`
- No state management library (no React Query, SWR, Zustand)
- No service worker, no IndexedDB, no offline support
- `localStorage` only stores user object and theme preference

**API:**
- No response compression (`@fastify/compress` not registered)
- No ETag/If-None-Match support
- `Cache-Control: stale-while-revalidate` only on 3 reference endpoints (breeds, diseases, vaccination schedules)
- No field selection — endpoints return full nested objects
- Broiler flock list performs heavy in-memory aggregation per flock
- Dashboard summary aggregates across all tables in a single request

### Load time bottlenecks

| Screen | Platform | API calls on load | Issue |
|--------|----------|-------------------|-------|
| Flock detail | Web | 8 parallel | No caching, full re-fetch on every navigation |
| Flock detail | Mobile | ~20-25 parallel | No caching between screens, full re-fetch |
| Flock list | Web | 3 parallel | Heavy aggregation per flock server-side |
| Dashboard | Both | 1 (heavy) | Single large aggregation query |
| Sales | Both | 2-3 | Already paginated, but no cache |

---

## 2. Goals

1. **Offline reads** — Both web and mobile can display cached data when offline
2. **Offline writes** — Both web and mobile can create/edit/delete while offline, with auto-sync on reconnection
3. **Faster load times** — Stale-while-revalidate pattern: show cached data instantly, refresh in background
4. **Consistent sync** — Single sync engine per platform that handles conflicts, retries, and skip-on-4xx
5. **No regression** — Existing API contracts, auth, and CRUD behavior preserved
6. **Bounded storage** — Cache caps prevent unbounded growth

---

## 3. Architecture Decisions

### 3.1 Mobile: Activate Drift/SQLite (already scaffolded)

**Why:** The Drift schema and database class already exist and are tested against the codebase. `flutter_secure_storage` JSON blobs are slow for large datasets and don't support querying. Drift gives us:
- Indexed SQLite storage with proper schema
- Queryable offline data (filter/sort without network)
- Batch upserts for sync efficiency
- Migration support for schema evolution

**What changes:**
- Run `build_runner` to generate `.g.dart` files
- Replace `OfflineCache` (secure storage) with `AppDatabase` (Drift) as the primary offline store
- Keep `OfflineCache` as a thin compatibility shim during migration, then deprecate
- Add `CachedSaleRecords` and `CachedSuppliers` tables (missing from current schema)
- Add `CachedSyncMetadata` table to track last-sync timestamps per entity type

### 3.2 Web: Add TanStack Query (React Query) + IndexedDB persistence

**Why:** TanStack Query is the standard React data-fetching library with built-in:
- Stale-while-revalidate caching
- Background refetch on focus/reconnect
- Mutation invalidation
- Offline mutation queue (via `mutationCache` + `onlineManager`)

For persistence across page reloads, pair it with IndexedDB via `idb-keyval` (3KB, no dependencies) or the `persistQueryClient` plugin with `persisters` for IndexedDB.

**What changes:**
- Add `@tanstack/react-query` + `idb-keyval` to web dependencies
- Create `QueryProvider` wrapper in `_app.tsx` / `layout.tsx`
- Create a `useApiQuery` hook wrapping `apiFetch` with TanStack Query
- Create an offline mutation queue using `mutationCache` + `onlineManager`
- Migrate all pages from direct `apiFetch` calls to `useApiQuery` / `useApiMutation`

### 3.3 API: Add compression + ETag support

**Why:** The API serves uncompressed JSON with no caching headers. Adding:
- `@fastify/compress` — gzip/brotli for all responses (50-80% payload reduction)
- ETag + `If-None-Match` handling — 304 Not Modified for unchanged data
- Selective `Cache-Control` headers on read endpoints

**What changes:**
- Register `@fastify/compress` in `main.ts`
- Add ETag generation on heavy GET endpoints (broiler-flocks list, dashboard, sale-records)
- Add `Cache-Control: private, max-age=60, stale-while-revalidate=300` on list endpoints
- Add `?fields=` support on the heaviest endpoints (broiler-flocks list, flock detail) to reduce payload for list views

### 3.4 Sync strategy: Last-write-wins with server authority

**Why:** This is a single-organization farm management app, not a multi-user collaborative document editor. Concurrent edits to the same record are rare. Last-write-wins with server-side validation is sufficient and simple.

**Conflict handling:**
- Server is always authoritative — sync replays mutations in order, server validates each
- If a record was deleted on the server while a client had a pending edit, the sync fails with 404 and is moved to the skipped queue
- If a record was edited on the server while a client had a pending edit, the client's edit overwrites it (last-write-wins)
- 4xx errors are auto-skipped (validation failures won't succeed on retry)
- 5xx errors are retried with exponential backoff

---

## 4. Implementation Phases

### Phase 1: API Performance Foundation (1-2 days)

**Goal:** Reduce payload sizes and add HTTP caching primitives.

**Tasks:**

1. **Register `@fastify/compress`** in `apps/api/src/main.ts`
   - Install: `pnpm add @fastify/compress`
   - Add `await app.register(compress, { encodings: ['gzip', 'br'] })` before route registration
   - Verify gzip/brotli is applied to all JSON responses

2. **Add ETag support** via `@fastify/etag` (global, automatic)
   - Install: `pnpm add @fastify/etag`
   - Register in `main.ts` before route registration: `await app.register(etag)`
   - Auto-generates ETags for all responses and handles `If-None-Match` → 304 automatically
   - No per-route code needed — every endpoint benefits

3. **Add `Cache-Control` headers** on read endpoints
   - Reference data (breeds, diseases, vaccination schedules): already done
   - List endpoints: `private, max-age=60, stale-while-revalidate=300`
   - Detail endpoints: `private, max-age=30, stale-while-revalidate=120`
   - Dashboard/summary: `private, max-age=30, stale-while-revalidate=60`

4. **Add `?fields=` parameter** on the two heaviest endpoints
   - `GET /broiler-flocks` — accept `?fields=id,name,breedName,status,currentCount,ageDays,mortalityRate` for list views
   - `GET /broiler-flocks/:id` — accept `?fields=` to exclude heavy relation trees when only basic info is needed
   - Default: return full object (backward compatible)

**Files touched:**
- `apps/api/src/main.ts`
- `apps/api/package.json`
- `apps/api/src/modules/broiler-flocks/routes.ts` (Cache-Control headers + `?fields=` param)
- `apps/api/src/modules/dashboard/routes.ts` (Cache-Control headers)
- `apps/api/src/modules/sale-records/routes.ts` (Cache-Control headers)

**Validation:**
- API tests pass (330+)
- API lint clean
- `curl -H "Accept-Encoding: gzip" -v` shows `Content-Encoding: gzip`
- `curl -H "If-None-Match: ..."` returns 304
- Verify `?fields=` reduces payload size on broiler-flocks list

---

### Phase 2: Mobile Offline-First with Drift (3-4 days)

**Goal:** Activate the Drift database, implement stale-while-revalidate reads, and migrate the sync queue to SQLite.

**Tasks:**

#### 2.1 Activate Drift database

1. Run `dart run build_runner build --delete-conflicting-outputs` to generate `app_database.g.dart`
2. Add missing tables to `tables.dart`:
   - `CachedSaleRecords` (id, flockId, saleDate, customerName, customerPhone, birdCount, avgWeightKg, pricePerBirdZmw, totalAmountZmw, paymentStatus, amountPaidZmw, notes, cachedAt)
   - `CachedSuppliers` (id, name, contactName, phone, email, cachedAt)
   - `CachedSyncMetadata` (entityType, lastSyncAt, etag) — tracks when each entity type was last synced
3. Bump `schemaVersion` to 3 and add migration for new tables
4. Initialize `AppDatabase` in `main.dart` and provide via a service locator

#### 2.2 Create `OfflineRepository` — the single offline data access layer

New file: `apps/mobile/lib/services/offline_repository.dart`

```dart
/// Single source of truth for offline data.
/// All services read from and write to Drift, then sync with the API.
class OfflineRepository {
  final AppDatabase _db;
  
  // Stale-while-revalidate pattern:
  // 1. Return cached data immediately (if available)
  // 2. Fetch fresh data from API in background
  // 3. Update Drift cache with fresh data
  // 4. Notify listeners of new data
  
  Future<List<CachedFlock>> getFlocks({bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final cached = await _db.getAllFlocks();
      if (cached.isNotEmpty) {
        _refreshFlocksInBackground(); // fire-and-forget
        return cached;
      }
    }
    return await _refreshFlocks();
  }
  
  Future<List<CachedFlock>> _refreshFlocks() async {
    final res = await ApiService.dio.get('/api/v1/broiler-flocks');
    final flocks = (res.data as List).map(...).toList();
    await _db.upsertFlocks(flocks);
    await _db.setSyncMetadata('flocks');
    return await _db.getAllFlocks();
  }
  
  // Same pattern for each entity type:
  // getGrowthRecords(flockId), getFeedRecords(flockId), etc.
}
```

#### 2.3 Migrate `BroilerService` to use `OfflineRepository`

- Replace direct Dio calls with `OfflineRepository` calls
- Keep the same public API (method signatures unchanged) so screens don't change
- On write operations (create/update/delete):
  - If online: call API, update local cache with response
  - If offline: write to Drift with a temporary UUID, enqueue in sync queue, return local copy
- Remove `ApiCache` (in-memory) — Drift replaces it
- Remove `OfflineCache` (secure storage) — Drift replaces it

#### 2.4 Migrate sync queue to Drift

- `SyncService` reads from `AppDatabase.getPendingSyncs()` instead of `OfflineCache.getPendingSyncsAsync()`
- On successful sync: `markSyncDone(id)` then delete the row
- On 4xx: `markSyncFailed` with status `skipped`
- On 5xx/network: increment retry, exponential backoff
- Add a `SyncNotifier` (ChangeNotifier/ValueNotifier) so UI can show sync status badge

#### 2.5 Add background sync on connectivity change

- Replace ping-based `ConnectivityService` with `connectivity_plus` plugin for proactive OS-level network detection
- `connectivity_plus` fires instantly when WiFi/cellular drops or returns — no more waiting for a request timeout to detect offline
- `SyncService` listens to connectivity changes and triggers sync on reconnection
- Add: after sync completes, trigger a full cache refresh (stale-while-revalidate all entity types)
- Add: periodic background sync every 5 minutes when app is in foreground (no sync when minimized — battery protection)
- Add: sync on app resume (app lifecycle observer)

#### 2.6 UI updates

- Add sync status indicator in app bar (synced / syncing N items / N pending / offline)
- Add "Last synced X minutes ago" in settings
- Add pull-to-refresh on list screens (forces `forceRefresh: true`)
- Show offline banner when `ConnectivityService.isOnline == false`

**Files touched:**
- `apps/mobile/lib/database/tables.dart` (add 3 tables)
- `apps/mobile/lib/database/app_database.dart` (add methods, bump schema)
- `apps/mobile/lib/services/offline_repository.dart` (NEW)
- `apps/mobile/lib/services/broiler_service.dart` (migrate to OfflineRepository)
- `apps/mobile/lib/services/sync_service.dart` (migrate to Drift sync queue)
- `apps/mobile/lib/services/offline_cache.dart` (deprecate, keep as shim)
- `apps/mobile/lib/services/api_cache.dart` (deprecate, remove)
- `apps/mobile/lib/services/connectivity_service.dart` (replace ping-based with connectivity_plus)
- `apps/mobile/lib/main.dart` (initialize AppDatabase, register lifecycle observer for background sync)
- `apps/mobile/lib/screens/dashboard_screen.dart` (use cached data)
- `apps/mobile/lib/screens/broiler/flock_detail_screen.dart` (use cached data)
- `apps/mobile/lib/screens/sales_dashboard_screen.dart` (use cached data)
- `apps/mobile/lib/widgets/sync_status_badge.dart` (NEW)
- `apps/mobile/pubspec.yaml` (add `connectivity_plus`)

**Validation:**
- `flutter analyze` — 0 errors
- `flutter test` — all tests pass
- Manual: load app, turn off network, navigate screens (cached data shows), create a record (queued), turn on network (syncs)
- Manual: verify load times are faster on second navigation to same screen

---

### Phase 3: Web Offline-First with TanStack Query (3-4 days)

**Goal:** Add stale-while-revalidate caching, offline mutation queue, and IndexedDB persistence.

**Tasks:**

#### 3.1 Install dependencies

```bash
cd apps/web
pnpm add @tanstack/react-query idb-keyval
```

#### 3.2 Create QueryProvider and client setup

New file: `apps/web/src/lib/api/query-client.ts`

```typescript
import { QueryClient, MutationCache, OnlineManager } from "@tanstack/react-query";
import { get, set, del } from "idb-keyval";

// Offline mutation queue
const pendingMutations: Array<() => Promise<void>> = [];

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,        // 1 minute
      gcTime: 5 * 60_000,       // 5 minutes
      retry: (failureCount, error) => {
        // Don't retry on 4xx
        if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 3;
      },
      // Use cached data on error (stale-while-revalidate)
      useErrorBoundary: false,
    },
    mutations: {
      onMutate: async (mutation) => {
        // If offline, queue the mutation
        if (!OnlineManager.getInstance().isOnline()) {
          pendingMutations.push(() => mutation.mutationFn(mutation.options.variables));
          return;
        }
      },
    },
  },
  mutationCache: new MutationCache({
    onSuccess: () => {
      // Invalidate relevant queries after successful mutation
    },
  }),
});

// IndexedDB persistence
export async function persistQueryClient() {
  // Save query cache to IndexedDB on changes
  // Restore on app load
}
```

New file: `apps/web/src/components/providers/query-provider.tsx`

```typescript
"use client";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { createQueryClient } from "@/lib/api/query-client";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => createQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

Wrap the root layout in `apps/web/src/app/layout.tsx` with `<QueryProvider>`.

#### 3.3 Create `useApiQuery` and `useApiMutation` hooks

New file: `apps/web/src/lib/api/hooks.ts`

```typescript
export function useApiQuery<T>(key: string[], path: string, options?: {
  staleTime?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: key,
    queryFn: () => apiFetch<T>(path),
    ...options,
  });
}

export function useApiMutation<TBody, TResponse>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  options?: { invalidateKeys?: string[][] }
) {
  return useMutation({
    mutationFn: (body: TBody) => apiFetch<TResponse>(path, {
      method,
      body: body ? JSON.stringify(body) : undefined,
    }),
    onSuccess: () => {
      if (options?.invalidateKeys) {
        options.invalidateKeys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
      }
    },
  });
}
```

#### 3.4 Migrate pages to use hooks

Migrate each page from direct `apiFetch` + `useEffect` + `useState` to `useApiQuery`:

Priority order (by impact):
1. `apps/web/src/app/page.tsx` (dashboard — 1 call)
2. `apps/web/src/app/broiler-flocks/page.tsx` (flock list — 3 calls)
3. `apps/web/src/app/broiler-flocks/[id]/page.tsx` (flock detail — 8 calls)
4. `apps/web/src/app/sales/page.tsx` (sales — 2 calls)
5. `apps/web/src/app/broiler-flocks/[id]/sales/page.tsx` (flock sales — 3 calls)
6. `apps/web/src/app/alerts/page.tsx` (alerts — 1 call)
7. Remaining pages (suppliers, diseases, vaccine inventory, expansion plan, etc.)
8. **SKIP:** All `/ledger/*` and `/financials/*` pages — these always fetch fresh for financial accuracy (per approved decision #6)

**Pattern for each page:**
```typescript
// Before:
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
useEffect(() => {
  apiFetch("/api/v1/broiler-flocks").then(setData).finally(() => setLoading(false));
}, []);

// After:
const { data, isLoading, error } = useApiQuery(["flocks"], "/api/v1/broiler-flocks");
```

#### 3.5 Offline mutation queue

- Use TanStack Query's `mutationCache` + `OnlineManager` to queue mutations when offline
- When online status changes to online, replay queued mutations in order
- Show a toast notification: "Saved offline — will sync when connected"
- Show sync status indicator in the header

#### 3.6 IndexedDB persistence

- Use `idb-keyval` to persist the query cache to IndexedDB
- On app load, restore cached queries before first network fetch
- This gives us offline reads across page reloads
- Cap storage: keep last 50MB of cached data, evict oldest first

#### 3.7 Online/offline detection

- Use `navigator.onLine` + `online`/`offline` window events
- Integrate with TanStack Query's `OnlineManager`
- Show a banner when offline: "You're offline — showing cached data"

**Files touched:**
- `apps/web/package.json` (add `@tanstack/react-query`, `idb-keyval`)
- `apps/web/src/app/layout.tsx` (wrap with QueryProvider)
- `apps/web/src/lib/api/query-client.ts` (NEW)
- `apps/web/src/lib/api/hooks.ts` (NEW)
- `apps/web/src/components/providers/query-provider.tsx` (NEW)
- `apps/web/src/components/offline-banner.tsx` (NEW)
- `apps/web/src/components/sync-status-indicator.tsx` (NEW)
- All page files in `apps/web/src/app/` (migrate to hooks — ~20 files)
- `apps/web/src/lib/api/client.ts` (add offline error handling)

**Validation:**
- `pnpm build` passes (lint + typecheck + production build)
- Manual: load page, refresh — data appears instantly from cache, then refreshes
- Manual: disconnect network, navigate pages (cached data shows), create a record (queued), reconnect (syncs)
- Verify no `apiFetch` calls remain in pages (all migrated to hooks)

---

### Phase 4: Sync Polish & Conflict Handling (1-2 days)

**Goal:** Handle edge cases, add user-facing sync controls, and ensure data consistency.

**Tasks:**

#### 4.1 Sync status UI (both platforms)

**Mobile:**
- Sync badge in app bar: green check (synced), spinner (syncing), orange dot (N pending), red dot (offline)
- "Sync now" button in settings
- "Pending changes" list in settings (shows queued mutations with retry/skip status)
- "Clear skipped items" button

**Web:**
- Sync indicator in header (same states as mobile)
- Toast on successful sync: "N changes synced"
- Toast on sync failure: "Failed to sync — will retry"
- Settings page: "Pending changes" section

#### 4.2 Optimistic updates

**Mobile:**
- When creating a record offline, immediately insert into Drift with a temporary UUID
- UI shows the new record instantly
- On sync, replace temporary UUID with server-assigned UUID
- If sync fails, mark the local record as `sync_failed` and show an error badge

**Web:**
- Use TanStack Query's `onMutate` to optimistically update the cache
- Rollback on error via `onError`
- Finalize on success via `onSettled`

#### 4.3 Selective cache invalidation

- After a sale record is created/updated/deleted, invalidate:
  - `["sale-records"]` (list)
  - `["sale-records", "dashboard"]` (dashboard)
  - `["sale-records", "summary"]` (summary)
  - `["broiler-flocks"]` (flock list — currentCount changed)
  - `["broiler-flocks", flockId]` (flock detail)
  - `["dashboard"]` (global dashboard)
- Same pattern for each entity type

#### 4.4 Cache eviction

**Mobile (Drift):**
- Keep last 100 records per flock per entity type (already in `enforceStorageCap`)
- Delete cached data for deleted flocks (cascade)
- Clear all cache on logout (already in `clearAll`)

**Web (IndexedDB):**
- Evict queries older than 7 days
- Cap total IndexedDB usage at 50MB
- Clear all on logout

**Files touched:**
- Mobile: `apps/mobile/lib/widgets/sync_status_badge.dart`, `apps/mobile/lib/screens/settings_screen.dart`
- Web: `apps/web/src/components/sync-status-indicator.tsx`, `apps/web/src/app/settings/page.tsx`
- Both: sync service refinements

**Validation:**
- Full test suite (API + mobile)
- Web build passes
- Manual: create record offline → see it appear instantly → reconnect → verify it syncs → verify cache is updated with server response

---

### Phase 5: Performance Verification & Release (1 day)

**Tasks:**

1. **Load time benchmarking**
   - Measure time-to-first-paint for dashboard, flock list, flock detail on both platforms
   - Compare before (no cache) vs after (cached)
   - Target: 50%+ reduction in perceived load time on repeat visits

2. **Offline scenario testing**
   - Mobile: airplane mode, create 5 records, reconnect, verify all sync
   - Web: disconnect network, navigate all pages, create records, reconnect, verify sync
   - Verify no data loss on app kill/restart

3. **API performance verification**
   - Verify gzip compression is active
   - Verify ETag/304 responses work
   - Verify payload size reduction on `?fields=` endpoints

4. **Full validation suite**
   - API: lint + 330+ tests
   - Web: lint + typecheck + build
   - Mobile: analyze + 55+ tests
   - Docker: all services healthy
   - Security: dependency audit

5. **Phase closeout**
   - Commit, tag, release
   - Update CHANGELOG

---

## 5. Entity Coverage

| Entity | Mobile Cache (Drift) | Web Cache (TanStack) | Offline Write | Sync |
|--------|---------------------|---------------------|---------------|------|
| Broiler Flocks | Yes | Yes | Yes | Yes |
| Growth Records | Yes | Yes | Yes | Yes |
| Feed Records | Yes | Yes | Yes | Yes |
| Water Records | Yes | Yes | Yes | Yes |
| Mortality Events | Yes | Yes | Yes | Yes |
| Vaccination Events | Yes | Yes | Yes | Yes |
| Financial Records | Yes | Yes | Yes | Yes |
| Sale Records | Yes (NEW table) | Yes | Yes | Yes |
| Environmental Records | Yes | Yes | Yes | Yes |
| Alerts | Yes (read-only) | Yes (read-only) | No (system-generated) | Read-only sync |
| Dashboard Summary | Yes (JSON blob) | Yes | N/A | Read-only sync |
| Breeds | No (reference data, cached via HTTP) | Yes (HTTP cache) | No | No |
| Suppliers | Yes (NEW table) | Yes | No (admin only) | Read-only sync |
| Flock Tasks | Yes | Yes | Yes | Yes |
| Feed Purchases | Yes | Yes | Yes | Yes |
| Medication Records | Yes | Yes | Yes | Yes |
| Documents | No (files in S3) | No (files in S3) | No | No |
| Ledger/Journal | No (always fresh — financial accuracy) | No (always fresh — financial accuracy) | No | No |

---

## 6. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Drift schema migration breaks existing installs | Schema versioning + migration strategy already in place; test upgrade from v2 → v3 |
| TanStack Query adds bundle size | ~13KB gzipped — acceptable for the performance gain |
| IndexedDB quota exceeded | Cap at 50MB, evict oldest first, catch QuotaExceededError |
| Sync conflicts (same record edited on web and mobile) | Last-write-wins with server authority; 4xx on stale data moves to skipped queue |
| Temporary UUID collision on offline creates | Use UUID v4 (collision probability negligible) |
| Auth token expiry during offline period | On sync attempt, if 401, attempt token refresh; if refresh fails, stop sync and prompt re-login |
| Large initial cache download on first login | Fetch flocks list first (small), then lazy-load per-flock data on detail navigation |
| `connectivity_plus` plugin adds native dependency | Already widely used, stable, minimal permissions |

---

## 7. Approved Decisions (from Q&A session)

All 8 design questions have been resolved:

1. **Web caching library → TanStack Query** — offline mutation queue and IndexedDB persistence plugins are critical. SWR would require building a custom offline queue, which defeats its simplicity advantage.

2. **Mobile connectivity → connectivity_plus** — proactive OS-level network detection gives instant offline awareness instead of waiting for a request to time out. Better UX, minimal permissions.

3. **ETag implementation → @fastify/etag global** — automatic ETags on all responses with zero per-route code. CPU overhead of hashing is negligible (<1ms) compared to the DB queries that produce responses.

4. **Offline write scope → All 12 entity types** — the sync infrastructure already handles all 12 types. Limiting scope would create inconsistent UX (can record mortality offline but not medication).

5. **Web persistence → IndexedDB** — without it, page refresh while offline produces a blank screen. IndexedDB gives true offline resilience across sessions.

6. **Ledger/journal caching → No caching** — financial reports must be accurate to the cent. These pages are accessed less frequently (weekly/monthly), so load time impact is minimal.

7. **Release strategy → Two phased releases** —
   - **Release 1 (v1.29.0-alpha):** Phase 1 (API performance) + Phase 2 (mobile offline)
   - **Release 2 (v1.30.0-alpha):** Phase 3 (web offline) + Phase 4 (sync polish) + Phase 5 (verification)

8. **Background sync interval → Every 5 minutes (foreground only)** — data is at most 5 minutes stale during active use. No background sync when minimized to protect battery. Also syncs on app resume and connectivity restore.

---

## 8. Release Plan & Timeline

### Release 1: v1.29.0-alpha — API Performance + Mobile Offline

| Phase | Duration | Dependencies |
|-------|----------|-------------|
| Phase 1: API Performance | 1-2 days | None |
| Phase 2: Mobile Offline | 3-4 days | Phase 1 (ETag/compression helps) |
| **Subtotal** | **4-6 days** | |

**Deliverables:**
- API: gzip/brotli compression, global ETags with 304s, Cache-Control headers, `?fields=` on heavy endpoints
- Mobile: Drift/SQLite activated, stale-while-revalidate reads, offline writes with auto-sync, sync status UI, `connectivity_plus` for instant offline detection, 5-min background refresh

### Release 2: v1.30.0-alpha — Web Offline + Sync Polish

| Phase | Duration | Dependencies |
|-------|----------|-------------|
| Phase 3: Web Offline | 3-4 days | Phase 1 (ETag/compression helps) |
| Phase 4: Sync Polish | 1-2 days | Phases 2 + 3 |
| Phase 5: Verification | 1 day | Phase 4 |
| **Subtotal** | **5-7 days** | |

**Deliverables:**
- Web: TanStack Query with IndexedDB persistence, `useApiQuery`/`useApiMutation` hooks, all pages migrated, offline mutation queue, offline banner, sync indicator
- Both: optimistic updates, selective cache invalidation, cache eviction, full performance benchmarks

### Total: 9-13 days across two releases

Phases 2 and 3 can run in parallel since they're on different platforms, but the two-release strategy means mobile ships first.

---

## 9. What Will NOT Change

- API route paths and response shapes (except adding optional `?fields=` param)
- Authentication (JWT + cookies)
- RBAC roles (owner, manager, viewer, sales_person, flock_minder)
- Prisma schema (no database migrations needed)
- Docker Compose service structure
- Mobile navigation structure
- Web URL structure
- Existing test suites (will add new tests, won't modify existing assertions)

---

*This plan is written to file at `PLAN-offline-sync.md`. No implementation has started. Awaiting your approval and answers to the questions above.*
