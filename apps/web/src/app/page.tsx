"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";
import { DashboardSummary } from "@/lib/types";
import {
  TrendingUp, Users, DollarSign, HeartPulse, Scale, AlertTriangle,
  Activity, Syringe, ClipboardList, Thermometer, Bird, Wallet, TrendingDown,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const CATEGORY_COLORS: Record<string, string> = {
  chick_purchase: "#3b82f6",
  feed: "#f59e0b",
  vaccines: "#10b981",
  medication: "#8b5cf6",
  labor: "#ec4899",
  utilities: "#06b6d4",
  equipment: "#f97316",
  sales: "#22c55e",
  other: "#94a3b8",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
};

function fmtZmw(n: number): string {
  return n.toLocaleString("en-ZM", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const alertTypeLabels: Record<string, string> = {
  temperature_adjustment: "Temp Adjustment",
  vaccination_due: "Vaccination Due",
  feed_transition: "Feed Transition",
  weight_check: "Weight Check",
  mortality_threshold: "Mortality Alert",
  environmental: "Environmental",
  environmental_threshold: "Env Threshold",
  financial: "Financial",
  medication_due: "Medication Due",
  withdrawal_due: "Withdrawal Due",
  vaccine_expiry: "Vaccine Expiry",
  task_due: "Task Due",
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      apiFetch<DashboardSummary>("/api/v1/dashboard/summary")
        .then(setData)
        .catch((err) => setError(err.message));
    }
  }, [user, isLoading, router]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;
  if (error) return <div className="p-8 text-destructive">{error}</div>;
  if (!data) return <div className="p-8">Loading dashboard...</div>;

  const k = data.kpis;
  const hasFinancials = k.totalRevenue > 0 || k.totalCost > 0;
  const hasFlocks = data.flockProfitability.length > 0;
  const hasAlerts = k.openAlerts > 0;

  const severityData = [
    { name: "Critical", value: data.alertsBySeverity.critical, color: SEVERITY_COLORS.critical },
    { name: "Warning", value: data.alertsBySeverity.warning, color: SEVERITY_COLORS.warning },
    { name: "Info", value: data.alertsBySeverity.info, color: SEVERITY_COLORS.info },
  ].filter((d) => d.value > 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your broiler production</p>
        </div>
        <Link href="/alerts" className="text-sm text-primary hover:underline">View all alerts →</Link>
      </div>

      {/* ── KPI Row ─────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Flocks</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{k.activeFlocks}</div>
            <p className="text-xs text-muted-foreground">{k.pendingFlocks} pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Birds</CardTitle>
            <Bird className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{k.totalBirds.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across active flocks</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mortality Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${k.mortalityRate > 10 ? "text-red-600" : k.mortalityRate > 5 ? "text-amber-600" : ""}`}>{k.mortalityRate}%</div>
            <p className="text-xs text-muted-foreground">Active flocks avg</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${k.netProfit < 0 ? "text-red-600" : "text-green-600"}`}>ZMW {fmtZmw(k.netProfit)}</div>
            <p className="text-xs text-muted-foreground">All flocks</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit / Bird</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${k.profitPerBird < 0 ? "text-red-600" : "text-green-600"}`}>ZMW {fmtZmw(k.profitPerBird)}</div>
            <p className="text-xs text-muted-foreground">Per bird</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${k.openAlerts > 0 ? "text-amber-600" : ""}`}>{k.openAlerts}</div>
            <p className="text-xs text-muted-foreground">{data.alertsBySeverity.critical} critical</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts Row 1: Revenue vs Cost + Cost Breakdown ─── */}
      <div className="grid gap-4 lg:grid-cols-3 mb-8">
        {/* Monthly Revenue vs Cost */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Monthly Revenue vs Cost</CardTitle>
            <CardDescription>Last 12 months (ZMW)</CardDescription>
          </CardHeader>
          <CardContent>
            {hasFinancials ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 12 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    formatter={(v: number) => `ZMW ${fmtZmw(v)}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cost" name="Cost" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                No financial data yet. Add financial records to flocks to see trends.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cost Breakdown Donut */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cost Breakdown</CardTitle>
            <CardDescription>By category (ZMW)</CardDescription>
          </CardHeader>
          <CardContent>
            {data.costBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={data.costBreakdown}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {data.costBreakdown.map((entry, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[entry.category] || "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    formatter={(v: number) => `ZMW ${fmtZmw(v)}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                No cost data yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Charts Row 2: Flock Profitability + Alerts ─── */}
      <div className="grid gap-4 lg:grid-cols-2 mb-8">
        {/* Flock Profitability */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Flock Profitability</CardTitle>
            <CardDescription>Net profit per flock (ZMW)</CardDescription>
          </CardHeader>
          <CardContent>
            {hasFlocks ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.flockProfitability} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" tick={{ fontSize: 12 }} tickFormatter={(v: number) => `ZMW ${fmtZmw(v)}`} />
                  <YAxis type="category" dataKey="flockName" className="text-xs" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    formatter={(v: number) => `ZMW ${fmtZmw(v)}`}
                  />
                  <Bar dataKey="profit" name="Profit" radius={[0, 4, 4, 0]}>
                    {data.flockProfitability.map((entry, i) => (
                      <Cell key={i} fill={entry.profit >= 0 ? "#22c55e" : "#ef4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                No active flocks yet. Create a flock to see profitability.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alerts by Severity + Recent Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alerts Overview</CardTitle>
            <CardDescription>{k.openAlerts} open alerts</CardDescription>
          </CardHeader>
          <CardContent>
            {hasAlerts ? (
              <div className="flex gap-4">
                {/* Severity Donut */}
                <div className="flex-shrink-0">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie
                        data={severityData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                      >
                        {severityData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="text-center -mt-12 text-2xl font-bold">{k.openAlerts}</div>
                  <div className="text-center text-xs text-muted-foreground mt-8">Total</div>
                </div>

                {/* Recent Alerts List */}
                <div className="flex-1 space-y-2 max-h-[260px] overflow-y-auto">
                  {data.recentAlerts.map((alert) => (
                    <Link
                      key={alert.id}
                      href="/alerts"
                      className="block p-2 rounded-lg border hover:bg-accent transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                          style={{ backgroundColor: SEVERITY_COLORS[alert.severity] || "#94a3b8" }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{alert.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {alert.flockName} · {timeAgo(alert.createdAt)}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                No open alerts. All clear!
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Alerts by Type Bar Chart ─────────────── */}
      {hasAlerts && data.alertsByType.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">Alerts by Type</CardTitle>
            <CardDescription>Open alerts grouped by category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.alertsByType.map((a) => ({ ...a, label: alertTypeLabels[a.type] || a.type }))}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" className="text-xs" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={60} />
                <YAxis className="text-xs" tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                />
                <Bar dataKey="count" name="Alerts" radius={[4, 4, 0, 0]}>
                  {data.alertsByType.map((entry, i) => (
                    <Cell key={i} fill={SEVERITY_COLORS[entry.severity] || "#3b82f6"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Active Flocks Summary Table ─────────── */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Active Flocks Summary</CardTitle>
          <CardDescription>Click a row to manage the flock</CardDescription>
        </CardHeader>
        <CardContent>
          {hasFlocks ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Flock</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Breed</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Day</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Birds</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Mortality</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Profit (ZMW)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.flockProfitability.map((f) => (
                    <tr key={f.flockId} className="border-b last:border-0 hover:bg-accent transition-colors cursor-pointer" onClick={() => router.push(`/broiler-flocks/${f.flockId}`)}>
                      <td className="py-2 pr-4 font-medium">{f.flockName}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{f.breedName}</td>
                      <td className="py-2 pr-4">{f.ageDays}</td>
                      <td className="py-2 pr-4">{f.currentCount.toLocaleString()}</td>
                      <td className="py-2 pr-4">
                        <span className={f.mortalityRate > 10 ? "text-red-600 font-medium" : f.mortalityRate > 5 ? "text-amber-600" : ""}>
                          {f.mortalityRate}%
                        </span>
                      </td>
                      <td className={`py-2 pr-4 text-right font-medium ${f.profit < 0 ? "text-red-600" : "text-green-600"}`}>
                        {fmtZmw(f.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No active flocks. <Link href="/broiler-flocks" className="text-primary hover:underline">Create your first flock →</Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Quick Actions ────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Frequently used tools</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Link href="/broiler-flocks" className="block p-4 rounded-lg border hover:bg-accent transition-colors">
            <Scale className="h-5 w-5 mb-2 text-primary" />
            <div className="font-medium">Manage Flocks</div>
            <div className="text-sm text-muted-foreground">Track growth & health</div>
          </Link>
          <Link href="/diseases" className="block p-4 rounded-lg border hover:bg-accent transition-colors">
            <HeartPulse className="h-5 w-5 mb-2 text-primary" />
            <div className="font-medium">Disease Database</div>
            <div className="text-sm text-muted-foreground">Symptoms & treatments</div>
          </Link>
          <Link href="/projections" className="block p-4 rounded-lg border hover:bg-accent transition-colors">
            <DollarSign className="h-5 w-5 mb-2 text-primary" />
            <div className="font-medium">Run Projection</div>
            <div className="text-sm text-muted-foreground">Calculate costs & profits</div>
          </Link>
          <Link href="/suppliers" className="block p-4 rounded-lg border hover:bg-accent transition-colors">
            <Users className="h-5 w-5 mb-2 text-primary" />
            <div className="font-medium">Manage Suppliers</div>
            <div className="text-sm text-muted-foreground">Update feed prices</div>
          </Link>
          <Link href="/vaccine-inventory" className="block p-4 rounded-lg border hover:bg-accent transition-colors">
            <Syringe className="h-5 w-5 mb-2 text-primary" />
            <div className="font-medium">Vaccine Inventory</div>
            <div className="text-sm text-muted-foreground">Stock, batches & expiry</div>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
