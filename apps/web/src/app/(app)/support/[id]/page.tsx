"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { useApiQuery } from "@/lib/api/hooks";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, LifeBuoy, Send, CheckCircle } from "lucide-react";
import {
  isTicketOpen,
  type SupportTicket,
  type SupportTicketMessage,
} from "@/lib/types/support";
import { statusBadge, categoryLabel, fmtDateTime } from "@/components/support/support-ui";
import { cn } from "@/lib/utils";

interface TicketDetailResponse {
  ticket: SupportTicket;
  messages: SupportTicketMessage[];
}

export default function SupportTicketPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [actionError, setActionError] = useState("");

  const { data, isLoading: ticketLoading, error: ticketError, refetch } =
    useApiQuery<TicketDetailResponse>(`/api/v1/support/tickets/${id}`, {
      enabled: !!user,
    });

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  const ticket = data?.ticket;
  // internalNote rows are already filtered server-side; hide any that slip
  // through as a second layer of defence.
  const messages = (data?.messages ?? []).filter((m) => m.internalNote !== true);
  const open = ticket ? isTicketOpen(ticket.status) : false;

  async function handleReply() {
    const trimmed = reply.trim();
    if (!trimmed) return;
    if (trimmed.length > 10000) {
      setActionError("Message must be at most 10,000 characters.");
      return;
    }
    setActionError("");
    setSending(true);
    try {
      await apiFetch(`/api/v1/support/tickets/${id}/reply`, {
        method: "POST",
        body: JSON.stringify({ body: trimmed }),
      });
      setReply("");
      refetch();
    } catch (err: any) {
      setActionError(
        err instanceof ApiRequestError
          ? err.body?.message || err.body?.error || err.message
          : err?.message || "Failed to send reply."
      );
    } finally {
      setSending(false);
    }
  }

  async function handleClose() {
    if (!confirm("Close this ticket? You can still read the conversation afterwards.")) return;
    setActionError("");
    setClosing(true);
    try {
      await apiFetch(`/api/v1/support/tickets/${id}/close`, {
        method: "POST",
        body: "{}",
      });
      refetch();
    } catch (err: any) {
      setActionError(
        err instanceof ApiRequestError
          ? err.body?.message || err.body?.error || err.message
          : err?.message || "Failed to close ticket."
      );
    } finally {
      setClosing(false);
    }
  }

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  if (ticketError) {
    const e = ticketError as any;
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/support"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Support
        </Link>
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          {e?.body?.message || e?.message || "Failed to load ticket."}
        </div>
      </div>
    );
  }

  if (ticketLoading || !ticket) {
    return <div className="p-8">Loading...</div>;
  }

  const metaEntries = Object.entries(ticket.meta ?? {}).filter(
    ([, v]) => typeof v === "string" || typeof v === "number"
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/support"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Support
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h1 className="text-2xl font-bold">{ticket.subject}</h1>
          {statusBadge(ticket.status)}
          <Badge variant="outline">{categoryLabel(ticket.category)}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Opened {fmtDateTime(ticket.createdAt)}
          {ticket.resolvedAt ? ` • Resolved ${fmtDateTime(ticket.resolvedAt)}` : ""}
        </p>
        {metaEntries.length > 0 && (
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
            {metaEntries.map(([k, v]) => (
              <span key={k}>
                <span className="font-medium">{k}:</span> {String(v)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Message thread */}
      <div className="space-y-3 mb-6">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No messages yet.
          </div>
        ) : (
          messages.map((m) => {
            const fromStaff = m.authorType === "staff";
            return (
              <div
                key={m.id}
                className={cn("flex", fromStaff ? "justify-start" : "justify-end")}
              >
                <Card
                  className={cn(
                    "max-w-[85%]",
                    fromStaff
                      ? "bg-muted/60"
                      : "bg-primary text-primary-foreground"
                  )}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-2 mb-1">
                      {fromStaff ? (
                        <LifeBuoy className="h-3.5 w-3.5" />
                      ) : null}
                      <span
                        className={cn(
                          "text-xs font-medium",
                          fromStaff ? "" : "text-primary-foreground/80"
                        )}
                      >
                        {fromStaff ? "Support team" : "You"}
                      </span>
                      <span
                        className={cn(
                          "text-xs",
                          fromStaff
                            ? "text-muted-foreground"
                            : "text-primary-foreground/70"
                        )}
                      >
                        {fmtDateTime(m.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {m.body}
                    </p>
                  </CardContent>
                </Card>
              </div>
            );
          })
        )}
      </div>

      {actionError && (
        <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          {actionError}
        </div>
      )}

      {/* Reply box + close */}
      {open ? (
        <div className="space-y-3">
          <textarea
            className="w-full border rounded-md p-3 min-h-[100px] bg-background text-foreground text-sm"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write a reply…"
            maxLength={10000}
          />
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={closing || sending}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              {closing ? "Closing…" : "Close ticket"}
            </Button>
            <Button
              size="sm"
              onClick={handleReply}
              disabled={sending || closing || !reply.trim()}
            >
              <Send className="h-4 w-4 mr-1" />
              {sending ? "Sending…" : "Send reply"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
          This ticket is closed. Replies are no longer accepted.
        </div>
      )}
    </div>
  );
}
