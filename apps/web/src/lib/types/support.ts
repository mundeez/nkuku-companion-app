/**
 * Tenant-side support ticket types (P3).
 * API base: /api/v1/support (tenant JWT).
 */

export type SupportTicketCategory =
  | "general"
  | "billing"
  | "bug"
  | "account"
  | "other";

export const SUPPORT_TICKET_CATEGORIES: { value: SupportTicketCategory; label: string }[] = [
  { value: "general", label: "General" },
  { value: "billing", label: "Billing" },
  { value: "bug", label: "Bug report" },
  { value: "account", label: "Account" },
  { value: "other", label: "Other" },
];

/** Item shape of GET /tickets → { items }. */
export interface SupportTicketSummary {
  id: string;
  subject: string;
  category: SupportTicketCategory | string;
  status: string;
  createdAt: string;
  lastMessageAt: string | null;
  messageCount: number;
  /** Present when the requester is someone else (owners see org tickets). */
  requesterEmail?: string | null;
}

/** ticket shape of GET /tickets/:id → { ticket }. */
export interface SupportTicket {
  id: string;
  subject: string;
  status: string;
  category: SupportTicketCategory | string;
  meta?: Record<string, unknown> | null;
  createdAt: string;
  resolvedAt: string | null;
}

/** Message shape of GET /tickets/:id → { messages }. */
export interface SupportTicketMessage {
  id: string;
  authorType: "user" | "staff" | string;
  body: string;
  /** Staff-only notes — filtered server-side; also hidden client-side. */
  internalNote?: boolean | null;
  createdAt: string;
}

export function isTicketOpen(status: string | undefined | null): boolean {
  // The API accepts replies on every status except 'closed' — a reply on a
  // 'waiting_on_user'/'resolved' ticket reopens it to 'open'. 'closed' is
  // the only terminal state.
  return status !== "closed";
}
