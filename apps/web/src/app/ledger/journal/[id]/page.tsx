"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import type { JournalEntry } from "@/lib/types/ledger";
import { ArrowLeft, RotateCcw } from "lucide-react";

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

export default function JournalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { user, isLoading } = useAuth();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [error, setError] = useState("");
  const [reversing, setReversing] = useState(false);
  const [reverseReason, setReverseReason] = useState("");
  const [showReverse, setShowReverse] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user && id) {
      apiFetch<JournalEntry>(`/api/v1/journal/${id}`)
        .then(setEntry)
        .catch((err) => setError(err.message));
    }
  }, [user, id]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;
  if (error) return <div className="p-8 text-destructive">{error}</div>;
  if (!entry) return <div className="p-8">Loading journal entry...</div>;

  const totalDebit = entry.lines.reduce((s, l) => s + parseFloat(l.debitZmw || "0"), 0);
  const totalCredit = entry.lines.reduce((s, l) => s + parseFloat(l.creditZmw || "0"), 0);

  const handleReverse = async () => {
    setReversing(true);
    setError("");
    try {
      const result = await apiFetch(`/api/v1/journal/${id}/reverse`, {
        method: "POST",
        body: JSON.stringify({ reason: reverseReason || undefined }),
      });
      router.push(`/ledger/journal/${result.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setReversing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/ledger/journal" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" />Back to Journal
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1 font-mono">{entry.entryNumber}</h1>
          <p className="text-muted-foreground">{entry.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {entry.isReversing && (
            <span className="text-xs px-2 py-1 rounded-full bg-orange-600/10 text-orange-600">Reversing Entry</span>
          )}
          <span className="text-xs px-2 py-1 rounded-full bg-muted">
            {SOURCE_LABELS[entry.sourceType] || entry.sourceType}
          </span>
        </div>
      </div>

      {/* ── Entry Metadata ───────────────────────── */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Date</p><p className="font-medium">{entry.entryDate.substring(0, 10)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Period</p><p className="font-medium">{entry.periodLabel || "—"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Reference</p><p className="font-medium">{entry.reference || "—"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Posted</p><p className="font-medium">{new Date(entry.postedAt).toLocaleDateString()}</p></CardContent></Card>
      </div>

      {/* ── Lines ────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Journal Lines</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Account</th>
                  <th className="text-left py-2 px-3 font-medium">Description</th>
                  <th className="text-right py-2 px-3 font-medium">Debit (ZMW)</th>
                  <th className="text-right py-2 px-3 font-medium">Credit (ZMW)</th>
                </tr>
              </thead>
              <tbody>
                {entry.lines.map((line) => (
                  <tr key={line.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3">
                      <Link href={`/ledger/accounts/${line.account?.code}`} className="font-mono text-primary hover:underline">
                        {line.account?.code}
                      </Link>
                      <span className="ml-2 text-muted-foreground">{line.account?.name}</span>
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">{line.description || "—"}</td>
                    <td className="py-2 px-3 text-right font-mono">{fmt(line.debitZmw)}</td>
                    <td className="py-2 px-3 text-right font-mono">{fmt(line.creditZmw)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold">
                  <td colSpan={2} className="py-3 px-3">TOTALS</td>
                  <td className="py-3 px-3 text-right font-mono">{totalDebit.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right font-mono">{totalCredit.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Reverse Action ───────────────────────── */}
      {user.role === "owner" && !entry.isReversing && (
        <Card>
          <CardHeader><CardTitle>Reverse Entry</CardTitle></CardHeader>
          <CardContent>
            {!showReverse ? (
              <Button variant="outline" onClick={() => setShowReverse(true)}>
                <RotateCcw className="h-4 w-4 mr-2" />Reverse this entry
              </Button>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium block mb-1">Reason (optional)</label>
                  <input type="text" value={reverseReason} onChange={(e) => setReverseReason(e.target.value)}
                    placeholder="e.g. Data entry error"
                    className="w-full max-w-md px-3 py-2 rounded-md border border-input bg-background text-sm" />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex items-center gap-2">
                  <Button variant="destructive" onClick={handleReverse} disabled={reversing}>
                    {reversing ? "Reversing..." : "Confirm Reversal"}
                  </Button>
                  <Button variant="outline" onClick={() => { setShowReverse(false); setError(""); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
