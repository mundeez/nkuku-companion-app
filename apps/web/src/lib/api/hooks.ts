"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { enqueueMutation } from "./offline-mutation-queue";
import { isExcluded } from "./query-provider";

// ─── Query hooks ─────────────────────────────────

/**
 * Generic query hook with offline-first behavior.
 * Uses TanStack Query's offlineFirst network mode.
 * Cached data is persisted to IndexedDB via the QueryProvider.
 *
 * Paths starting with /api/v1/ledger or /api/v1/financials are
 * excluded from caching — they always fetch fresh data.
 */
export function useApiQuery<T = unknown>(
  path: string,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    refetchInterval?: number;
  }
) {
  return useQuery<T>({
    queryKey: [path],
    queryFn: () => apiFetch<T>(path),
    enabled: options?.enabled ?? true,
    staleTime: isExcluded(path) ? 0 : (options?.staleTime ?? 60 * 1000),
    refetchInterval: options?.refetchInterval,
    // Always refetch on mount — shows cached data immediately while
    // refreshing in the background. Ledger/financials always refetch.
    refetchOnMount: true,
  });
}

/**
 * Generic mutation hook with offline queue support.
 * When online, mutations hit the API immediately and return the real response.
 * When a network error occurs (offline), the mutation is enqueued in IndexedDB
 * and replayed when connectivity is restored.
 *
 * Supports optimistic updates via the `optimisticUpdate` option.
 */
export function useApiMutation<T = unknown, V = unknown>(
  method: "POST" | "PATCH" | "DELETE",
  options?: {
    onSuccess?: (data: T, variables: V) => void;
    onError?: (error: Error, variables: V) => void;
    invalidatePaths?: string[];
    // Optimistic update: receives the variables and should return
    // the optimistic value to write to the cache before the mutation completes.
    // On error, the cache is automatically rolled back.
    optimisticUpdate?: (variables: { path: string; body?: V }) => {
      queryKey: unknown[];
      updater: (old: unknown) => unknown;
    };
  }
) {
  const queryClient = useQueryClient();

  return useMutation<T, Error, { path: string; body?: V }>({
    mutationFn: async ({ path, body }) => {
      try {
        // Always try the API first — when online this returns the real response
        return await apiFetch<T>(path, {
          method,
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (e: any) {
        // Only queue if this is a network error (fetch failed), not a 4xx/5xx
        // Network errors are TypeError (fetch failed) or have no status code
        const isNetworkError =
          e instanceof TypeError ||
          e?.status === undefined ||
          e?.message?.includes("fetch") ||
          e?.message?.includes("Network Error") ||
          e?.name === "TypeError";

        if (isNetworkError) {
          // Queue for later replay
          await enqueueMutation(method, path, body);
          // Return a placeholder so the mutation resolves
          return { queued: true } as unknown as T;
        }
        // Re-throw validation/server errors so the UI can handle them
        throw e;
      }
    },
    onMutate: async (variables) => {
      // Optimistic update
      if (options?.optimisticUpdate) {
        const { queryKey, updater } = options.optimisticUpdate(variables);
        // Cancel any outgoing refetches so they don't overwrite our optimistic update
        await queryClient.cancelQueries({ queryKey });
        // Snapshot the previous value
        const previousData = queryClient.getQueryData(queryKey);
        // Optimistically update the cache
        queryClient.setQueryData(queryKey, updater);
        // Return context with the previous data for rollback
        return { previousData };
      }
    },
    onError: (error, variables, context) => {
      // Roll back optimistic update on error
      const ctx = context as { previousData?: unknown } | undefined;
      if (ctx?.previousData !== undefined && options?.optimisticUpdate) {
        const { queryKey } = options.optimisticUpdate(variables);
        queryClient.setQueryData(queryKey, ctx.previousData);
      }
      options?.onError?.(error, variables.body as V);
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries to refresh from server.
      // Use predicate matching so that "/api/v1/sale-records" invalidates
      // all queries whose key starts with that path (e.g. "/api/v1/sale-records/all?...").
      if (options?.invalidatePaths) {
        for (const p of options.invalidatePaths) {
          queryClient.invalidateQueries({
            predicate: (query) => {
              const key = query.queryKey?.[0];
              return typeof key === "string" && key.startsWith(p);
            },
          });
        }
      }
      // Also invalidate the exact mutation path
      queryClient.invalidateQueries({ queryKey: [variables.path] });
      options?.onSuccess?.(data, variables.body as V);
    },
  });
}

// ─── Specific entity hooks ───────────────────────

/** Flock list query */
export function useFlocks(status?: string) {
  const path = `/api/v1/broiler-flocks${status ? `?status=${status}` : ""}`;
  return useApiQuery(path, { staleTime: 60 * 1000 });
}

/** Flock detail query */
export function useFlock(id: string) {
  return useApiQuery(`/api/v1/broiler-flocks/${id}`, {
    staleTime: 30 * 1000,
  });
}

/** Dashboard summary query */
export function useDashboardSummary() {
  return useApiQuery("/api/v1/dashboard/summary", {
    staleTime: 30 * 1000,
  });
}

/** Alerts query */
export function useAlerts() {
  return useApiQuery("/api/v1/alerts", { staleTime: 30 * 1000 });
}

/** Sales query with optional filters */
export function useSales(params?: {
  flockId?: string;
  paymentStatus?: string;
  fromDate?: string;
  toDate?: string;
  customer?: string;
  limit?: number;
  offset?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.flockId) searchParams.set("flockId", params.flockId);
  if (params?.paymentStatus) searchParams.set("paymentStatus", params.paymentStatus);
  if (params?.fromDate) searchParams.set("fromDate", params.fromDate);
  if (params?.toDate) searchParams.set("toDate", params.toDate);
  if (params?.customer) searchParams.set("customer", params.customer);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));
  const query = searchParams.toString();
  return useApiQuery(`/api/v1/sale-records${query ? `?${query}` : ""}`, {
    staleTime: 60 * 1000,
  });
}

/** Sales dashboard query */
export function useSalesDashboard(params?: {
  flockId?: string;
  fromDate?: string;
  toDate?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.flockId) searchParams.set("flockId", params.flockId);
  if (params?.fromDate) searchParams.set("fromDate", params.fromDate);
  if (params?.toDate) searchParams.set("toDate", params.toDate);
  const query = searchParams.toString();
  return useApiQuery(
    `/api/v1/sale-records/dashboard${query ? `?${query}` : ""}`,
    { staleTime: 30 * 1000 }
  );
}

/** Sales summary query */
export function useSalesSummary(params?: {
  flockId?: string;
  fromDate?: string;
  toDate?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.flockId) searchParams.set("flockId", params.flockId);
  if (params?.fromDate) searchParams.set("fromDate", params.fromDate);
  if (params?.toDate) searchParams.set("toDate", params.toDate);
  const query = searchParams.toString();
  return useApiQuery(
    `/api/v1/sale-records/summary${query ? `?${query}` : ""}`,
    { staleTime: 30 * 1000 }
  );
}

// ─── Mutation hooks ──────────────────────────────

/** Create flock mutation (with optimistic list update) */
export function useCreateFlock() {
  return useApiMutation("POST", {
    invalidatePaths: ["/api/v1/broiler-flocks", "/api/v1/dashboard/summary"],
    optimisticUpdate: ({ body }) => ({
      queryKey: ["/api/v1/broiler-flocks"],
      updater: (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return [...old, { ...(body as object), _optimistic: true }];
      },
    }),
  });
}

/** Update flock mutation (with optimistic detail + list update) */
export function useUpdateFlock() {
  return useApiMutation("PATCH", {
    invalidatePaths: ["/api/v1/broiler-flocks", "/api/v1/dashboard/summary"],
    optimisticUpdate: ({ path, body }) => {
      // Extract flock ID from path for detail cache update
      const match = path.match(/\/api\/v1\/broiler-flocks\/([^/]+)/);
      const flockId = match?.[1];
      return {
        queryKey: flockId
          ? [`/api/v1/broiler-flocks/${flockId}`]
          : ["/api/v1/broiler-flocks"],
        updater: (old: unknown) => {
          if (!old) return old;
          if (Array.isArray(old)) {
            return old.map((f: any) =>
              f.id === flockId ? { ...f, ...(body as object), _optimistic: true } : f
            );
          }
          return { ...(old as object), ...(body as object), _optimistic: true };
        },
      };
    },
  });
}

/** Delete flock mutation (with optimistic list removal) */
export function useDeleteFlock() {
  return useApiMutation("DELETE", {
    invalidatePaths: ["/api/v1/broiler-flocks", "/api/v1/dashboard/summary"],
    optimisticUpdate: ({ path }) => {
      const match = path.match(/\/api\/v1\/broiler-flocks\/([^/]+)/);
      const flockId = match?.[1];
      return {
        queryKey: ["/api/v1/broiler-flocks"],
        updater: (old: unknown) => {
          if (!Array.isArray(old)) return old;
          return old.filter((f: any) => f.id !== flockId);
        },
      };
    },
  });
}

/** Create sale record mutation */
export function useCreateSale() {
  return useApiMutation("POST", {
    invalidatePaths: [
      "/api/v1/sale-records",
      "/api/v1/sale-records/dashboard",
      "/api/v1/sale-records/summary",
      "/api/v1/dashboard/summary",
    ],
  });
}

/** Update sale record mutation */
export function useUpdateSale() {
  return useApiMutation("PATCH", {
    invalidatePaths: [
      "/api/v1/sale-records",
      "/api/v1/sale-records/dashboard",
      "/api/v1/sale-records/summary",
    ],
  });
}

/** Delete sale record mutation */
export function useDeleteSale() {
  return useApiMutation("DELETE", {
    invalidatePaths: [
      "/api/v1/sale-records",
      "/api/v1/sale-records/dashboard",
      "/api/v1/sale-records/summary",
    ],
  });
}

// ─── Cache management hooks ──────────────────────

/** Hook to access the query client for manual cache operations */
export function useQueryCache() {
  const queryClient = useQueryClient();
  return {
    invalidate: (path: string) =>
      queryClient.invalidateQueries({ queryKey: [path] }),
    invalidateAll: () => queryClient.invalidateQueries(),
    clear: () => queryClient.clear(),
    prefetch: (path: string) =>
      queryClient.prefetchQuery({
        queryKey: [path],
        queryFn: () => apiFetch(path),
      }),
  };
}
