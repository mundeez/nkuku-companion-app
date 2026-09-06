import { get, set, del } from "idb-keyval";
import { apiFetch } from "./client";

// Offline mutation queue — stores pending mutations in IndexedDB
// and replays them when connectivity is restored.

const QUEUE_KEY = "nkuku-mutation-queue";

interface QueuedMutation {
  id: string;
  method: "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

// Generate a unique ID for each queued mutation
function generateId(): string {
  return `mut_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Get all queued mutations
export async function getQueuedMutations(): Promise<QueuedMutation[]> {
  try {
    return (await get(QUEUE_KEY)) || [];
  } catch {
    return [];
  }
}

// Get the count of pending mutations (for UI badges)
export async function getQueuedMutationCount(): Promise<number> {
  const queue = await getQueuedMutations();
  return queue.length;
}

// Enqueue a mutation for later processing
export async function enqueueMutation(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<QueuedMutation> {
  const queue = await getQueuedMutations();
  const mutation: QueuedMutation = {
    id: generateId(),
    method,
    path,
    body,
    timestamp: Date.now(),
    retryCount: 0,
  };
  queue.push(mutation);
  await set(QUEUE_KEY, queue);
  // Notify the UI that the queue changed
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("nkuku:mutation-queue-changed", {
        detail: { count: queue.length },
      })
    );
  }
  return mutation;
}

// Remove a mutation from the queue (on success or discard)
async function removeMutation(id: string): Promise<void> {
  const queue = await getQueuedMutations();
  const filtered = queue.filter((m) => m.id !== id);
  await set(QUEUE_KEY, filtered);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("nkuku:mutation-queue-changed", {
        detail: { count: filtered.length },
      })
    );
  }
}

// Mark a mutation as failed (increment retry count)
async function markMutationFailed(
  id: string,
  error: string
): Promise<void> {
  const queue = await getQueuedMutations();
  const mutation = queue.find((m) => m.id === id);
  if (mutation) {
    mutation.retryCount++;
    mutation.lastError = error;
    await set(QUEUE_KEY, queue);
  }
}

// Process all queued mutations (called when online)
export async function processMutationQueue(): Promise<{
  processed: number;
  failed: number;
}> {
  const queue = await getQueuedMutations();
  if (queue.length === 0) return { processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;

  // Process in order (oldest first)
  const sorted = [...queue].sort((a, b) => a.timestamp - b.timestamp);

  for (const mutation of sorted) {
    try {
      await apiFetch(mutation.path, {
        method: mutation.method,
        body: mutation.body ? JSON.stringify(mutation.body) : undefined,
      });
      await removeMutation(mutation.id);
      processed++;
    } catch (e: any) {
      // 4xx errors are validation failures — skip immediately
      if (e.status >= 400 && e.status < 500) {
        await removeMutation(mutation.id);
        console.warn(
          `Mutation ${mutation.id} skipped (4xx validation error):`,
          e.message
        );
        processed++;
        continue;
      }

      // Network error — stop processing, will retry later
      await markMutationFailed(mutation.id, e.message || String(e));
      failed++;
      // If this is a network error, stop processing (we're offline again)
      if (e.name === "TypeError" || e.message?.includes("fetch")) {
        break;
      }
    }
  }

  return { processed, failed };
}

// Clear the entire queue (on logout)
export async function clearMutationQueue(): Promise<void> {
  await del(QUEUE_KEY);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("nkuku:mutation-queue-changed", { detail: { count: 0 } })
    );
  }
}

// Auto-process queue when online status changes
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    processMutationQueue().catch((e) =>
      console.warn("Failed to process mutation queue:", e)
    );
  });
}
