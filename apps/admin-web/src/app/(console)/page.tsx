"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { getFailedPayments, getMetrics } from "@/lib/api/platform";
import type { FailedPayments, PlatformMetrics } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  Bell,
  Bird,
  Building2,
  CreditCard,
  Users,
} from "lucide-react";

const PLAN_COLORS: Record<string, string> = {
  free: "#94a3b8",
  grower: "#3b82f6",
  business: "#22c55e",
  enterprise: "#8b5cf6",
};

function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  title: string;
  value: React.ReactNode;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "warn" | "bad" | "good";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div
          className={
            "text-2xl font-bold " +
            (tone === "warn"
              ? "text-amber-500"
              : tone === "bad"
                ? "text-red-500"
                : tone === "good"
                  ? "text-green-500"
                  : "")
          }
        >
          {value}
        </div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user, isLoading, hasPermission } = useAuth();
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [failed, setFailed] = useState<FailedPayments | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading || !user) return;
    Promise.all([getMetrics(), getFailedPayments().catch(() => null)])
      .then(([m, f]) => {
        setMetrics(m);
        setFailed(f);
      })
      .catch((e) => setError(e.message));
  }, [user, isLoading]);

  if (isLoading || (!metrics && !error)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-destructive">{error}</div>;
  }
  if (!metrics) return null;

  const t = metrics.totals;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Platform Dashboard</h1>
        <p className="text-muted-foreground">Tenant operations overview — all figures exclude demo orgs</p>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard title="Organizations" value={t.organizations} hint="Total tenants" icon={Building2} />
        <KpiCard title="Users" value={t.users} hint="All tenant users" icon={Users} />
        <KpiCard title="Active Flocks" value={t.activeFlocks} hint="Across all orgs" icon={Bird} />
        <KpiCard title="Active Subs" value={t.activeSubscriptions} hint="Paying customers" icon={Activity} tone="good" />
        <KpiCard title="Past Due" value={t.pastDueSubscriptions} hint="Need attention" icon={AlertTriangle} tone={t.pastDueSubscriptions > 0 ? "warn" : undefined} />
        <KpiCard title="Suspended" value={t.suspendedSubscriptions} hint="Inactive subs" icon={AlertTriangle} tone={t.suspendedSubscriptions > 0 ? "bad" : undefined} />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan Distribution</CardTitle>
            <CardDescription>Active subscriptions by plan</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.planDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={metrics.planDistribution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="plan" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  <Bar dataKey="count" name="Subscriptions" radius={[4, 4, 0, 0]}>
                    {metrics.planDistribution.map((entry, i) => (
                      <Cell key={i} fill={PLAN_COLORS[entry.plan] || "#3b82f6"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
                No active subscriptions yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue (Paid Invoices)</CardTitle>
            <CardDescription>Total collected by currency</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.revenueByCurrency.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={metrics.revenueByCurrency}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="currency" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  <Bar dataKey="amount" name="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
                No paid invoices yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Failed payments */}
      {failed && failed.count > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-amber-400">
              <CreditCard className="h-4 w-4" /> Failed Payments ({failed.count})
            </CardTitle>
            <CardDescription>Subscriptions needing attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Organization</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Plan</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Status</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Period End</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {failed.items.map((fp) => (
                    <tr key={fp.subscriptionId} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">
                        <Link href={`/tenants/${fp.organization.id}`} className="text-primary hover:underline">
                          {fp.organization.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">{fp.planCode}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={fp.status === "suspended" ? "destructive" : "secondary"}>{fp.status}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {fp.currentPeriodEnd ? new Date(fp.currentPeriodEnd).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        {fp.invoices.map((inv) => (
                          <div key={inv.id}>
                            {inv.amountDue} {inv.currency}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent orgs */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent Organizations</CardTitle>
            <CardDescription>Latest signups</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Name</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Plan</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Country</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Users</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Flocks</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recentOrganizations.map((org) => (
                    <tr key={org.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">
                        <Link href={`/tenants/${org.id}`} className="text-primary hover:underline">
                          {org.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">
                        <Badge
                          style={{
                            backgroundColor: PLAN_COLORS[org.planCode] || "#64748b",
                            color: "white",
                          }}
                        >
                          {org.planCode}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{org.country || "—"}</td>
                      <td className="py-2 pr-4">{org.userCount}</td>
                      <td className="py-2 pr-4">{org.flockCount}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasPermission("tenants.read") && (
              <div className="mt-4 text-right">
                <Link href="/tenants" className="text-sm text-primary hover:underline">
                  View all tenants →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Staff alerts placeholder (P3 pushes real alerts) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" /> Staff Alerts
            </CardTitle>
            <CardDescription>Cron failures, health alerts, payment webhooks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              No alerts — push alerting arrives with the health panel (P3).
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
