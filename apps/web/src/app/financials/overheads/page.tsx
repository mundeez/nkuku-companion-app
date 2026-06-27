"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Trash2, RefreshCw } from "lucide-react";
import Link from "next/link";

const CATEGORIES = [
  { value: "labour", label: "Labour" },
  { value: "electricity", label: "Electricity" },
  { value: "water", label: "Water" },
  { value: "litter", label: "Litter" },
  { value: "transport_to_market", label: "Transport to Market" },
  { value: "medication", label: "Medication" },
  { value: "vaccination", label: "Vaccination" },
  { value: "other", label: "Other" },
];

const CONTRACT_TYPES = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "daily", label: "Daily" },
  { value: "once_off", label: "Once-off" },
];

export default function OverheadsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [overheads, setOverheads] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [form, setForm] = useState({
    yearMonth: new Date().toISOString().slice(0, 7),
    category: "labour",
    description: "",
    amountZmw: "",
    contractType: "monthly",
  });

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (user) loadOverheads();
  }, [user, isLoading, router]);

  function loadOverheads() {
    apiFetch("/api/v1/financial-engine/overheads")
      .then((data: any) => setOverheads(data))
      .catch((err) => setError(err.message));
  }

  async function createOverhead(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await apiFetch("/api/v1/financial-engine/overheads", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          amountZmw: Number(form.amountZmw),
        }),
      });
      setShowForm(false);
      setForm({ yearMonth: new Date().toISOString().slice(0, 7), category: "labour", description: "", amountZmw: "", contractType: "monthly" });
      loadOverheads();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function deleteOverhead(id: string) {
    if (!confirm("Delete this overhead entry and its allocations?")) return;
    try {
      await apiFetch(`/api/v1/financial-engine/overheads/${id}`, { method: "DELETE" });
      loadOverheads();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function allocateMonth(yearMonth: string) {
    setAllocating(true);
    setError("");
    try {
      await apiFetch(`/api/v1/financial-engine/overheads/allocate/${yearMonth}`, { method: "POST" });
      loadOverheads();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAllocating(false);
    }
  }

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  const grouped = overheads.reduce((acc: any, o: any) => {
    if (!acc[o.yearMonth]) acc[o.yearMonth] = [];
    acc[o.yearMonth].push(o);
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/financials"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
          <h1 className="text-3xl font-bold">Monthly Overheads</h1>
        </div>
        <Button onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 mr-1" />New Overhead</Button>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {showForm && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Add Monthly Overhead</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={createOverhead} className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Month (YYYY-MM)</label>
                <Input type="month" value={form.yearMonth} onChange={(e) => setForm({ ...form, yearMonth: e.target.value })} required />
              </div>
              <div>
                <label className="text-sm font-medium">Category</label>
                <select className="w-full border rounded-md p-2 bg-background text-foreground" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Farm workers wages" />
              </div>
              <div>
                <label className="text-sm font-medium">Amount (ZMW)</label>
                <Input type="number" step="0.01" value={form.amountZmw} onChange={(e) => setForm({ ...form, amountZmw: e.target.value })} required />
              </div>
              <div>
                <label className="text-sm font-medium">Contract Type</label>
                <select className="w-full border rounded-md p-2 bg-background text-foreground" value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value })}>
                  {CONTRACT_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="md:col-span-2"><Button type="submit" className="w-full">Add Overhead & Allocate</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      {Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([month, items]: [string, any]) => (
        <Card key={month} className="mb-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{month}</CardTitle>
              <Button variant="outline" size="sm" disabled={allocating} onClick={() => allocateMonth(month)}>
                <RefreshCw className={`h-4 w-4 mr-1 ${allocating ? "animate-spin" : ""}`} />
                Re-allocate
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left py-2">Category</th><th className="text-left py-2">Description</th><th className="text-right py-2">Amount</th><th className="text-left py-2">Contract</th><th className="text-right py-2">Actions</th></tr></thead>
                <tbody>
                  {items.map((o: any) => (
                    <tr key={o.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 capitalize">{o.category.replace(/_/g, " ")}</td>
                      <td className="py-2">{o.description || "—"}</td>
                      <td className="py-2 text-right font-medium">ZMW {Number(o.amountZmw).toFixed(2)}</td>
                      <td className="py-2 capitalize">{o.contractType.replace(/_/g, " ")}</td>
                      <td className="py-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => deleteOverhead(o.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      {overheads.length === 0 && <p className="text-muted-foreground text-center py-8">No overheads entered yet. Add one to start allocating costs to active flocks.</p>}
    </div>
  );
}
