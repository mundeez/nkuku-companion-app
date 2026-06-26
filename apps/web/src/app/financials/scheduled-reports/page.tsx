"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Trash2, Plus } from "lucide-react";
import Link from "next/link";

export default function ScheduledReportsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", reportType: "income_statement", frequency: "monthly", scope: "global", recipients: "", format: "csv" });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (user) loadReports();
  }, [user, isLoading, router]);

  function loadReports() {
    apiFetch("/api/v1/financial-engine/scheduled-reports")
      .then((data: any) => setReports(data))
      .catch((err) => setError(err.message));
  }

  async function createReport(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await apiFetch("/api/v1/financial-engine/scheduled-reports", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          recipients: form.recipients.split(",").map((r) => r.trim()).filter(Boolean),
        }),
      });
      setShowForm(false);
      setForm({ name: "", reportType: "income_statement", frequency: "monthly", scope: "global", recipients: "", format: "csv" });
      loadReports();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function deleteReport(id: string) {
    if (!confirm("Delete this scheduled report?")) return;
    try {
      await apiFetch(`/api/v1/financial-engine/scheduled-reports/${id}`, { method: "DELETE" });
      loadReports();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/financials"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
          <h1 className="text-3xl font-bold">Scheduled Reports</h1>
        </div>
        <Button onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 mr-1" />New Schedule</Button>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {showForm && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Create Scheduled Report</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={createReport} className="grid gap-4 md:grid-cols-2">
              <div><label className="text-sm font-medium">Name</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div><label className="text-sm font-medium">Report Type</label>
                <select className="w-full border rounded-md p-2 bg-background text-foreground" value={form.reportType} onChange={(e) => setForm({ ...form, reportType: e.target.value })}>
                  <option value="income_statement">Income Statement</option>
                  <option value="balance_sheet">Balance Sheet</option>
                  <option value="cash_flow">Cash Flow</option>
                  <option value="cost_breakdown">Cost Breakdown</option>
                  <option value="flock_profitability">Flock Profitability</option>
                </select>
              </div>
              <div><label className="text-sm font-medium">Frequency</label>
                <select className="w-full border rounded-md p-2 bg-background text-foreground" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
              <div><label className="text-sm font-medium">Scope</label>
                <select className="w-full border rounded-md p-2 bg-background text-foreground" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                  <option value="global">Global</option>
                  <option value="flock">Flock</option>
                  <option value="cycle">Cycle</option>
                </select>
              </div>
              <div><label className="text-sm font-medium">Recipients (comma-separated emails)</label><Input value={form.recipients} onChange={(e) => setForm({ ...form, recipients: e.target.value })} required /></div>
              <div><label className="text-sm font-medium">Format</label>
                <select className="w-full border rounded-md p-2 bg-background text-foreground" value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
                  <option value="csv">CSV</option>
                  <option value="pdf">PDF</option>
                  <option value="excel">Excel</option>
                </select>
              </div>
              <div className="md:col-span-2"><Button type="submit" className="w-full">Create Schedule</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Active Schedules</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left py-2">Name</th><th className="text-left py-2">Type</th><th className="text-left py-2">Frequency</th><th className="text-left py-2">Scope</th><th className="text-left py-2">Format</th><th className="text-left py-2">Next Run</th><th className="text-left py-2">Status</th><th className="text-right py-2">Actions</th></tr></thead>
              <tbody>
                {reports.map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 font-medium">{r.name}</td>
                    <td className="py-2 capitalize">{r.reportType.replace(/_/g, " ")}</td>
                    <td className="py-2 capitalize">{r.frequency}</td>
                    <td className="py-2 capitalize">{r.scope}</td>
                    <td className="py-2 uppercase">{r.format}</td>
                    <td className="py-2">{r.nextRunAt ? new Date(r.nextRunAt).toLocaleDateString() : "—"}</td>
                    <td className="py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>{r.isActive ? "Active" : "Inactive"}</span></td>
                    <td className="py-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => deleteReport(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && <tr><td colSpan={8} className="py-4 text-muted-foreground text-center">No scheduled reports yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
