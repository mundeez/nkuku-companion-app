"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X, Info, AlertTriangle, AlertOctagon } from "lucide-react";
import { dismissAnnouncement, type Announcement } from "@/lib/api/client";
import { useActiveAnnouncements } from "@/lib/api/hooks";
import { useAuth } from "@/components/auth-provider";

const SEVERITY_STYLES: Record<
  string,
  { container: string; icon: typeof Info; linkClass: string; dismissClass: string }
> = {
  info: {
    container: "bg-blue-600 text-blue-50",
    icon: Info,
    linkClass: "bg-blue-50 text-blue-700 hover:bg-white",
    dismissClass: "text-blue-200 hover:text-white",
  },
  warning: {
    container: "bg-amber-500 text-amber-950",
    icon: AlertTriangle,
    linkClass: "bg-amber-950/90 text-amber-50 hover:bg-amber-950",
    dismissClass: "text-amber-800 hover:text-amber-950",
  },
  critical: {
    container: "bg-red-600 text-red-50",
    icon: AlertOctagon,
    linkClass: "bg-red-50 text-red-700 hover:bg-white",
    dismissClass: "text-red-200 hover:text-white",
  },
};

/**
 * Renders platform announcements (P4) at the top of every authenticated
 * page — below the impersonation banner, above the navbar. Fetches
 * GET /api/v1/announcements/active on mount and every 5 minutes (see
 * useActiveAnnouncements), and refetches on each route change since the
 * app layout itself persists across navigation.
 *
 * Dismissal POSTs to /api/v1/announcements/:id/dismiss and hides the
 * banner locally for the rest of the session. Announcements with
 * `isDismissible: false` render without a close button.
 *
 * Renders nothing when the request fails (e.g. the endpoint isn't
 * deployed yet) or the user is logged out.
 */
export function AnnouncementBanner() {
  const { user } = useAuth();
  const pathname = usePathname();
  const { data, refetch } = useActiveAnnouncements({ enabled: !!user });
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [pendingDismiss, setPendingDismiss] = useState<Set<string>>(new Set());

  // The layout doesn't remount on route change — refetch explicitly so a
  // newly targeted/scheduled announcement shows up during navigation too.
  useEffect(() => {
    refetch();
  }, [pathname, refetch]);

  if (!user || !Array.isArray(data) || data.length === 0) return null;

  const visible = data.filter((a) => !dismissedIds.has(a.id));
  if (visible.length === 0) return null;

  const handleDismiss = async (announcement: Announcement) => {
    if (pendingDismiss.has(announcement.id)) return;
    setPendingDismiss((prev) => new Set(prev).add(announcement.id));
    try {
      await dismissAnnouncement(announcement.id);
    } catch {
      // Dismissal is best-effort — hide locally regardless; the server
      // will re-surface it on a later session if the POST really failed.
    }
    setDismissedIds((prev) => new Set(prev).add(announcement.id));
  };

  return (
    // Not sticky — the navbar below stays pinned; banners scroll away.
    <div>
      {visible.map((announcement) => {
        const styles = SEVERITY_STYLES[announcement.severity] ?? SEVERITY_STYLES.info;
        const Icon = styles.icon;
        return (
          <div
            key={announcement.id}
            role="alert"
            className={`flex items-start gap-3 px-4 py-2 text-sm ${styles.container}`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <span className="font-semibold">{announcement.title}</span>
              {announcement.body && (
                <span className="ml-2 opacity-90">{announcement.body}</span>
              )}
            </div>
            {announcement.linkUrl && (
              <a
                href={announcement.linkUrl}
                // External links open in a new tab; internal (/…) navigate in place.
                {...(announcement.linkUrl.startsWith("/")
                  ? {}
                  : { target: "_blank", rel: "noopener noreferrer" })}
                className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${styles.linkClass}`}
              >
                {announcement.linkLabel || "Learn more"}
              </a>
            )}
            {announcement.isDismissible !== false && (
              <button
                type="button"
                onClick={() => handleDismiss(announcement)}
                disabled={pendingDismiss.has(announcement.id)}
                aria-label={`Dismiss announcement: ${announcement.title}`}
                className={`shrink-0 rounded p-0.5 ${styles.dismissClass}`}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
