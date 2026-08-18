"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { getAdCampaignStats } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil } from "lucide-react";

export default function AdCampaignStatsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { user, isLoading } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && (!user || !user.isPlatformAdmin)) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.isPlatformAdmin) {
      getAdCampaignStats(id).then(setStats).finally(() => setLoading(false));
    }
  }, [user, id]);

  if (isLoading || !user?.isPlatformAdmin) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Campaign Stats</h1>
        <Link href={`/admin/ads/${id}/edit`}>
          <Button variant="outline">
            <Pencil className="h-4 w-4 mr-1" /> Edit
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : stats ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Impressions</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">{stats.impressionsCount}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Clicks</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">{stats.clicksCount}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">CTR</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">{(stats.ctr * 100).toFixed(2)}%</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Spend to Date</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">
              {stats.spendToDate} {stats.budgetCap ? `/ ${stats.budgetCap}` : ""}
            </CardContent>
          </Card>
          <Card className="sm:col-span-2">
            <CardHeader><CardTitle className="text-base">Impressions by Page</CardTitle></CardHeader>
            <CardContent>
              <ul className="text-sm space-y-1">
                {stats.impressionsByPage.map((r: any) => (
                  <li key={r.page} className="flex justify-between">
                    <span>{r.page}</span>
                    <span className="font-medium">{r.count}</span>
                  </li>
                ))}
                {stats.impressionsByPage.length === 0 && <li className="text-muted-foreground">No data yet.</li>}
              </ul>
            </CardContent>
          </Card>
          <Card className="sm:col-span-2">
            <CardHeader><CardTitle className="text-base">Clicks by Page</CardTitle></CardHeader>
            <CardContent>
              <ul className="text-sm space-y-1">
                {stats.clicksByPage.map((r: any) => (
                  <li key={r.page} className="flex justify-between">
                    <span>{r.page}</span>
                    <span className="font-medium">{r.count}</span>
                  </li>
                ))}
                {stats.clicksByPage.length === 0 && <li className="text-muted-foreground">No data yet.</li>}
              </ul>
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-muted-foreground">Not found.</p>
      )}
    </div>
  );
}
