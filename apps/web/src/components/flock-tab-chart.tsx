"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, ReferenceArea,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";
import { PerformanceTarget } from "@/lib/types";

const FEED_COLORS: Record<string, string> = {
  Starter: "#f59e0b",
  Grower: "#3b82f6",
  Finisher: "#10b981",
  Chick: "#ec4899",
};

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

const MORTALITY_COLORS = ["#ef4444", "#f59e0b", "#8b5cf6", "#06b6d4", "#94a3b8", "#ec4899"];

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" });
}

function fmtZmw(n: number): string {
  return n.toLocaleString("en-ZM", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface FlockTabChartProps {
  type: string;
  records: any[];
  flockId: string;
  breedId?: string;
  startDate?: string;
}

export function FlockTabChart({ type, records, flockId, breedId, startDate }: FlockTabChartProps) {
  const [targets, setTargets] = useState<PerformanceTarget[]>([]);

  useEffect(() => {
    if (type === "growth" && breedId) {
      apiFetch<{ performanceTargets: PerformanceTarget[] }>(`/api/v1/breeds/${breedId}`)
        .then((d) => setTargets(d.performanceTargets || []))
        .catch(() => {});
    }
  }, [type, breedId]);

  if (!records || records.length === 0) return null;

  // ── Growth: Weight vs Target Line Chart ──────────
  if (type === "growth") {
    const sorted = [...records].sort((a, b) => new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime());
    const chartData = sorted.map((r) => {
      const ageDays = startDate
        ? Math.floor((new Date(r.recordDate).getTime() - new Date(startDate).getTime()) / 86400000)
        : 0;
      const target = targets.find((t) => t.ageDays === ageDays);
      return {
        day: `D${ageDays}`,
        actual: Number(r.avgWeight),
        target: target ? Number(target.targetWeight) : null,
      };
    });

    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Weight vs Target</CardTitle>
          <CardDescription>Actual weight (g) compared to breed performance targets</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} unit="g" />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                formatter={(v: number, name: string) => [`${v}g`, name === "actual" ? "Actual" : "Target"]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="actual" name="Actual" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="target" name="Target" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  // ── Feed: Daily Consumption Bar Chart ────────────
  if (type === "feed") {
    const sorted = [...records].sort((a, b) => new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime());
    const chartData = sorted.map((r) => ({
      date: fmtDate(r.recordDate),
      kg: Number(r.quantityKg),
      cost: Number(r.costZmw || 0),
      feedType: r.feedType,
    }));

    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Feed Consumption</CardTitle>
          <CardDescription>Daily feed quantity (kg) and cost (ZMW)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} unit="kg" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} tickFormatter={(v: number) => `ZMW ${fmtZmw(v)}`} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                formatter={(v: number, name: string) => name === "Cost" ? `ZMW ${fmtZmw(v)}` : `${v}kg`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="kg" name="Feed (kg)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="cost" name="Cost" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  // ── Water: Consumption & pH Composed Chart ───────
  if (type === "water") {
    const sorted = [...records].sort((a, b) => new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime());
    const chartData = sorted.map((r) => ({
      date: fmtDate(r.recordDate),
      liters: Number(r.quantityLiters),
      ph: r.ph ? Number(r.ph) : null,
    }));

    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Water Consumption & pH</CardTitle>
          <CardDescription>Daily water intake (L) with pH levels</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} unit="L" />
              <YAxis yAxisId="right" orientation="right" domain={[5, 9]} tick={{ fontSize: 12 }} unit=" pH" />
              <ReferenceArea yAxisId="right" y1={6.5} y2={7.5} fill="#22c55e" fillOpacity={0.08} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="liters" name="Water (L)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="ph" name="pH" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <ReferenceLine yAxisId="right" y={7} stroke="#22c55e" strokeDasharray="3 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  // ── Mortality: Cumulative Area Chart ─────────────
  if (type === "mortality") {
    const sorted = [...records].sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
    let cumulative = 0;
    const chartData = sorted.map((r) => {
      cumulative += Number(r.count);
      return {
        date: fmtDate(r.eventDate),
        deaths: Number(r.count),
        cumulative,
        cause: r.cause || "Unknown",
      };
    });

    // Cause breakdown for pie
    const causeMap = new Map<string, number>();
    sorted.forEach((r) => {
      const c = r.cause || "Unknown";
      causeMap.set(c, (causeMap.get(c) || 0) + Number(r.count));
    });
    const causeData = Array.from(causeMap.entries()).map(([cause, count]) => ({ cause, count }));

    return (
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Cumulative Mortality</CardTitle>
            <CardDescription>Running total of deaths over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                />
                <Area type="monotone" dataKey="cumulative" name="Cumulative Deaths" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Causes</CardTitle>
            <CardDescription>Death breakdown by cause</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={causeData} dataKey="count" nameKey="cause" cx="50%" cy="50%" outerRadius={80} paddingAngle={2}>
                  {causeData.map((_, i) => <Cell key={i} fill={MORTALITY_COLORS[i % MORTALITY_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Financial: Cost Breakdown Pie + Revenue vs Cost Bar ─
  if (type === "financial") {
    const costMap = new Map<string, number>();
    let totalRevenue = 0;
    let totalCost = 0;
    records.forEach((r) => {
      const amt = Number(r.amountZmw);
      if (r.isIncome) {
        totalRevenue += amt;
      } else {
        totalCost += amt;
        const cat = r.category as string;
        costMap.set(cat, (costMap.get(cat) || 0) + amt);
      }
    });
    const costData = Array.from(costMap.entries()).map(([category, amount]) => ({ category, amount }));
    const revCostData = [{ name: "Revenue", value: totalRevenue }, { name: "Cost", value: totalCost }];

    return (
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cost Breakdown</CardTitle>
            <CardDescription>By category (ZMW)</CardDescription>
          </CardHeader>
          <CardContent>
            {costData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={costData} dataKey="amount" nameKey="category" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {costData.map((entry, i) => <Cell key={i} fill={CATEGORY_COLORS[entry.category] || "#94a3b8"} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    formatter={(v: number) => `ZMW ${fmtZmw(v)}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No cost data</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue vs Cost</CardTitle>
            <CardDescription>Total (ZMW)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revCostData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `ZMW ${fmtZmw(v)}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  formatter={(v: number) => `ZMW ${fmtZmw(v)}`}
                />
                <Bar dataKey="value" name="Amount" radius={[4, 4, 0, 0]}>
                  <Cell fill="#22c55e" />
                  <Cell fill="#ef4444" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Vaccination: Schedule Timeline ───────────────
  if (type === "vaccination") {
    const sorted = [...records].sort((a, b) => new Date(a.adminDate).getTime() - new Date(b.adminDate).getTime());
    const chartData = sorted.map((r) => ({
      date: fmtDate(r.adminDate),
      vaccine: r.vaccineName,
      method: r.adminMethod,
      cost: Number(r.costZmw || 0),
    }));

    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Vaccination Cost Timeline</CardTitle>
          <CardDescription>Cost per vaccination event (ZMW)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `ZMW ${fmtZmw(v)}`} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                formatter={(v: number) => `ZMW ${fmtZmw(v)}`}
              />
              <Bar dataKey="cost" name="Cost" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  return null;
}
