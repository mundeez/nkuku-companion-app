"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { getAdCampaigns, deleteAdCampaign } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, BarChart3, Loader2 } from "lucide-react";

export default function AdCampaignsAdminPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && (!user || !user.isPlatformAdmin)) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.isPlatformAdmin) {
      getAdCampaigns()
        .then(setCampaigns)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [user]);

  async function handleDelete(id: string) {
    if (!confirm("Mark this campaign as completed? It will stop serving.")) return;
    await deleteAdCampaign(id);
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status: "completed" } : c)));
  }

  if (isLoading || !user?.isPlatformAdmin) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Ad Campaigns</h1>
          <p className="text-muted-foreground">Manage house ad inventory sold to advertisers</p>
        </div>
        <Link href="/admin/ads/new">
          <Button>
            <Plus className="h-4 w-4 mr-1" /> New Campaign
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No campaigns yet. Create one to start serving house ads.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <Card key={c.id}>
              <CardContent className="py-4 flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.creativeImageUrl} alt={c.altText} className="h-14 w-14 rounded object-cover shrink-0 border" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{c.advertiserName}</span>
                    <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
                    <Badge variant="outline">{c.placement}</Badge>
                    <Badge variant="outline">{c.pricingModel}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.pages.join(", ")} · {new Date(c.startDate).toLocaleDateString()} – {new Date(c.endDate).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.impressionsCount} impressions · {c.clicksCount} clicks · spend {c.currency} {Number(c.spendToDate).toLocaleString()}
                    {c.budgetCap ? ` / ${Number(c.budgetCap).toLocaleString()}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Link href={`/admin/ads/${c.id}`}>
                    <Button variant="ghost" size="sm">
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href={`/admin/ads/${c.id}/edit`}>
                    <Button variant="ghost" size="sm">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                  {c.status !== "completed" && (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
