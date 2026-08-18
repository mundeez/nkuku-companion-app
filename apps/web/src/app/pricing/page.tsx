"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { getBillingPlans } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Zap, Crown, Loader2 } from "lucide-react";

interface Plan {
  code: string;
  name: string;
  description: string;
  pricing: { monthly: Record<string, number> };
  limits: {
    maxActiveFlocks: number;
    maxUsers: number;
    maxDocumentsPerRecord: number;
    features: string[];
  };
  isSelfServe: boolean;
}

const PLAN_ICONS: Record<string, any> = { free: Check, grower: Zap, business: Crown };

const FEATURE_NAMES: Record<string, string> = {
  financial_dashboard: "Financial dashboard",
  double_entry_ledger: "Double-entry ledger",
  document_attachments: "Document attachments",
  full_alerts: "Advanced alert system",
  multi_site: "Multi-site management",
  gaap_statements: "GAAP financial statements",
  csv_pdf_export: "CSV/PDF export",
  api_access: "API access",
  priority_support: "Priority support",
};

export default function PricingPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBillingPlans()
      .then((data) => setPlans(data.plans as Plan[]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-3">Simple, transparent pricing</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Start free with core flock tracking. Upgrade as your farm grows — no hidden fees,
          cancel anytime.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const Icon = PLAN_ICONS[plan.code] || Check;
            const price = plan.pricing.monthly?.ZMW ?? 0;
            const isFree = plan.code === "free";
            return (
              <Card key={plan.code} className={`relative ${plan.code === "grower" ? "border-primary" : ""}`}>
                {plan.code === "grower" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge>Most Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-5 w-5" />
                    {plan.name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <span className="text-3xl font-bold">
                      {isFree ? "Free" : `ZMW ${price.toLocaleString()}`}
                    </span>
                    {!isFree && <span className="text-sm text-muted-foreground ml-1">/ month</span>}
                  </div>
                  <ul className="space-y-2 text-sm mb-6">
                    <FeatureRow
                      included
                      text={
                        plan.limits.maxActiveFlocks === -1
                          ? "Unlimited active flocks"
                          : `${plan.limits.maxActiveFlocks} active flock${plan.limits.maxActiveFlocks !== 1 ? "s" : ""}`
                      }
                    />
                    <FeatureRow
                      included
                      text={plan.limits.maxUsers === -1 ? "Unlimited users" : `${plan.limits.maxUsers} user${plan.limits.maxUsers !== 1 ? "s" : ""}`}
                    />
                    {isFree && <FeatureRow included={false} text="Ad-free experience" />}
                    {isFree && <FeatureRow included={false} text="Financial dashboard & ledger" />}
                    {!isFree &&
                      plan.limits.features
                        .filter((f) => FEATURE_NAMES[f])
                        .map((f) => <FeatureRow key={f} included text={FEATURE_NAMES[f]} />)}
                  </ul>
                  <Link href={user ? "/billing" : "/signup"}>
                    <Button className="w-full" variant={plan.code === "grower" ? "default" : "outline"}>
                      {user ? "Manage plan" : isFree ? "Start free" : `Get ${plan.name}`}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground mt-10">
        Need multi-site management, white-label branding, or a custom SLA?{" "}
        <a href="mailto:sales@nkuku.deeztechnology.solutions" className="underline">
          Talk to us about Enterprise
        </a>
        .
      </p>
    </div>
  );
}

function FeatureRow({ included, text }: { included: boolean; text: string }) {
  return (
    <li className="flex items-start gap-2">
      {included ? (
        <Check className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      )}
      <span className={included ? "" : "text-muted-foreground"}>{text}</span>
    </li>
  );
}
