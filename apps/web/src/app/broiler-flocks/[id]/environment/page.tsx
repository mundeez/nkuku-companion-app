"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { BroilerFlock, EnvironmentalRecord } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Thermometer, Droplets, Wind, Sun, Trash2 } from "lucide-react";

export default function EnvironmentPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const flockId = params.id as string;

  const [flock, setFlock] = useState<BroilerFlock | null>(null);
  const [records, setRecords] = useState<EnvironmentalRecord[]>([]);
  const [form, setForm] = useState({
    recordDate: new Date().toISOString().split("T")[0],
    timeOfDay: "Morning",
    temperatureC: "",
    humidityPct: "",
    ammoniaPpm: "",
    lightHours: "",
    litterScore: "",
    ventilationNote: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canCreateEdit = user?.role === "owner" || user?.role === "manager";

  function loadAll() {
    apiFetch<BroilerFlock>(`/api/v1/broiler-flocks/${flockId}`)
      .then(setFlock)
      .catch((err) => setError(err.message));
    apiFetch<EnvironmentalRecord[]>(`/api/v1/environmental-records?flockId=${flockId}`)
      .then(setRecords)
      .catch((err) => setError(err.message));
  }

  async function saveRecord(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/api/v1/environmental-records`, {
        method: "POST",
        body: JSON.stringify({
          flockId,
          recordDate: form.recordDate,
          timeOfDay: form.timeOfDay,
          temperatureC: form.temperatureC ? Number(form.temperatureC) : undefined,
          humidityPct: form.humidityPct ? Number(form.humidityPct) : undefined,
          ammoniaPpm: form.ammoniaPpm ? Number(form.ammoniaPpm) : undefined,
          lightHours: form.lightHours ? Number(form.lightHours) : undefined,
          litterScore: form.litterScore ? Number(form.litterScore) : undefined,
          ventilationNote: form.ventilationNote || undefined,
          notes: form.notes || undefined,
        }),
      });
      setForm({
        recordDate: new Date().toISOString().split("T")[0],
        timeOfDay: "Morning",
        temperatureC: "",
        humidityPct: "",
        ammoniaPpm: "",
        lightHours: "",
        litterScore: "",
        ventilationNote: "",
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
    if (!confirm("Delete this environmental record?")) return;
    try {
      await apiFetch(`/api/v1/environmental-records/${id}`, { method: "DELETE" });
      loadAll();
    } catch (e: any) {
      alert(e.message);
    }
  }

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (user && flockId) loadAll();
  }, [user, isLoading, flockId, router]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  const latest = records[0];
  const today = new Date().toISOString().split("T")[0];
  const todayRecords = records.filter((r) => r.recordDate.startsWith(today));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={() => router.push(`/broiler-flocks/${flockId}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Flock
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Environment</h1>
          <div className="text-muted-foreground">{flock?.name || "Loading..."}</div>
        </div>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2"><Thermometer className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Latest Temp</span></div>
            <p className="text-2xl font-bold mt-1">{latest?.temperatureC != null ? `${latest.temperatureC}°C` : "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2"><Droplets className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Latest Humidity</span></div>
            <p className="text-2xl font-bold mt-1">{latest?.humidityPct != null ? `${latest.humidityPct}%` : "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2"><Wind className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Ammonia</span></div>
            <p className="text-2xl font-bold mt-1">{latest?.ammoniaPpm != null ? `${latest.ammoniaPpm} ppm` : "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2"><Sun className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Light Hours</span></div>
            <p className="text-2xl font-bold mt-1">{latest?.lightHours != null ? `${latest.lightHours}h` : "-"}</p>
          </CardContent>
        </Card>
      </div>

      {canCreateEdit && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Record Environmental Reading</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={saveRecord} className="grid gap-4 md:grid-cols-3">
              <div><Label htmlFor="recordDate">Date</Label><Input id="recordDate" type="date" value={form.recordDate} onChange={(e) => setForm({ ...form, recordDate: e.target.value })} required /></div>
              <div><Label htmlFor="timeOfDay">Time</Label><Input id="timeOfDay" value={form.timeOfDay} onChange={(e) => setForm({ ...form, timeOfDay: e.target.value })} /></div>
              <div><Label htmlFor="temperatureC">Temperature (°C)</Label><Input id="temperatureC" type="number" step="0.1" value={form.temperatureC} onChange={(e) => setForm({ ...form, temperatureC: e.target.value })} /></div>
              <div><Label htmlFor="humidityPct">Humidity (%)</Label><Input id="humidityPct" type="number" step="0.1" value={form.humidityPct} onChange={(e) => setForm({ ...form, humidityPct: e.target.value })} /></div>
              <div><Label htmlFor="ammoniaPpm">Ammonia (ppm)</Label><Input id="ammoniaPpm" type="number" step="0.1" value={form.ammoniaPpm} onChange={(e) => setForm({ ...form, ammoniaPpm: e.target.value })} /></div>
              <div><Label htmlFor="lightHours">Light Hours</Label><Input id="lightHours" type="number" step="0.1" value={form.lightHours} onChange={(e) => setForm({ ...form, lightHours: e.target.value })} /></div>
              <div><Label htmlFor="litterScore">Litter Score (1-5)</Label><Input id="litterScore" type="number" min="1" max="5" value={form.litterScore} onChange={(e) => setForm({ ...form, litterScore: e.target.value })} /></div>
              <div><Label htmlFor="ventilationNote">Ventilation Note</Label><Input id="ventilationNote" value={form.ventilationNote} onChange={(e) => setForm({ ...form, ventilationNote: e.target.value })} /></div>
              <div className="md:col-span-3"><Label htmlFor="notes">Notes</Label><Input id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <div className="md:col-span-3"><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Reading"}</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      <h2 className="text-lg font-semibold mb-4">Today's Readings ({todayRecords.length})</h2>
      <div className="space-y-3">
        {todayRecords.length === 0 && <p className="text-muted-foreground">No readings recorded today.</p>}
        {todayRecords.map((r) => (
          <Card key={r.id}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Date</span><p className="font-medium">{new Date(r.recordDate).toLocaleDateString()}</p></div>
                  <div><span className="text-muted-foreground">Time</span><p className="font-medium">{r.timeOfDay || "-"}</p></div>
                  <div><span className="text-muted-foreground">Temp</span><p className="font-medium">{r.temperatureC != null ? `${r.temperatureC}°C` : "-"}</p></div>
                  <div><span className="text-muted-foreground">Humidity</span><p className="font-medium">{r.humidityPct != null ? `${r.humidityPct}%` : "-"}</p></div>
                  <div><span className="text-muted-foreground">Ammonia</span><p className="font-medium">{r.ammoniaPpm != null ? `${r.ammoniaPpm} ppm` : "-"}</p></div>
                  <div><span className="text-muted-foreground">Light</span><p className="font-medium">{r.lightHours != null ? `${r.lightHours}h` : "-"}</p></div>
                </div>
                {canCreateEdit && (
                  <Button variant="ghost" size="sm" onClick={() => deleteRecord(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
              {(r.ventilationNote || r.notes) && (
                <p className="text-sm text-muted-foreground mt-2">{r.ventilationNote || r.notes}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {records.length > todayRecords.length && (
        <>
          <h2 className="text-lg font-semibold mt-8 mb-4">History</h2>
          <div className="space-y-3">
            {records.filter((r) => !r.recordDate.startsWith(today)).map((r) => (
              <Card key={r.id} className="opacity-80">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Date</span><p className="font-medium">{new Date(r.recordDate).toLocaleDateString()}</p></div>
                    <div><span className="text-muted-foreground">Time</span><p className="font-medium">{r.timeOfDay || "-"}</p></div>
                    <div><span className="text-muted-foreground">Temp</span><p className="font-medium">{r.temperatureC != null ? `${r.temperatureC}°C` : "-"}</p></div>
                    <div><span className="text-muted-foreground">Humidity</span><p className="font-medium">{r.humidityPct != null ? `${r.humidityPct}%` : "-"}</p></div>
                    <div><span className="text-muted-foreground">Ammonia</span><p className="font-medium">{r.ammoniaPpm != null ? `${r.ammoniaPpm} ppm` : "-"}</p></div>
                    <div><span className="text-muted-foreground">Light</span><p className="font-medium">{r.lightHours != null ? `${r.lightHours}h` : "-"}</p></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
