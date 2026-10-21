"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import type { BalanceSheet } from "@/lib/types/ledger";
import { ArrowLeft, Download, CheckCircle2, AlertCircle } from "lucide-react";

function fmt(s: string): string {
  const n = parseFloat(s);
  if (isNaN(n) || n === 0) return "—";
  return n.toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BalanceSheetPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [stmt, setStmt] = useState<BalanceSheet | null>(null);
  const [error, setError] = useState("");
  const today = new Date().toISOString().substring(0, 10);
  const [asOf, setAsOf] = useState(today);

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      apiFetch<BalanceSheet>(`/api/v1/ledger/balance-sheet?asOf=${asOf}`)
        .then(setStmt)
        .catch((err) => setError(err.message));
    }
  }, [user, asOf]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;
  if (error) return <div className="p-8 text-destructive">{error}</div>;
  if (!stmt) return <div className="p-8">Loading balance sheet...</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/ledger" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" />Back to Ledger
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Balance Sheet</h1>
          <p className="text-muted-foreground">As of {stmt.asOfDate}</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-input bg-background text-sm" />
          <a href={`/api/v1/ledger/balance-sheet?asOf=${asOf}&format=csv`} target="_blank">
            <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />CSV</Button>
          </a>
        </div>
      </div>

      {/* Balance check */}
      <div className={`mb-4 p-3 rounded-md flex items-center gap-2 ${stmt.isBalanced ? "bg-green-600/10" : "bg-red-600/10"}`}>
        {stmt.isBalanced ? (
          <><CheckCircle2 className="h-5 w-5 text-green-600" /><span className="text-sm font-medium text-green-600">Balanced: Assets = Liabilities + Equity</span></>
        ) : (
          <><AlertCircle className="h-5 w-5 text-red-600" /><span className="text-sm font-medium text-red-600">Out of balance — difference: ZMW {(parseFloat(stmt.totalAssets) - parseFloat(stmt.totalLiabilitiesAndEquity)).toFixed(2)}</span></>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Assets */}
        <Card>
          <CardHeader><CardTitle className="text-base">Assets</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <tbody>
                {stmt.assets.map((a) => (
                  <tr key={a.accountCode} className="border-b">
                    <td className="py-2 px-2 font-mono text-xs">{a.accountCode}</td>
                    <td className="py-2 px-2">{a.accountName}</td>
                    <td className="py-2 px-2 text-right font-mono">{fmt(a.balance)}</td>
                  </tr>
                ))}
                <tr className="font-bold border-t-2">
                  <td colSpan={2} className="py-3 px-2">Total Assets</td>
                  <td className="py-3 px-2 text-right font-mono">{fmt(stmt.totalAssets)}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Liabilities + Equity */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Liabilities</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <tbody>
                  {stmt.liabilities.map((l) => (
                    <tr key={l.accountCode} className="border-b">
                      <td className="py-2 px-2 font-mono text-xs">{l.accountCode}</td>
                      <td className="py-2 px-2">{l.accountName}</td>
                      <td className="py-2 px-2 text-right font-mono">{fmt(l.balance)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold border-t-2">
                    <td colSpan={2} className="py-3 px-2">Total Liabilities</td>
                    <td className="py-3 px-2 text-right font-mono">{fmt(stmt.totalLiabilities)}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Equity</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <tbody>
                  {stmt.equity.map((e) => (
                    <tr key={e.accountCode} className="border-b">
                      <td className="py-2 px-2 font-mono text-xs">{e.accountCode}</td>
                      <td className="py-2 px-2">{e.accountName}</td>
                      <td className="py-2 px-2 text-right font-mono">{fmt(e.balance)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold border-t-2">
                    <td colSpan={2} className="py-3 px-2">Total Equity</td>
                    <td className="py-3 px-2 text-right font-mono">{fmt(stmt.totalEquity)}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between p-4 rounded-md bg-muted">
            <span className="font-bold">Total L + E</span>
            <span className="font-bold font-mono">{fmt(stmt.totalLiabilitiesAndEquity)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
