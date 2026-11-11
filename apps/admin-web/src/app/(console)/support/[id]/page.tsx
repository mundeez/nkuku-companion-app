"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { ImpersonateButton } from "@/components/impersonate-dialog";
import {
  assignTicket,
  getTicket,
  listStaff,
  replyTicket,
  setTicketStatus,
} from "@/lib/api/platform";
import type { StaffUser, TicketDetail, TicketStatus } from "@/lib/types";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  TICKET_STATUSES,
  TicketPriorityBadge,
  TicketStatusBadge,
} from "@/components/support/ticket-badges";
import { ArrowLeft, Building2, Lock, Send, User } from "lucide-react";

const UNASSIGNED = "unassigned";

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading, hasPermission } = useAuth();
  const id = String(params?.id ?? "");

  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Staff roster for the assign control — GET /staff needs staff.manage;
  // without it we show the assignee name but leave the control disabled.
  const [roster, setRoster] = useState<StaffUser[] | null>(null);
  const [rosterDenied, setRosterDenied] = useState(false);

  // composer
  const [reply, setReply] = useState("");
  const [internalNote, setInternalNote] = useState(false);

  const canWrite = hasPermission("support.tickets.write");
  const canImpersonate = hasPermission("tenants.impersonate");

  const load = useCallback(() => {
    if (!id) return;
    getTicket(id)
      .then(setDetail)
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (!hasPermission("support.tickets.read")) {
      router.replace("/");
      return;
    }
    load();
  }, [user, isLoading, hasPermission, load, router]);

  useEffect(() => {
    if (isLoading || !user || !canWrite) return;
    listStaff()
      .then((r) => setRoster(r.items.filter((s) => s.isActive)))
      .catch(() => setRosterDenied(true));
  }, [user, isLoading, canWrite]);

  async function doReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setError("");
    setNotice("");
    setBusy("reply");
    try {
      await replyTicket(id, { body: reply.trim(), internalNote: internalNote || undefined });
      setReply("");
      setInternalNote(false);
      setNotice(internalNote ? "Internal note added." : "Reply sent to the requester.");
      load();
    } catch (e: any) {
      setError(e.message || "Reply failed");
    } finally {
      setBusy(null);
    }
  }

  async function doAssign(staffId: string | null) {
    setError("");
    setNotice("");
    setBusy("assign");
    try {
      await assignTicket(id, staffId);
      setNotice(staffId ? "Ticket assigned." : "Ticket unassigned.");
      load();
    } catch (e: any) {
      setError(e.message || "Assignment failed");
    } finally {
      setBusy(null);
    }
  }

  async function doStatus(status: TicketStatus) {
    setError("");
    setNotice("");
    setBusy(`status:${status}`);
    try {
      await setTicketStatus(id, status);
      setNotice(`Status set to ${status.replace(/_/g, " ")}.`);
      load();
    } catch (e: any) {
      setError(e.message || "Status change failed");
    } finally {
      setBusy(null);
    }
  }

  if (isLoading || !user || (!detail && !error)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="space-y-4">
        <Link href="/support">
          <Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /> Back to inbox</Button>
        </Link>
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">{error || "Ticket not found"}</div>
      </div>
    );
  }

  const t = detail!.ticket;
  const org = t.organization;
  const requester = t.requester;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/support">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2">
            <ArrowLeft className="mr-1 h-4 w-4" /> Support inbox
          </Button>
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{t.subject}</h1>
          <TicketStatusBadge status={t.status} />
          <TicketPriorityBadge priority={t.priority} />
          <Badge variant="secondary">{t.category}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          opened {formatDateTime(t.createdAt)}
          {t.resolvedAt ? ` · resolved ${formatDateTime(t.resolvedAt)}` : ""}
          {` · id ${t.id}`}
        </p>
      </div>

      {notice && <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-400">{notice}</div>}
      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Thread + composer ── */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conversation ({detail!.messages.length})</CardTitle>
              <CardDescription>Internal notes are only visible to staff.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {detail!.messages.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No messages yet.</p>
              )}
              {detail!.messages.map((m) => {
                const staffMsg = m.authorType === "staff";
                const authorLabel = m.author?.name || m.author?.email || (staffMsg ? "staff" : "requester");
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[85%] rounded-lg border p-3",
                      m.internalNote
                        ? "ml-auto border-amber-500/50 bg-amber-500/10"
                        : staffMsg
                          ? "ml-auto border-primary/40 bg-primary/10"
                          : "border-border bg-muted/40"
                    )}
                  >
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{authorLabel}</span>
                      {staffMsg && <Badge variant="outline" className="px-1.5 py-0 text-[10px]">staff</Badge>}
                      {m.internalNote && (
                        <Badge variant="outline" className="gap-1 border-amber-500/50 px-1.5 py-0 text-[10px] text-amber-400">
                          <Lock className="h-3 w-3" /> internal
                        </Badge>
                      )}
                      <span className="ml-auto" title={formatDateTime(m.createdAt)}>
                        {timeAgo(m.createdAt)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Reply composer */}
          {canWrite && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Reply</CardTitle>
                <CardDescription>
                  Replies are emailed to the requester; internal notes stay in the console.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={doReply} className="space-y-3">
                  <Textarea
                    rows={4}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={internalNote ? "Note for staff only…" : "Reply to the requester…"}
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input"
                        checked={internalNote}
                        onChange={(e) => setInternalNote(e.target.checked)}
                      />
                      Send as internal note
                    </label>
                    <Button type="submit" disabled={busy !== null || !reply.trim()}>
                      <Send className="mr-2 h-4 w-4" />
                      {busy === "reply" ? "Sending…" : internalNote ? "Add note" : "Send reply"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Context column ── */}
        <div className="space-y-4">
          {/* Organization */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" /> Organization
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {org ? (
                <div className="space-y-2">
                  <Link href={`/tenants/${org.id}`} className="font-medium text-primary hover:underline">
                    {org.name}
                  </Link>
                  <div className="flex flex-wrap gap-1">
                    <Badge>{org.planCode}</Badge>
                    {(org.suspendedAt || org.suspended) && <Badge variant="destructive">suspended</Badge>}
                    {org.isDemo && <Badge variant="outline">demo</Badge>}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No organization linked.</p>
              )}
            </CardContent>
          </Card>

          {/* Requester */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" /> Requester
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {requester ? (
                <>
                  <div>
                    <div className="font-medium">{requester.name || requester.email}</div>
                    {requester.name && <div className="text-xs text-muted-foreground">{requester.email}</div>}
                    {requester.role && (
                      <Badge variant="secondary" className="mt-1">{requester.role}</Badge>
                    )}
                  </div>
                  {canImpersonate && org && (
                    <ImpersonateButton
                      orgId={org.id}
                      orgName={org.name}
                      targetUserId={requester.id}
                      targetEmail={requester.email}
                      defaultReason={`Ticket: ${t.subject}`}
                      ticketId={t.id}
                      onStarted={load}
                    />
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">No requester linked.</p>
              )}
            </CardContent>
          </Card>

          {/* Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assignment</CardTitle>
              <CardDescription>
                {rosterDenied
                  ? "Showing current assignee — roster requires staff.manage."
                  : "Assign to a staff member."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {canWrite ? (
                <Select
                  value={t.assignee?.id ?? UNASSIGNED}
                  onValueChange={(v) => doAssign(v === UNASSIGNED ? null : v)}
                  disabled={busy !== null || rosterDenied || roster === null}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                    {/* Keep the current assignee selectable even when the
                        roster is unavailable or they're inactive. */}
                    {t.assignee && !roster?.some((s) => s.id === t.assignee!.id) && (
                      <SelectItem value={t.assignee.id}>
                        {t.assignee.name || t.assignee.email}
                      </SelectItem>
                    )}
                    {roster?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name || s.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t.assignee ? `Assigned to ${t.assignee.name || t.assignee.email}` : "Unassigned"}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Status */}
          {canWrite && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {TICKET_STATUSES.map((s) => (
                  <Button
                    key={s.value}
                    variant={t.status === s.value ? "default" : "outline"}
                    size="sm"
                    disabled={busy !== null || t.status === s.value}
                    onClick={() => doStatus(s.value)}
                  >
                    {busy === `status:${s.value}` ? "…" : s.label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
