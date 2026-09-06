"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getQueuedMutationCount, processMutationQueue } from "@/lib/api/offline-mutation-queue";

export function SyncStatusIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        // Process queued mutations when we come back online
        processMutationQueue().then(() => {
          // Invalidate all queries to refresh data
          queryClient.invalidateQueries();
        });
      }
    };

    const updatePendingCount = async () => {
      const count = await getQueuedMutationCount();
      setPendingCount(count);
    };

    setIsOnline(navigator.onLine);
    updatePendingCount();

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    window.addEventListener("nkuku:mutation-queue-changed", updatePendingCount);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
      window.removeEventListener("nkuku:mutation-queue-changed", updatePendingCount);
    };
  }, [queryClient]);

  if (isOnline && pendingCount === 0) return null;

  if (!isOnline) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground px-4 py-2 text-center text-sm">
        {pendingCount > 0
          ? `Offline — ${pendingCount} pending change${pendingCount === 1 ? "" : "s"} will sync when reconnected`
          : "Offline — changes will sync when reconnected"}
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-yellow-500 text-black px-4 py-2 text-center text-sm">
      Syncing {pendingCount} change{pendingCount === 1 ? "" : "s"}...
    </div>
  );
}
