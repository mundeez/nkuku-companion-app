"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { getAdCampaign } from "@/lib/api/client";
import { AdCampaignForm } from "@/components/ads/AdCampaignForm";
import { Loader2 } from "lucide-react";

export default function EditAdCampaignPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { user, isLoading } = useAuth();
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && (!user || !user.isPlatformAdmin)) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.isPlatformAdmin) {
      getAdCampaign(id).then(setCampaign).finally(() => setLoading(false));
    }
  }, [user, id]);

  if (isLoading || !user?.isPlatformAdmin) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-6">Edit Ad Campaign</h1>
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <AdCampaignForm campaignId={id} initial={campaign} />
      )}
    </div>
  );
}
