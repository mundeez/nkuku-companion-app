"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";
import { ArrowLeft } from "lucide-react";

interface CashFlowStatement {
  periodFrom: string;
  periodTo: string;
  generatedAt: string;
  operatingActivities: { label: string; amount: string }[];
  netOperatingCashFlow: string;
  investingActivities: { label: string; amount: string }[];
  netInvestingCashFlow: string;
  financingActivities: { label: string; amount: string }[];
  netFinancingCashFlow: string;
  netCashFlow: string;
}

function fmt(s: string): string {
  const n = parseFloat(s);
  if (isNaN(n) || n === 0) return "—";
  return n.toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CashFlowPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [stmt, setStmt] = useState<CashFlowStatement | null>(null);
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
      apiFetch<CashFlowStatement>(`/api/v1/ledger/cash-flow?fromDate=${fromDate}&toDate=${toDate}`)
        .then(setStmt)
        .catch((err) => setError(err.message));
    }
  }, [user, fromDate, toDate]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;
  if (error) return <div className="p-8 text-destructive">{error}</div>;
  if (!stmt) return <div className="p-8">Loading cash flow statement...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/ledger" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" />Back to Ledger
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Cash Flow Statement</h1>
          <p className="text-muted-foreground">{stmt.periodFrom} to {stmt.periodTo}</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-input bg-background text-sm" />
          <span className="text-muted-foreground">to</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-input bg-background text-sm" />
        </div>
      </div>

      {/* Operating Activities */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Operating Activities</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              {stmt.operatingActivities.map((a, i) => (
                <tr key={i} className={`border-b ${a.label.startsWith("Net Cash") ? "font-bold border-t-2" : ""}`}>
                  <td className="py-2 px-3">{a.label}</td>
                  <td className="py-2 px-3 text-right font-mono">{fmt(a.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Investing Activities */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Investing Activities</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              {stmt.investingActivities.map((a, i) => (
                <tr key={i} className={`border-b ${a.label.startsWith("Net Cash") ? "font-bold border-t-2" : ""}`}>
                  <td className="py-2 px-3">{a.label}</td>
                  <td className="py-2 px-3 text-right font-mono">{fmt(a.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Financing Activities */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Financing Activities</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              {stmt.financingActivities.map((a, i) => (
                <tr key={i} className={`border-b ${a.label.startsWith("Net Cash") ? "font-bold border-t-2" : ""}`}>
                  <td className="py-2 px-3">{a.label}</td>
                  <td className="py-2 px-3 text-right font-mono">{fmt(a.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Net Cash Flow */}
      <div className="flex items-center justify-between p-6 rounded-md bg-primary/10">
        <span className="font-bold text-lg">Net Change in Cash</span>
        <span className={`font-bold font-mono text-xl ${parseFloat(stmt.netCashFlow) >= 0 ? "text-green-600" : "text-red-600"}`}>
          ZMW {fmt(stmt.netCashFlow)}
        </span>
      </div>
    </div>
  );
}
