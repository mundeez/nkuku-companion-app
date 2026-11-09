"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SaleRecord, SalePayment } from "@/lib/types";
import { apiFetch } from "@/lib/api/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AttachmentPanel } from "@/components/attachments/AttachmentPanel";
import { Pencil, Trash2, Phone, DollarSign, FileText, User, Plus } from "lucide-react";

interface SaleDetailDrawerProps {
  sale: SaleRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (sale: SaleRecord) => void;
  onDelete?: (sale: SaleRecord) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

function fmt(n: number | null | undefined): string {
  return Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  mobile_money_airtel: "Mobile Money — Airtel",
  mobile_money_mtn: "Mobile Money — MTN",
  mobile_money_zamtel: "Mobile Money — Zamtel",
  bank_transfer: "Bank Transfer",
  other: "Other",
  adjustment: "Adjustment",
  opening_balance: "Opening balance",
};

function PaymentsSection({
  sale,
  canEdit,
  canDelete,
}: {
  sale: SaleRecord;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const queryClient = useQueryClient();
  const [payments, setPayments] = useState<SalePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ amount: "", paidAt: "", method: "cash", reference: "", note: "" });

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/v1/sale-records/${sale.id}/payments`);
      setPayments(Array.isArray(data) ? data : []);
    } catch {
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sale.id]);

  function openDialog() {
    const due = sale.remainingDueZmw ?? Math.max(0, Number(sale.totalAmountZmw) - Number(sale.amountPaidZmw ?? 0));
    setForm({ amount: due > 0 ? due.toFixed(2) : "", paidAt: new Date().toISOString().split("T")[0], method: "cash", reference: "", note: "" });
    setError(null);
    setDialogOpen(true);
  }

  async function recordPayment() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/sale-records/${sale.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amountZmw: Number(form.amount),
          paidAt: form.paidAt || undefined,
          method: form.method,
          reference: form.reference || null,
          note: form.note || null,
        }),
      });
      setDialogOpen(false);
      await load();
      queryClient.invalidateQueries();
    } catch (e: any) {
      setError(e?.message ?? "Failed to record payment");
    } finally {
      setSaving(false);
    }
  }

  async function deletePayment(paymentId: string) {
    try {
      await apiFetch(`/api/v1/sale-records/${sale.id}/payments/${paymentId}`, { method: "DELETE" });
      await load();
      queryClient.invalidateQueries();
    } catch {
      // surfaced via stale list otherwise
    }
  }

  const due = Math.max(0, Number(sale.totalAmountZmw) - Number(sale.amountPaidZmw ?? 0));

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          Payments
        </h3>
        {canEdit && due > 0 && (
          <Button variant="outline" size="sm" onClick={openDialog}>
            <Plus className="h-3 w-3 mr-1" /> Record payment
          </Button>
        )}
      </div>
      <div className="rounded-lg border divide-y text-sm">
        {loading ? (
          <div className="p-4 text-muted-foreground">Loading…</div>
        ) : payments.length === 0 ? (
          <div className="p-4 text-muted-foreground italic">No payments recorded</div>
        ) : (
          payments.map((p) => {
            const muted = p.method === "adjustment" || p.method === "opening_balance";
            const amt = Number(p.amountZmw);
            return (
              <div key={p.id} className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={muted ? "text-muted-foreground" : "font-medium"}>
                      {amt < 0 ? `− ZMW ${fmt(-amt)}` : `ZMW ${fmt(amt)}`}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(p.paidAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className={`text-xs ${muted ? "text-muted-foreground italic" : "text-muted-foreground"}`}>
                    {METHOD_LABELS[p.method] ?? p.method}
                    {p.reference ? ` · ${p.reference}` : ""}
                    {p.note ? ` · ${p.note}` : ""}
                  </div>
                </div>
                {canDelete && !muted && (
                  <Button variant="ghost" size="sm" onClick={() => deletePayment(p.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount (ZMW)</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.paidAt} onChange={(e) => setForm({ ...form, paidAt: e.target.value })} />
            </div>
            <div>
              <Label>Method</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
              >
                <option value="cash">Cash</option>
                <option value="mobile_money_airtel">Mobile Money — Airtel</option>
                <option value="mobile_money_mtn">Mobile Money — MTN</option>
                <option value="mobile_money_zamtel">Mobile Money — Zamtel</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label>Reference (optional)</Label>
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={recordPayment} disabled={saving || !form.amount || Number(form.amount) <= 0}>
              {saving ? "Saving…" : "Save payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function SaleDetailDrawer({
  sale,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: SaleDetailDrawerProps) {
  if (!sale) return null;

  const total = Number(sale.totalAmountZmw);
  const paid = Number(sale.amountPaidZmw ?? 0);
  const remaining = total - paid;
  const pctPaid = total > 0 ? (paid / total) * 100 : 0;

  const statusColor =
    sale.paymentStatus === "paid" ? "bg-green-500"
    : sale.paymentStatus === "partial" ? "bg-amber-500"
    : "bg-red-500";

  const barColor =
    sale.paymentStatus === "paid" ? "bg-green-500"
    : sale.paymentStatus === "partial" ? "bg-amber-500"
    : "bg-red-500";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            Sale Details
          </SheetTitle>
          <SheetDescription>
            {new Date(sale.saleDate).toLocaleDateString()} — {sale.flock?.name || "Unknown flock"}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-8 space-y-6">
          {/* Payment Breakdown */}
          <section>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Payment Breakdown
            </h3>
            <div className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
                <span className="text-sm font-medium capitalize">{sale.paymentStatus}</span>
                <Badge
                  variant={sale.paymentStatus === "paid" ? "default" : sale.paymentStatus === "partial" ? "secondary" : "outline"}
                  className="ml-auto"
                >
                  {sale.paymentStatus}
                </Badge>
              </div>
              {/* Progress bar */}
              <div className="relative h-4 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${pctPaid}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold">
                  {pctPaid.toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground pt-1">
                <span>Paid ZMW {fmt(paid)} · Due ZMW {fmt(remaining)}</span>
                <span>ZMW {fmt(total)} total</span>
              </div>
              {sale.paymentStatus === "partial" && (
                <div className="text-sm text-amber-600 font-medium pt-1">
                  ZMW {fmt(remaining)} remaining
                </div>
              )}
              {sale.paymentStatus === "paid" && (
                <div className="text-sm text-green-600 font-medium pt-1">
                  Fully paid
                </div>
              )}
              {sale.paymentStatus === "pending" && (
                <div className="text-sm text-red-600 font-medium pt-1">
                  ZMW {fmt(total)} unpaid
                </div>
              )}
            </div>
          </section>

          {/* Sale Info */}
          <section>
            <h3 className="text-sm font-semibold mb-3">Sale Information</h3>
            <div className="space-y-2 rounded-lg border p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Birds sold</span>
                <span className="font-medium">{sale.birdCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg weight</span>
                <span className="font-medium">{sale.avgWeightKg ? `${Number(sale.avgWeightKg).toFixed(2)} kg` : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price per bird</span>
                <span className="font-medium">ZMW {fmt(sale.pricePerBirdZmw)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total amount</span>
                <span className="font-medium">ZMW {fmt(total)}</span>
              </div>
            </div>
          </section>

          {/* Customer Info */}
          <section>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Customer
            </h3>
            <div className="space-y-2 rounded-lg border p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{sale.customerName || "Walk-in"}</span>
              </div>
              {sale.customerPhone && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Phone</span>
                  <a href={`tel:${sale.customerPhone}`} className="font-medium text-blue-600 hover:underline flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {sale.customerPhone}
                  </a>
                </div>
              )}
            </div>
          </section>

          {/* Notes */}
          <section>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Notes
            </h3>
            <div className="rounded-lg border p-4 text-sm">
              {sale.notes ? (
                <p className="whitespace-pre-wrap">{sale.notes}</p>
              ) : (
                <p className="text-muted-foreground italic">No notes</p>
              )}
            </div>
          </section>

          {/* Payment history */}
          <PaymentsSection sale={sale} canEdit={canEdit} canDelete={canDelete} />

          {/* Attachments */}
          <section>
            <h3 className="text-sm font-semibold mb-3">Attachments</h3>
            <AttachmentPanel
              saleRecordId={sale.id}
              title="Documents"
              canManage={canEdit}
              canDelete={canDelete}
            />
          </section>

          {/* Actions */}
          {(canEdit || canDelete) && (
            <div className="flex gap-2 pt-2">
              {canEdit && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    onOpenChange(false);
                    onEdit?.(sale);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    onOpenChange(false);
                    onDelete?.(sale);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
