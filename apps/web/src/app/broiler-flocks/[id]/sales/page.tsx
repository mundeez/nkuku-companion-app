"use client";

import { useEffect, useState, Fragment, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { BroilerFlock, SaleRecord, SaleRecordSummary, PaymentStatus, SalesFilter, PaginatedSales } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Trash2, Pencil, DollarSign, Paperclip, ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";
import { FlockSubNav } from "@/components/flock-subnav";
import { AttachmentPanel } from "@/components/attachments/AttachmentPanel";
import { SalesFilterBar } from "@/components/sales/sales-filter-bar";

const paymentStatusOptions: PaymentStatus[] = ["pending", "partial", "paid"];
const PAGE_SIZE = 20;

function fmtZmw(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function paymentBadge(status: PaymentStatus) {
  switch (status) {
    case "paid":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Paid</Badge>;
    case "partial":
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Partial</Badge>;
    case "pending":
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Pending</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function buildFilterParams(flockId: string, filter: SalesFilter): string {
  const params = new URLSearchParams();
  params.set("flockId", flockId);
  if (filter.fromDate) params.set("fromDate", filter.fromDate);
  if (filter.toDate) params.set("toDate", filter.toDate);
  if (filter.paymentStatus) params.set("paymentStatus", filter.paymentStatus);
  if (filter.customer) params.set("customer", filter.customer);
  params.set("limit", String(filter.limit ?? PAGE_SIZE));
  params.set("offset", String(filter.offset ?? 0));
  return params.toString();
}

export default function SalesPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const flockId = params.id as string;

  const [flock, setFlock] = useState<BroilerFlock | null>(null);
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [summary, setSummary] = useState<SaleRecordSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [filter, setFilter] = useState<SalesFilter>({ limit: PAGE_SIZE, offset: 0 });

  const [form, setForm] = useState({
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

  const canManageSales =
    user?.role === "owner" || user?.role === "manager" || user?.role === "sales_person";
  const canDeleteSales = user?.role === "owner";

  const currentPage = Math.floor((filter.offset ?? 0) / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));

  const loadAll = useCallback(() => {
    const listParams = buildFilterParams(flockId, filter);
    const summaryParams = new URLSearchParams();
    summaryParams.set("flockId", flockId);
    if (filter.fromDate) summaryParams.set("fromDate", filter.fromDate);
    if (filter.toDate) summaryParams.set("toDate", filter.toDate);
    if (filter.paymentStatus) summaryParams.set("paymentStatus", filter.paymentStatus);
    if (filter.customer) summaryParams.set("customer", filter.customer);

    apiFetch<BroilerFlock>(`/api/v1/broiler-flocks/${flockId}`)
      .then(setFlock)
      .catch((err) => setError(err.message));
    apiFetch<PaginatedSales>(`/api/v1/sale-records?${listParams}`)
      .then((data) => { setRecords(data.data); setTotalRecords(data.total); })
      .catch((err) => setError(err.message));
    apiFetch<SaleRecordSummary>(`/api/v1/sale-records/summary?${summaryParams.toString()}`)
      .then(setSummary)
      .catch(() => {});
  }, [flockId, filter]);

  function resetForm() {
    setForm({
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
    setEditingId(null);
  }

  function startEdit(record: SaleRecord) {
    setEditingId(record.id);
    setForm({
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
  }

  async function saveRecord(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const birdCount = Number(form.birdCount);
      const pricePerBird = Number(form.pricePerBirdZmw);
      const total = birdCount * pricePerBird;
      const body: any = {
        flockId,
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
      if (editingId) {
        await apiFetch(`/api/v1/sale-records/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch(`/api/v1/sale-records`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      resetForm();
      loadAll();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(id: string) {
    if (!confirm("Delete this sale record?")) return;
    try {
      await apiFetch(`/api/v1/sale-records/${id}`, { method: "DELETE" });
      loadAll();
    } catch (e: any) {
      alert(e.message);
    }
  }

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user && flockId) loadAll();
  }, [user, isLoading, flockId, router, loadAll]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  const computedTotal =
    (Number(form.birdCount) || 0) * (Number(form.pricePerBirdZmw) || 0);
  const effectiveAmountPaid = form.paymentStatus === "paid"
    ? String(computedTotal)
    : form.amountPaidZmw;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <FlockSubNav />
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Sales Records</h1>
        <div className="text-muted-foreground">{flock?.name || "Loading..."}</div>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Birds Sold</span>
            </div>
            <p className="text-2xl font-bold mt-1">{summary?.totalBirdsSold ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Revenue (ZMW)</span>
            </div>
            <p className="text-2xl font-bold mt-1">{fmtZmw(summary?.totalRevenue ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Total Paid (ZMW)</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">{fmtZmw(summary?.totalPaid ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-red-600" />
              <span className="text-sm text-muted-foreground">Outstanding (ZMW)</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">{fmtZmw(summary?.outstanding ?? 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar (no flock filter — already scoped) */}
      <SalesFilterBar filter={filter} onChange={setFilter} showFlockFilter={false} />

      {/* Add/Edit Sale Form */}
      {canManageSales && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              {editingId ? "Edit Sale Record" : "Add Sale Record"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveRecord} className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="saleDate">Sale Date</Label>
                <Input
                  id="saleDate"
                  type="date"
                  value={form.saleDate}
                  onChange={(e) => setForm({ ...form, saleDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="customerName">Customer Name</Label>
                <Input
                  id="customerName"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="customerPhone">Customer Phone</Label>
                <Input
                  id="customerPhone"
                  value={form.customerPhone}
                  onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="birdCount">Bird Count</Label>
                <Input
                  id="birdCount"
                  type="number"
                  min="1"
                  value={form.birdCount}
                  onChange={(e) => setForm({ ...form, birdCount: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="avgWeightKg">Avg Weight (kg)</Label>
                <Input
                  id="avgWeightKg"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.avgWeightKg}
                  onChange={(e) => setForm({ ...form, avgWeightKg: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pricePerBirdZmw">Price per Bird (ZMW)</Label>
                <Input
                  id="pricePerBirdZmw"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.pricePerBirdZmw}
                  onChange={(e) => setForm({ ...form, pricePerBirdZmw: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Total Amount (ZMW)</Label>
                <Input
                  type="text"
                  readOnly
                  value={fmtZmw(computedTotal)}
                  className="bg-muted"
                />
              </div>
              <div>
                <Label htmlFor="paymentStatus">Payment Status</Label>
                <select
                  id="paymentStatus"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                  value={form.paymentStatus}
                  onChange={(e) => setForm({ ...form, paymentStatus: e.target.value as PaymentStatus })}
                >
                  {paymentStatusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="amountPaidZmw">Amount Paid (ZMW)</Label>
                <Input
                  id="amountPaidZmw"
                  type="number"
                  step="0.01"
                  min="0"
                  value={effectiveAmountPaid}
                  onChange={(e) => setForm({ ...form, amountPaidZmw: e.target.value })}
                  disabled={form.paymentStatus === "paid" || form.paymentStatus === "pending"}
                  placeholder={form.paymentStatus === "paid" ? "Auto-set to total" : form.paymentStatus === "pending" ? "0.00" : "Enter amount"}
                />
              </div>
              <div className="md:col-span-3">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className="md:col-span-3 flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Update Record" : "Save Record"}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Sales Table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Birds</TableHead>
              <TableHead>Avg Weight</TableHead>
              <TableHead>Price/Bird</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Payment Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <Fragment key={r.id}>
                <TableRow
                  className={`cursor-pointer hover:bg-muted/30 ${selectedSaleId === r.id ? "bg-muted/50" : ""}`}
                  onClick={() => setSelectedSaleId(selectedSaleId === r.id ? null : r.id)}
                >
                  <TableCell>{new Date(r.saleDate).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">
                    {r.customerName || "—"}
                    {r.customerPhone && (
                      <div className="text-xs text-muted-foreground">{r.customerPhone}</div>
                    )}
                  </TableCell>
                  <TableCell>{r.birdCount}</TableCell>
                  <TableCell>{r.avgWeightKg ? `${r.avgWeightKg} kg` : "—"}</TableCell>
                  <TableCell>{fmtZmw(r.pricePerBirdZmw)}</TableCell>
                  <TableCell className="font-semibold">{fmtZmw(r.totalAmountZmw)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {paymentBadge(r.paymentStatus)}
                      {r.paymentStatus === "partial" && r.amountPaidZmw != null && (
                        <span className="text-xs text-muted-foreground">
                          Paid: {fmtZmw(r.amountPaidZmw)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Paperclip className="h-4 w-4 inline text-muted-foreground mr-1" />
                    {canManageSales && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); startEdit(r); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDeleteSales && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={(e) => { e.stopPropagation(); deleteRecord(r.id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
                {selectedSaleId === r.id && (
                  <TableRow>
                    <TableCell colSpan={8} className="p-0">
                      <AttachmentPanel
                        saleRecordId={r.id}
                        title={`Attachments — ${r.customerName || "Sale"}`}
                        canManage={canManageSales}
                        canDelete={canDeleteSales}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
            {records.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No sale records found for the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalRecords > PAGE_SIZE && (
          <div className="flex items-center justify-between p-4 border-t">
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages} ({totalRecords} total)
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
      </div>
    </div>
  );
}
