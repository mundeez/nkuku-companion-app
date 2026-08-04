"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { SaleRecord, SalesDashboardSummary, BroilerFlock } from "@/lib/types";
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
import { DollarSign, Bird, TrendingUp, AlertCircle, Plus, Trash2, Pencil, Paperclip, ChevronDown, ChevronRight } from "lucide-react";
import { AttachmentPanel } from "@/components/attachments/AttachmentPanel";

export default function SalesDashboardPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [summary, setSummary] = useState<SalesDashboardSummary | null>(null);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [flocks, setFlocks] = useState<BroilerFlock[]>([]);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<SaleRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [form, setForm] = useState({
    flockId: "",
    saleDate: new Date().toISOString().split("T")[0],
    customerName: "",
    customerPhone: "",
    birdCount: "",
    avgWeightKg: "",
    pricePerBirdZmw: "",
    paymentStatus: "pending" as "pending" | "partial" | "paid",
    amountPaidZmw: "",
    notes: "",
  });

  const canEditSales = user?.role === "owner" || user?.role === "manager" || user?.role === "sales_person";

  function loadData() {
    apiFetch<SalesDashboardSummary>("/api/v1/sale-records/dashboard")
      .then(setSummary)
      .catch((err) => setError(err.message));
    apiFetch<SaleRecord[]>("/api/v1/sale-records/all")
      .then(setSales)
      .catch((err) => setError(err.message));
    apiFetch<BroilerFlock[]>("/api/v1/broiler-flocks")
      .then(setFlocks)
      .catch(() => {});
  }

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (user && !["owner", "manager", "sales_person"].includes(user.role)) {
      router.push("/"); return;
    }
    if (user) loadData();
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
    setSaving(true);
    try {
      const birdCount = Number(form.birdCount);
      const pricePerBird = Number(form.pricePerBirdZmw);
      const total = birdCount * pricePerBird;
      const body = {
        flockId: form.flockId,
        saleDate: form.saleDate,
        customerName: form.customerName || undefined,
        customerPhone: form.customerPhone || undefined,
        birdCount,
        avgWeightKg: form.avgWeightKg ? Number(form.avgWeightKg) : undefined,
        pricePerBirdZmw: pricePerBird,
        totalAmountZmw: total,
        paymentStatus: form.paymentStatus,
        amountPaidZmw: form.amountPaidZmw ? Number(form.amountPaidZmw) : undefined,
        notes: form.notes || undefined,
      };
      if (editRecord) {
        await apiFetch(`/api/v1/sale-records/${editRecord.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/api/v1/sale-records", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      setCreateOpen(false);
      loadData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this sale record? This will restore the bird count to the flock.")) return;
    try {
      await apiFetch(`/api/v1/sale-records/${id}`, { method: "DELETE" });
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  }

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
        <CardHeader><CardTitle>Sale Records ({sales.length})</CardTitle></CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <p className="text-muted-foreground">No sales recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2 w-8"></th>
                    <th className="p-2">Date</th>
                    <th className="p-2">Flock</th>
                    <th className="p-2">Customer</th>
                    <th className="p-2">Birds</th>
                    <th className="p-2">Price/Bird</th>
                    <th className="p-2">Total</th>
                    <th className="p-2">Payment</th>
                    {canEditSales && <th className="p-2">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <Fragment key={s.id}>
                      <tr className="border-b last:border-0">
                        <td className="p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => setExpandedSaleId(expandedSaleId === s.id ? null : s.id)}
                          >
                            {expandedSaleId === s.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </td>
                        <td className="p-2">{new Date(s.saleDate).toLocaleDateString()}</td>
                        <td className="p-2">{s.flock?.name || "-"}</td>
                        <td className="p-2">{s.customerName || "Walk-in"}</td>
                        <td className="p-2">{s.birdCount}</td>
                        <td className="p-2">ZMW {Number(s.pricePerBirdZmw).toFixed(2)}</td>
                        <td className="p-2 font-medium">ZMW {Number(s.totalAmountZmw).toFixed(2)}</td>
                        <td className="p-2">
                          <Badge variant={s.paymentStatus === "paid" ? "default" : s.paymentStatus === "partial" ? "secondary" : "outline"}>
                            {s.paymentStatus}
                          </Badge>
                        </td>
                        {canEditSales && (
                          <td className="p-2">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => setExpandedSaleId(expandedSaleId === s.id ? null : s.id)} title="Attachments">
                                <Paperclip className="h-3 w-3" />
                              </Button>
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
                      {expandedSaleId === s.id && (
                        <tr className="border-b">
                          <td colSpan={canEditSales ? 9 : 8} className="p-2 bg-muted/30">
                            <AttachmentPanel
                              saleRecordId={s.id}
                              title={`Attachments — ${s.customerName || "Walk-in"} sale`}
                              canManage={canEditSales}
                              canDelete={user?.role === "owner" || user?.role === "manager"}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
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
                <p className="text-xs text-muted-foreground mt-1">Total: ZMW {(Number(form.birdCount) * Number(form.pricePerBirdZmw)).toFixed(2)}</p>
              )}
            </div>
            <div>
              <Label>Payment Status</Label>
              <select
                className="w-full border rounded-md p-2 bg-background text-foreground"
                value={form.paymentStatus}
                onChange={(e) => setForm({ ...form, paymentStatus: e.target.value as any })}
              >
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            {form.paymentStatus !== "pending" && (
              <div>
                <Label>Amount Paid (ZMW)</Label>
                <Input type="number" step="0.01" value={form.amountPaidZmw} onChange={(e) => setForm({ ...form, amountPaidZmw: e.target.value })} />
              </div>
            )}
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
    </div>
  );
}
