"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import type { Account } from "@/lib/types/ledger";
import { ArrowLeft, Plus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";

interface LineInput {
  accountCode: string;
  debitZmw: string;
  creditZmw: string;
  description: string;
}

export default function NewJournalEntryPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [entryDate, setEntryDate] = useState(new Date().toISOString().substring(0, 10));
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<LineInput[]>([
    { accountCode: "", debitZmw: "", creditZmw: "", description: "" },
    { accountCode: "", debitZmw: "", creditZmw: "", description: "" },
  ]);

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (user && user.role === "viewer") { router.push("/ledger/journal"); return; }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      apiFetch<Account[]>("/api/v1/accounts")
        .then((a) => setAccounts(a.filter((acc) => acc.isActive)))
        .catch((err) => setError(err.message));
    }
  }, [user]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  const totalDebits = lines.reduce((s, l) => s + (parseFloat(l.debitZmw) || 0), 0);
  const totalCredits = lines.reduce((s, l) => s + (parseFloat(l.creditZmw) || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01 && totalDebits > 0;

  const updateLine = (i: number, field: keyof LineInput, value: string) => {
    const updated = [...lines];
    updated[i] = { ...updated[i], [field]: value };
    // If entering debit, clear credit and vice versa
    if (field === "debitZmw" && value) updated[i].creditZmw = "";
    if (field === "creditZmw" && value) updated[i].debitZmw = "";
    setLines(updated);
  };

  const addLine = () => {
    setLines([...lines, { accountCode: "", debitZmw: "", creditZmw: "", description: "" }]);
  };

  const removeLine = (i: number) => {
    if (lines.length > 2) setLines(lines.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    setError("");
    setSuccess("");
    if (!description.trim()) { setError("Description is required"); return; }
    if (!isBalanced) { setError("Entry is not balanced"); return; }
    if (lines.some((l) => !l.accountCode)) { setError("All lines must have an account selected"); return; }

    setSubmitting(true);
    try {
      const payload = {
        entryDate,
        description,
        reference: reference || undefined,
        lines: lines
          .filter((l) => l.accountCode && (parseFloat(l.debitZmw) > 0 || parseFloat(l.creditZmw) > 0))
          .map((l) => ({
            accountCode: l.accountCode,
            debitZmw: parseFloat(l.debitZmw) || undefined,
            creditZmw: parseFloat(l.creditZmw) || undefined,
            description: l.description || undefined,
          })),
      };
      const result = await apiFetch("/api/v1/journal", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSuccess(`Posted: ${result.entryNumber}`);
      setTimeout(() => router.push(`/ledger/journal/${result.id}`), 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/ledger/journal" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" />Back to Journal
      </Link>

      <h1 className="text-3xl font-bold mb-6">New Journal Entry</h1>

      {/* ── Entry Header ─────────────────────────── */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Entry Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-sm font-medium block mb-1">Date</label>
            <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium block mb-1">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Feed purchase from NutriFeed"
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm" />
          </div>
          <div className="md:col-span-3">
            <label className="text-sm font-medium block mb-1">Reference (optional)</label>
            <input type="text" value={reference} onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. INV-2026-001"
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm" />
          </div>
        </CardContent>
      </Card>

      {/* ── Journal Lines ────────────────────────── */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lines</CardTitle>
            <Button variant="outline" size="sm" onClick={addLine}><Plus className="h-4 w-4 mr-1" />Add Line</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium">Account</th>
                  <th className="text-left py-2 px-2 font-medium">Description</th>
                  <th className="text-right py-2 px-2 font-medium w-32">Debit (ZMW)</th>
                  <th className="text-right py-2 px-2 font-medium w-32">Credit (ZMW)</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2 px-2">
                      <select value={line.accountCode} onChange={(e) => updateLine(i, "accountCode", e.target.value)}
                        className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-sm">
                        <option value="">Select account...</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.code}>{a.code} — {a.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <input type="text" value={line.description} onChange={(e) => updateLine(i, "description", e.target.value)}
                        placeholder="Line description"
                        className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-sm" />
                    </td>
                    <td className="py-2 px-2">
                      <input type="number" step="0.01" min="0" value={line.debitZmw}
                        onChange={(e) => updateLine(i, "debitZmw", e.target.value)}
                        className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-sm text-right" />
                    </td>
                    <td className="py-2 px-2">
                      <input type="number" step="0.01" min="0" value={line.creditZmw}
                        onChange={(e) => updateLine(i, "creditZmw", e.target.value)}
                        className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-sm text-right" />
                    </td>
                    <td className="py-2 px-2 text-center">
                      {lines.length > 2 && (
                        <button onClick={() => removeLine(i)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold">
                  <td colSpan={2} className="py-3 px-2">TOTALS</td>
                  <td className="py-3 px-2 text-right font-mono">{totalDebits.toFixed(2)}</td>
                  <td className="py-3 px-2 text-right font-mono">{totalCredits.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Balance Indicator */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isBalanced ? (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" /> Balanced
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  {totalDebits === 0 && totalCredits === 0
                    ? "Enter amounts"
                    : `Out of balance by ${Math.abs(totalDebits - totalCredits).toFixed(2)}`}
                </span>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              Difference: {(totalDebits - totalCredits).toFixed(2)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Actions ──────────────────────────────── */}
      {error && <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 rounded-md bg-green-600/10 text-green-600 text-sm">{success}</div>}

      <div className="flex items-center gap-3">
        <Button onClick={handleSubmit} disabled={!isBalanced || submitting || !description.trim()}>
          {submitting ? "Posting..." : "Post Entry"}
        </Button>
        <Link href="/ledger/journal">
          <Button variant="outline">Cancel</Button>
        </Link>
      </div>
    </div>
  );
}
