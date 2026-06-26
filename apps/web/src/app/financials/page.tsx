"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { DollarSign, TrendingUp, TrendingDown, PiggyBank, FileText, BarChart3, Calendar } from "lucide-react";
import Link from "next/link";

const COLORS = ["#1B5E20", "#C6A017", "#1565C0", "#D32F2F", "#7B1FA2", "#E65100", "#00695C", "#5D4037"];

export default function FinancialsDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<any>(null);
  const [trend, setTrend] = useState<any[]>([]);
  const [flockProfit, setFlockProfit] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [year] = useState(new Date().getFullYear());

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (user) {
      apiFetch("/api/v1/financial-engine/summary")
        .then(setSummary)
        .catch((err) => setError(err.message));
      apiFetch(`/api/v1/financial-engine/monthly-trend?year=${year}`)
        .then(setTrend)
        .catch(() => {});
      apiFetch("/api/v1/financial-engine/flock-profitability")
        .then(setFlockProfit)
        .catch(() => {});
    }
  }, [user, isLoading, router, year]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  const kpi = summary ?? { totalRevenue: 0, totalCost: 0, grossProfit: 0, netProfit: 0, grossMargin: 0, netMargin: 0, categoryBreakdown: [], flockBreakdown: [] };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Financial Dashboard</h1>
        <div className="flex gap-2">
          <Link href="/financials/income-statement"><Button variant="outline"><FileText className="h-4 w-4 mr-2" />Income Statement</Button></Link>
          <Link href="/financials/balance-sheet"><Button variant="outline"><BarChart3 className="h-4 w-4 mr-2" />Balance Sheet</Button></Link>
          <Link href="/financials/cash-flow"><Button variant="outline"><TrendingUp className="h-4 w-4 mr-2" />Cash Flow</Button></Link>
          {user.role !== "viewer" && <Link href="/financials/audit-log"><Button variant="outline"><Calendar className="h-4 w-4 mr-2" />Audit Log</Button></Link>}
        </div>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Total Revenue</p>
          <p className="text-2xl font-bold text-green-600">ZMW {Number(kpi.totalRevenue).toFixed(2)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Total Cost</p>
          <p className="text-2xl font-bold text-red-600">ZMW {Number(kpi.totalCost).toFixed(2)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Net Profit</p>
          <p className={`text-2xl font-bold ${kpi.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>ZMW {Number(kpi.netProfit).toFixed(2)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Net Margin</p>
          <p className={`text-2xl font-bold ${kpi.netMargin >= 0 ? "text-green-600" : "text-red-600"}`}>{Number(kpi.netMargin).toFixed(1)}%</p>
        </CardContent></Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        {/* Monthly Trend */}
        <Card>
          <CardHeader><CardTitle>Monthly Revenue vs Cost ({year})</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(v: any) => `ZMW ${Number(v).toFixed(2)}`} />
                <Legend />
                <Bar dataKey="revenue" fill="#1B5E20" name="Revenue" />
                <Bar dataKey="cost" fill="#D32F2F" name="Cost" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader><CardTitle>Cost Breakdown by Category</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={kpi.categoryBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ category, cost }: any) => `${category}: ZMW ${Number(cost).toFixed(0)}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="cost"
                  nameKey="category"
                >
                  {kpi.categoryBreakdown.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => `ZMW ${Number(v).toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Profit Trend */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Monthly Profit Trend</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(v: any) => `ZMW ${Number(v).toFixed(2)}`} />
              <Legend />
              <Line type="monotone" dataKey="profit" stroke="#1B5E20" strokeWidth={2} name="Profit" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Flock Profitability */}
      <Card>
        <CardHeader><CardTitle>Flock Profitability Ranking</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left py-2">Flock</th><th className="text-right py-2">Revenue</th><th className="text-right py-2">Cost</th><th className="text-right py-2">Net</th></tr></thead>
              <tbody>
                {flockProfit.map((f: any) => (
                  <tr key={f.flockId} className="border-b">
                    <td className="py-2 font-medium">{f.flockName}</td>
                    <td className="py-2 text-right text-green-600">ZMW {Number(f.revenue).toFixed(2)}</td>
                    <td className="py-2 text-right text-red-600">ZMW {Number(f.cost).toFixed(2)}</td>
                    <td className={`py-2 text-right font-medium ${f.net >= 0 ? "text-green-600" : "text-red-600"}`}>ZMW {Number(f.net).toFixed(2)}</td>
                  </tr>
                ))}
                {flockProfit.length === 0 && <tr><td colSpan={4} className="py-4 text-muted-foreground text-center">No flock data yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
