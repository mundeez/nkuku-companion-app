"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";

export function NotificationBell() {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    let mounted = true;
    const fetchUnread = async () => {
      try {
        const alerts = await apiFetch<any[]>(
          "/api/v1/alerts?status=open"
        );
        if (mounted && Array.isArray(alerts)) {
          setCount(alerts.filter((a) => !a.isRead).length);
        }
      } catch {
        // Best-effort: silently fail
      }
    };
    fetchUnread();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-9 w-9"
      asChild
      aria-label="Alerts"
    >
      <Link href="/alerts">
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground ring-2 ring-background">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>
    </Button>
  );
}
