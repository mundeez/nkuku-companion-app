"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";

export default function BalanceSheetPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [sheet, setSheet] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (user) {
      apiFetch("/api/v1/financial-engine/balance-sheet")
        .then(setSheet)
        .catch((err) => setError(err.message));
    }
  }, [user, isLoading, router]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  const s = sheet ?? {
    asOfDate: new Date().toISOString(),
    assets: { current: { cash: 0, receivables: 0, inventory: 0, total: 0 }, fixed: { equipment: 0, facilities: 0, total: 0 }, total: 0 },
    liabilities: { current: { payables: 0, shortTermDebt: 0, total: 0 }, longTerm: { loans: 0, total: 0 }, total: 0 },
    equity: { ownerCapital: 0, retainedEarnings: 0, total: 0 },
    totalLiabilitiesAndEquity: 0,
  };

  function downloadCsv() {
    window.open("/api/v1/financial-engine/export/balance-sheet?format=csv", "_blank");
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/financials"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
        <h1 className="text-3xl font-bold">Balance Sheet</h1>
        <Button variant="outline" size="sm" onClick={downloadCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Balance Sheet</CardTitle>
          <p className="text-sm text-muted-foreground">As of {new Date(s.asOfDate).toLocaleDateString()}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Assets */}
            <div>
              <h3 className="font-semibold text-lg mb-2">Assets</h3>
              <div className="pl-4 space-y-1">
                <p className="font-medium">Current Assets</p>
                <div className="pl-4 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Cash</span><span>ZMW {Number(s.assets.current.cash).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Receivables</span><span>ZMW {Number(s.assets.current.receivables).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Inventory</span><span>ZMW {Number(s.assets.current.inventory).toFixed(2)}</span></div>
                </div>
                <div className="flex justify-between font-medium border-t pt-1"><span>Total Current Assets</span><span>ZMW {Number(s.assets.current.total).toFixed(2)}</span></div>

                <p className="font-medium mt-3">Fixed Assets</p>
                <div className="pl-4 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Equipment</span><span>ZMW {Number(s.assets.fixed.equipment).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Facilities</span><span>ZMW {Number(s.assets.fixed.facilities).toFixed(2)}</span></div>
                </div>
                <div className="flex justify-between font-medium border-t pt-1"><span>Total Fixed Assets</span><span>ZMW {Number(s.assets.fixed.total).toFixed(2)}</span></div>
              </div>
              <div className="flex justify-between font-bold text-lg border-t-2 border-primary pt-2 mt-2"><span>Total Assets</span><span>ZMW {Number(s.assets.total).toFixed(2)}</span></div>
            </div>

            {/* Liabilities */}
            <div>
              <h3 className="font-semibold text-lg mb-2">Liabilities</h3>
              <div className="pl-4 space-y-1">
                <p className="font-medium">Current Liabilities</p>
                <div className="pl-4 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Payables</span><span>ZMW {Number(s.liabilities.current.payables).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Short-term Debt</span><span>ZMW {Number(s.liabilities.current.shortTermDebt).toFixed(2)}</span></div>
                </div>
                <div className="flex justify-between font-medium border-t pt-1"><span>Total Current Liabilities</span><span>ZMW {Number(s.liabilities.current.total).toFixed(2)}</span></div>

                <p className="font-medium mt-3">Long-term Liabilities</p>
                <div className="pl-4 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Loans</span><span>ZMW {Number(s.liabilities.longTerm.loans).toFixed(2)}</span></div>
                </div>
                <div className="flex justify-between font-medium border-t pt-1"><span>Total Long-term Liabilities</span><span>ZMW {Number(s.liabilities.longTerm.total).toFixed(2)}</span></div>
              </div>
              <div className="flex justify-between font-bold text-lg border-t-2 border-primary pt-2 mt-2"><span>Total Liabilities</span><span>ZMW {Number(s.liabilities.total).toFixed(2)}</span></div>
            </div>

            {/* Equity */}
            <div>
              <h3 className="font-semibold text-lg mb-2">Equity</h3>
              <div className="pl-4 space-y-1 text-sm">
                <div className="flex justify-between"><span>Owner Capital</span><span>ZMW {Number(s.equity.ownerCapital).toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Retained Earnings</span><span>ZMW {Number(s.equity.retainedEarnings).toFixed(2)}</span></div>
              </div>
              <div className="flex justify-between font-bold text-lg border-t-2 border-primary pt-2 mt-2"><span>Total Equity</span><span>ZMW {Number(s.equity.total).toFixed(2)}</span></div>
            </div>

            {/* Balance check */}
            <div className="flex justify-between font-bold text-xl border-t-4 border-primary pt-3">
              <span>Total Liabilities + Equity</span>
              <span>ZMW {Number(s.totalLiabilitiesAndEquity).toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
