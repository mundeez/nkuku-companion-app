"use client";

import type { TenantDetail } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function SubStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={
        status === "active"
          ? "default"
          : status === "past_due"
            ? "secondary"
            : status === "trialing"
              ? "outline"
              : "destructive"
      }
    >
      {status}
    </Badge>
  );
}

export function BillingTab({ tenant }: { tenant: TenantDetail }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subscriptions ({tenant.subscriptions.length})</CardTitle>
          <CardDescription>Recent subscription history</CardDescription>
        </CardHeader>
        <CardContent>
          {tenant.subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscriptions.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Plan</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Status</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Cycle</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Period Start</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Period End</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Trial Ends</th>
                  </tr>
                </thead>
                <tbody>
                  {tenant.subscriptions.map((s, i) => (
                    <tr key={s.id ?? i} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{s.planCode}</td>
                      <td className="py-2 pr-4"><SubStatusBadge status={s.status} /></td>
                      <td className="py-2 pr-4">{s.billingCycle ?? "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{formatDate(s.currentPeriodStart)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{formatDate(s.currentPeriodEnd)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{formatDate(s.trialEndsAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoices ({tenant.invoices.length})</CardTitle>
          <CardDescription>Recent invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {tenant.invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Status</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Due</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Paid</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Created</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Paid At</th>
                  </tr>
                </thead>
                <tbody>
                  {tenant.invoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        <Badge
                          variant={
                            inv.status === "paid"
                              ? "default"
                              : inv.status === "open"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">{inv.amountDue} {inv.currency}</td>
                      <td className="py-2 pr-4">{inv.amountPaid} {inv.currency}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{formatDate(inv.createdAt)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{formatDate(inv.paidAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
