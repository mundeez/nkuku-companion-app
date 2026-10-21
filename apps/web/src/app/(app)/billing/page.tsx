"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { BillingSettings } from "@/components/billing/billing-settings";
import { useEffect } from "react";

export default function BillingPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-2">Billing & Plans</h1>
      <p className="text-muted-foreground mb-8">
        Manage your subscription, view invoices, and upgrade your plan
      </p>
      <BillingSettings />
    </div>
  );
}
