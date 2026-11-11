"use client";

import { Fragment, Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { useReauth } from "@/components/reauth-modal";
import { listComms, resendComms } from "@/lib/api/platform";
import type { CommsLogItem, Paged } from "@/lib/types";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  RotateCw,
  Search,
} from "lucide-react";

const PAGE_SIZE = 20;
const ALL = "__all__";

const CHANNELS = ["email", "sms", "push"];
// Matches the API's status enum — other values are rejected by validation.
const STATUSES = ["sent", "failed", "bounced"];
const RESENDABLE_STATUSES = ["failed", "sent"];

function commsStatusBadge(status: string) {
  switch (status) {
    case "delivered":
    case "sent":
      return <Badge variant="default">{status}</Badge>;
    case "queued":
      return <Badge variant="secondary">{status}</Badge>;
    case "failed":
    case "bounced":
      return <Badge variant="destructive">{status}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function CommsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, isLoading, hasPermission } = useAuth();
  const { withReauth } = useReauth();

  const channel = params.get("channel") ?? "";
  const status = params.get("status") ?? "";
  const orgId = params.get("orgId") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? "1"));

  const [filters, setFilters] = useState({ status, orgId, from, to });
  const [data, setData] = useState<Paged<CommsLogItem> | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [resendTarget, setResendTarget] = useState<CommsLogItem | null>(null);
  const [busy, setBusy] = useState(false);

  const canResend = hasPermission("comms.resend");

  const setQuery = useCallback(
    (patch: Record<string, string | number | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      router.replace(`/comms?${next.toString()}`);
    },
    [params, router]
  );

  useEffect(() => {
    setFilters({ status, orgId, from, to });
  }, [status, orgId, from, to]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (!hasPermission("comms.log.read")) {
      router.replace("/");
      return;
    }
    setLoading(true);
    listComms({
      channel: channel || undefined,
      status: status || undefined,
      orgId: orgId || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading, channel, status, orgId, from, to, page]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setQuery({
      status: filters.status || undefined,
      orgId: filters.orgId || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      page: 1,
    });
  }

  async function doResend() {
    if (!resendTarget) return;
    setError("");
    setBusy(true);
    try {
      await withReauth(() => resendComms(resendTarget.id));
      setNotice(`Resent ${resendTarget.channel} to ${resendTarget.toAddr}.`);
      setResendTarget(null);
    } catch (e: any) {
      if (e?.code !== "CANCELLED") setError(e.message || "Resend failed");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !user) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Comms Log</h1>
        <p className="text-muted-foreground">Outbound email, SMS and push messages sent by the platform</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {data ? `${data.total} messages` : "Messages"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Channel chips */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setQuery({ channel: undefined, page: 1 })}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                !channel
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              All channels
            </button>
            {CHANNELS.map((c) => (
              <button
                key={c}
                onClick={() => setQuery({ channel: c, page: 1 })}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                  channel === c
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Filters */}
          <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select
                value={filters.status || ALL}
                onValueChange={(v) => setFilters((f) => ({ ...f, status: v === ALL ? "" : v }))}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="f-org" className="text-xs">Org ID</Label>
              <Input
                id="f-org"
                className="w-56 font-mono text-xs"
                placeholder="uuid"
                value={filters.orgId}
                onChange={(e) => setFilters((f) => ({ ...f, orgId: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="f-from" className="text-xs">From</Label>
              <Input
                id="f-from"
                type="date"
                value={filters.from}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="f-to" className="text-xs">To</Label>
              <Input
                id="f-to"
                type="date"
                value={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              />
            </div>
            <Button type="submit" variant="secondary" size="sm" className="h-10">
              <Search className="mr-2 h-4 w-4" /> Apply
            </Button>
            {(status || orgId || from || to || channel) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10"
                onClick={() => {
                  setFilters({ status: "", orgId: "", from: "", to: "" });
                  router.replace("/comms");
                }}
              >
                Clear
              </Button>
            )}
          </form>

          {notice && <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-400">{notice}</div>}
          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No messages match these filters.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">When</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Channel</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">To</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Subject / Template</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Status</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Org</th>
                      <th className="pb-2 font-medium text-muted-foreground"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((m) => {
                      const open = !!expanded[m.id];
                      const resendable = RESENDABLE_STATUSES.includes(m.status);
                      const resendDisabled = m.channel !== "email" || m.hasBody === false;
                      const resendHint =
                        m.channel !== "email"
                          ? "Resend is only supported for email"
                          : m.hasBody === false
                            ? "No stored body to re-deliver"
                            : "Resend this message";
                      return (
                        <Fragment key={m.id}>
                          <tr className="border-b align-top">
                            <td className="whitespace-nowrap py-2.5 pr-4 text-muted-foreground" title={formatDateTime(m.createdAt)}>
                              {timeAgo(m.createdAt)}
                            </td>
                            <td className="py-2.5 pr-4">
                              <Badge variant="secondary" className="capitalize">{m.channel}</Badge>
                            </td>
                            <td className="max-w-[200px] truncate py-2.5 pr-4" title={m.toAddr}>
                              {m.toAddr}
                            </td>
                            <td className="max-w-[240px] py-2.5 pr-4">
                              <div className="truncate" title={m.subject ?? ""}>{m.subject ?? "—"}</div>
                              {m.template && (
                                <div className="truncate font-mono text-xs text-muted-foreground" title={m.template}>
                                  {m.template}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 pr-4">
                              {commsStatusBadge(m.status)}
                              {m.resendOfId && (
                                <div className="text-xs text-muted-foreground">resend</div>
                              )}
                            </td>
                            <td className="py-2.5 pr-4 text-muted-foreground">
                              {m.organizationId ? (
                                <Link href={`/tenants/${m.organizationId}`} className="text-xs text-primary hover:underline">
                                  {m.organization?.name ?? `${String(m.organizationId).slice(0, 8)}…`}
                                </Link>
                              ) : "—"}
                            </td>
                            <td className="py-2.5">
                              <div className="flex items-center gap-1">
                                {m.error && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title="Show error"
                                    onClick={() => setExpanded((x) => ({ ...x, [m.id]: !open }))}
                                  >
                                    {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </Button>
                                )}
                                {canResend && resendable && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title={resendHint}
                                    disabled={resendDisabled || busy}
                                    onClick={() => {
                                      setResendTarget(m);
                                      setError("");
                                    }}
                                  >
                                    <RotateCw className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {open && m.error && (
                            <tr className="border-b bg-muted/30">
                              <td colSpan={7} className="p-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="sm:col-span-2">
                                    <div className="mb-1 text-xs font-medium text-muted-foreground">Error</div>
                                    <pre className="max-h-48 overflow-auto rounded-md bg-muted p-2 text-xs">
                                      {m.error}
                                    </pre>
                                  </div>
                                  {m.providerRef && (
                                    <div>
                                      <div className="mb-1 text-xs font-medium text-muted-foreground">Provider ref</div>
                                      <div className="font-mono text-xs">{m.providerRef}</div>
                                    </div>
                                  )}
                                  {m.sentByStaff && (
                                    <div>
                                      <div className="mb-1 text-xs font-medium text-muted-foreground">Sent by</div>
                                      <div className="text-xs">{m.sentByStaff.name || m.sentByStaff.email}</div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Page {data.page} of {data.totalPages} ({data.total} total)
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setQuery({ page: page - 1 })}>
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setQuery({ page: page + 1 })}>
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Resend confirm dialog */}
      <Dialog open={!!resendTarget} onOpenChange={(v) => !v && setResendTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resend message</DialogTitle>
            <DialogDescription>
              Queue a fresh {resendTarget?.channel} to{" "}
              <strong>{resendTarget?.toAddr}</strong>
              {resendTarget?.subject ? ` — "${resendTarget.subject}"` : ""}. Requires
              re-authentication and is audit-logged.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResendTarget(null)}>Cancel</Button>
            <Button onClick={doResend} disabled={busy}>
              {busy ? "Resending…" : "Resend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CommsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <CommsInner />
    </Suspense>
  );
}
