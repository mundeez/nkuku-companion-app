"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";

export default function CashFlowPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [cf, setCf] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (user) {
      apiFetch("/api/v1/financial-engine/cash-flow")
        .then(setCf)
        .catch((err) => setError(err.message));
    }
  }, [user, isLoading, router]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  const s = cf ?? {
    period: { startDate: new Date().toISOString(), endDate: new Date().toISOString() },
    operating: { inflows: 0, outflows: 0, net: 0 },
    investing: { inflows: 0, outflows: 0, net: 0 },
    financing: { inflows: 0, outflows: 0, net: 0 },
    netChange: 0, openingBalance: 0, closingBalance: 0,
  };

  function downloadCsv() {
    window.open("/api/v1/financial-engine/export/cash-flow?format=csv", "_blank");
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/financials"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
        <h1 className="text-3xl font-bold">Cash Flow Statement</h1>
        <Button variant="outline" size="sm" onClick={downloadCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Cash Flow</CardTitle>
          <p className="text-sm text-muted-foreground">{new Date(s.period.startDate).toLocaleDateString()} — {new Date(s.period.endDate).toLocaleDateString()}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Operating */}
            <div>
              <h3 className="font-semibold text-lg mb-2">Operating Activities</h3>
              <div className="pl-4 space-y-1 text-sm">
                <div className="flex justify-between"><span>Inflows</span><span className="text-green-600">ZMW {Number(s.operating.inflows).toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Outflows</span><span className="text-red-600">ZMW {Number(s.operating.outflows).toFixed(2)}</span></div>
              </div>
              <div className="flex justify-between font-medium border-t pt-1"><span>Net Operating</span><span className={s.operating.net >= 0 ? "text-green-600" : "text-red-600"}>ZMW {Number(s.operating.net).toFixed(2)}</span></div>
            </div>

            {/* Investing */}
            <div>
              <h3 className="font-semibold text-lg mb-2">Investing Activities</h3>
              <div className="pl-4 space-y-1 text-sm">
                <div className="flex justify-between"><span>Inflows</span><span className="text-green-600">ZMW {Number(s.investing.inflows).toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Outflows</span><span className="text-red-600">ZMW {Number(s.investing.outflows).toFixed(2)}</span></div>
              </div>
              <div className="flex justify-between font-medium border-t pt-1"><span>Net Investing</span><span className={s.investing.net >= 0 ? "text-green-600" : "text-red-600"}>ZMW {Number(s.investing.net).toFixed(2)}</span></div>
            </div>

            {/* Financing */}
            <div>
              <h3 className="font-semibold text-lg mb-2">Financing Activities</h3>
              <div className="pl-4 space-y-1 text-sm">
                <div className="flex justify-between"><span>Inflows</span><span className="text-green-600">ZMW {Number(s.financing.inflows).toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Outflows</span><span className="text-red-600">ZMW {Number(s.financing.outflows).toFixed(2)}</span></div>
              </div>
              <div className="flex justify-between font-medium border-t pt-1"><span>Net Financing</span><span className={s.financing.net >= 0 ? "text-green-600" : "text-red-600"}>ZMW {Number(s.financing.net).toFixed(2)}</span></div>
            </div>

            {/* Summary */}
            <div className="flex justify-between font-bold text-lg border-t-2 border-primary pt-2"><span>Net Change</span><span className={s.netChange >= 0 ? "text-green-600" : "text-red-600"}>ZMW {Number(s.netChange).toFixed(2)}</span></div>
            <div className="flex justify-between font-medium"><span>Opening Balance</span><span>ZMW {Number(s.openingBalance).toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-xl border-t-2 border-primary pt-2"><span>Closing Balance</span><span className={s.closingBalance >= 0 ? "text-green-600" : "text-red-600"}>ZMW {Number(s.closingBalance).toFixed(2)}</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
