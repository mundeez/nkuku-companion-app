"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";

export default function IncomeStatementPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [stmt, setStmt] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (user) {
      apiFetch("/api/v1/financial-engine/income-statement")
        .then(setStmt)
        .catch((err) => setError(err.message));
    }
  }, [user, isLoading, router]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  const s = stmt ?? {
    period: { startDate: new Date().toISOString(), endDate: new Date().toISOString() },
    revenue: { total: 0, byCategory: {} },
    cogs: { total: 0, byCategory: {} },
    grossProfit: 0, grossMargin: 0,
    operatingExpenses: { total: 0, byCategory: {} },
    netProfit: 0, netMargin: 0,
  };

  function downloadCsv() {
    window.open("/api/v1/financial-engine/export/income-statement?format=csv", "_blank");
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/financials"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
        <h1 className="text-3xl font-bold">Income Statement</h1>
        <Button variant="outline" size="sm" onClick={downloadCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Profit &amp; Loss</CardTitle>
          <p className="text-sm text-muted-foreground">{new Date(s.period.startDate).toLocaleDateString()} — {new Date(s.period.endDate).toLocaleDateString()}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Revenue */}
            <div>
              <h3 className="font-semibold text-lg mb-2">Revenue</h3>
              {Object.entries(s.revenue.byCategory).map(([cat, amt]: [string, any]) => (
                <div key={cat} className="flex justify-between py-1 text-sm"><span className="capitalize">{cat.replace(/_/g, " ")}</span><span>ZMW {Number(amt).toFixed(2)}</span></div>
              ))}
              <div className="flex justify-between py-2 border-t font-medium"><span>Total Revenue</span><span className="text-green-600">ZMW {Number(s.revenue.total).toFixed(2)}</span></div>
            </div>

            {/* COGS */}
            <div>
              <h3 className="font-semibold text-lg mb-2">Cost of Goods Sold</h3>
              {Object.entries(s.cogs.byCategory).map(([cat, amt]: [string, any]) => (
                <div key={cat} className="flex justify-between py-1 text-sm"><span className="capitalize">{cat.replace(/_/g, " ")}</span><span>ZMW {Number(amt).toFixed(2)}</span></div>
              ))}
              <div className="flex justify-between py-2 border-t font-medium"><span>Total COGS</span><span className="text-red-600">ZMW {Number(s.cogs.total).toFixed(2)}</span></div>
            </div>

            {/* Gross Profit */}
            <div className="flex justify-between py-3 border-t-2 border-primary font-bold text-lg">
              <span>Gross Profit</span>
              <span className={s.grossProfit >= 0 ? "text-green-600" : "text-red-600"}>ZMW {Number(s.grossProfit).toFixed(2)} ({Number(s.grossMargin).toFixed(1)}%)</span>
            </div>

            {/* Operating Expenses */}
            <div>
              <h3 className="font-semibold text-lg mb-2">Operating Expenses</h3>
              {Object.entries(s.operatingExpenses.byCategory).map(([cat, amt]: [string, any]) => (
                <div key={cat} className="flex justify-between py-1 text-sm"><span className="capitalize">{cat.replace(/_/g, " ")}</span><span>ZMW {Number(amt).toFixed(2)}</span></div>
              ))}
              <div className="flex justify-between py-2 border-t font-medium"><span>Total OpEx</span><span className="text-red-600">ZMW {Number(s.operatingExpenses.total).toFixed(2)}</span></div>
            </div>

            {/* Net Profit */}
            <div className="flex justify-between py-3 border-t-2 border-primary font-bold text-xl">
              <span>Net Profit</span>
              <span className={s.netProfit >= 0 ? "text-green-600" : "text-red-600"}>ZMW {Number(s.netProfit).toFixed(2)} ({Number(s.netMargin).toFixed(1)}%)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
