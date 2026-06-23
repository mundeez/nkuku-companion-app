"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { BroilerFlock, GrowthRecord, FeedRecord, WaterRecord, MortalityEvent, VaccinationEvent, FinancialRecord, Supplier } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, TrendingUp, Droplets, Syringe, Skull, DollarSign, Activity, Scale, Pencil, Trash2, Wheat, Package, Sprout } from "lucide-react";

function fmtCollectionDate(date: string | Date | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const day = d.toLocaleDateString("en-GB", { day: "2-digit" });
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  const year = d.toLocaleDateString("en-GB", { year: "numeric" });
  return `${weekday}-${day}-${month}-${year}`;
}

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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const [editCollectionOpen, setEditCollectionOpen] = useState(false);
  const [collectionForm, setCollectionForm] = useState({ chicksCollected: false, collectionDate: "" });
  const [editNotesOpen, setEditNotesOpen] = useState(false);
  const [notesForm, setNotesForm] = useState("");
  const [saving, setSaving] = useState(false);

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
    apiFetch<Supplier[]>("/api/v1/suppliers").then(setSuppliers).catch(() => {});
  }

  async function saveCollectionStatus() {
    setSaving(true);
    try {
      await apiFetch(`/api/v1/broiler-flocks/${flockId}`, {
        method: "PATCH",
        body: JSON.stringify({
          chicksCollected: collectionForm.chicksCollected,
          collectionDate: collectionForm.chicksCollected ? collectionForm.collectionDate : null,
        }),
      });
      setEditCollectionOpen(false);
      loadAll();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveQualityNotes() {
    setSaving(true);
    try {
      await apiFetch(`/api/v1/broiler-flocks/${flockId}`, {
        method: "PATCH",
        body: JSON.stringify({ chickQualityNotes: notesForm || null }),
      });
      setEditNotesOpen(false);
      loadAll();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (user && flockId) loadAll();
  }, [user, isLoading, flockId, router]);

  function getStatusBadge(status: string, chicksCollected?: boolean) {
    if (status === "active" && !chicksCollected) {
      return <Badge className="bg-amber-100 text-amber-800">Pending</Badge>;
    }
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
  const financialCost = financialRecords.filter((r) => !r.isIncome).reduce((sum, r) => sum + Number(r.amountZmw), 0);
  const hasChickFinancialRecord = financialRecords.some((r) => r.category === "chick_purchase" && !r.isIncome);
  const chickPurchaseCost = !hasChickFinancialRecord && flock.chickPriceZmw ? Number(flock.chickPriceZmw) * flock.initialCount : 0;
  const totalCost = financialCost + chickPurchaseCost;
  const totalRevenue = financialRecords.filter((r) => r.isIncome).reduce((sum, r) => sum + Number(r.amountZmw), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={() => router.push("/broiler-flocks")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{flock.name}</h1>
          <div className="text-muted-foreground">{flock.breed?.name} | Day {ageDays} | {getStatusBadge(flock.status, flock.chicksCollected)}</div>
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
          <TabsTrigger value="chicks">Chicks</TabsTrigger>
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

        <TabsContent value="chicks">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" /> Chick Purchase
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {flock.chickPriceZmw ? (
                    <>
                      <div className="flex justify-between"><span className="text-muted-foreground">Unit Price</span><span className="font-medium">ZMW {flock.chickPriceZmw}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Quantity</span><span className="font-medium">{flock.initialCount} birds</span></div>
                      <div className="flex justify-between border-t pt-2 mt-2"><span className="font-medium">Total Cost</span><span className="font-bold">ZMW {(flock.chickPriceZmw * flock.initialCount).toFixed(2)}</span></div>
                    </>
                  ) : (
                    <p className="text-muted-foreground">No chick purchase data recorded.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sprout className="h-4 w-4" /> Supplier
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {flock.supplier ? (
                    <>
                      <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{flock.supplier.name}</span></div>
                      {flock.supplier.contact && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Contact</span><span className="font-medium">{flock.supplier.contact}</span></div>
                      )}
                      {flock.supplier.chickenType && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium">{flock.supplier.chickenType}</span></div>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground">No supplier assigned.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Collection Status
                </CardTitle>
                {canCreateEdit && (
                  <Button variant="outline" size="sm" onClick={() => {
                    setCollectionForm({
                      chicksCollected: flock.chicksCollected,
                      collectionDate: flock.collectionDate ? new Date(flock.collectionDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
                    });
                    setEditCollectionOpen(true);
                  }}>
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {flock.chicksCollected ? (
                    <div className="inline-flex items-center gap-1 text-green-700 bg-green-100 px-2 py-1 rounded">
                      <span className="font-medium">Collected</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 text-amber-700 bg-amber-100 px-2 py-1 rounded">
                      <span className="font-medium">Pending Collection</span>
                    </div>
                  )}
                  {flock.collectionDate && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Collection Date</span><span className="font-medium">{fmtCollectionDate(flock.collectionDate)}</span></div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Chick Quality Notes</CardTitle>
                {canCreateEdit && (
                  <Button variant="outline" size="sm" onClick={() => { setNotesForm(flock.chickQualityNotes || ""); setEditNotesOpen(true); }}>
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {flock.chickQualityNotes ? (
                  <p className="text-sm whitespace-pre-wrap">{flock.chickQualityNotes}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No quality notes recorded.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Edit Collection Dialog */}
          <Dialog open={editCollectionOpen} onOpenChange={setEditCollectionOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Collection Status</DialogTitle>
                <DialogDescription>Update whether chicks have been collected from the hatchery.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="collection-status"
                    id="status-not-collected"
                    checked={!collectionForm.chicksCollected}
                    onChange={() => setCollectionForm({ ...collectionForm, chicksCollected: false, collectionDate: "" })}
                  />
                  <label htmlFor="status-not-collected" className="text-sm font-medium">NOT Collected</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="collection-status"
                    id="status-collected"
                    checked={collectionForm.chicksCollected}
                    onChange={() => setCollectionForm({ ...collectionForm, chicksCollected: true, collectionDate: collectionForm.collectionDate || new Date().toISOString().split("T")[0] })}
                  />
                  <label htmlFor="status-collected" className="text-sm font-medium">Collected on</label>
                </div>
                {collectionForm.chicksCollected && (
                  <div>
                    <label className="text-sm text-muted-foreground">Collection Date</label>
                    <input
                      type="date"
                      className="w-full border rounded-md p-2 mt-1"
                      value={collectionForm.collectionDate}
                      onChange={(e) => setCollectionForm({ ...collectionForm, collectionDate: e.target.value })}
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditCollectionOpen(false)}>Cancel</Button>
                <Button onClick={saveCollectionStatus} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Notes Dialog */}
          <Dialog open={editNotesOpen} onOpenChange={setEditNotesOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Chick Quality Notes</DialogTitle>
                <DialogDescription>Record observations about chick quality on arrival.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <textarea
                  className="w-full border rounded-md p-2 min-h-[120px]"
                  placeholder="e.g. Uniform size, active, good feathering..."
                  value={notesForm}
                  onChange={(e) => setNotesForm(e.target.value)}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground mt-1">{notesForm.length}/500 characters</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditNotesOpen(false)}>Cancel</Button>
                <Button onClick={saveQualityNotes} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="growth"><SimpleRecordTab flockId={flockId} records={growthRecords} type="growth" onRefresh={loadAll} canEdit={canCreateEdit} userRole={user?.role} /></TabsContent>
        <TabsContent value="feed"><SimpleRecordTab flockId={flockId} records={feedRecords} type="feed" onRefresh={loadAll} canEdit={canCreateEdit} userRole={user?.role} suppliers={suppliers} /></TabsContent>
        <TabsContent value="water"><SimpleRecordTab flockId={flockId} records={waterRecords} type="water" onRefresh={loadAll} canEdit={canCreateEdit} userRole={user?.role} /></TabsContent>
        <TabsContent value="mortality"><SimpleRecordTab flockId={flockId} records={mortalityEvents} type="mortality" onRefresh={loadAll} canEdit={canCreateEdit} userRole={user?.role} /></TabsContent>
        <TabsContent value="vaccination"><SimpleRecordTab flockId={flockId} records={vaccinationEvents} type="vaccination" onRefresh={loadAll} canEdit={canCreateEdit} userRole={user?.role} /></TabsContent>
        <TabsContent value="financial"><SimpleRecordTab flockId={flockId} records={financialRecords} type="financial" onRefresh={loadAll} canEdit={canCreateEdit} userRole={user?.role} /></TabsContent>
      </Tabs>
    </div>
  );
}

function SimpleRecordTab({ flockId, records, type, onRefresh, canEdit, userRole, suppliers }: any) {
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<any | null>(null);
  const [costOverride, setCostOverride] = useState(false);

  const titles: any = {
    growth: { title: "Growth Records", icon: TrendingUp, endpoint: "/api/v1/growth-records", fields: [
      { key: "recordDate", label: "Date", type: "date" },
      { key: "sampleSize", label: "Sample Size", type: "number" },
      { key: "avgWeight", label: "Average Weight (grams)", type: "number" },
      { key: "notes", label: "Notes", type: "text" },
    ]},
    feed: { title: "Feed Records", icon: TrendingUp, endpoint: "/api/v1/feed-records", fields: [
      { key: "recordDate", label: "Date", type: "date" },
      { key: "supplierId", label: "Supplier", type: "supplier-select" },
      { key: "feedType", label: "Feed Type", type: "feed-type-select" },
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
  const isEditing = !!editingRecord;

  async function handleSave() {
    setSaving(true);
    try {
      const body = { ...form, flockId };
      // Remove UI-only fields before sending
      delete body._bagSizeKg;
      delete body._bagPriceZmw;
      delete body.bagCount;
      if (body.supplierId === "custom") delete body.supplierId;

      if (isEditing) {
        await apiFetch(`${config.endpoint}/${editingRecord.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch(config.endpoint, { method: "POST", body: JSON.stringify(body) });
      }
      setFormOpen(false);
      setEditingRecord(null);
      setForm({});
      setCostOverride(false);
      onRefresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingRecord) return;
    setSaving(true);
    try {
      await apiFetch(`${config.endpoint}/${deletingRecord.id}`, { method: "DELETE" });
      setDeleteOpen(false);
      setDeletingRecord(null);
      onRefresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  function openAdd() {
    setEditingRecord(null);
    // Default date to today for all record types
    const today = new Date().toISOString().split("T")[0];
    const defaults: any = {};
    config.fields.forEach((f: any) => {
      if (f.type === "date") defaults[f.key] = today;
    });
    setForm(defaults);
    setCostOverride(false);
    setFormOpen(true);
  }

  function openEdit(record: any) {
    setEditingRecord(record);
    const prefill: any = {};
    config.fields.forEach((f: any) => {
      const val = record[f.key];
      if (val !== undefined && val !== null) {
        if (f.type === "date") {
          prefill[f.key] = new Date(val).toISOString().split("T")[0];
        } else if (f.type === "number") {
          prefill[f.key] = Number(val);
        } else if (f.type === "checkbox") {
          prefill[f.key] = !!val;
        } else {
          prefill[f.key] = String(val);
        }
      }
    });

    // For feed records with supplier, calculate bag count
    if (type === "feed" && record.supplierId && suppliers) {
      const supplier = suppliers.find((s: any) => s.id === record.supplierId);
      if (supplier) {
        const stage = supplier.feedStages.find(
          (s: any) => (s.stageType === "feed" || s.stageType === "chick") && s.stageName.toLowerCase() === record.feedType.toLowerCase()
        );
        if (stage) {
          prefill._bagSizeKg = Number(stage.unitSizeKg);
          prefill._bagPriceZmw = Number(stage.unitPriceZmw);
          prefill.bagCount = Math.round(Number(record.quantityKg) / Number(stage.unitSizeKg));
        }
        prefill.supplierId = record.supplierId;
      }
    }
    // Always prefill quantity and cost for feed records
    if (type === "feed") {
      if (record.quantityKg !== undefined && record.quantityKg !== null) {
        prefill.quantityKg = Number(record.quantityKg);
      }
      if (record.costZmw !== undefined && record.costZmw !== null) {
        prefill.costZmw = Number(record.costZmw);
      }
    }
    // If no supplier but has feedBrand, treat as custom
    if (type === "feed" && !record.supplierId && record.feedBrand) {
      prefill.supplierId = "custom";
      prefill.feedBrand = record.feedBrand;
    }

    setForm(prefill);
    setCostOverride(false);
    setFormOpen(true);
  }

  function openDelete(record: any) {
    setDeletingRecord(record);
    setDeleteOpen(true);
  }

  async function fetchSupplierPrice(supplierId: string, feedType: string) {
    try {
      return await apiFetch<any>(`/api/v1/suppliers/${supplierId}/feed-price?feedType=${feedType}`);
    } catch {
      return null;
    }
  }

  function recalcFromBags(newForm: any, bags: number) {
    const bagSize = newForm._bagSizeKg || 0;
    const bagPrice = newForm._bagPriceZmw || 0;
    if (bagSize > 0 && bagPrice > 0) {
      newForm.quantityKg = Number((bags * bagSize).toFixed(2));
      if (!costOverride) {
        newForm.costZmw = Number((bags * bagPrice).toFixed(2));
      }
    }
    return newForm;
  }

  function renderField(f: any) {
    const val = form[f.key] || (f.type === "checkbox" ? false : "");

    if (f.type === "supplier-select") {
      return (
        <select
          key={f.key}
          className="w-full border rounded-md p-2 bg-background"
          value={val || ""}
          onChange={async (e) => {
            const supplierId = e.target.value;
            const newForm = { ...form, [f.key]: supplierId };

            if (supplierId && supplierId !== "custom") {
              const priceData = form.feedType ? await fetchSupplierPrice(supplierId, form.feedType) : null;
              if (priceData) {
                newForm._bagSizeKg = priceData.unitSizeKg;
                newForm._bagPriceZmw = priceData.unitPriceZmw;
                newForm.feedBrand = priceData.supplierName;
                const bags = Number(newForm.bagCount) || 0;
                if (bags > 0) {
                  recalcFromBags(newForm, bags);
                }
              } else {
                newForm._bagSizeKg = null;
                newForm._bagPriceZmw = null;
              }
            } else {
              newForm._bagSizeKg = null;
              newForm._bagPriceZmw = null;
            }
            setForm(newForm);
          }}
        >
          <option value="">Select supplier...</option>
          {suppliers && suppliers.map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
          <option value="custom">Custom (Other)</option>
        </select>
      );
    }

    if (f.type === "feed-type-select") {
      const supplier = suppliers?.find((s: any) => s.id === form.supplierId);
      const stages = supplier
        ? supplier.feedStages
            .filter((s: any) => s.stageType === "feed" || s.stageType === "chick")
            .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
        : [];
      return (
        <select key={f.key} className="w-full border rounded-md p-2 bg-background" value={val} onChange={async (e) => {
          const newForm = { ...form, [f.key]: e.target.value };
          if (type === "feed" && form.supplierId && form.supplierId !== "custom") {
            const priceData = await fetchSupplierPrice(form.supplierId, e.target.value);
            if (priceData) {
              newForm._bagSizeKg = priceData.unitSizeKg;
              newForm._bagPriceZmw = priceData.unitPriceZmw;
              newForm.feedBrand = priceData.supplierName;
              const bags = Number(newForm.bagCount) || 0;
              if (bags > 0) {
                recalcFromBags(newForm, bags);
              }
            }
          }
          setForm(newForm);
        }}>
          <option value="">{supplier ? "Select feed type..." : "Select supplier first..."}</option>
          {stages.map((s: any) => (
            <option key={s.id} value={s.stageName}>{s.stageName}</option>
          ))}
        </select>
      );
    }

    if (f.type === "select") {
      return (
        <select key={f.key} className="w-full border rounded-md p-2 bg-background" value={val} onChange={async (e) => {
          const newForm = { ...form, [f.key]: e.target.value };
          setForm(newForm);
        }}>
          <option value="">Select...</option>
          {f.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    if (f.type === "checkbox") {
      return <input key={f.key} type="checkbox" checked={!!val} onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })} />;
    }

    return <input key={f.key} type={f.type} step={f.type === "number" ? "0.1" : undefined} className="w-full border rounded-md p-2" value={val} onChange={(e) => setForm({ ...form, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value })} />;
  }

  function getFeedTypeColor(name: string) {
    const lower = name.toLowerCase();
    if (lower.includes("starter")) return "bg-blue-100 text-blue-800";
    if (lower.includes("grower")) return "bg-amber-100 text-amber-800";
    if (lower.includes("finish")) return "bg-green-100 text-green-800";
    if (lower.includes("pre")) return "bg-cyan-100 text-cyan-800";
    if (lower.includes("withdraw")) return "bg-orange-100 text-orange-800";
    if (lower.includes("chick")) return "bg-pink-100 text-pink-800";
    return "bg-gray-100 text-gray-800";
  }
  function getFeedTypeIcon(name: string) {
    const lower = name.toLowerCase();
    if (lower.includes("starter")) return <Sprout className="h-3 w-3 mr-1" />;
    if (lower.includes("grower")) return <Wheat className="h-3 w-3 mr-1" />;
    if (lower.includes("finish")) return <Package className="h-3 w-3 mr-1" />;
    if (lower.includes("chick")) return <span className="text-xs mr-1">🐣</span>;
    return null;
  }

  function renderRecord(r: any) {
    if (type === "growth") return <span>Weight: {r.avgWeight}g (n={r.sampleSize})</span>;
    if (type === "feed") {
      // Look up bag size from supplier if available
      let bagInfo = "";
      if (r.supplierId && suppliers) {
        const supplier = suppliers.find((s: any) => s.id === r.supplierId);
        if (supplier) {
          const stage = supplier.feedStages.find(
            (s: any) => (s.stageType === "feed" || s.stageType === "chick") && s.stageName.toLowerCase() === r.feedType.toLowerCase()
          );
          if (stage && stage.unitSizeKg > 0) {
            const bags = Math.round(Number(r.quantityKg) / Number(stage.unitSizeKg));
            bagInfo = `${bags}×${stage.unitSizeKg}kg bags`;
          }
        }
      }
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {r.feedType && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getFeedTypeColor(r.feedType)}`}>
                {getFeedTypeIcon(r.feedType)}
                {r.feedType}
              </span>
            )}
            <span className="font-medium">{r.quantityKg}kg</span>
            {bagInfo && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{bagInfo}</span>}
            {r.costZmw && <span className="text-muted-foreground text-sm">@ ZMW {r.costZmw}</span>}
            {r.feedBrand && <span className="text-muted-foreground text-sm">| {r.feedBrand}</span>}
          </div>
          {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
        </div>
      );
    }
    if (type === "water") return <span>{r.quantityLiters} liters {r.ph && `| pH ${r.ph}`}</span>;
    if (type === "mortality") return <span className="text-red-700">{r.count} deaths - {r.cause || "Unknown"}</span>;
    if (type === "vaccination") return <span className="text-green-700">{r.vaccineName} | {r.adminMethod}</span>;
    if (type === "financial") return <span className={r.isIncome ? "text-green-700" : ""}>{r.category}: {r.description} | ZMW {r.amountZmw} {r.isIncome && "(Income)"}</span>;
    return null;
  }

  const hasSupplier = form.supplierId && form.supplierId !== "custom" && form._bagSizeKg;
  const isCustom = form.supplierId === "custom";

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">{config.title}</h3>
        {canEdit && <Button size="sm" onClick={openAdd}><Icon className="h-4 w-4 mr-1" />Add</Button>}
      </div>
      {records.length === 0 ? <p className="text-muted-foreground">No records yet.</p> : (
        <div className="space-y-2">{records.map((r: any) => (
          <Card key={r.id}><CardContent className="py-3 flex justify-between items-center">
            <div><div className="font-medium">{renderRecord(r)}</div><p className="text-sm text-muted-foreground">{new Date(r.recordDate || r.eventDate || r.adminDate).toLocaleDateString()}</p></div>
            {canEdit && (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                {userRole === "owner" && (
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => openDelete(r)}><Trash2 className="h-4 w-4" /></Button>
                )}
              </div>
            )}
          </CardContent></Card>
        ))}</div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) { setFormOpen(false); setEditingRecord(null); setForm({}); setCostOverride(false); } }}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>{isEditing ? "Edit" : "Add"} {config.title}</DialogTitle>
            <DialogDescription>{isEditing ? "Update the record details below." : "Enter the new record details."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 px-6 overflow-y-auto">
            {/* Standard fields */}
            {config.fields.map((f: any) => (
              <div key={f.key}><label className="text-sm font-medium">{f.label}</label>{renderField(f)}</div>
            ))}

            {/* Bag count field (only for feed with supplier) */}
            {type === "feed" && hasSupplier && (
              <div>
                <label className="text-sm font-medium">Number of Bags ({form._bagSizeKg}kg each @ ZMW {form._bagPriceZmw}/bag)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="w-full border rounded-md p-2"
                  value={form.bagCount || ""}
                  placeholder={`Enter number of ${form._bagSizeKg}kg bags`}
                  onChange={(e) => {
                    const bags = Number(e.target.value) || 0;
                    const newForm = { ...form, bagCount: bags };
                    recalcFromBags(newForm, bags);
                    setForm(newForm);
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Auto: {form.quantityKg || 0}kg @ ZMW {form.costZmw || 0}
                </p>
              </div>
            )}

            {/* Custom supplier name input */}
            {type === "feed" && isCustom && (
              <div>
                <label className="text-sm font-medium">Custom Supplier Name</label>
                <input
                  className="w-full border rounded-md p-2"
                  value={form.feedBrand || ""}
                  placeholder="e.g., Local Market"
                  onChange={(e) => setForm({ ...form, feedBrand: e.target.value })}
                />
              </div>
            )}

            {/* Notes field for feed records */}
            {type === "feed" && (
              <div>
                <label className="text-sm font-medium">Notes</label>
                <textarea
                  className="w-full border rounded-md p-2 min-h-[60px] resize-y"
                  value={form.notes || ""}
                  placeholder="Optional notes about this feed purchase"
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            )}

            {/* Quantity and Cost (shown for all feed records) */}
            {type === "feed" && (
              <>
                <div>
                  <label className="text-sm font-medium">Total Quantity (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full border rounded-md p-2"
                    value={form.quantityKg || ""}
                    onChange={(e) => setForm({ ...form, quantityKg: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Total Cost (ZMW)</label>
                    {hasSupplier && (
                      <div className="flex items-center gap-1.5">
                        <input
                          id="cost-override"
                          type="checkbox"
                          checked={costOverride}
                          onChange={(e) => setCostOverride(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-gray-300"
                        />
                        <label htmlFor="cost-override" className="text-xs text-muted-foreground cursor-pointer select-none">
                          Override
                        </label>
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full border rounded-md p-2"
                    value={form.costZmw || ""}
                    readOnly={hasSupplier && !costOverride}
                    style={{ backgroundColor: hasSupplier && !costOverride ? "#f3f4f6" : "white" }}
                    onChange={(e) => setForm({ ...form, costZmw: Number(e.target.value) })}
                  />
                  {hasSupplier && !costOverride && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Auto-calculated from supplier pricing. Check Override to edit.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter className="p-6 pt-0">
            <Button variant="outline" onClick={() => { setFormOpen(false); setEditingRecord(null); setForm({}); setCostOverride(false); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : (isEditing ? "Update" : "Save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={(open) => { if (!open) { setDeleteOpen(false); setDeletingRecord(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Record</DialogTitle>
            <DialogDescription>This action cannot be undone. Are you sure?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeletingRecord(null); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>{saving ? "Deleting..." : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
