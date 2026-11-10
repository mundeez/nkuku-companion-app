"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { listTenants } from "@/lib/api/platform";
import type { Paged, TenantListItem } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";

const PAGE_SIZE = 20;
const ALL = "__all__";

const SORTABLE: Record<string, string> = {
  name: "Name",
  planCode: "Plan",
  createdAt: "Created",
  userCount: "Users",
  flockCount: "Flocks",
};

function TenantsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, isLoading, hasPermission } = useAuth();

  const search = params.get("search") ?? "";
  const plan = params.get("plan") ?? "";
  const status = params.get("status") ?? "";
  const sortBy = params.get("sortBy") ?? "createdAt";
  const sortDir = (params.get("sortDir") ?? "desc") as "asc" | "desc";
  const page = Math.max(1, Number(params.get("page") ?? "1"));

  const [searchInput, setSearchInput] = useState(search);
  const [data, setData] = useState<Paged<TenantListItem> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const setQuery = useCallback(
    (patch: Record<string, string | number | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      router.replace(`/tenants?${next.toString()}`);
    },
    [params, router]
  );

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (!hasPermission("tenants.read")) {
      router.replace("/");
      return;
    }
    setLoading(true);
    listTenants({
      search: search || undefined,
      plan: plan || undefined,
      status: status || undefined,
      sortBy,
      sortDir,
      page,
      pageSize: PAGE_SIZE,
    })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading, search, plan, status, sortBy, sortDir, page]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery({ search: searchInput || undefined, page: 1 });
  }

  function toggleSort(field: string) {
    if (sortBy === field) {
      setQuery({ sortDir: sortDir === "asc" ? "desc" : "asc", page: 1 });
    } else {
      setQuery({ sortBy: field, sortDir: field === "name" ? "asc" : "desc", page: 1 });
    }
  }

  function SortIcon({ field }: { field: string }) {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  }

  if (isLoading || !user) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tenants</h1>
        <p className="text-muted-foreground">All customer organizations on the platform</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {data ? `${data.total} organizations` : "Organizations"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <form onSubmit={submitSearch} className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search name or plan…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </form>
            <Select value={plan || ALL} onValueChange={(v) => setQuery({ plan: v === ALL ? undefined : v, page: 1 })}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All plans</SelectItem>
                <SelectItem value="free">free</SelectItem>
                <SelectItem value="grower">grower</SelectItem>
                <SelectItem value="business">business</SelectItem>
                <SelectItem value="enterprise">enterprise</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status || ALL} onValueChange={(v) => setQuery({ status: v === ALL ? undefined : v, page: 1 })}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Subscription status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectItem value="active">active</SelectItem>
                <SelectItem value="trialing">trialing</SelectItem>
                <SelectItem value="past_due">past_due</SelectItem>
                <SelectItem value="suspended">suspended</SelectItem>
                <SelectItem value="cancelled">cancelled</SelectItem>
                <SelectItem value="none">no subscription</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No organizations match these filters.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      {(["name", "planCode", "createdAt", "userCount", "flockCount"] as const).map((f) => (
                        <th key={f} className="pb-2 pr-4 font-medium text-muted-foreground">
                          <button onClick={() => toggleSort(f)} className="inline-flex items-center gap-1 hover:text-foreground">
                            {SORTABLE[f]} <SortIcon field={f} />
                          </button>
                        </th>
                      ))}
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Sub Status</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((t) => (
                      <tr
                        key={t.id}
                        className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/40"
                        onClick={() => router.push(`/tenants/${t.id}`)}
                      >
                        <td className="py-2.5 pr-4 font-medium">{t.name}</td>
                        <td className="py-2.5 pr-4">{t.planCode}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{formatDate(t.createdAt)}</td>
                        <td className="py-2.5 pr-4">{t.userCount}</td>
                        <td className="py-2.5 pr-4">{t.flockCount}</td>
                        <td className="py-2.5 pr-4">
                          {t.subscription ? (
                            <Badge
                              variant={
                                t.subscription.status === "active"
                                  ? "default"
                                  : t.subscription.status === "past_due"
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {t.subscription.status}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4">
                          <div className="flex gap-1">
                            {t.suspendedAt && <Badge variant="destructive">suspended</Badge>}
                            {t.override && <Badge variant="outline" className="border-amber-500/50 text-amber-400">override</Badge>}
                          </div>
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

export default function TenantsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <TenantsInner />
    </Suspense>
  );
}
