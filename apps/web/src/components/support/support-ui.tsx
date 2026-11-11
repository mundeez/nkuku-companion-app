"use client";

import { Badge } from "@/components/ui/badge";
import { SUPPORT_TICKET_CATEGORIES } from "@/lib/types/support";

/** Shared presentational helpers for the /support pages. */

export function statusBadge(status: string) {
  switch (status) {
    case "open":
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
          Open
        </Badge>
      );
    case "in_progress":
    case "pending":
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          In progress
        </Badge>
      );
    case "waiting_on_user":
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
          Waiting on you
        </Badge>
      );
    case "resolved":
      return <Badge variant="secondary">Resolved</Badge>;
    case "closed":
      return <Badge variant="outline">Closed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function categoryLabel(category: string | undefined | null) {
  const found = SUPPORT_TICKET_CATEGORIES.find((c) => c.value === category);
  return found?.label ?? (category || "General");
}

export function fmtDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
