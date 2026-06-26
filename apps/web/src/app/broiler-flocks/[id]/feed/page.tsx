"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calculator } from "lucide-react";

export default function FeedCalculatorPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const flockId = params.id as string;
  const [summary, setSummary] = useState<any>(null);
  const [flock, setFlock] = useState<any>(null);
  const [supplier, setSupplier] = useState<any>(null);
  const [error, setError] = useState("");
  const [calc, setCalc] = useState({ birds: 1000, days: 42, feedType: "" });
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (user && flockId) {
      apiFetch(`/api/v1/feed-records/summary?flockId=${flockId}`)
        .then(setSummary)
        .catch((err) => setError(err.message));
      apiFetch(`/api/v1/broiler-flocks/${flockId}`)
        .then((f: any) => {
          setFlock(f);
          if (f?.supplierId) {
            apiFetch(`/api/v1/suppliers/${f.supplierId}`)
              .then(setSupplier)
              .catch(() => {});
          }
        })
        .catch(() => {});
    }
  }, [user, isLoading, flockId, router]);

  const feedStages = supplier?.feedStages
    ?.filter((s: any) => s.stageType === "feed" || s.stageType === "chick")
    ?.sort((a: any, b: any) => a.sortOrder - b.sortOrder) || [];

  function runCalculator() {
    const { birds, days, feedType } = calc;
    const lower = feedType.toLowerCase();
    // Ross 308 approximate feed consumption per bird
    let daily = 0.05;
    if (lower.includes("starter")) daily = days <= 10 ? 0.035 : 0.045;
    else if (lower.includes("grower")) daily = days > 10 && days <= 24 ? 0.065 : 0.055;
    else if (lower.includes("finish")) daily = days > 24 ? 0.095 : 0.085;
    else if (lower.includes("pre")) daily = 0.025;
    else if (lower.includes("withdraw")) daily = 0.04;
    const totalFeed = birds * daily * days;
    const bags50kg = Math.ceil(totalFeed / 50);
    const costPerKg = 15; // Approximate ZMW per kg
    const totalCost = totalFeed * costPerKg;

    setResult({
      birds,
      days,
      feedType,
      dailyFeedPerBird: daily,
      totalFeedKg: totalFeed.toFixed(1),
      bags50kg,
      totalCostZmw: totalCost.toFixed(2),
      costPerBird: (totalCost / birds).toFixed(2),
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
        <h1 className="text-3xl font-bold">Feed Calculator</h1>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" />Ross 308 Feed Calculator</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Number of Birds</label>
              <input type="number" className="w-full border rounded-md p-2 mt-1 bg-background text-foreground" value={calc.birds} onChange={(e) => setCalc({ ...calc, birds: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-sm font-medium">Age Range (days)</label>
              <input type="number" className="w-full border rounded-md p-2 mt-1 bg-background text-foreground" value={calc.days} onChange={(e) => setCalc({ ...calc, days: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-sm font-medium">Feed Type</label>
              <select className="w-full border rounded-md p-2 mt-1 bg-background text-foreground" value={calc.feedType} onChange={(e) => setCalc({ ...calc, feedType: e.target.value })}>
                <option value="">{feedStages.length > 0 ? "Select feed type..." : "Loading..."}</option>
                {feedStages.map((s: any) => (
                  <option key={s.id} value={s.stageName}>{s.stageName}</option>
                ))}
              </select>
            </div>
            <Button onClick={runCalculator} className="w-full">Calculate</Button>
            {result && (
              <div className="mt-4 p-4 bg-muted rounded-lg space-y-2 text-sm">
                <div className="flex justify-between"><span>Total Feed</span><span className="font-medium">{result.totalFeedKg} kg</span></div>
                <div className="flex justify-between"><span>50kg Bags Needed</span><span className="font-medium">{result.bags50kg} bags</span></div>
                <div className="flex justify-between"><span>Total Cost</span><span className="font-medium">ZMW {result.totalCostZmw}</span></div>
                <div className="flex justify-between"><span>Cost per Bird</span><span className="font-medium">ZMW {result.costPerBird}</span></div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Actual Feed Summary</CardTitle></CardHeader>
          <CardContent>
            {summary ? (
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-muted-foreground">Total Feed</span><span className="font-medium">{Number(summary.totalFeedKg).toFixed(1)} kg</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total Cost</span><span className="font-medium">ZMW {Number(summary.totalCostZmw).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Cost per Bird</span><span className="font-medium">ZMW {Number(summary.costPerBird).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Current Birds</span><span className="font-medium">{summary.currentCount}</span></div>
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium mb-2">By Feed Type</p>
                  {summary.summary?.map((s: any) => (
                    <div key={s.feedType} className="flex justify-between text-sm py-1 capitalize">
                      <span>{s.feedType}</span>
                      <span>{Number(s._sum.quantityKg).toFixed(1)} kg | ZMW {Number(s._sum.costZmw || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No feed records yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
