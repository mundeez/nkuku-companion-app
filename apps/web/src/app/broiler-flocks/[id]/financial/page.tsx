"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, DollarSign, TrendingUp, Target, FileText, BarChart3, Wallet } from "lucide-react";
import Link from "next/link";

export default function FinancialProjectionPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const flockId = params.id as string;
  const [summary, setSummary] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [flock, setFlock] = useState<any>(null);
  const [error, setError] = useState("");
  const [projection, setProjection] = useState<any>(null);

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (user && flockId) {
      apiFetch(`/api/v1/financial-records/summary?flockId=${flockId}`)
        .then((data: any) => setSummary(data))
        .catch((err) => setError(err.message));
      apiFetch(`/api/v1/financial-records?flockId=${flockId}`)
        .then((data: any) => setRecords(data))
        .catch(() => {});
      apiFetch(`/api/v1/broiler-flocks/${flockId}`)
        .then((data: any) => setFlock(data))
        .catch(() => {});
    }
  }, [user, isLoading, flockId, router]);

  function calculateProjection() {
    if (!flock || !summary) return;
    const currentCost = summary.totalCost || 0;
    const currentRevenue = summary.totalRevenue || 0;
    const birds = flock.currentCount || 1;
    const targetWeight = flock.targetWeight || 2.5;
    const pricePerKg = 25; // Approximate ZMW per kg
    const projectedRevenue = birds * targetWeight * pricePerKg;
    const projectedProfit = projectedRevenue - currentCost;
    const breakEvenPrice = currentCost / (birds * targetWeight);

    setProjection({
      currentCost,
      currentRevenue,
      projectedRevenue,
      projectedProfit,
      breakEvenPrice,
      profitPerBird: projectedProfit / birds,
      roi: currentCost > 0 ? ((projectedRevenue - currentCost) / currentCost * 100) : 0,
    });
  }

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={() => router.push(`/broiler-flocks/${flockId}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-3xl font-bold">Financial Projection</h1>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {summary && (
        <>
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card><CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Cost</p>
              <p className="text-2xl font-bold text-red-600">ZMW {Number(summary.totalCost).toFixed(2)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold text-green-600">ZMW {Number(summary.totalRevenue).toFixed(2)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Current Profit</p>
              <p className={`text-2xl font-bold ${summary.profit >= 0 ? "text-green-600" : "text-red-600"}`}>ZMW {Number(summary.profit).toFixed(2)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Profit per Bird</p>
              <p className={`text-2xl font-bold ${summary.profitPerBird >= 0 ? "text-green-600" : "text-red-600"}`}>ZMW {Number(summary.profitPerBird).toFixed(2)}</p>
            </CardContent></Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Link href={`/financials/income-statement?flockIds=${flockId}`}>
              <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardContent className="pt-6 flex items-center gap-3">
                  <FileText className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">Income Statement</p>
                    <p className="text-sm text-muted-foreground">P&L for this flock</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href={`/financials/balance-sheet?flockIds=${flockId}`}>
              <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardContent className="pt-6 flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">Balance Sheet</p>
                    <p className="text-sm text-muted-foreground">Assets & liabilities</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href={`/financials/cash-flow?flockIds=${flockId}`}>
              <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardContent className="pt-6 flex items-center gap-3">
                  <Wallet className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="font-medium">Cash Flow</p>
                    <p className="text-sm text-muted-foreground">Operating & investing</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-2 mb-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" />Projected Harvest Revenue</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground">Current Birds</label>
                      <p className="font-medium">{flock?.currentCount || "-"}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Target Weight</label>
                      <p className="font-medium">{flock?.targetWeight || "-"} kg</p>
                    </div>
                  </div>
                  <Button onClick={calculateProjection} className="w-full">Calculate Projection</Button>
                  {projection && (
                    <div className="mt-4 p-4 bg-muted rounded-lg space-y-2 text-sm">
                      <div className="flex justify-between"><span>Projected Revenue</span><span className="font-medium text-green-600">ZMW {projection.projectedRevenue.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>Projected Profit</span><span className={`font-medium ${projection.projectedProfit >= 0 ? "text-green-600" : "text-red-600"}`}>ZMW {projection.projectedProfit.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>Profit per Bird</span><span className="font-medium">ZMW {projection.profitPerBird.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>Break-even Price/kg</span><span className="font-medium">ZMW {projection.breakEvenPrice.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>ROI</span><span className={`font-medium ${projection.roi >= 0 ? "text-green-600" : "text-red-600"}`}>{projection.roi.toFixed(1)}%</span></div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" />Cost Breakdown</CardTitle></CardHeader>
              <CardContent>
                {summary.categoryBreakdown?.length > 0 ? (
                  <div className="space-y-3">
                    {summary.categoryBreakdown.map((c: any) => (
                      <div key={c.category}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="capitalize">{c.category.replace(/_/g, " ")}</span>
                          <span className="font-medium">ZMW {Number(c._sum.amountZmw).toFixed(2)}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${summary.totalCost > 0 ? (Number(c._sum.amountZmw) / Number(summary.totalCost) * 100) : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-muted-foreground">No financial records yet.</p>}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Financial Records</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left py-2">Date</th><th className="text-left py-2">Category</th><th className="text-left py-2">Description</th><th className="text-left py-2">Amount (ZMW)</th><th className="text-left py-2">Type</th></tr></thead>
                  <tbody>
                    {records.map((r: any) => (
                      <tr key={r.id} className="border-b">
                        <td className="py-2">{new Date(r.recordDate).toLocaleDateString()}</td>
                        <td className="py-2 capitalize">{r.category.replace(/_/g, " ")}</td>
                        <td className="py-2">{r.description}</td>
                        <td className={`py-2 font-medium ${r.isIncome ? "text-green-600" : ""}`}>ZMW {Number(r.amountZmw).toFixed(2)}</td>
                        <td className="py-2">{r.isIncome ? <span className="text-green-600">Income</span> : <span className="text-red-600">Expense</span>}</td>
                      </tr>
                    ))}
                    {records.length === 0 && <tr><td colSpan={5} className="py-4 text-muted-foreground text-center">No financial records yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
