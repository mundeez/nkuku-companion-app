"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAdCampaign, updateAdCampaign } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const PAGE_OPTIONS = ["dashboard", "projections", "document_search", "flock_detail"] as const;

function toDateInput(d?: string) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function AdCampaignForm({ campaignId, initial }: { campaignId?: string; initial?: any }) {
  const router = useRouter();
  const [form, setForm] = useState({
    advertiserName: initial?.advertiserName || "",
    creativeImageUrl: initial?.creativeImageUrl || "",
    targetUrl: initial?.targetUrl || "",
    altText: initial?.altText || "",
    placement: initial?.placement || "banner",
    pages: (initial?.pages as string[]) || ["dashboard"],
    countryTargets: (initial?.countryTargets || []).join(","),
    pricingModel: initial?.pricingModel || "flat",
    flatFeeAmount: initial?.flatFeeAmount != null ? String(initial.flatFeeAmount) : "",
    cpmRate: initial?.cpmRate != null ? String(initial.cpmRate) : "",
    cpcRate: initial?.cpcRate != null ? String(initial.cpcRate) : "",
    currency: initial?.currency || "ZMW",
    budgetCap: initial?.budgetCap != null ? String(initial.budgetCap) : "",
    priorityWeight: initial?.priorityWeight != null ? String(initial.priorityWeight) : "1",
    startDate: toDateInput(initial?.startDate) || toDateInput(new Date().toISOString()),
    endDate: toDateInput(initial?.endDate),
    status: initial?.status || "draft",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function togglePage(page: string) {
    setForm((f) => ({
      ...f,
      pages: f.pages.includes(page) ? f.pages.filter((p) => p !== page) : [...f.pages, page],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload: any = {
        advertiserName: form.advertiserName,
        creativeImageUrl: form.creativeImageUrl,
        targetUrl: form.targetUrl,
        altText: form.altText,
        placement: form.placement,
        pages: form.pages,
        countryTargets: form.countryTargets
          .split(",")
          .map((s: string) => s.trim().toUpperCase())
          .filter(Boolean),
        pricingModel: form.pricingModel,
        flatFeeAmount: form.flatFeeAmount ? Number(form.flatFeeAmount) : null,
        cpmRate: form.cpmRate ? Number(form.cpmRate) : null,
        cpcRate: form.cpcRate ? Number(form.cpcRate) : null,
        currency: form.currency,
        budgetCap: form.budgetCap ? Number(form.budgetCap) : null,
        priorityWeight: Number(form.priorityWeight) || 1,
        startDate: form.startDate,
        endDate: form.endDate,
        status: form.status,
      };
      if (campaignId) {
        await updateAdCampaign(campaignId, payload);
      } else {
        await createAdCampaign(payload);
      }
      router.push("/admin/ads");
    } catch (err: any) {
      setError(err.message || "Failed to save campaign");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{campaignId ? "Edit Campaign" : "New Campaign"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="advertiserName">Advertiser Name</Label>
            <Input id="advertiserName" required value={form.advertiserName} onChange={(e) => setForm({ ...form, advertiserName: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="currency">Currency</Label>
            <select
              id="currency"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            >
              <option value="ZMW">ZMW</option>
              <option value="BWP">BWP</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="creativeImageUrl">Creative Image URL</Label>
            <Input id="creativeImageUrl" required type="url" value={form.creativeImageUrl} onChange={(e) => setForm({ ...form, creativeImageUrl: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="targetUrl">Target URL (where the ad links to)</Label>
            <Input id="targetUrl" required type="url" value={form.targetUrl} onChange={(e) => setForm({ ...form, targetUrl: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="altText">Alt Text</Label>
            <Input id="altText" required value={form.altText} onChange={(e) => setForm({ ...form, altText: e.target.value })} />
          </div>

          <div>
            <Label htmlFor="placement">Placement</Label>
            <select
              id="placement"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={form.placement}
              onChange={(e) => setForm({ ...form, placement: e.target.value })}
            >
              <option value="banner">Banner</option>
              <option value="native">Native card</option>
            </select>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <Label>Pages</Label>
            <div className="flex flex-wrap gap-3 mt-1">
              {PAGE_OPTIONS.map((page) => (
                <label key={page} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={form.pages.includes(page)} onChange={() => togglePage(page)} />
                  {page.replace(/_/g, " ")}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="countryTargets">Country Targets (ISO-2, comma-separated; blank = all)</Label>
            <Input id="countryTargets" placeholder="ZM, BW" value={form.countryTargets} onChange={(e) => setForm({ ...form, countryTargets: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="priorityWeight">Priority Weight</Label>
            <Input id="priorityWeight" type="number" min={1} value={form.priorityWeight} onChange={(e) => setForm({ ...form, priorityWeight: e.target.value })} />
          </div>

          <div>
            <Label htmlFor="pricingModel">Pricing Model</Label>
            <select
              id="pricingModel"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={form.pricingModel}
              onChange={(e) => setForm({ ...form, pricingModel: e.target.value })}
            >
              <option value="flat">Flat sponsorship fee</option>
              <option value="cpm">CPM (per 1000 impressions)</option>
              <option value="cpc">CPC (per click)</option>
            </select>
          </div>
          <div>
            <Label htmlFor="budgetCap">Budget Cap (optional, cpm/cpc)</Label>
            <Input id="budgetCap" type="number" step="0.01" value={form.budgetCap} onChange={(e) => setForm({ ...form, budgetCap: e.target.value })} />
          </div>

          {form.pricingModel === "flat" && (
            <div>
              <Label htmlFor="flatFeeAmount">Flat Fee Amount</Label>
              <Input id="flatFeeAmount" type="number" step="0.01" value={form.flatFeeAmount} onChange={(e) => setForm({ ...form, flatFeeAmount: e.target.value })} />
            </div>
          )}
          {form.pricingModel === "cpm" && (
            <div>
              <Label htmlFor="cpmRate">CPM Rate</Label>
              <Input id="cpmRate" type="number" step="0.0001" value={form.cpmRate} onChange={(e) => setForm({ ...form, cpmRate: e.target.value })} />
            </div>
          )}
          {form.pricingModel === "cpc" && (
            <div>
              <Label htmlFor="cpcRate">CPC Rate</Label>
              <Input id="cpcRate" type="number" step="0.0001" value={form.cpcRate} onChange={(e) => setForm({ ...form, cpcRate: e.target.value })} />
            </div>
          )}

          <div>
            <Label htmlFor="startDate">Start Date</Label>
            <Input id="startDate" type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="endDate">End Date</Label>
            <Input id="endDate" type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>

          {error && <p className="sm:col-span-2 text-sm text-destructive">{error}</p>}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving || form.pages.length === 0}>
              {saving ? "Saving..." : campaignId ? "Save Changes" : "Create Campaign"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
