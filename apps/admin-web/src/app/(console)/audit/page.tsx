"use client";

import { Fragment, Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { listAuditEvents } from "@/lib/api/platform";
import type { AuditEvent, Paged } from "@/lib/types";
import { formatDateTime, timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Search,
} from "lucide-react";

const PAGE_SIZE = 20;

function JsonBlock({ label, value }: { label: string; value: any }) {
  if (value === undefined || value === null) return null;
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      <pre className="max-h-48 overflow-auto rounded-md bg-muted p-2 text-xs">
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function AuditInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, isLoading, hasPermission } = useAuth();

  const action = params.get("action") ?? "";
  const actor = params.get("actor") ?? "";
  const orgId = params.get("orgId") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? "1"));

  const [filters, setFilters] = useState({ action, actor, orgId, from, to });
  const [data, setData] = useState<Paged<AuditEvent> | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const setQuery = useCallback(
    (patch: Record<string, string | number | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      router.replace(`/audit?${next.toString()}`);
    },
    [params, router]
  );

  useEffect(() => {
    setFilters({ action, actor, orgId, from, to });
  }, [action, actor, orgId, from, to]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (!hasPermission("audit.read")) {
      router.replace("/");
      return;
    }
    setLoading(true);
    listAuditEvents({
      action: action || undefined,
      actor: actor || undefined,
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
  }, [user, isLoading, action, actor, orgId, from, to, page]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setQuery({
      action: filters.action || undefined,
      actor: filters.actor || undefined,
      orgId: filters.orgId || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      page: 1,
    });
  }

  if (isLoading || !user) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Platform Audit Log</h1>
        <p className="text-muted-foreground">Append-only record of every staff action</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {data ? `${data.total} events` : "Events"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="f-action" className="text-xs">Action</Label>
              <Input
                id="f-action"
                className="w-44"
                placeholder="e.g. staff.invite"
                value={filters.action}
                onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="f-actor" className="text-xs">Actor</Label>
              <Input
                id="f-actor"
                className="w-44"
                placeholder="email or staff id"
                value={filters.actor}
                onChange={(e) => setFilters((f) => ({ ...f, actor: e.target.value }))}
              />
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
            {(action || actor || orgId || from || to) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10"
                onClick={() => {
                  setFilters({ action: "", actor: "", orgId: "", from: "", to: "" });
                  router.replace("/audit");
                }}
              >
                Clear
              </Button>
            )}
          </form>

          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !data || data.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No audit events match these filters.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">When</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Actor</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Action</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Target</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Org</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Reason</th>
                      <th className="pb-2 font-medium text-muted-foreground"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((ev) => {
                      const open = !!expanded[ev.id];
                      const hasDetail = ev.before !== undefined || ev.after !== undefined || ev.ip || ev.userAgent;
                      return (
                        <Fragment key={ev.id}>
                          <tr className="border-b align-top">
                            <td className="whitespace-nowrap py-2.5 pr-4 text-muted-foreground" title={formatDateTime(ev.occurredAt)}>
                              {timeAgo(ev.occurredAt)}
                            </td>
                            <td className="py-2.5 pr-4">
                              <div className="font-medium">{ev.actorEmail ?? ev.actor ?? ev.actorStaffId ?? "system"}</div>
                              {ev.actorRole && <div className="text-xs text-muted-foreground">{ev.actorRole}</div>}
                            </td>
                            <td className="py-2.5 pr-4">
                              <Badge variant="secondary" className="font-mono text-[11px]">{ev.action}</Badge>
                            </td>
                            <td className="py-2.5 pr-4 text-muted-foreground">
                              {ev.targetType ? `${ev.targetType} ` : ""}
                              {ev.targetId && <span className="font-mono text-xs">{String(ev.targetId).slice(0, 8)}…</span>}
                            </td>
                            <td className="py-2.5 pr-4 text-muted-foreground">
                              {ev.organizationId ? (
                                <Link href={`/tenants/${ev.organizationId}`} className="font-mono text-xs text-primary hover:underline">
                                  {ev.organizationName ?? `${String(ev.organizationId).slice(0, 8)}…`}
                                </Link>
                              ) : "—"}
                            </td>
                            <td className="max-w-[220px] truncate py-2.5 pr-4 text-muted-foreground" title={ev.reason ?? ""}>
                              {ev.reason ?? "—"}
                            </td>
                            <td className="py-2.5">
                              {hasDetail && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setExpanded((x) => ({ ...x, [ev.id]: !open }))}
                                >
                                  {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                              )}
                            </td>
                          </tr>
                          {open && (
                            <tr className="border-b bg-muted/30">
                              <td colSpan={7} className="p-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <JsonBlock label="Before" value={ev.before} />
                                  <JsonBlock label="After" value={ev.after} />
                                  <JsonBlock label="IP" value={ev.ip} />
                                  <JsonBlock label="User agent" value={ev.userAgent} />
                                  <JsonBlock label="Impersonation session" value={ev.impersonationSessionId} />
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
    </div>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AuditInner />
    </Suspense>
  );
}
