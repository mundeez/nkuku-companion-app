"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { AdCampaignForm } from "@/components/ads/AdCampaignForm";

export default function NewAdCampaignPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && (!user || !user.isPlatformAdmin)) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user?.isPlatformAdmin) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-6">New Ad Campaign</h1>
      <AdCampaignForm />
    </div>
  );
}
