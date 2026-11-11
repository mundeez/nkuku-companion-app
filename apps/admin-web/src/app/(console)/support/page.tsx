"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { listStaff, listTickets } from "@/lib/api/platform";
import type { Paged, StaffUser, TicketListItem } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TICKET_STATUSES,
  TicketPriorityBadge,
  TicketStatusBadge,
} from "@/components/support/ticket-badges";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

const PAGE_SIZE = 20;
const ALL = "__all__";
const ME = "__me__";
const UNASSIGNED = "unassigned";

function SupportInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, isLoading, hasPermission } = useAuth();

  const status = params.get("status") ?? "";
  const assigned = params.get("assigned") ?? "";
  const search = params.get("search") ?? "";
  const orgId = params.get("orgId") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? "1"));

  const [searchInput, setSearchInput] = useState(search);
  const [data, setData] = useState<Paged<TicketListItem> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Staff roster for the assignee filter — GET /staff needs staff.manage;
  // degrade to All/Unassigned/Me when the caller lacks it.
  const [roster, setRoster] = useState<StaffUser[] | null>(null);

  const setQuery = useCallback(
    (patch: Record<string, string | number | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      router.replace(`/support?${next.toString()}`);
    },
    [params, router]
  );

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if (isLoading || !user) return;
    listStaff()
      .then((r) => setRoster(r.items.filter((s) => s.isActive)))
      .catch(() => setRoster([])); // 403 or offline — filter degrades
  }, [user, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (!hasPermission("support.tickets.read")) {
      router.replace("/");
      return;
    }
    setLoading(true);
    listTickets({
      status: status || undefined,
      // "me" is resolved client-side so the API always sees a real staff id
      assigned:
        assigned === ME
          ? user.id
          : assigned || undefined,
      orgId: orgId || undefined,
      search: search || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading, status, assigned, orgId, search, page]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery({ search: searchInput || undefined, page: 1 });
  }

  if (isLoading || !user) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Support Inbox</h1>
        <p className="text-muted-foreground">Tenant support tickets across all organizations</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {data ? `${data.total} tickets` : "Tickets"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status chips */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setQuery({ status: undefined, page: 1 })}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                !status
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              All
            </button>
            {TICKET_STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => setQuery({ status: s.value, page: 1 })}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  status === s.value
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <form onSubmit={submitSearch} className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search subject or requester…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </form>
            <Select
              value={assigned || ALL}
              onValueChange={(v) => setQuery({ assigned: v === ALL ? undefined : v, page: 1 })}
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All assignees</SelectItem>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                <SelectItem value={ME}>Assigned to me</SelectItem>
                {roster?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name || s.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {orgId && (
              <Badge variant="outline" className="gap-1">
                org {orgId.slice(0, 8)}…
                <button
                  className="ml-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setQuery({ orgId: undefined, page: 1 })}
                  title="Clear organization filter"
                >
                  ×
                </button>
              </Badge>
            )}
          </div>

          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No tickets match these filters.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Subject</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Org</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Requester</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Category</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Status</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Priority</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Last activity</th>
                      <th className="pb-2 font-medium text-muted-foreground">Assignee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((t) => (
                      <tr
                        key={t.id}
                        className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/40"
                        onClick={() => router.push(`/support/${t.id}`)}
                      >
                        <td className="max-w-[260px] py-2.5 pr-4 font-medium">
                          <div className="truncate" title={t.subject}>
                            {t.awaitingStaffReply && (
                              <span
                                className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle"
                                title="Awaiting staff reply"
                              />
                            )}
                            {t.subject}
                          </div>
                          <div className="text-xs font-normal text-muted-foreground">
                            {t.messageCount} message{t.messageCount === 1 ? "" : "s"}
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground">
                          {t.organization?.name ?? "—"}
                        </td>
                        <td className="py-2.5 pr-4">
                          {t.requester ? (
                            <>
                              <div>{t.requester.name || t.requester.email}</div>
                              {t.requester.name && (
                                <div className="text-xs text-muted-foreground">{t.requester.email}</div>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2.5 pr-4">
                          <Badge variant="secondary">{t.category}</Badge>
                        </td>
                        <td className="py-2.5 pr-4">
                          <TicketStatusBadge status={t.status} />
                        </td>
                        <td className="py-2.5 pr-4">
                          <TicketPriorityBadge priority={t.priority} />
                        </td>
                        <td className="whitespace-nowrap py-2.5 pr-4 text-muted-foreground">
                          {timeAgo(t.lastMessageAt ?? t.createdAt)}
                        </td>
                        <td className="py-2.5">
                          {t.assignee ? (
                            <span>{t.assignee.name || t.assignee.email}</span>
                          ) : (
                            <span className="text-muted-foreground">unassigned</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Page {data.page} of {data.totalPages} ({data.total} total)
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setQuery({ page: page - 1 })}
                  >
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.totalPages}
                    onClick={() => setQuery({ page: page + 1 })}
                  >
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

export default function SupportPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <SupportInner />
    </Suspense>
  );
}
