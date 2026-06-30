"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { BroilerFlock, MedicationRecord } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Pill, Trash2, AlertTriangle } from "lucide-react";

const categoryOptions = [
  "antibiotic", "coccidiostat", "electrolyte", "vitamin", "probiotic", "acidifier", "phytogenic", "other",
];

export default function MedicationPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const flockId = params.id as string;

  const [flock, setFlock] = useState<BroilerFlock | null>(null);
  const [records, setRecords] = useState<MedicationRecord[]>([]);
  const [form, setForm] = useState({
    recordDate: new Date().toISOString().split("T")[0],
    productName: "",
    category: "antibiotic",
    dose: "",
    route: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    withdrawalDays: "",
    costZmw: "",
    veterinarian: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canCreateEdit = user?.role === "owner" || user?.role === "manager";

  function loadAll() {
    apiFetch<BroilerFlock>(`/api/v1/broiler-flocks/${flockId}`)
      .then(setFlock)
      .catch((err) => setError(err.message));
    apiFetch<MedicationRecord[]>(`/api/v1/medication-records?flockId=${flockId}`)
      .then(setRecords)
      .catch((err) => setError(err.message));
  }

  async function saveRecord(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/api/v1/medication-records`, {
        method: "POST",
        body: JSON.stringify({
          flockId,
          recordDate: form.recordDate,
          productName: form.productName,
          category: form.category,
          dose: form.dose || undefined,
          route: form.route || undefined,
          startDate: form.startDate,
          endDate: form.endDate || null,
          withdrawalDays: form.withdrawalDays ? Number(form.withdrawalDays) : undefined,
          costZmw: form.costZmw ? Number(form.costZmw) : undefined,
          veterinarian: form.veterinarian || undefined,
          notes: form.notes || undefined,
        }),
      });
      setForm({
        recordDate: new Date().toISOString().split("T")[0],
        productName: "",
        category: "antibiotic",
        dose: "",
        route: "",
        startDate: new Date().toISOString().split("T")[0],
        endDate: "",
        withdrawalDays: "",
        costZmw: "",
        veterinarian: "",
        notes: "",
      });
      loadAll();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(id: string) {
    if (!confirm("Delete this medication record?")) return;
    try {
      await apiFetch(`/api/v1/medication-records/${id}`, { method: "DELETE" });
      loadAll();
    } catch (e: any) {
      alert(e.message);
    }
  }

  function daysUntil(dateStr?: string) {
    if (!dateStr) return null;
    const diff = Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (user && flockId) loadAll();
  }, [user, isLoading, flockId, router]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  const activeRecords = records.filter((r) => !r.endDate || new Date(r.endDate) >= new Date());
  const pastRecords = records.filter((r) => r.endDate && new Date(r.endDate) < new Date());

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={() => router.push(`/broiler-flocks/${flockId}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Flock
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Medication Register</h1>
          <div className="text-muted-foreground">{flock?.name || "Loading..."}</div>
        </div>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {canCreateEdit && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="flex items-center gap-2"><Pill className="h-4 w-4" /> Add Medication Record</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={saveRecord} className="grid gap-4 md:grid-cols-3">
              <div><Label htmlFor="recordDate">Record Date</Label><Input id="recordDate" type="date" value={form.recordDate} onChange={(e) => setForm({ ...form, recordDate: e.target.value })} required /></div>
              <div><Label htmlFor="productName">Product Name</Label><Input id="productName" value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} required /></div>
              <div><Label htmlFor="category">Category</Label>
                <select id="category" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><Label htmlFor="dose">Dose</Label><Input id="dose" value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} /></div>
              <div><Label htmlFor="route">Route</Label><Input id="route" value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} /></div>
              <div><Label htmlFor="startDate">Start Date</Label><Input id="startDate" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></div>
              <div><Label htmlFor="endDate">End Date</Label><Input id="endDate" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
              <div><Label htmlFor="withdrawalDays">Withdrawal Days</Label><Input id="withdrawalDays" type="number" min="0" value={form.withdrawalDays} onChange={(e) => setForm({ ...form, withdrawalDays: e.target.value })} /></div>
              <div><Label htmlFor="costZmw">Cost (ZMW)</Label><Input id="costZmw" type="number" step="0.01" min="0" value={form.costZmw} onChange={(e) => setForm({ ...form, costZmw: e.target.value })} /></div>
              <div><Label htmlFor="veterinarian">Veterinarian</Label><Input id="veterinarian" value={form.veterinarian} onChange={(e) => setForm({ ...form, veterinarian: e.target.value })} /></div>
              <div className="md:col-span-3"><Label htmlFor="notes">Notes</Label><Input id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <div className="md:col-span-3"><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Record"}</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      <h2 className="text-lg font-semibold mb-4">Active / Recent Records</h2>
      <div className="space-y-3">
        {activeRecords.length === 0 && <p className="text-muted-foreground">No active medication records.</p>}
        {activeRecords.map((r) => {
          const remaining = daysUntil(r.withdrawalDate);
          return (
            <Card key={r.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{r.productName}</span>
                      <span className="text-xs uppercase bg-muted px-2 py-0.5 rounded">{r.category}</span>
                      {remaining !== null && remaining <= 0 && (
                        <span className="text-xs flex items-center gap-1 text-red-700 bg-red-100 px-2 py-0.5 rounded"><AlertTriangle className="h-3 w-3" /> Withdrawal complete</span>
                      )}
                      {remaining !== null && remaining > 0 && (
                        <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded">{remaining} days withdrawal left</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {r.dose} {r.route} · {new Date(r.startDate).toLocaleDateString()} {r.endDate ? `→ ${new Date(r.endDate).toLocaleDateString()}` : ""}
                      {r.withdrawalDate ? ` · Withdrawal: ${new Date(r.withdrawalDate).toLocaleDateString()}` : ""}
                      {r.veterinarian ? ` · Vet: ${r.veterinarian}` : ""}
                      {r.costZmw ? ` · ZMW ${r.costZmw}` : ""}
                    </p>
                    {r.notes && <p className="text-sm mt-1">{r.notes}</p>}
                  </div>
                  {canCreateEdit && (
                    <Button variant="ghost" size="sm" onClick={() => deleteRecord(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {pastRecords.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mt-8 mb-4">Past Records</h2>
          <div className="space-y-3 opacity-70">
            {pastRecords.map((r) => (
              <Card key={r.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{r.productName}</span>
                    <span className="text-xs uppercase bg-muted px-2 py-0.5 rounded">{r.category}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {r.dose} {r.route} · {new Date(r.startDate).toLocaleDateString()} → {new Date(r.endDate!).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
