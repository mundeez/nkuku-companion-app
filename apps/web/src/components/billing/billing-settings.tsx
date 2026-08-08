"use client";

import { useEffect, useState } from "react";
import {
  getBillingPlans,
  getSubscription,
  subscribeToPlan,
  cancelSubscriptionApi,
  getInvoices,
} from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Check, X, Zap, Crown, Loader2 } from "lucide-react";

interface Plan {
  code: string;
  name: string;
  description: string;
  pricing: {
    monthly: Record<string, number>;
    cycle_3mo: Record<string, number>;
    annual: Record<string, number>;
  };
  limits: {
    maxActiveFlocks: number;
    maxUsers: number;
    maxCyclesHistory: number;
    maxDocumentsPerRecord: number;
    features: string[];
  };
  isSelfServe: boolean;
}

interface SubscriptionInfo {
  planCode: string;
  planName: string;
  billingCycle: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  canceledAt: string | null;
  limits: any;
  usage: { activeFlocks: number; users: number };
}

type BillingCycle = "monthly" | "cycle_3mo" | "annual";

const CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: "Monthly",
  cycle_3mo: "3-Month",
  annual: "Annual",
};

const PLAN_ICONS: Record<string, any> = {
  free: Check,
  grower: Zap,
  business: Crown,
};

export function BillingSettings() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>("monthly");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [plansData, subData, invoicesData] = await Promise.all([
        getBillingPlans(),
        getSubscription().catch(() => null),
        getInvoices().catch(() => []),
      ]);
      setPlans(plansData.plans);
      setSubscription(subData);
      setInvoices(invoicesData);
    } catch (err: any) {
      setError(err.message || "Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe(planCode: string) {
    setActionLoading(planCode);
    setError(null);
    try {
      const result = await subscribeToPlan(planCode, selectedCycle);
      if (result.checkout?.paymentLink) {
        window.location.href = result.checkout.paymentLink;
      } else {
        // Free plan — no checkout needed
        await loadData();
      }
    } catch (err: any) {
      setError(err.message || "Failed to subscribe");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel your subscription? You will be moved to the Free plan.")) return;
    setActionLoading("cancel");
    setError(null);
    try {
      await cancelSubscriptionApi();
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to cancel subscription");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentPlanCode = subscription?.planCode || "free";

  return (
    <div className="space-y-8">
      {/* Current Subscription */}
      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-5 w-5" />
              Current Subscription
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">{subscription.planName}</span>
                  <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
                    {subscription.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Billing cycle: {CYCLE_LABELS[subscription.billingCycle as BillingCycle] || subscription.billingCycle}
                </p>
                {subscription.currentPeriodEnd && (
                  <p className="text-sm text-muted-foreground">
                    Current period ends: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
                {subscription.trialEndsAt && new Date(subscription.trialEndsAt) > new Date() && (
                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                    Trial ends: {new Date(subscription.trialEndsAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="ml-auto flex gap-4 text-sm">
                <div className="text-center">
                  <p className="font-semibold text-lg">{subscription.usage.activeFlocks}</p>
                  <p className="text-muted-foreground">Active Flocks</p>
                  <p className="text-xs text-muted-foreground">
                    {subscription.limits.maxActiveFlocks === -1
                      ? "Unlimited"
                      : `of ${subscription.limits.maxActiveFlocks}`}
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-lg">{subscription.usage.users}</p>
                  <p className="text-muted-foreground">Users</p>
                  <p className="text-xs text-muted-foreground">
                    {subscription.limits.maxUsers === -1 ? "Unlimited" : `of ${subscription.limits.maxUsers}`}
                  </p>
                </div>
              </div>
            </div>
            {currentPlanCode !== "free" && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={handleCancel}
                disabled={actionLoading === "cancel"}
              >
                {actionLoading === "cancel" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Cancel Subscription
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Billing Cycle Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Billing cycle:</span>
        {(Object.keys(CYCLE_LABELS) as BillingCycle[]).map((cycle) => (
          <Button
            key={cycle}
            variant={selectedCycle === cycle ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCycle(cycle)}
          >
            {CYCLE_LABELS[cycle]}
            {cycle === "annual" && <Badge variant="secondary" className="ml-2 text-xs">Save 20%</Badge>}
          </Button>
        ))}
      </div>

      {/* Plan Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const Icon = PLAN_ICONS[plan.code] || CreditCard;
          const isCurrent = plan.code === currentPlanCode;
          const price = plan.pricing[selectedCycle]?.ZMW ?? 0;
          const isFree = plan.code === "free";

          return (
            <Card
              key={plan.code}
              className={`relative ${plan.code === "grower" ? "border-primary" : ""} ${
                isCurrent ? "ring-2 ring-primary" : ""
              }`}
            >
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
                  {!isFree && (
                    <span className="text-sm text-muted-foreground ml-1">
                      / {CYCLE_LABELS[selectedCycle].toLowerCase()}
                    </span>
                  )}
                </div>

                <ul className="space-y-2 text-sm mb-6">
                  <FeatureRow
                    included={plan.limits.maxActiveFlocks === -1}
                    text={
                      plan.limits.maxActiveFlocks === -1
                        ? "Unlimited active flocks"
                        : `${plan.limits.maxActiveFlocks} active flock${plan.limits.maxActiveFlocks !== 1 ? "s" : ""}`
                    }
                  />
                  <FeatureRow
                    included={plan.limits.maxUsers > 1 || plan.limits.maxUsers === -1}
                    text={
                      plan.limits.maxUsers === -1
                        ? "Unlimited users"
                        : `${plan.limits.maxUsers} user${plan.limits.maxUsers !== 1 ? "s" : ""}`
                    }
                  />
                  <FeatureRow
                    included={plan.limits.maxDocumentsPerRecord > 0 || plan.limits.maxDocumentsPerRecord === -1}
                    text={
                      plan.limits.maxDocumentsPerRecord === 0
                        ? "No document attachments"
                        : plan.limits.maxDocumentsPerRecord === -1
                        ? "Unlimited document attachments"
                        : `${plan.limits.maxDocumentsPerRecord} documents per record`
                    }
                  />
                  {plan.limits.features
                    .filter((f) => !["core_tracking", "disease_db", "basic_alerts"].includes(f))
                    .map((feature) => (
                      <FeatureRow key={feature} included={true} text={formatFeatureName(feature)} />
                    ))}
                </ul>

                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={plan.code === "grower" ? "default" : "outline"}
                    onClick={() => handleSubscribe(plan.code)}
                    disabled={actionLoading === plan.code}
                  >
                    {actionLoading === plan.code ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : null}
                    {isFree ? "Switch to Free" : `Upgrade to ${plan.name}`}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Invoices */}
      {invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoice History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Invoice #</th>
                    <th className="pb-2 font-medium">Plan</th>
                    <th className="pb-2 font-medium">Amount</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv: any) => (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">{inv.invoiceNumber}</td>
                      <td className="py-2 capitalize">{inv.planCode}</td>
                      <td className="py-2">
                        {inv.currency} {Number(inv.amountDue).toLocaleString()}
                      </td>
                      <td className="py-2">
                        <Badge
                          variant={
                            inv.status === "paid"
                              ? "default"
                              : inv.status === "open"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2">
                        {inv.paymentLink && inv.status === "open" && (
                          <a href={inv.paymentLink} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline">Pay Now</Button>
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>
      )}
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

function formatFeatureName(feature: string): string {
  const names: Record<string, string> = {
    financial_dashboard: "Financial dashboard",
    double_entry_ledger: "Double-entry ledger",
    document_attachments: "Document attachments",
    full_alerts: "Advanced alert system",
    multi_site: "Multi-site management",
    gaap_statements: "GAAP financial statements",
    csv_pdf_export: "CSV/PDF export",
    api_access: "API access",
    priority_support: "Priority support",
    white_label: "White-label branding",
    dedicated_onboarding: "Dedicated onboarding",
    sla: "SLA guarantee",
    self_hosted: "Self-hosted option",
  };
  return names[feature] || feature.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
