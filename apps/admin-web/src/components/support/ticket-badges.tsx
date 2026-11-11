"use client";

import { Badge } from "@/components/ui/badge";
import type { TicketStatus } from "@/lib/types";

export const TICKET_STATUSES: { value: TicketStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting_on_user", label: "Waiting on user" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export function ticketStatusLabel(status: string): string {
  return TICKET_STATUSES.find((s) => s.value === status)?.label ?? status.replace(/_/g, " ");
}

export function TicketStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "open":
      return <Badge variant="default">{ticketStatusLabel(status)}</Badge>;
    case "in_progress":
      return (
        <Badge variant="outline" className="border-blue-500/50 text-blue-400">
          {ticketStatusLabel(status)}
        </Badge>
      );
    case "waiting_on_user":
      return (
        <Badge variant="outline" className="border-amber-500/50 text-amber-400">
          {ticketStatusLabel(status)}
        </Badge>
      );
    case "resolved":
      return (
        <Badge variant="outline" className="border-green-500/50 text-green-400">
          {ticketStatusLabel(status)}
        </Badge>
      );
    case "closed":
      return <Badge variant="secondary">{ticketStatusLabel(status)}</Badge>;
    default:
      return <Badge variant="secondary">{ticketStatusLabel(status)}</Badge>;
  }
}

export function TicketPriorityBadge({ priority }: { priority: string }) {
  switch (priority) {
    case "urgent":
      return <Badge variant="destructive">urgent</Badge>;
    case "high":
      return (
        <Badge variant="outline" className="border-amber-500/50 text-amber-400">
          high
        </Badge>
      );
    case "low":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          low
        </Badge>
      );
    default:
      return <Badge variant="secondary">{priority || "normal"}</Badge>;
  }
}
