"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { getBillingPlans } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Zap, Crown, Loader2, Sparkles, Building2, Sprout } from "lucide-react";

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

const PLAN_ICONS: Record<string, any> = {
  trial: Sparkles,
  basic: Sprout,
  grower: Zap,
  business: Crown,
  enterprise: Building2,
  // Legacy code kept so pre-P4 API responses still render sanely.
  free: Check,
};

// trial → basic → grower → business → enterprise
const PLAN_ORDER: Record<string, number> = {
  trial: 0,
  free: 0,
  basic: 1,
  grower: 2,
  business: 3,
  enterprise: 4,
};

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
      .then((data) =>
        setPlans(
          [...(data.plans as Plan[])].sort(
            (a, b) => (PLAN_ORDER[a.code] ?? 99) - (PLAN_ORDER[b.code] ?? 99)
          )
        )
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-3">Simple, transparent pricing</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Start with a 14-day free trial at Business level. Pick a plan as your farm grows —
          no hidden fees, cancel anytime.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3 xl:grid-cols-5">
          {plans.map((plan) => {
            const Icon = PLAN_ICONS[plan.code] || Check;
            const price = plan.pricing.monthly?.ZMW ?? 0;
            const isFreeTier = plan.code === "trial" || plan.code === "free";
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
                      {isFreeTier
                        ? "Free"
                        : price === 0
                        ? "Custom"
                        : `ZMW ${price.toLocaleString()}`}
                    </span>
                    {isFreeTier ? (
                      <span className="text-sm text-muted-foreground ml-1">14-day trial</span>
                    ) : (
                      price > 0 && <span className="text-sm text-muted-foreground ml-1">/ month</span>
                    )}
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
                    {isFreeTier && <FeatureRow included={false} text="Ad-free experience" />}
                    {isFreeTier && <FeatureRow included={false} text="Financial dashboard & ledger" />}
                    {!isFreeTier &&
                      plan.limits.features
                        .filter((f) => FEATURE_NAMES[f])
                        .map((f) => <FeatureRow key={f} included text={FEATURE_NAMES[f]} />)}
                  </ul>
                  {plan.isSelfServe === false ? (
                    <a href="mailto:nkuku@deeztechnology.solutions?subject=Enterprise%20plan%20enquiry">
                      <Button className="w-full" variant="outline">
                        Contact sales
                      </Button>
                    </a>
                  ) : (
                    <Link href={user ? "/billing" : "/signup"}>
                      <Button className="w-full" variant={plan.code === "grower" ? "default" : "outline"}>
                        {user ? "Manage plan" : isFreeTier ? "Start free trial" : `Get ${plan.name}`}
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground mt-10">
        Need multi-site management, white-label branding, or a custom SLA?{" "}
        <a href="mailto:nkuku@deeztechnology.solutions" className="underline">
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
