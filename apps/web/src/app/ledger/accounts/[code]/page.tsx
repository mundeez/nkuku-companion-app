"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import type { AccountLedger } from "@/lib/types/ledger";
import { ArrowLeft } from "lucide-react";

function fmt(s: string | null): string {
  if (!s) return "—";
  const n = parseFloat(s);
  if (isNaN(n) || n === 0) return "—";
  return n.toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AccountDetailPage() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;
  const { user, isLoading } = useAuth();
  const [ledger, setLedger] = useState<AccountLedger | null>(null);
  const [error, setError] = useState("");
  const today = new Date().toISOString().substring(0, 10);
  const yearStart = `${today.substring(0, 4)}-01-01`;
  const [fromDate, setFromDate] = useState(yearStart);
  const [toDate, setToDate] = useState(today);

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user && code) {
      apiFetch<AccountLedger>(`/api/v1/ledger/account/${code}?fromDate=${fromDate}&toDate=${toDate}`)
        .then(setLedger)
        .catch((err) => setError(err.message));
    }
  }, [user, code, fromDate, toDate]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;
  if (error) return <div className="p-8 text-destructive">{error}</div>;
  if (!ledger) return <div className="p-8">Loading account ledger...</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/ledger/accounts" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" />Back to Chart of Accounts
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">
            <span className="font-mono text-muted-foreground mr-2">{ledger.account.code}</span>
            {ledger.account.name}
          </h1>
          <p className="text-muted-foreground capitalize">
            {ledger.account.accountType} · Normal balance: {ledger.account.normalBalance}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-input bg-background text-sm" />
          <span className="text-muted-foreground">to</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-input bg-background text-sm" />
        </div>
      </div>

      {/* ── Summary Cards ────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Opening Balance</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold font-mono">{fmt(ledger.openingBalance)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Debits</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold font-mono text-green-600">{fmt(ledger.totalDebits)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Credits</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold font-mono text-red-600">{fmt(ledger.totalCredits)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Closing Balance</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold font-mono">{fmt(ledger.closingBalance)}</div></CardContent>
        </Card>
      </div>

      {/* ── Ledger Entries ───────────────────────── */}
      <Card>
        <CardHeader><CardTitle>General Ledger</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Date</th>
                  <th className="text-left py-2 px-3 font-medium">Entry #</th>
                  <th className="text-left py-2 px-3 font-medium">Description</th>
                  <th className="text-right py-2 px-3 font-medium">Debit</th>
                  <th className="text-right py-2 px-3 font-medium">Credit</th>
                  <th className="text-right py-2 px-3 font-medium">Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.entries.map((entry, i) => (
                  <tr key={i} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3">{entry.date.substring(0, 10)}</td>
                    <td className="py-2 px-3 font-mono text-xs">
                      <Link href={`/ledger/journal/${entry.journalNumber}`} className="text-primary hover:underline">
                        {entry.journalNumber}
                      </Link>
                    </td>
                    <td className="py-2 px-3">{entry.description}</td>
                    <td className="py-2 px-3 text-right font-mono">{fmt(entry.debitZmw)}</td>
                    <td className="py-2 px-3 text-right font-mono">{fmt(entry.creditZmw)}</td>
                    <td className="py-2 px-3 text-right font-mono">{fmt(entry.runningBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ledger.entries.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No entries in this period.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
