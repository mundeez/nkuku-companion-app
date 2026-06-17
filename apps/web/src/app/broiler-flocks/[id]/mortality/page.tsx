"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Skull } from "lucide-react";

export default function MortalityAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const flockId = params.id as string;
  const [summary, setSummary] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (user && flockId) {
      apiFetch(`/api/v1/mortality-events/summary?flockId=${flockId}`)
        .then(setSummary)
        .catch((err) => setError(err.message));
      apiFetch(`/api/v1/mortality-events?flockId=${flockId}`)
        .then(setEvents)
        .catch(() => {});
    }
  }, [user, isLoading, flockId, router]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  // Calculate age distribution
  const ageGroups: any = {};
  events.forEach((e: any) => {
    const age = e.ageDays || 0;
    const group = age <= 7 ? "0-7 days" : age <= 14 ? "8-14 days" : age <= 21 ? "15-21 days" : age <= 28 ? "22-28 days" : "29+ days";
    ageGroups[group] = (ageGroups[group] || 0) + e.count;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={() => router.push(`/broiler-flocks/${flockId}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-3xl font-bold">Mortality Analysis</h1>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {summary && (
        <>
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card><CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Deaths</p>
              <p className="text-2xl font-bold text-red-600">{summary.totalDeaths}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Mortality Rate</p>
              <p className={`text-2xl font-bold ${Number(summary.mortalityRate) > 10 ? "text-red-600" : ""}`}>{summary.mortalityRate}%</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Initial Count</p>
              <p className="text-2xl font-bold">{summary.initialCount}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Current Count</p>
              <p className="text-2xl font-bold">{summary.currentCount}</p>
            </CardContent></Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 mb-6">
            <Card>
              <CardHeader><CardTitle>Cause Breakdown</CardTitle></CardHeader>
              <CardContent>
                {summary.causeBreakdown?.length > 0 ? (
                  <div className="space-y-3">
                    {summary.causeBreakdown.map((c: any) => (
                      <div key={c.cause || "unknown"}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{c.cause || "Unknown"}</span>
                          <span className="font-medium">{c._sum.count} birds</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-red-500 rounded-full" style={{ width: `${summary.totalDeaths > 0 ? (c._sum.count / summary.totalDeaths * 100) : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-muted-foreground">No cause data recorded.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Age Distribution</CardTitle></CardHeader>
              <CardContent>
                {Object.keys(ageGroups).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(ageGroups).map(([group, count]: [string, any]) => (
                      <div key={group}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{group}</span>
                          <span className="font-medium">{count} birds</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${summary.totalDeaths > 0 ? (count / summary.totalDeaths * 100) : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-muted-foreground">No age data recorded.</p>}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Mortality Events</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left py-2">Date</th><th className="text-left py-2">Count</th><th className="text-left py-2">Cause</th><th className="text-left py-2">Age</th></tr></thead>
                  <tbody>
                    {events.map((e: any) => (
                      <tr key={e.id} className="border-b">
                        <td className="py-2">{new Date(e.eventDate).toLocaleDateString()}</td>
                        <td className="py-2 font-medium text-red-600">{e.count}</td>
                        <td className="py-2">{e.cause || "-"}</td>
                        <td className="py-2">{e.ageDays ? `Day ${e.ageDays}` : "-"}</td>
                      </tr>
                    ))}
                    {events.length === 0 && <tr><td colSpan={4} className="py-4 text-muted-foreground text-center">No mortality events recorded.</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
