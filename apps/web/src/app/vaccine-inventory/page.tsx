"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { VaccineInventory } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Syringe, Trash2, AlertTriangle } from "lucide-react";

const statusColors: Record<string, string> = {
  available: "bg-green-100 text-green-800",
  in_use: "bg-blue-100 text-blue-800",
  expired: "bg-red-100 text-red-800",
  depleted: "bg-gray-100 text-gray-800",
};

export default function VaccineInventoryPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [items, setItems] = useState<VaccineInventory[]>([]);
  const [form, setForm] = useState({
    name: "",
    disease: "",
    supplier: "",
    batchNumber: "",
    quantityDoses: "",
    expiryDate: "",
    costZmw: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canCreateEdit = user?.role === "owner" || user?.role === "manager";

  function loadAll() {
    apiFetch<VaccineInventory[]>("/api/v1/vaccine-inventory")
      .then(setItems)
      .catch((err) => setError(err.message));
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch("/api/v1/vaccine-inventory", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          disease: form.disease || undefined,
          supplier: form.supplier || undefined,
          batchNumber: form.batchNumber,
          quantityDoses: Number(form.quantityDoses),
          expiryDate: form.expiryDate,
          costZmw: form.costZmw ? Number(form.costZmw) : undefined,
          notes: form.notes || undefined,
        }),
      });
      setForm({ name: "", disease: "", supplier: "", batchNumber: "", quantityDoses: "", expiryDate: "", costZmw: "", notes: "" });
      loadAll();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this vaccine inventory item?")) return;
    try {
      await apiFetch(`/api/v1/vaccine-inventory/${id}`, { method: "DELETE" });
      loadAll();
    } catch (e: any) {
      alert(e.message);
    }
  }

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (user) loadAll();
  }, [user, isLoading, router]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  const expiringItems = items.filter((i) => {
    const days = Math.ceil((new Date(i.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return days <= 7 && days >= 0 && i.status !== "depleted";
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={() => router.push("/")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Vaccine Inventory</h1>
          <div className="text-muted-foreground">Track vaccine stock, batches, and expiry dates</div>
        </div>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {expiringItems.length > 0 && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
          <div className="flex items-center gap-2 font-semibold mb-1"><AlertTriangle className="h-4 w-4" /> Expiring Soon</div>
          <p className="text-sm">{expiringItems.length} vaccine item(s) expire within 7 days.</p>
        </div>
      )}

      {canCreateEdit && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="flex items-center gap-2"><Syringe className="h-4 w-4" /> Add Vaccine Stock</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={saveItem} className="grid gap-4 md:grid-cols-3">
              <div><Label htmlFor="name">Vaccine Name</Label><Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div><Label htmlFor="disease">Disease</Label><Input id="disease" value={form.disease} onChange={(e) => setForm({ ...form, disease: e.target.value })} /></div>
              <div><Label htmlFor="supplier">Supplier</Label><Input id="supplier" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
              <div><Label htmlFor="batchNumber">Batch Number</Label><Input id="batchNumber" value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} required /></div>
              <div><Label htmlFor="quantityDoses">Quantity (doses)</Label><Input id="quantityDoses" type="number" min="0" value={form.quantityDoses} onChange={(e) => setForm({ ...form, quantityDoses: e.target.value })} required /></div>
              <div><Label htmlFor="expiryDate">Expiry Date</Label><Input id="expiryDate" type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} required /></div>
              <div><Label htmlFor="costZmw">Cost (ZMW)</Label><Input id="costZmw" type="number" step="0.01" min="0" value={form.costZmw} onChange={(e) => setForm({ ...form, costZmw: e.target.value })} /></div>
              <div className="md:col-span-2"><Label htmlFor="notes">Notes</Label><Input id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <div className="md:col-span-3"><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Add Stock"}</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {items.length === 0 && <p className="text-muted-foreground">No vaccine inventory recorded.</p>}
        {items.map((item) => {
          const daysLeft = Math.ceil((new Date(item.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          return (
            <Card key={item.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{item.name}</span>
                      <Badge className={statusColors[item.status] || "bg-gray-100"}>{item.status}</Badge>
                      {daysLeft <= 7 && daysLeft >= 0 && <Badge className="bg-amber-100 text-amber-800">Expires in {daysLeft}d</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Batch: {item.batchNumber} · {item.quantityDoses} doses · Expiry: {new Date(item.expiryDate).toLocaleDateString()}
                      {item.disease ? ` · Disease: ${item.disease}` : ""}
                      {item.supplier ? ` · Supplier: ${item.supplier}` : ""}
                      {item.costZmw ? ` · ZMW ${item.costZmw}` : ""}
                    </p>
                    {item.notes && <p className="text-sm mt-1">{item.notes}</p>}
                  </div>
                  {canCreateEdit && (
                    <Button variant="ghost" size="sm" onClick={() => deleteItem(item.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
