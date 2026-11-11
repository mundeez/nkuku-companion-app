"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { useApiQuery } from "@/lib/api/hooks";
import { apiFetch, APP_VERSION, ApiRequestError } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LifeBuoy, Plus, RefreshCw, MessageSquare, Clock } from "lucide-react";
import {
  SUPPORT_TICKET_CATEGORIES,
  type SupportTicketCategory,
  type SupportTicketSummary,
} from "@/lib/types/support";
import { statusBadge, categoryLabel, fmtDateTime } from "@/components/support/support-ui";

export default function SupportPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [newOpen, setNewOpen] = useState(false);
  const [category, setCategory] = useState<SupportTicketCategory>("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const {
    data,
    isLoading: ticketsLoading,
    isFetching,
    error: ticketsError,
    refetch,
  } = useApiQuery<{ items: SupportTicketSummary[] }>("/api/v1/support/tickets", {
    enabled: !!user,
  });
  const tickets = data?.items ?? [];
  const listError = ticketsError
    ? (ticketsError as any)?.body?.message ||
      (ticketsError as Error).message ||
      "Failed to load tickets."
    : "";

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  async function handleCreate() {
    setFormError("");
    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();
    if (trimmedSubject.length < 3 || trimmedSubject.length > 200) {
      setFormError("Subject must be between 3 and 200 characters.");
      return;
    }
    if (trimmedBody.length < 1 || trimmedBody.length > 10000) {
      setFormError("Message must be between 1 and 10,000 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<{ ticket: { id: string } }>(
        "/api/v1/support/tickets",
        {
          method: "POST",
          headers: {
            "x-app-version": APP_VERSION,
            "x-device-info": `web (${navigator.userAgent})`,
          },
          body: JSON.stringify({
            subject: trimmedSubject,
            body: trimmedBody,
            category,
          }),
        }
      );
      setNewOpen(false);
      setCategory("general");
      setSubject("");
      setBody("");
      refetch();
      if (res?.ticket?.id) {
        router.push(`/support/${res.ticket.id}`);
      }
    } catch (err: any) {
      setFormError(
        err instanceof ApiRequestError
          ? err.body?.message || err.body?.error || err.message
          : err?.message || "Failed to create ticket."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <LifeBuoy className="h-7 w-7" />
            Support
          </h1>
          <p className="text-muted-foreground">
            Contact our team and track your support tickets
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={ticketsLoading || isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New ticket
          </Button>
        </div>
      </div>

      {listError && (
        <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          {listError}
        </div>
      )}

      <div className="space-y-3">
        {ticketsLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading tickets…
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12">
            <LifeBuoy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No support tickets yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Click &quot;New ticket&quot; to contact our team.
            </p>
          </div>
        ) : (
          tickets.map((ticket) => (
            <Link key={ticket.id} href={`/support/${ticket.id}`} className="block">
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium truncate">{ticket.subject}</h3>
                        {statusBadge(ticket.status)}
                        <Badge variant="outline">
                          {categoryLabel(ticket.category)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last activity: {fmtDateTime(ticket.lastMessageAt || ticket.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {ticket.messageCount ?? 0} message
                          {ticket.messageCount === 1 ? "" : "s"}
                        </span>
                        {ticket.requesterEmail && (
                          <span>by {ticket.requesterEmail}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>

      {/* New ticket dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contact support</DialogTitle>
            <DialogDescription>
              Describe your issue and our team will get back to you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="ticket-category">Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as SupportTicketCategory)}
              >
                <SelectTrigger id="ticket-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORT_TICKET_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ticket-subject">Subject</Label>
              <Input
                id="ticket-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Short summary of your issue"
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {subject.length}/200 characters
              </p>
            </div>
            <div>
              <Label htmlFor="ticket-body">Message</Label>
              <textarea
                id="ticket-body"
                className="w-full border rounded-md p-2 min-h-[140px] bg-background text-foreground text-sm"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Describe the problem, what you expected, and any steps to reproduce…"
                maxLength={10000}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {body.length}/10,000 characters
              </p>
            </div>
            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? "Sending…" : "Send ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
