"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp } from "lucide-react";

export default function GrowthAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const flockId = params.id as string;
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (user && flockId) {
      apiFetch(`/api/v1/growth-records/analysis?flockId=${flockId}`)
        .then(setData)
        .catch((err) => setError(err.message));
    }
  }, [user, isLoading, flockId, router]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;
  if (!data) return <div className="p-8">Loading analysis...</div>;

  const { records, ageDays, targets, fcr, currentCount } = data;
  const latest = records[records.length - 1];

  // Build comparison data
  const comparison = targets
    .filter((t: any) => records.some((r: any) => {
      const rAge = Math.floor((new Date(r.recordDate).getTime() - new Date(data.flock?.startDate || 0).getTime()) / 86400000);
      return Math.abs(rAge - t.ageDays) <= 1;
    }))
    .slice(0, 10);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={() => router.push(`/broiler-flocks/${flockId}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Flock
        </Button>
        <h1 className="text-3xl font-bold">Growth Analysis</h1>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Current Age</p>
          <p className="text-2xl font-bold">{ageDays} days</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Latest Weight</p>
          <p className="text-2xl font-bold">{latest ? `${latest.avgWeight}g` : "-"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">FCR (Feed Conversion)</p>
          <p className="text-2xl font-bold">{fcr ? fcr.toFixed(2) : "N/A"}</p>
        </CardContent></Card>
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Weight vs Ross 308 Targets</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left py-2">Age (days)</th><th className="text-left py-2">Actual Weight</th><th className="text-left py-2">Ross 308 Target</th><th className="text-left py-2">Variance</th></tr></thead>
              <tbody>
                {records.map((r: any, i: number) => {
                  const rAge = Math.floor((new Date(r.recordDate).getTime() - new Date(data.flock?.startDate || 0).getTime()) / 86400000);
                  const target = targets.find((t: any) => Math.abs(t.ageDays - rAge) <= 1);
                  const targetWeight = target ? Number(target.targetWeight) * 1000 : null;
                  const variance = targetWeight ? ((Number(r.avgWeight) - targetWeight) / targetWeight * 100).toFixed(1) : null;
                  return (
                    <tr key={r.id} className="border-b">
                      <td className="py-2">{rAge}</td>
                      <td className="py-2 font-medium">{r.avgWeight}g</td>
                      <td className="py-2 text-muted-foreground">{targetWeight ? `${targetWeight.toFixed(0)}g` : "-"}</td>
                      <td className={`py-2 ${variance && Number(variance) < 0 ? "text-red-600" : "text-green-600"}`}>{variance ? `${variance}%` : "-"}</td>
                    </tr>
                  );
                })}
                {records.length === 0 && <tr><td colSpan={4} className="py-4 text-muted-foreground text-center">No growth records yet. Add records on the flock detail page.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ross 308 Performance Targets (Reference)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-sm">
            {targets.slice(0, 28).map((t: any) => (
              <div key={t.ageDays} className="p-2 border rounded bg-muted/30">
                <p className="font-medium">Day {t.ageDays}</p>
                <p className="text-muted-foreground">{t.targetWeight}kg</p>
                <p className="text-muted-foreground text-xs">FCR: {t.targetFcr}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
