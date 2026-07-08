"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import type { IncomeStatement } from "@/lib/types/ledger";
import { ArrowLeft, AlertTriangle, CheckCircle2, Lock } from "lucide-react";

function fmt(s: string): string {
  const n = parseFloat(s);
  if (isNaN(n)) return "0.00";
  return n.toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function YearEndClosePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [incomeStmt, setIncomeStmt] = useState<IncomeStatement | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (user && user.role !== "owner") { router.push("/ledger"); return; }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      apiFetch<IncomeStatement>(`/api/v1/ledger/income-statement?fromDate=${year}-01-01&toDate=${year}-12-31`)
        .then(setIncomeStmt)
        .catch((err) => setError(err.message));
    }
  }, [user, year]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;
  if (error && !incomeStmt) return <div className="p-8 text-destructive">{error}</div>;

  const handleClose = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await apiFetch(`/api/v1/ledger/year-end-close`, {
        method: "POST",
        body: JSON.stringify({ year }),
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/ledger" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" />Back to Ledger
      </Link>

      <h1 className="text-3xl font-bold mb-2">Year-End Close</h1>
      <p className="text-muted-foreground mb-6">
        Post closing entries to zero out all revenue and expense accounts, and transfer net income to Retained Earnings.
      </p>

      {/* ── Warning ──────────────────────────────── */}
      <Card className="mb-6 border-amber-500/50">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-amber-600 mb-1">Important</p>
            <p className="text-muted-foreground">
              This action will post journal entries that close all revenue and expense accounts for the selected year.
              After closing, these accounts will have zero balances. This action is idempotent — running it again
              will have no effect if accounts are already closed.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Year Selector ────────────────────────── */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Select Fiscal Year</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Year:</label>
            <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
              className="px-3 py-1.5 rounded-md border border-input bg-background text-sm">
              {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* ── Income Statement Preview ─────────────── */}
      {incomeStmt && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Income Statement Preview — {year}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Revenue</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {incomeStmt.revenue.map((r) => (
                      <tr key={r.accountCode} className="border-b">
                        <td className="py-1.5 px-2 font-mono text-xs">{r.accountCode}</td>
                        <td className="py-1.5 px-2">{r.accountName}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{fmt(r.netBalance)}</td>
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td colSpan={2} className="py-2 px-2">Total Revenue</td>
                      <td className="py-2 px-2 text-right font-mono">{fmt(incomeStmt.totalRevenue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Expenses</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {[...incomeStmt.costOfGoodsSold, ...incomeStmt.operatingExpenses].map((e) => (
                      <tr key={e.accountCode} className="border-b">
                        <td className="py-1.5 px-2 font-mono text-xs">{e.accountCode}</td>
                        <td className="py-1.5 px-2">{e.accountName}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{fmt(e.netBalance)}</td>
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td colSpan={2} className="py-2 px-2">Total Expenses</td>
                      <td className="py-2 px-2 text-right font-mono">
                        {fmt((parseFloat(incomeStmt.totalCogs) + parseFloat(incomeStmt.totalOperatingExpenses)).toFixed(2))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between p-4 rounded-md bg-muted">
                <span className="font-bold">Net Income for {year}</span>
                <span className={`font-bold font-mono text-lg ${parseFloat(incomeStmt.netProfit) >= 0 ? "text-green-600" : "text-red-600"}`}>
                  ZMW {fmt(incomeStmt.netProfit)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Close Action ─────────────────────────── */}
      {result ? (
        <Card className="border-green-500/50">
          <CardContent className="p-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-green-600 mb-1">Year-End Close Complete</p>
              <p className="text-muted-foreground">
                Revenue closed: ZMW {fmt(result.revenueClosed)} · Expenses closed: ZMW {fmt(result.expenseClosed)} ·
                Net income transferred: ZMW {fmt(result.netIncome)}
              </p>
              {result.journalEntryId && (
                <Link href={`/ledger/journal/${result.journalEntryId}`} className="text-primary hover:underline mt-1 inline-block">
                  View closing journal entry →
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={handleClose} disabled={submitting || !incomeStmt} size="lg">
          <Lock className="h-4 w-4 mr-2" />
          {submitting ? "Closing..." : `Close Year ${year}`}
        </Button>
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
    </div>
  );
}
