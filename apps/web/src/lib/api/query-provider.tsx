"use client";

import { useState, useEffect } from "react";
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { del } from "idb-keyval";
import { idbPersister, CACHE_KEY } from "./idb-persister";

// Paths excluded from caching — financial data must always be fresh.
const EXCLUDED_PATHS = ["/api/v1/ledger", "/api/v1/financials"];

function isExcluded(path: string): boolean {
  return EXCLUDED_PATHS.some((p) => path.startsWith(p));
}

// Online detection — uses navigator.onLine + window events
if (typeof window !== "undefined") {
  onlineManager.setOnline(navigator.onLine);
  window.addEventListener("online", () => onlineManager.setOnline(true));
  window.addEventListener("offline", () => onlineManager.setOnline(false));
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale time: 60s for most data, but can be overridden per-query
            staleTime: 60 * 1000,
            // Keep data in cache for 30 minutes after unmounting
            gcTime: 30 * 60 * 1000,
            // Retry: 1 attempt on failure (don't hammer when offline)
            retry: 1,
            // Don't refetch on mount if data is fresh
            refetchOnMount: false,
            // Refetch when window regains focus (if stale)
            refetchOnWindowFocus: true,
            // Don't refetch when offline
            networkMode: "offlineFirst",
          },
          mutations: {
            // Mutations are queued when offline (see offline-mutation-queue.ts)
            retry: 0,
            networkMode: "offlineFirst",
          },
        },
      })
  );

  // Persist query cache to IndexedDB
  useEffect(() => {
    let mounted = true;
    const unsubscribe = persistQueryClient({
      queryClient,
      persister: idbPersister as any,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      dehydrateOptions: {
        shouldDehydrateQuery: (query: any) => {
          // Don't persist excluded paths (financial/ledger data)
          const queryKey = query.queryKey?.[0] as string;
          if (queryKey && isExcluded(queryKey)) return false;
          return true;
        },
      },
    });
    return () => {
      mounted = false;
      if (typeof unsubscribe === "function") {
        (unsubscribe as () => void)();
      }
    };
  }, [queryClient]);

  // Clear IndexedDB cache on logout
  useEffect(() => {
    const handleLogout = () => {
      queryClient.clear();
      del(CACHE_KEY);
    };
    window.addEventListener("nkuku:logout", handleLogout);
    return () => window.removeEventListener("nkuku:logout", handleLogout);
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

export { isExcluded, EXCLUDED_PATHS };
