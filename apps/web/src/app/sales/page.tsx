"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { useApiQuery, useApiMutation, useFlocks } from "@/lib/api/hooks";
import { SaleRecord, SalesDashboardSummary, BroilerFlock, PaginatedSales, SalesFilter, PaymentStatus } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DollarSign, Bird, TrendingUp, AlertCircle, Plus, Trash2, Pencil, ChevronLeft, ChevronRight as ChevronRightIcon, ArrowUp, ArrowDown } from "lucide-react";
import { SalesFilterBar } from "@/components/sales/sales-filter-bar";
import { SaleDetailDrawer } from "@/components/sales/sale-detail-drawer";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function buildFilterParams(filter: SalesFilter): string {
  const params = new URLSearchParams();
  if (filter.fromDate) params.set("fromDate", filter.fromDate);
  if (filter.toDate) params.set("toDate", filter.toDate);
  if (filter.paymentStatus) params.set("paymentStatus", filter.paymentStatus);
  if (filter.flockId) params.set("flockId", filter.flockId);
  if (filter.customer) params.set("customer", filter.customer);
  if (filter.sortBy) { params.set("sortBy", filter.sortBy); params.set("sortDir", filter.sortDir ?? "desc"); }
  params.set("limit", String(filter.limit ?? PAGE_SIZE));
  params.set("offset", String(filter.offset ?? 0));
  return params.toString();
}

export default function SalesDashboardPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<SaleRecord | null>(null);
  const [drawerSale, setDrawerSale] = useState<SaleRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filter, setFilter] = useState<SalesFilter>({ limit: PAGE_SIZE, offset: 0 });
  const [form, setForm] = useState({
    flockId: "",
    saleDate: new Date().toISOString().split("T")[0],
    customerName: "",
    customerPhone: "",
    birdCount: "",
    avgWeightKg: "",
    pricePerBirdZmw: "",
    paymentStatus: "pending" as PaymentStatus,
    amountPaidZmw: "",
    notes: "",
  });

  // Build query paths from filter
  const dashboardPath = `/api/v1/sale-records/dashboard?${buildFilterParams({ ...filter, limit: undefined, offset: undefined })}`;
  const salesPath = `/api/v1/sale-records/all?${buildFilterParams(filter)}`;

  // TanStack Query hooks — cached, auto-refreshing, offline-first
  // Low staleTime so invalidation triggers immediate refetch after CRUD
  const { data: summary, error: summaryError } = useApiQuery<SalesDashboardSummary>(dashboardPath, { staleTime: 5 * 1000 });
  const { data: salesData, error: salesError } = useApiQuery<PaginatedSales>(salesPath, { staleTime: 5 * 1000 });
  const { data: flocksData = [] } = useFlocks();

  const flocks = flocksData as BroilerFlock[];
  const sales = salesData?.data ?? [];
  const totalSales = salesData?.total ?? 0;
  const error = summaryError?.message || salesError?.message || "";

  // QueryClient for explicit refetch after mutations
  const queryClient = useQueryClient();

  // Mutations — invalidate and refetch all sales-related queries
  const createSale = useApiMutation("POST", {
    invalidatePaths: ["/api/v1/sale-records", "/api/v1/sale-records/dashboard", "/api/v1/sale-records/summary", "/api/v1/dashboard/summary"],
    onSuccess: () => {
      queryClient.refetchQueries({ predicate: (q) => {
        const k = q.queryKey?.[0] as string;
        return typeof k === "string" && (k.startsWith("/api/v1/sale-records") || k.startsWith("/api/v1/dashboard"));
      }});
    },
  });
  const updateSale = useApiMutation("PATCH", {
    invalidatePaths: ["/api/v1/sale-records", "/api/v1/sale-records/dashboard", "/api/v1/sale-records/summary"],
    onSuccess: () => {
      queryClient.refetchQueries({ predicate: (q) => {
        const k = q.queryKey?.[0] as string;
        return typeof k === "string" && (k.startsWith("/api/v1/sale-records") || k.startsWith("/api/v1/dashboard"));
      }});
    },
  });
  const deleteSale = useApiMutation("DELETE", {
    invalidatePaths: ["/api/v1/sale-records", "/api/v1/sale-records/dashboard", "/api/v1/sale-records/summary"],
    onSuccess: () => {
      queryClient.refetchQueries({ predicate: (q) => {
        const k = q.queryKey?.[0] as string;
        return typeof k === "string" && (k.startsWith("/api/v1/sale-records") || k.startsWith("/api/v1/dashboard"));
      }});
    },
  });
  const saving = createSale.isPending || updateSale.isPending || deleteSale.isPending;

  const canEditSales = user?.role === "owner" || user?.role === "manager" || user?.role === "sales_person";

  const currentPage = Math.floor((filter.offset ?? 0) / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(totalSales / PAGE_SIZE));

  function toggleSort(field: string) {
    const currentSort = filter.sortBy ?? "saleDate";
    const currentDir = filter.sortDir ?? "desc";
    if (currentSort === field) {
      setFilter({ ...filter, sortBy: field, sortDir: currentDir === "asc" ? "desc" : "asc", offset: 0 });
    } else {
      setFilter({ ...filter, sortBy: field, sortDir: field === "saleDate" ? "desc" : "asc", offset: 0 });
    }
  }

  function SortHeader({ field, label, className }: { field: string; label: string; className?: string }) {
    const isActive = (filter.sortBy ?? "saleDate") === field;
    const currentDir = filter.sortDir ?? "desc";
    return (
      <th className={`p-2 ${className ?? ""}`}>
        <button
          onClick={() => toggleSort(field)}
          className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${isActive ? "text-foreground font-semibold" : "text-muted-foreground"}`}
        >
          {label}
          {isActive && (currentDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        </button>
      </th>
    );
  }

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (user && !["owner", "manager", "sales_person"].includes(user.role)) {
      router.push("/"); return;
    }
  }, [user, isLoading, router]);

  function openCreate() {
    setEditRecord(null);
    setForm({
      flockId: "",
      saleDate: new Date().toISOString().split("T")[0],
      customerName: "",
      customerPhone: "",
      birdCount: "",
      avgWeightKg: "",
      pricePerBirdZmw: "",
      paymentStatus: "pending",
      amountPaidZmw: "",
      notes: "",
    });
    setCreateOpen(true);
  }

  function openEdit(record: SaleRecord) {
    setEditRecord(record);
    setForm({
      flockId: record.flockId,
      saleDate: new Date(record.saleDate).toISOString().split("T")[0],
      customerName: record.customerName || "",
      customerPhone: record.customerPhone || "",
      birdCount: String(record.birdCount),
      avgWeightKg: record.avgWeightKg ? String(record.avgWeightKg) : "",
      pricePerBirdZmw: String(record.pricePerBirdZmw),
      paymentStatus: record.paymentStatus,
      amountPaidZmw: record.amountPaidZmw ? String(record.amountPaidZmw) : "",
      notes: record.notes || "",
    });
    setCreateOpen(true);
  }

  async function handleSave() {
    try {
      const birdCount = Number(form.birdCount);
      const pricePerBird = Number(form.pricePerBirdZmw);
      const total = birdCount * pricePerBird;
      const body: any = {
        flockId: form.flockId,
        saleDate: form.saleDate,
        customerName: form.customerName || undefined,
        customerPhone: form.customerPhone || undefined,
        birdCount,
        avgWeightKg: form.avgWeightKg ? Number(form.avgWeightKg) : undefined,
        pricePerBirdZmw: pricePerBird,
        totalAmountZmw: total,
        paymentStatus: form.paymentStatus,
        notes: form.notes || undefined,
      };
      // Only send amountPaidZmw for partial; API auto-sets for paid/pending
      if (form.paymentStatus === "partial" && form.amountPaidZmw) {
        body.amountPaidZmw = Number(form.amountPaidZmw);
      }
      if (editRecord) {
        await updateSale.mutateAsync({ path: `/api/v1/sale-records/${editRecord.id}`, body });
      } else {
        await createSale.mutateAsync({ path: "/api/v1/sale-records", body });
      }
      setCreateOpen(false);
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this sale record? This will restore the bird count to the flock.")) return;
    try {
      await deleteSale.mutateAsync({ path: `/api/v1/sale-records/${id}` });
    } catch (e: any) {
      alert(e.message);
    }
  }

  // Auto-fill amountPaidZmw when status is paid
  const computedTotal = (Number(form.birdCount) || 0) * (Number(form.pricePerBirdZmw) || 0);
  const effectiveAmountPaid = form.paymentStatus === "paid"
    ? String(computedTotal)
    : form.amountPaidZmw;

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  const availableFlocks = flocks.filter((f) => f.currentCount > 0 && f.startDate);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Sales Dashboard</h1>
          <p className="text-muted-foreground">Track bird sales, revenue, and customer payments</p>
        </div>
        {canEditSales && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> New Sale
          </Button>
        )}
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {/* Filter Bar */}
      <SalesFilterBar filter={filter} onChange={setFilter} flocks={flocks} showFlockFilter={true} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Total Revenue</span></div>
          <p className="text-2xl font-bold mt-1">ZMW {summary?.totalRevenue?.toFixed(2) || "0.00"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2"><Bird className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Birds Sold</span></div>
          <p className="text-2xl font-bold mt-1">{summary?.totalBirdsSold || 0}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Avg Price/Bird</span></div>
          <p className="text-2xl font-bold mt-1">ZMW {summary?.avgPricePerBird?.toFixed(2) || "0.00"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Outstanding</span></div>
          <p className="text-2xl font-bold mt-1 text-amber-600">ZMW {summary?.outstanding?.toFixed(2) || "0.00"}</p>
        </CardContent></Card>
      </div>

      {/* Payment Status Breakdown */}
      {summary && summary.paymentBreakdown.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Payment Status</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              {summary.paymentBreakdown.map((p) => (
                <div key={p.paymentStatus} className="flex items-center gap-2">
                  <Badge variant={p.paymentStatus === "paid" ? "default" : p.paymentStatus === "partial" ? "secondary" : "outline"}>
                    {p.paymentStatus}
                  </Badge>
                  <span className="text-sm">{p.count} sales — ZMW {p.totalAmount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Customers */}
      {summary && summary.topCustomers.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Top Customers</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.topCustomers.map((c, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="font-medium">{c.customerName || "Walk-in"}</span>
                  <span>{c.saleCount} sales — ZMW {c.totalAmount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sales Records Table */}
      <Card>
        <CardHeader><CardTitle>Sale Records ({totalSales})</CardTitle></CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <p className="text-muted-foreground">No sales records found for the current filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b text-left">
                    <SortHeader field="saleDate" label="Date" />
                    <SortHeader field="flockName" label="Flock" />
                    <SortHeader field="customerName" label="Customer" />
                    <SortHeader field="birdCount" label="Birds" />
                    <SortHeader field="pricePerBirdZmw" label="Price/Bird" />
                    <SortHeader field="totalAmountZmw" label="Total" />
                    <SortHeader field="paymentStatus" label="Payment" className="min-w-[160px]" />
                    {canEditSales && <th className="p-2">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => {
                    const paid = Number(s.amountPaidZmw ?? 0);
                    const total = Number(s.totalAmountZmw);
                    const remaining = total - paid;
                    const pctPaid = total > 0 ? (paid / total) * 100 : 0;
                    const statusColor = s.paymentStatus === "paid" ? "bg-green-500" : s.paymentStatus === "partial" ? "bg-amber-500" : "bg-red-500";
                    const barColor = s.paymentStatus === "paid" ? "bg-green-500" : s.paymentStatus === "partial" ? "bg-amber-500" : "bg-red-500";

                    return (
                      <tr
                        key={s.id}
                        className="border-b last:border-0 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => { setDrawerSale(s); setDrawerOpen(true); }}
                      >
                        <td className="p-2">{new Date(s.saleDate).toLocaleDateString()}</td>
                        <td className="p-2">{s.flock?.name || "-"}</td>
                        <td className="p-2">{s.customerName || "Walk-in"}</td>
                        <td className="p-2">{s.birdCount}</td>
                        <td className="p-2">ZMW {Number(s.pricePerBirdZmw).toFixed(2)}</td>
                        <td className="p-2 font-medium">ZMW {total.toFixed(2)}</td>
                        <td className="p-2 min-w-[160px]" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className={cn("h-2 w-2 rounded-full", statusColor)} />
                              <span className="text-xs font-medium capitalize">{s.paymentStatus}</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                              <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pctPaid}%` }} />
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>ZMW {paid.toFixed(2)}</span>
                              <span>ZMW {total.toFixed(2)}</span>
                            </div>
                            {s.paymentStatus === "partial" && (
                              <span className="text-xs text-amber-600 font-medium">ZMW {remaining.toFixed(2)} remaining</span>
                            )}
                          </div>
                        </td>
                        {canEditSales && (
                          <td className="p-2" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              {user?.role === "owner" && (
                                <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalSales > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages} ({totalSales} total)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(filter.offset ?? 0) === 0}
                  onClick={() => setFilter({ ...filter, offset: Math.max(0, (filter.offset ?? 0) - PAGE_SIZE) })}
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setFilter({ ...filter, offset: (filter.offset ?? 0) + PAGE_SIZE })}
                >
                  Next <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Sale Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>{editRecord ? "Edit Sale" : "New Sale"}</DialogTitle>
            <DialogDescription>{editRecord ? "Update sale record" : "Record a new bird sale"}</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-4 space-y-4">
            <div>
              <Label>Flock</Label>
              <select
                className="w-full border rounded-md p-2 bg-background text-foreground"
                value={form.flockId}
                onChange={(e) => setForm({ ...form, flockId: e.target.value })}
                disabled={!!editRecord}
              >
                <option value="">Select flock...</option>
                {availableFlocks.map((f) => (
                  <option key={f.id} value={f.id}>{f.name} ({f.currentCount} available)</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Sale Date</Label>
              <Input type="date" value={form.saleDate} onChange={(e) => setForm({ ...form, saleDate: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Customer Name</Label>
                <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Walk-in" />
              </div>
              <div>
                <Label>Customer Phone</Label>
                <Input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Bird Count</Label>
                <Input type="number" value={form.birdCount} onChange={(e) => setForm({ ...form, birdCount: e.target.value })} />
              </div>
              <div>
                <Label>Avg Weight (kg)</Label>
                <Input type="number" step="0.01" value={form.avgWeightKg} onChange={(e) => setForm({ ...form, avgWeightKg: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Price per Bird (ZMW)</Label>
              <Input type="number" step="0.01" value={form.pricePerBirdZmw} onChange={(e) => setForm({ ...form, pricePerBirdZmw: e.target.value })} />
              {form.birdCount && form.pricePerBirdZmw && (
                <p className="text-xs text-muted-foreground mt-1">Total: ZMW {computedTotal.toFixed(2)}</p>
              )}
            </div>
            <div>
              <Label>Payment Status</Label>
              <select
                className="w-full border rounded-md p-2 bg-background text-foreground"
                value={form.paymentStatus}
                onChange={(e) => setForm({ ...form, paymentStatus: e.target.value as PaymentStatus })}
              >
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            {/* Always show amount paid; disabled for paid (auto-set) and pending (zero) */}
            <div>
              <Label>Amount Paid (ZMW)</Label>
              <Input
                type="number"
                step="0.01"
                value={effectiveAmountPaid}
                onChange={(e) => setForm({ ...form, amountPaidZmw: e.target.value })}
                disabled={form.paymentStatus === "paid" || form.paymentStatus === "pending"}
                placeholder={form.paymentStatus === "paid" ? "Auto-set to total" : form.paymentStatus === "pending" ? "0.00" : "Enter amount"}
              />
              {form.paymentStatus === "paid" && (
                <p className="text-xs text-muted-foreground mt-1">Automatically set to total amount</p>
              )}
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter className="p-6 pt-0">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.flockId || !form.birdCount || !form.pricePerBirdZmw}>
              {saving ? "Saving..." : editRecord ? "Save Changes" : "Create Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sale Detail Drawer */}
      <SaleDetailDrawer
        sale={drawerSale}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onEdit={(s) => openEdit(s)}
        onDelete={(s) => handleDelete(s.id)}
        canEdit={canEditSales}
        canDelete={user?.role === "owner"}
      />
    </div>
  );
}
