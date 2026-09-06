import { get, set, del } from "idb-keyval";

// Custom IndexedDB persister for TanStack Query.
// Persists cache to IndexedDB so it survives page reloads while offline.
// Uses idb-keyval for a simple key-value store.

const CACHE_KEY = "nkuku-query-cache";

// We use a custom persister that async-loads/saves to IndexedDB.
// TanStack Query's persistQueryClient expects a Persister interface.

export const idbPersister = {
  persistClient: async (client: unknown) => {
    try {
      await set(CACHE_KEY, client);
    } catch (e) {
      console.warn("Failed to persist query cache to IndexedDB:", e);
    }
  },
  restoreClient: async () => {
    try {
      return await get(CACHE_KEY);
    } catch (e) {
      console.warn("Failed to restore query cache from IndexedDB:", e);
      return null;
    }
  },
  removeClient: async () => {
    try {
      await del(CACHE_KEY);
    } catch (e) {
      console.warn("Failed to remove query cache from IndexedDB:", e);
    }
  },
};

export { CACHE_KEY };
