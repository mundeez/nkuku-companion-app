"use client";

import { SaleRecord } from "@/lib/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AttachmentPanel } from "@/components/attachments/AttachmentPanel";
import { Pencil, Trash2, Phone, DollarSign, FileText, User } from "lucide-react";

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
              <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${pctPaid}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground pt-1">
                <span>ZMW {fmt(paid)} paid</span>
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
