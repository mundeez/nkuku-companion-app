"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useReauth } from "@/components/reauth-modal";
import { listPlans, replacePlanPrices, updatePlan } from "@/lib/api/platform";
import { FEATURE_KEYS, featureLabel } from "@/lib/feature-keys";
import type {
  BillingCycle,
  PlatformPlan,
  PriceCurrency,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Pencil } from "lucide-react";

const BILLING_CYCLES: { value: BillingCycle; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "cycle_3mo", label: "3-mo cycle" },
  { value: "annual", label: "Annual" },
];
const CURRENCIES: PriceCurrency[] = ["ZMW", "BWP", "USD"];

const LIMIT_FIELDS: { key: keyof PlatformPlan["limits"]; label: string }[] = [
  { key: "maxActiveFlocks", label: "Max active flocks" },
  { key: "maxUsers", label: "Max users" },
  { key: "maxCyclesHistory", label: "Max cycles history" },
  { key: "maxDocumentsPerRecord", label: "Max documents / record" },
];

function limitLabel(v: number) {
  return v === -1 ? "Unlimited" : String(v);
}

interface PlanDraft {
  name: string;
  description: string;
  isTrial: boolean;
  trialDays: string;
  isSelfServe: boolean;
  isActive: boolean;
  limits: Record<keyof PlatformPlan["limits"], string>;
  features: string[];
  // prices[cycle][currency] as string for free typing
  prices: Record<string, Record<string, string>>;
}

function draftFromPlan(plan: PlatformPlan): PlanDraft {
  const prices: Record<string, Record<string, string>> = {};
  for (const c of BILLING_CYCLES) {
    prices[c.value] = {};
    for (const cur of CURRENCIES) {
      const found = plan.prices.find(
        (p) => p.billingCycle === c.value && p.currency === cur
      );
      prices[c.value][cur] = found ? String(found.amount) : "0";
    }
  }
  return {
    name: plan.name,
    description: plan.description ?? "",
    isTrial: plan.isTrial,
    trialDays: plan.trialDays != null ? String(plan.trialDays) : "",
    isSelfServe: plan.isSelfServe,
    isActive: plan.isActive,
    limits: {
      maxActiveFlocks: String(plan.limits.maxActiveFlocks),
      maxUsers: String(plan.limits.maxUsers),
      maxCyclesHistory: String(plan.limits.maxCyclesHistory),
      maxDocumentsPerRecord: String(plan.limits.maxDocumentsPerRecord),
    },
    features: [...plan.features],
    prices,
  };
}

export default function PlansPage() {
  const router = useRouter();
  const { user, isLoading, hasPermission } = useAuth();
  const { withReauth } = useReauth();

  const [plans, setPlans] = useState<PlatformPlan[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<PlatformPlan | null>(null);
  const [draft, setDraft] = useState<PlanDraft | null>(null);

  const canRead = hasPermission("billing.read");
  const canWrite = hasPermission("billing.plans.write");

  const load = useCallback(() => {
    listPlans()
      .then((items) =>
        setPlans([...items].sort((a, b) => a.sortOrder - b.sortOrder))
      )
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (!canRead) {
      router.replace("/");
      return;
    }
    load();
  }, [user, isLoading, canRead, load, router]);

  async function toggleActive(plan: PlatformPlan) {
    setError("");
    setNotice("");
    setBusy(`active:${plan.code}`);
    try {
      await withReauth(() => updatePlan(plan.code, { isActive: !plan.isActive }));
      load();
    } catch (e: any) {
      if (e?.code !== "CANCELLED") setError(e.message || "Update failed");
    } finally {
      setBusy(null);
    }
  }

  function openEdit(plan: PlatformPlan) {
    setEditTarget(plan);
    setDraft(draftFromPlan(plan));
    setError("");
  }

  async function savePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget || !draft) return;
    setError("");
    setBusy("save");
    try {
      const limits: PlatformPlan["limits"] = {
        maxActiveFlocks: parseInt(draft.limits.maxActiveFlocks, 10) || 0,
        maxUsers: parseInt(draft.limits.maxUsers, 10) || 0,
        maxCyclesHistory: parseInt(draft.limits.maxCyclesHistory, 10) || 0,
        maxDocumentsPerRecord: parseInt(draft.limits.maxDocumentsPerRecord, 10) || 0,
      };
      await withReauth(() =>
        updatePlan(editTarget.code, {
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          isTrial: draft.isTrial,
          trialDays:
            draft.isTrial && draft.trialDays.trim()
              ? parseInt(draft.trialDays, 10)
              : null,
          isSelfServe: draft.isSelfServe,
          isActive: draft.isActive,
          limits,
          features: draft.features,
        })
      );
      // Price matrix — full replace via PUT
      const prices = BILLING_CYCLES.flatMap((c) =>
        CURRENCIES.map((cur) => ({
          billingCycle: c.value,
          currency: cur,
          amount: Number(draft.prices[c.value]?.[cur] ?? 0) || 0,
        }))
      );
      await withReauth(() => replacePlanPrices(editTarget.code, prices));
      setNotice(`Plan "${editTarget.name}" saved.`);
      setEditTarget(null);
      setDraft(null);
      load();
    } catch (e: any) {
      if (e?.code !== "CANCELLED") setError(e.message || "Save failed");
    } finally {
      setBusy(null);
    }
  }

  function toggleFeature(key: string) {
    if (!draft) return;
    const has = draft.features.includes(key);
    setDraft({
      ...draft,
      features: has
        ? draft.features.filter((f) => f !== key)
        : [...draft.features, key],
    });
  }

  if (isLoading || !user) return <Skeleton className="h-96 w-full" />;

  const isEnterprise = editTarget?.code === "enterprise";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Plans &amp; Pricing</h1>
        <p className="text-muted-foreground">
          Subscription tiers — limits, features and the per-currency price matrix
        </p>
      </div>

      {notice && (
        <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-400">{notice}</div>
      )}
      {error && !editTarget && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tiers ({plans?.length ?? 0})</CardTitle>
          <CardDescription>
            Ordered by sort order · -1 limits shown as Unlimited · the &quot;enterprise&quot; tier is
            custom-quoted (prices stay 0)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {plans === null ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Plan</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Code</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Flocks</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Users</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Features</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Self-serve</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Active</th>
                    {canWrite && <th className="pb-2 font-medium text-muted-foreground"></th>}
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr
                      key={p.code}
                      className={cn(
                        "border-b last:border-0",
                        canWrite && "cursor-pointer transition-colors hover:bg-muted/40"
                      )}
                      onClick={() => canWrite && openEdit(p)}
                    >
                      <td className="py-2.5 pr-4 font-medium">
                        {p.name}
                        {p.isTrial && (
                          <Badge variant="outline" className="ml-2">
                            trial{p.trialDays ? ` ${p.trialDays}d` : ""}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">{p.code}</td>
                      <td className="py-2.5 pr-4">{limitLabel(p.limits.maxActiveFlocks)}</td>
                      <td className="py-2.5 pr-4">{limitLabel(p.limits.maxUsers)}</td>
                      <td className="py-2.5 pr-4">{p.features.length}</td>
                      <td className="py-2.5 pr-4">
                        {p.isSelfServe ? (
                          <Badge variant="default">self-serve</Badge>
                        ) : (
                          <Badge variant="secondary">sales-assisted</Badge>
                        )}
                      </td>
                      <td className="py-2.5 pr-4" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={p.isActive}
                          disabled={!canWrite || busy !== null}
                          onCheckedChange={() => toggleActive(p)}
                          title={canWrite ? "Toggle active" : "Requires billing.plans.write"}
                        />
                      </td>
                      {canWrite && (
                        <td className="py-2.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(p);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {plans.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        No plans returned by the API.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit plan — {editTarget?.name}{" "}
              <span className="font-mono text-sm font-normal text-muted-foreground">
                ({editTarget?.code})
              </span>
            </DialogTitle>
            <DialogDescription>
              Changes apply to new subscriptions immediately; existing tenants keep their current
              terms until renewal.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <form onSubmit={savePlan} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="plan-name">Name</Label>
                  <Input
                    id="plan-name"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    required
                  />
                </div>
                {draft.isTrial && (
                  <div className="space-y-1">
                    <Label htmlFor="plan-trial">Trial days</Label>
                    <Input
                      id="plan-trial"
                      type="number"
                      min={0}
                      value={draft.trialDays}
                      onChange={(e) => setDraft({ ...draft, trialDays: e.target.value })}
                    />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="plan-desc">Description</Label>
                <Textarea
                  id="plan-desc"
                  rows={2}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>

              {/* Limits */}
              <div>
                <div className="mb-2 text-sm font-medium">Limits (-1 = unlimited)</div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {LIMIT_FIELDS.map(({ key, label }) => (
                    <div key={key} className="space-y-1">
                      <Label htmlFor={`limit-${key}`}>{label}</Label>
                      <Input
                        id={`limit-${key}`}
                        type="number"
                        value={draft.limits[key]}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            limits: { ...draft.limits, [key]: e.target.value },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Features */}
              <div>
                <div className="mb-2 text-sm font-medium">
                  Features ({draft.features.length} selected)
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {FEATURE_KEYS.map((f) => {
                    const checked = draft.features.includes(f.key);
                    return (
                      <label
                        key={f.key}
                        className={cn(
                          "flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm transition-colors",
                          checked ? "border-primary/60 bg-primary/10" : "hover:bg-muted/40"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-primary"
                          checked={checked}
                          onChange={() => toggleFeature(f.key)}
                        />
                        <span>
                          <span className="block font-medium">{f.label}</span>
                          <span className="block font-mono text-xs text-muted-foreground">
                            {f.key}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {/* Unknown keys already on the plan — keep them so a save doesn't silently drop them */}
                {draft.features
                  .filter((k) => !FEATURE_KEYS.some((f) => f.key === k))
                  .map((k) => (
                    <label
                      key={k}
                      className="mt-2 flex cursor-pointer items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked
                        onChange={() => toggleFeature(k)}
                      />
                      <span>
                        <span className="font-medium">{featureLabel(k)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          (unlisted key — uncheck to remove)
                        </span>
                      </span>
                    </label>
                  ))}
              </div>

              {/* Flags */}
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={draft.isSelfServe}
                    onCheckedChange={(v) => setDraft({ ...draft, isSelfServe: v })}
                  />
                  Self-serve (signup without sales)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={draft.isActive}
                    onCheckedChange={(v) => setDraft({ ...draft, isActive: v })}
                  />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={draft.isTrial}
                    onCheckedChange={(v) => setDraft({ ...draft, isTrial: v })}
                  />
                  Trial plan
                </label>
              </div>

              {/* Price matrix */}
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  Price matrix
                  {isEnterprise && (
                    <Badge variant="outline" className="border-amber-500/50 text-amber-400">
                      custom-quoted — keep amounts at 0
                    </Badge>
                  )}
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="p-2 font-medium text-muted-foreground">Billing cycle</th>
                        {CURRENCIES.map((cur) => (
                          <th key={cur} className="p-2 font-medium text-muted-foreground">
                            {cur}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {BILLING_CYCLES.map((c) => (
                        <tr key={c.value} className="border-b last:border-0">
                          <td className="p-2 font-medium">{c.label}</td>
                          {CURRENCIES.map((cur) => (
                            <td key={cur} className="p-2">
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                className="h-8 w-28"
                                value={draft.prices[c.value]?.[cur] ?? "0"}
                                onChange={(e) =>
                                  setDraft({
                                    ...draft,
                                    prices: {
                                      ...draft.prices,
                                      [c.value]: {
                                        ...draft.prices[c.value],
                                        [cur]: e.target.value,
                                      },
                                    },
                                  })
                                }
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setEditTarget(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy === "save"}>
                  {busy === "save" ? "Saving…" : "Save plan & prices"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
