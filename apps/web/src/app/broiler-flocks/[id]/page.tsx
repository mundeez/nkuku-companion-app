"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { BroilerFlock, GrowthRecord, FeedRecord, WaterRecord, MortalityEvent, VaccinationEvent, FinancialRecord, Alert } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, Droplets, Syringe, Skull, DollarSign, Bell, Activity, Scale } from "lucide-react";

export default function FlockDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const flockId = params.id as string;

  const [flock, setFlock] = useState<BroilerFlock | null>(null);
  const [ageDays, setAgeDays] = useState(0);
  const [growthRecords, setGrowthRecords] = useState<GrowthRecord[]>([]);
  const [feedRecords, setFeedRecords] = useState<FeedRecord[]>([]);
  const [waterRecords, setWaterRecords] = useState<WaterRecord[]>([]);
  const [mortalityEvents, setMortalityEvents] = useState<MortalityEvent[]>([]);
  const [vaccinationEvents, setVaccinationEvents] = useState<VaccinationEvent[]>([]);
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>([]);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const canCreateEdit = user?.role === "owner" || user?.role === "manager";

  function loadAll() {
    apiFetch<any>(`/api/v1/broiler-flocks/${flockId}`)
      .then((d) => { setFlock(d); setAgeDays(Math.floor((new Date().getTime() - new Date(d.startDate).getTime()) / 86400000)); })
      .catch((err) => setError(err.message));
    apiFetch<GrowthRecord[]>(`/api/v1/growth-records?flockId=${flockId}`).then(setGrowthRecords).catch(() => {});
    apiFetch<FeedRecord[]>(`/api/v1/feed-records?flockId=${flockId}`).then(setFeedRecords).catch(() => {});
    apiFetch<WaterRecord[]>(`/api/v1/water-records?flockId=${flockId}`).then(setWaterRecords).catch(() => {});
    apiFetch<MortalityEvent[]>(`/api/v1/mortality-events?flockId=${flockId}`).then(setMortalityEvents).catch(() => {});
    apiFetch<VaccinationEvent[]>(`/api/v1/vaccination-events?flockId=${flockId}`).then(setVaccinationEvents).catch(() => {});
    apiFetch<FinancialRecord[]>(`/api/v1/financial-records?flockId=${flockId}`).then(setFinancialRecords).catch(() => {});
  }

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (user && flockId) loadAll();
  }, [user, isLoading, flockId, router]);

  function getStatusBadge(status: string) {
    switch (status) {
      case "active": return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case "completed": return <Badge variant="secondary">Completed</Badge>;
      case "cancelled": return <Badge variant="destructive">Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  }

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;
  if (!flock) return <div className="p-8">Loading flock details...</div>;

  const latestGrowth = growthRecords[growthRecords.length - 1];
  const totalFeed = feedRecords.reduce((sum, r) => sum + Number(r.quantityKg), 0);
  const totalWater = waterRecords.reduce((sum, r) => sum + Number(r.quantityLiters), 0);
  const totalMortality = mortalityEvents.reduce((sum, e) => sum + e.count, 0);
  const totalCost = financialRecords.filter((r) => !r.isIncome).reduce((sum, r) => sum + Number(r.amountZmw), 0);
  const totalRevenue = financialRecords.filter((r) => r.isIncome).reduce((sum, r) => sum + Number(r.amountZmw), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={() => router.push("/broiler-flocks")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{flock.name}</h1>
          <p className="text-muted-foreground">{flock.breed?.name} | Day {ageDays} | {getStatusBadge(flock.status)}</p>
        </div>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2"><Scale className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Birds</span></div>
          <p className="text-2xl font-bold mt-1">{flock.currentCount}</p><p className="text-xs text-muted-foreground">of {flock.initialCount}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Latest Weight</span></div>
          <p className="text-2xl font-bold mt-1">{latestGrowth ? `${latestGrowth.avgWeight}g` : "-"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2"><Skull className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Mortality</span></div>
          <p className="text-2xl font-bold mt-1">{flock.initialCount > 0 ? ((flock.initialCount - flock.currentCount) / flock.initialCount * 100).toFixed(1) : "0"}%</p><p className="text-xs text-muted-foreground">{totalMortality} birds</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Profit (ZMW)</span></div>
          <p className="text-2xl font-bold mt-1">{(totalRevenue - totalCost).toFixed(2)}</p>
        </CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="growth">Growth ({growthRecords.length})</TabsTrigger>
          <TabsTrigger value="feed">Feed ({feedRecords.length})</TabsTrigger>
          <TabsTrigger value="water">Water ({waterRecords.length})</TabsTrigger>
          <TabsTrigger value="mortality">Mortality ({mortalityEvents.length})</TabsTrigger>
          <TabsTrigger value="vaccination">Vaccines ({vaccinationEvents.length})</TabsTrigger>
          <TabsTrigger value="financial">Financial ({financialRecords.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {growthRecords.slice(-3).map((r) => (
                  <div key={r.id} className="flex justify-between"><span>Weight: {r.avgWeight}g (n={r.sampleSize})</span><span className="text-muted-foreground">{new Date(r.recordDate).toLocaleDateString()}</span></div>
                ))}
                {feedRecords.slice(-3).map((r) => (
                  <div key={r.id} className="flex justify-between"><span>Feed: {r.feedType} {r.quantityKg}kg</span><span className="text-muted-foreground">{new Date(r.recordDate).toLocaleDateString()}</span></div>
                ))}
                {mortalityEvents.slice(-3).map((e) => (
                  <div key={e.id} className="flex justify-between text-red-600"><span>Deaths: {e.count} {e.cause || ""}</span><span className="text-muted-foreground">{new Date(e.eventDate).toLocaleDateString()}</span></div>
                ))}
                {growthRecords.length === 0 && feedRecords.length === 0 && mortalityEvents.length === 0 && (
                  <p className="text-muted-foreground">No activity recorded yet. Use the tabs above to add records.</p>
                )}
              </div>
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Flock Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Total Feed</span><span className="font-medium">{totalFeed.toFixed(1)} kg</span></div>
                <div className="flex justify-between"><span>Total Water</span><span className="font-medium">{totalWater.toFixed(1)} liters</span></div>
                <div className="flex justify-between"><span>Total Cost</span><span className="font-medium">ZMW {totalCost.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Total Revenue</span><span className="font-medium">ZMW {totalRevenue.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Feed Transition Day</span><span className="font-medium">Day {flock.feedTransitionDay || 11}</span></div>
                <div className="flex justify-between"><span>Target Weight</span><span className="font-medium">{flock.targetWeight || "-"} kg @ Day {flock.targetAge || "-"}</span></div>
              </div>
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="growth"><SimpleRecordTab flockId={flockId} records={growthRecords} type="growth" onRefresh={loadAll} canEdit={canCreateEdit} /></TabsContent>
        <TabsContent value="feed"><SimpleRecordTab flockId={flockId} records={feedRecords} type="feed" onRefresh={loadAll} canEdit={canCreateEdit} /></TabsContent>
        <TabsContent value="water"><SimpleRecordTab flockId={flockId} records={waterRecords} type="water" onRefresh={loadAll} canEdit={canCreateEdit} /></TabsContent>
        <TabsContent value="mortality"><SimpleRecordTab flockId={flockId} records={mortalityEvents} type="mortality" onRefresh={loadAll} canEdit={canCreateEdit} /></TabsContent>
        <TabsContent value="vaccination"><SimpleRecordTab flockId={flockId} records={vaccinationEvents} type="vaccination" onRefresh={loadAll} canEdit={canCreateEdit} /></TabsContent>
        <TabsContent value="financial"><SimpleRecordTab flockId={flockId} records={financialRecords} type="financial" onRefresh={loadAll} canEdit={canCreateEdit} /></TabsContent>
      </Tabs>
    </div>
  );
}

function SimpleRecordTab({ flockId, records, type, onRefresh, canEdit }: any) {
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});

  const titles: any = {
    growth: { title: "Growth Records", icon: TrendingUp, endpoint: "/api/v1/growth-records", fields: [
      { key: "recordDate", label: "Date", type: "date" },
      { key: "sampleSize", label: "Sample Size", type: "number" },
      { key: "avgWeight", label: "Average Weight (grams)", type: "number" },
      { key: "notes", label: "Notes", type: "text" },
    ]},
    feed: { title: "Feed Records", icon: TrendingUp, endpoint: "/api/v1/feed-records", fields: [
      { key: "recordDate", label: "Date", type: "date" },
      { key: "feedType", label: "Type", type: "select", options: ["starter", "grower", "finisher"] },
      { key: "quantityKg", label: "Quantity (kg)", type: "number" },
      { key: "costZmw", label: "Cost (ZMW)", type: "number" },
    ]},
    water: { title: "Water Records", icon: Droplets, endpoint: "/api/v1/water-records", fields: [
      { key: "recordDate", label: "Date", type: "date" },
      { key: "quantityLiters", label: "Quantity (liters)", type: "number" },
      { key: "ph", label: "pH", type: "number" },
      { key: "temperature", label: "Temperature (C)", type: "number" },
    ]},
    mortality: { title: "Mortality Events", icon: Skull, endpoint: "/api/v1/mortality-events", fields: [
      { key: "eventDate", label: "Date", type: "date" },
      { key: "count", label: "Number of Birds", type: "number" },
      { key: "cause", label: "Cause", type: "text" },
      { key: "ageDays", label: "Age (days)", type: "number" },
    ]},
    vaccination: { title: "Vaccination Records", icon: Syringe, endpoint: "/api/v1/vaccination-events", fields: [
      { key: "vaccineName", label: "Vaccine Name", type: "text" },
      { key: "adminDate", label: "Date", type: "date" },
      { key: "adminMethod", label: "Method", type: "select", options: ["Drinking Water", "Spray", "Eye Drop", "Injection", "Wing Web"] },
      { key: "ageDays", label: "Age (days)", type: "number" },
    ]},
    financial: { title: "Financial Records", icon: DollarSign, endpoint: "/api/v1/financial-records", fields: [
      { key: "recordDate", label: "Date", type: "date" },
      { key: "category", label: "Category", type: "select", options: ["chick_purchase", "feed", "vaccines", "medication", "labor", "utilities", "equipment", "sales", "other"] },
      { key: "description", label: "Description", type: "text" },
      { key: "amountZmw", label: "Amount (ZMW)", type: "number" },
      { key: "isIncome", label: "Is Income", type: "checkbox" },
    ]},
  };

  const config = titles[type];
  const Icon = config.icon;

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch(config.endpoint, { method: "POST", body: JSON.stringify({ ...form, flockId }) });
      setFormOpen(false); onRefresh();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  }

  function renderField(f: any) {
    const val = form[f.key] || "";
    if (f.type === "select") return (
      <select key={f.key} className="w-full border rounded-md p-2" value={val} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
        <option value="">Select...</option>
        {f.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
    if (f.type === "checkbox") return <input key={f.key} type="checkbox" checked={!!val} onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })} />;
    return <input key={f.key} type={f.type} step={f.type === "number" ? "0.1" : undefined} className="w-full border rounded-md p-2" value={val} onChange={(e) => setForm({ ...form, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value })} />;
  }

  function renderRecord(r: any) {
    if (type === "growth") return <span>Weight: {r.avgWeight}g (n={r.sampleSize})</span>;
    if (type === "feed") return <span className="capitalize">{r.feedType}: {r.quantityKg}kg {r.costZmw && `| ZMW ${r.costZmw}`}</span>;
    if (type === "water") return <span>{r.quantityLiters} liters {r.ph && `| pH ${r.ph}`}</span>;
    if (type === "mortality") return <span className="text-red-700">{r.count} deaths - {r.cause || "Unknown"}</span>;
    if (type === "vaccination") return <span className="text-green-700">{r.vaccineName} | {r.adminMethod}</span>;
    if (type === "financial") return <span className={r.isIncome ? "text-green-700" : ""}>{r.category}: {r.description} | ZMW {r.amountZmw} {r.isIncome && "(Income)"}</span>;
    return null;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">{config.title}</h3>
        {canEdit && <Button size="sm" onClick={() => { setForm({}); setFormOpen(true); }}><Icon className="h-4 w-4 mr-1" />Add</Button>}
      </div>
      {records.length === 0 ? <p className="text-muted-foreground">No records yet.</p> : (
        <div className="space-y-2">{records.map((r: any) => (
          <Card key={r.id}><CardContent className="py-3 flex justify-between items-center">
            <div><p className="font-medium">{renderRecord(r)}</p><p className="text-sm text-muted-foreground">{new Date(r.recordDate || r.eventDate || r.adminDate).toLocaleDateString()}</p></div>
          </CardContent></Card>
        ))}</div>
      )}
      {formOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader><CardTitle>Add {config.title}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {config.fields.map((f: any) => (
                <div key={f.key}><label className="text-sm font-medium">{f.label}</label>{renderField(f)}</div>
              ))}
            </CardContent>
            <div className="p-6 pt-0 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
