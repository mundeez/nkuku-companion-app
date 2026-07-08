"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import type { JournalEntry, Account } from "@/lib/types/ledger";
import { Plus, ArrowLeft } from "lucide-react";

function fmt(s: string | null): string {
  if (!s) return "—";
  const n = parseFloat(s);
  if (isNaN(n)) return "—";
  return n.toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  feed_record: "Feed Record",
  vaccination_event: "Vaccination",
  mortality_event: "Mortality",
  water_record: "Water Record",
  batch_expense: "Batch Expense",
  overhead_cost: "Overhead Cost",
  sales: "Sales",
  migration: "Migration",
  period_close: "Period Close",
};

export default function JournalListPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [error, setError] = useState("");
  const [sourceType, setSourceType] = useState("");

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      const q = sourceType ? `?sourceType=${sourceType}` : "";
      apiFetch<JournalEntry[]>(`/api/v1/journal${q}`)
        .then(setEntries)
        .catch((err) => setError(err.message));
    }
  }, [user, sourceType]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;
  if (error) return <div className="p-8 text-destructive">{error}</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/ledger" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" />Back to Ledger
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Journal Entries</h1>
          <p className="text-muted-foreground">{entries.length} entries</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-input bg-background text-sm"
          >
            <option value="">All sources</option>
            {Object.entries(SOURCE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          {(user.role === "owner" || user.role === "manager") && (
            <Link href="/ledger/journal/new">
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Entry</Button>
            </Link>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Entry #</th>
                  <th className="text-left py-2 px-3 font-medium">Date</th>
                  <th className="text-left py-2 px-3 font-medium">Description</th>
                  <th className="text-left py-2 px-3 font-medium">Source</th>
                  <th className="text-left py-2 px-3 font-medium">Lines</th>
                  <th className="text-right py-2 px-3 font-medium">Amount</th>
                  <th className="text-left py-2 px-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const totalDebit = entry.lines.reduce((s, l) => s + parseFloat(l.debitZmw || "0"), 0);
                  return (
                    <tr key={entry.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3 font-mono text-xs">
                        <Link href={`/ledger/journal/${entry.id}`} className="text-primary hover:underline">
                          {entry.entryNumber}
                        </Link>
                      </td>
                      <td className="py-2 px-3">{entry.entryDate.substring(0, 10)}</td>
                      <td className="py-2 px-3 max-w-xs truncate">{entry.description}</td>
                      <td className="py-2 px-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                          {SOURCE_LABELS[entry.sourceType] || entry.sourceType}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">{entry.lines.length}</td>
                      <td className="py-2 px-3 text-right font-mono">{fmt(totalDebit.toFixed(2))}</td>
                      <td className="py-2 px-3">
                        {entry.isReversing ? (
                          <span className="text-xs text-orange-600">Reversing</span>
                        ) : (
                          <span className="text-xs text-green-600">Posted</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {entries.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No journal entries found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
