"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import type { IncomeStatement } from "@/lib/types/ledger";
import { ArrowLeft, Download } from "lucide-react";

function fmt(s: string): string {
  const n = parseFloat(s);
  if (isNaN(n) || n === 0) return "—";
  return n.toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function IncomeStatementPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [stmt, setStmt] = useState<IncomeStatement | null>(null);
  const [error, setError] = useState("");
  const today = new Date().toISOString().substring(0, 10);
  const yearStart = `${today.substring(0, 4)}-01-01`;
  const [fromDate, setFromDate] = useState(yearStart);
  const [toDate, setToDate] = useState(today);

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      apiFetch<IncomeStatement>(`/api/v1/ledger/income-statement?fromDate=${fromDate}&toDate=${toDate}`)
        .then(setStmt)
        .catch((err) => setError(err.message));
    }
  }, [user, fromDate, toDate]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;
  if (error) return <div className="p-8 text-destructive">{error}</div>;
  if (!stmt) return <div className="p-8">Loading income statement...</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/ledger" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" />Back to Ledger
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Income Statement</h1>
          <p className="text-muted-foreground">{stmt.periodFrom} to {stmt.periodTo}</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-input bg-background text-sm" />
          <span className="text-muted-foreground">to</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-input bg-background text-sm" />
          <a href={`/api/v1/ledger/income-statement?fromDate=${fromDate}&toDate=${toDate}&format=csv`} target="_blank">
            <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />CSV</Button>
          </a>
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Revenue</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              {stmt.revenue.map((r) => (
                <tr key={r.accountCode} className="border-b">
                  <td className="py-2 px-3 font-mono text-xs">{r.accountCode}</td>
                  <td className="py-2 px-3">{r.accountName}</td>
                  <td className="py-2 px-3 text-right font-mono">{fmt(r.netBalance)}</td>
                </tr>
              ))}
              <tr className="font-bold border-t-2">
                <td colSpan={2} className="py-3 px-3">Total Revenue</td>
                <td className="py-3 px-3 text-right font-mono">{fmt(stmt.totalRevenue)}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Cost of Goods Sold</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              {stmt.costOfGoodsSold.map((r) => (
                <tr key={r.accountCode} className="border-b">
                  <td className="py-2 px-3 font-mono text-xs">{r.accountCode}</td>
                  <td className="py-2 px-3">{r.accountName}</td>
                  <td className="py-2 px-3 text-right font-mono">({fmt(r.netBalance)})</td>
                </tr>
              ))}
              <tr className="font-bold border-t-2">
                <td colSpan={2} className="py-3 px-3">Total COGS</td>
                <td className="py-3 px-3 text-right font-mono">({fmt(stmt.totalCogs)})</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between p-4 rounded-md bg-muted mb-4">
        <span className="font-bold">Gross Profit</span>
        <span className={`font-bold font-mono text-lg ${parseFloat(stmt.grossProfit) >= 0 ? "text-green-600" : "text-red-600"}`}>
          ZMW {fmt(stmt.grossProfit)}
        </span>
      </div>

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Operating Expenses</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              {stmt.operatingExpenses.map((r) => (
                <tr key={r.accountCode} className="border-b">
                  <td className="py-2 px-3 font-mono text-xs">{r.accountCode}</td>
                  <td className="py-2 px-3">{r.accountName}</td>
                  <td className="py-2 px-3 text-right font-mono">({fmt(r.netBalance)})</td>
                </tr>
              ))}
              <tr className="font-bold border-t-2">
                <td colSpan={2} className="py-3 px-3">Total Operating Expenses</td>
                <td className="py-3 px-3 text-right font-mono">({fmt(stmt.totalOperatingExpenses)})</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <div className="flex items-center justify-between p-4 rounded-md bg-muted">
          <span className="font-bold">Operating Profit (EBIT)</span>
          <span className={`font-bold font-mono ${parseFloat(stmt.operatingProfit) >= 0 ? "text-green-600" : "text-red-600"}`}>
            ZMW {fmt(stmt.operatingProfit)}
          </span>
        </div>
        <div className="flex items-center justify-between p-4 rounded-md bg-primary/10">
          <span className="font-bold text-lg">Net Profit</span>
          <span className={`font-bold font-mono text-lg ${parseFloat(stmt.netProfit) >= 0 ? "text-green-600" : "text-red-600"}`}>
            ZMW {fmt(stmt.netProfit)}
          </span>
        </div>
      </div>
    </div>
  );
}
