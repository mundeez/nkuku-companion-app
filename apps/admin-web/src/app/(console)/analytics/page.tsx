"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  downloadAnalyticsCsv,
  getAnalyticsCohorts,
  getAnalyticsOverview,
} from "@/lib/api/platform";
import type { AnalyticsCohort, AnalyticsDay } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, RefreshCw } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const kwacha = (n: number) => `K${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      {sub && <CardContent className="pt-0 text-xs text-muted-foreground">{sub}</CardContent>}
    </Card>
  );
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsDay[]>([]);
  const [latest, setLatest] = useState<AnalyticsDay | null>(null);
  const [cohorts, setCohorts] = useState<AnalyticsCohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, co] = await Promise.all([
        getAnalyticsOverview(from || undefined, to || undefined),
        getAnalyticsCohorts(),
      ]);
      setData(ov.series);
      setLatest(ov.latest);
      setCohorts(co.cohorts);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const totals = useMemo(() => {
    const t = { signups: 0, activations: 0, newMrr: 0, expansionMrr: 0, churnedMrr: 0, recov: 0 };
    for (const d of data) {
      t.signups += d.signups;
      t.activations += d.activations;
      t.newMrr += d.newMrr;
      t.expansionMrr += d.expansionMrr;
      t.churnedMrr += d.churnedMrr;
      t.recov += d.failedPaymentRecoveries;
    }
    return t;
  }, [data]);

  const countries = useMemo(() => {
    const c = latest?.countries ?? {};
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [latest]);

  const funnel = latest?.funnel ?? null;
  const cohortMonths = useMemo(() => {
    const max = Math.max(0, ...cohorts.flatMap((c) => Object.keys(c.months).map(Number)));
    return Array.from({ length: max + 1 }, (_, i) => i);
  }, [cohorts]);

  if (!user) return null;
  if (loading && !data.length) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const tick = { fontSize: 11 };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Growth &amp; Finance Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Daily rollups from <code>platform_daily_stats</code> (00:30 cron). Demo org &amp; staff excluded.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" />
          </div>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => downloadAnalyticsCsv(from || undefined, to || undefined)}>
            <Download className="mr-1 h-4 w-4" /> CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="MRR (current)" value={kwacha(latest?.mrrTotal ?? 0)}
          sub={`basic ${kwacha(latest?.mrrBasic ?? 0)} · grower ${kwacha(latest?.mrrGrower ?? 0)} · biz ${kwacha(latest?.mrrBusiness ?? 0)}`} />
        <Kpi label="Signups (range)" value={String(totals.signups)} sub={`${totals.activations} first-flock activations`} />
        <Kpi label="WAU / MAU" value={`${latest?.wau ?? 0} / ${latest?.mau ?? 0}`} sub="audit-active tenant users" />
        <Kpi label="Net MRR movement" value={kwacha(totals.newMrr + totals.expansionMrr - totals.churnedMrr)}
          sub={`+${kwacha(totals.newMrr)} new · +${kwacha(totals.expansionMrr)} exp · −${kwacha(totals.churnedMrr)} churn`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">MRR by plan</CardTitle>
            <CardDescription>Normalized monthly ZMW from covering paid invoices</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer>
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={tick} />
                <YAxis tick={tick} />
                <Tooltip formatter={(v: any) => kwacha(Number(v))} />
                <Legend />
                <Area type="monotone" dataKey="mrrBasic" stackId="1" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.4} name="Basic" />
                <Area type="monotone" dataKey="mrrGrower" stackId="1" stroke="#34d399" fill="#34d399" fillOpacity={0.4} name="Grower" />
                <Area type="monotone" dataKey="mrrBusiness" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.4} name="Business" />
                <Area type="monotone" dataKey="mrrEnterprise" stackId="1" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.4} name="Enterprise" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Signups &amp; activations</CardTitle>
            <CardDescription>New orgs vs orgs creating their first flock</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={tick} />
                <YAxis tick={tick} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="signups" fill="#60a5fa" name="Signups" />
                <Bar dataKey="activations" fill="#34d399" name="Activations" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weekly / monthly active users</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={tick} />
                <YAxis tick={tick} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="wau" stroke="#60a5fa" dot={false} name="WAU" />
                <Line type="monotone" dataKey="mau" stroke="#f59e0b" dot={false} name="MAU" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan funnel &amp; countries</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Subscription funnel</div>
              {funnel ? (
                ["trialing", "active", "past_due", "suspended", "cancelled"].map((k) => (
                  <div key={k} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{k.replace("_", " ")}</span>
                    <span className="font-mono">{(funnel as any)[k]}</span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No data yet</div>
              )}
              <div className="flex items-center justify-between border-t pt-2 text-sm font-medium">
                <span>Ever-paid orgs</span>
                <span className="font-mono">{funnel?.everPaid ?? 0}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Active orgs by country</div>
              {countries.length ? countries.map(([cc, n]) => (
                <div key={cc} className="flex items-center justify-between text-sm">
                  <span>{cc}</span>
                  <span className="font-mono">{n}</span>
                </div>
              )) : <div className="text-sm text-muted-foreground">No data yet</div>}
              <div className="border-t pt-2 text-xs text-muted-foreground">
                Failed-payment recoveries in range: <span className="font-mono">{totals.recov}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Retention cohorts</CardTitle>
          <CardDescription>Signup month × months active — % of the cohort with tenant activity in that month</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {cohorts.length === 0 ? (
            <div className="text-sm text-muted-foreground">No cohort data yet.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="p-2">Cohort</th>
                  <th className="p-2">Size</th>
                  {cohortMonths.map((m) => <th key={m} className="p-2 text-center">M{m}</th>)}
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => (
                  <tr key={c.cohort} className="border-t">
                    <td className="p-2 font-medium">{c.cohort}</td>
                    <td className="p-2">{c.size}</td>
                    {cohortMonths.map((m) => {
                      const v = c.months[m];
                      return (
                        <td key={m} className="p-2 text-center"
                          style={v != null ? { backgroundColor: `rgba(52, 211, 153, ${Math.min(0.7, v / 100)})` } : undefined}>
                          {v != null ? `${v}%` : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
