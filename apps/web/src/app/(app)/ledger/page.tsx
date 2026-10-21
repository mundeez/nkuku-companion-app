"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import type { TrialBalance } from "@/lib/types/ledger";
import { CheckCircle2, AlertCircle, Download, BookOpen, FileText, Wallet, TrendingUp } from "lucide-react";

function fmt(s: string): string {
  const n = parseFloat(s);
  if (isNaN(n) || n === 0) return "—";
  return n.toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function LedgerPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [tb, setTb] = useState<TrialBalance | null>(null);
  const [error, setError] = useState("");
  const [asOf, setAsOf] = useState(new Date().toISOString().substring(0, 10));

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      apiFetch<TrialBalance>(`/api/v1/ledger/trial-balance?asOf=${asOf}`)
        .then(setTb)
        .catch((err) => setError(err.message));
    }
  }, [user, asOf]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;
  if (error) return <div className="p-8 text-destructive">{error}</div>;
  if (!tb) return <div className="p-8">Loading trial balance...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Ledger</h1>
          <p className="text-muted-foreground">Double-entry bookkeeping & financial statements</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-input bg-background text-sm"
          />
          <a href={`/api/v1/ledger/export/trial-balance?asOf=${asOf}`} target="_blank">
            <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />CSV</Button>
          </a>
        </div>
      </div>

      {/* ── Quick Links ─────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Link href="/ledger/accounts">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chart of Accounts</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-xs text-muted-foreground">View all accounts</p></CardContent>
          </Card>
        </Link>
        <Link href="/ledger/journal">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Journal Entries</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-xs text-muted-foreground">View & post entries</p></CardContent>
          </Card>
        </Link>
        <Link href="/ledger/journal/new">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New Entry</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-xs text-muted-foreground">Post manual journal entry</p></CardContent>
          </Card>
        </Link>
        {(user.role === "owner") && (
          <Link href="/ledger/close">
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Year-End Close</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><p className="text-xs text-muted-foreground">Close fiscal year</p></CardContent>
            </Card>
          </Link>
        )}
      </div>

      {/* ── Financial Statement Links ────────────── */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Link href={`/ledger/income-statement?fromDate=${asOf.substring(0,4)}-01-01&toDate=${asOf}`}>
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Income Statement</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-xs text-muted-foreground">Revenue, COGS & Net Profit</p></CardContent>
          </Card>
        </Link>
        <Link href={`/ledger/balance-sheet?asOf=${asOf}`}>
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Balance Sheet</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-xs text-muted-foreground">Assets = Liabilities + Equity</p></CardContent>
          </Card>
        </Link>
        <Link href={`/ledger/cash-flow?fromDate=${asOf.substring(0,4)}-01-01&toDate=${asOf}`}>
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cash Flow</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-xs text-muted-foreground">Operating, investing & financing</p></CardContent>
          </Card>
        </Link>
      </div>

      {/* ── Trial Balance ────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Trial Balance</CardTitle>
            <div className="flex items-center gap-2">
              {tb.isBalanced ? (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" /> Balanced
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" /> Out of Balance
                </span>
              )}
              <span className="text-sm text-muted-foreground">As of {tb.asOfDate}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Code</th>
                  <th className="text-left py-2 px-3 font-medium">Account Name</th>
                  <th className="text-left py-2 px-3 font-medium">Type</th>
                  <th className="text-right py-2 px-3 font-medium">Debit (ZMW)</th>
                  <th className="text-right py-2 px-3 font-medium">Credit (ZMW)</th>
                </tr>
              </thead>
              <tbody>
                {tb.lines.map((line) => (
                  <tr key={line.accountCode} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3 font-mono">{line.accountCode}</td>
                    <td className="py-2 px-3">{line.accountName}</td>
                    <td className="py-2 px-3 text-muted-foreground capitalize">{line.accountType}</td>
                    <td className="py-2 px-3 text-right font-mono">{fmt(line.debitBalance)}</td>
                    <td className="py-2 px-3 text-right font-mono">{fmt(line.creditBalance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold">
                  <td colSpan={3} className="py-3 px-3">TOTALS</td>
                  <td className="py-3 px-3 text-right font-mono">{parseFloat(tb.totalDebits).toLocaleString("en-ZM", { minimumFractionDigits: 2 })}</td>
                  <td className="py-3 px-3 text-right font-mono">{parseFloat(tb.totalCredits).toLocaleString("en-ZM", { minimumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {tb.lines.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No journal entries found for this date.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
