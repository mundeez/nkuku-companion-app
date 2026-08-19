"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Building2, Users, Bird, AlertTriangle, Activity } from "lucide-react";

interface AdminMetrics {
  totals: {
    organizations: number;
    users: number;
    activeFlocks: number;
    activeSubscriptions: number;
    pastDueSubscriptions: number;
    suspendedSubscriptions: number;
    cancelledSubscriptions: number;
  };
  revenueByCurrency: { currency: string; amount: number }[];
  planDistribution: { plan: string; count: number }[];
  recentOrganizations: {
    id: string;
    name: string;
    planCode: string;
    country: string;
    createdAt: string;
    userCount: number;
    flockCount: number;
  }[];
}

interface AdminOrgs {
  items: {
    id: string;
    name: string;
    planCode: string;
    country: string;
    currency: string;
    createdAt: string;
    userCount: number;
    flockCount: number;
    subscription: { status: string; planCode: string; billingCycle: string; currentPeriodEnd: string } | null;
  }[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface FailedPayments {
  items: {
    subscriptionId: string;
    status: string;
    planCode: string;
    organization: { id: string; name: string; planCode: string; country: string };
    currentPeriodEnd: string;
    invoices: { id: string; amountDue: number; currency: string; status: string }[];
  }[];
  count: number;
}

const PLAN_COLORS: Record<string, string> = {
  free: "#94a3b8",
  grower: "#3b82f6",
  business: "#22c55e",
  enterprise: "#8b5cf6",
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [orgs, setOrgs] = useState<AdminOrgs | null>(null);
  const [failedPayments, setFailedPayments] = useState<FailedPayments | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && (!user || !user.isPlatformAdmin)) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.isPlatformAdmin) {
      Promise.all([
        apiFetch<AdminMetrics>("/api/v1/admin/metrics"),
        apiFetch<AdminOrgs>("/api/v1/admin/organizations?pageSize=10"),
        apiFetch<FailedPayments>("/api/v1/admin/failed-payments"),
      ])
        .then(([m, o, f]) => {
          setMetrics(m);
          setOrgs(o);
          setFailedPayments(f);
        })
        .catch((e) => setError(e.message));
    }
  }, [user]);

  if (isLoading || !user || !user.isPlatformAdmin) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Skeleton className="h-8 w-64 mb-4" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (error) return <div className="p-8 text-destructive">{error}</div>;
  if (!metrics || !orgs || !failedPayments) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Skeleton className="h-8 w-64 mb-4" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const t = metrics.totals;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Admin Dashboard</h1>
          <p className="text-muted-foreground">Platform operations overview</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/ads" className="text-sm text-primary hover:underline">Ad Campaigns →</Link>
        </div>
      </div>

      {/* ── KPI Row ─────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{t.organizations}</div>
            <p className="text-xs text-muted-foreground">Total tenants</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{t.users}</div>
            <p className="text-xs text-muted-foreground">All users</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Flocks</CardTitle>
            <Bird className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{t.activeFlocks}</div>
            <p className="text-xs text-muted-foreground">Across all orgs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{t.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">Paying customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Past Due</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${t.pastDueSubscriptions > 0 ? "text-amber-600" : ""}`}>{t.pastDueSubscriptions}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspended</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${t.suspendedSubscriptions > 0 ? "text-red-600" : ""}`}>{t.suspendedSubscriptions}</div>
            <p className="text-xs text-muted-foreground">Inactive</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts Row: Plan Distribution + Revenue ─── */}
      <div className="grid gap-4 lg:grid-cols-2 mb-8">
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
                  <XAxis dataKey="plan" className="text-xs" tick={{ fontSize: 12 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Bar dataKey="count" name="Subscriptions" radius={[4, 4, 0, 0]}>
                    {metrics.planDistribution.map((entry, i) => (
                      <Cell key={i} fill={PLAN_COLORS[entry.plan] || "#3b82f6"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
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
                  <XAxis dataKey="currency" className="text-xs" tick={{ fontSize: 12 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Bar dataKey="amount" name="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                No paid invoices yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Failed Payments ─────────────────────── */}
      {failedPayments.count > 0 && (
        <Card className="mb-8 border-amber-200">
          <CardHeader>
            <CardTitle className="text-base text-amber-700">Failed Payments ({failedPayments.count})</CardTitle>
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
                  {failedPayments.items.map((fp) => (
                    <tr key={fp.subscriptionId} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{fp.organization.name}</td>
                      <td className="py-2 pr-4">{fp.planCode}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={fp.status === "suspended" ? "destructive" : "secondary"}>
                          {fp.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {fp.currentPeriodEnd ? new Date(fp.currentPeriodEnd).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        {fp.invoices.map((inv, i) => (
                          <div key={i}>
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

      {/* ── Recent Organizations ────────────────── */}
      <Card className="mb-8">
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
                  <tr key={org.id} className="border-b last:border-0 hover:bg-accent transition-colors cursor-pointer" onClick={() => router.push(`/admin/organizations/${org.id}`)}>
                    <td className="py-2 pr-4 font-medium">{org.name}</td>
                    <td className="py-2 pr-4">
                      <Badge style={{ backgroundColor: PLAN_COLORS[org.planCode] || "#94a3b8", color: "white" }}>
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
        </CardContent>
      </Card>

      {/* ── All Organizations ───────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Organizations ({orgs.total})</CardTitle>
          <CardDescription>Page {orgs.page} of {orgs.totalPages}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Name</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Plan</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Sub Status</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Users</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Flocks</th>
                </tr>
              </thead>
              <tbody>
                {orgs.items.map((org) => (
                  <tr key={org.id} className="border-b last:border-0 hover:bg-accent transition-colors cursor-pointer" onClick={() => router.push(`/admin/organizations/${org.id}`)}>
                    <td className="py-2 pr-4 font-medium">{org.name}</td>
                    <td className="py-2 pr-4">{org.planCode}</td>
                    <td className="py-2 pr-4">
                      {org.subscription ? (
                        <Badge variant={org.subscription.status === "active" ? "default" : org.subscription.status === "past_due" ? "secondary" : "destructive"}>
                          {org.subscription.status}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">{org.userCount}</td>
                    <td className="py-2 pr-4">{org.flockCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
