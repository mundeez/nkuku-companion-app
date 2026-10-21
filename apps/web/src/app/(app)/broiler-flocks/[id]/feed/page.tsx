"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { FeedProjectionResult, FeedPurchase } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Calculator, Plus, Pencil, Trash2, Package } from "lucide-react";

export default function FeedCalculatorPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const flockId = params.id as string;
  const [summary, setSummary] = useState<any>(null);
  const [flock, setFlock] = useState<any>(null);
  const [supplier, setSupplier] = useState<any>(null);
  const [error, setError] = useState("");
  const [calc, setCalc] = useState({ birds: 1000, days: 42, feedType: "" });
  const [result, setResult] = useState<any>(null);

  // Feed projection + purchases state
  const [projection, setProjection] = useState<FeedProjectionResult | null>(null);
  const [purchases, setPurchases] = useState<FeedPurchase[]>([]);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<FeedPurchase | null>(null);
  const [purchaseForm, setPurchaseForm] = useState({
    feedStageId: "",
    stageName: "",
    bagSizeKg: "",
    bagsPurchased: "",
    unitPriceZmw: "",
    purchaseDate: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [savingPurchase, setSavingPurchase] = useState(false);

  const canEdit = user?.role === "owner" || user?.role === "manager";

  const loadProjection = useCallback(() => {
    apiFetch<FeedProjectionResult>(`/api/v1/broiler-flocks/${flockId}/feed-projection`)
      .then(setProjection)
      .catch(() => {});
  }, [flockId]);

  const loadPurchases = useCallback(() => {
    apiFetch<FeedPurchase[]>(`/api/v1/feed-purchases?flockId=${flockId}`)
      .then(setPurchases)
      .catch(() => {});
  }, [flockId]);

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (user && flockId) {
      apiFetch(`/api/v1/feed-records/summary?flockId=${flockId}`)
        .then(setSummary)
        .catch((err) => setError(err.message));
      apiFetch(`/api/v1/broiler-flocks/${flockId}`)
        .then((f: any) => {
          setFlock(f);
          if (f?.supplierId) {
            apiFetch(`/api/v1/suppliers/${f.supplierId}`)
              .then(setSupplier)
              .catch(() => {});
          }
        })
        .catch(() => {});
      loadProjection();
      loadPurchases();
    }
  }, [user, isLoading, flockId, router, loadProjection, loadPurchases]);

  const feedStages = supplier?.feedStages
    ?.filter((s: any) => s.stageType === "feed" || s.stageType === "chick")
    ?.sort((a: any, b: any) => a.sortOrder - b.sortOrder) || [];

  function runCalculator() {
    const { birds, days, feedType } = calc;
    const lower = feedType.toLowerCase();
    // Ross 308 approximate feed consumption per bird
    let daily = 0.05;
    if (lower.includes("starter")) daily = days <= 10 ? 0.035 : 0.045;
    else if (lower.includes("grower")) daily = days > 10 && days <= 24 ? 0.065 : 0.055;
    else if (lower.includes("finish")) daily = days > 24 ? 0.095 : 0.085;
    else if (lower.includes("pre")) daily = 0.025;
    else if (lower.includes("withdraw")) daily = 0.04;
    const totalFeed = birds * daily * days;
    const bags50kg = Math.ceil(totalFeed / 50);
    const costPerKg = 15; // Approximate ZMW per kg
    const totalCost = totalFeed * costPerKg;

    setResult({
      birds,
      days,
      feedType,
      dailyFeedPerBird: daily,
      totalFeedKg: totalFeed.toFixed(1),
      bags50kg,
      totalCostZmw: totalCost.toFixed(2),
      costPerBird: (totalCost / birds).toFixed(2),
    });
  }

  function openAddPurchase(stage?: FeedProjectionResult["stages"][number]) {
    setEditingPurchase(null);
    if (stage) {
      setPurchaseForm({
        feedStageId: stage.feedStageId,
        stageName: stage.stageName,
        bagSizeKg: String(stage.bagSizeKg),
        bagsPurchased: "",
        unitPriceZmw: String(stage.unitPriceZmw),
        purchaseDate: new Date().toISOString().split("T")[0],
        notes: "",
      });
    } else {
      setPurchaseForm({
        feedStageId: "",
        stageName: "",
        bagSizeKg: "",
        bagsPurchased: "",
        unitPriceZmw: "",
        purchaseDate: new Date().toISOString().split("T")[0],
        notes: "",
      });
    }
    setPurchaseOpen(true);
  }

  function openEditPurchase(p: FeedPurchase) {
    setEditingPurchase(p);
    setPurchaseForm({
      feedStageId: p.feedStageId || "",
      stageName: p.stageName,
      bagSizeKg: String(p.bagSizeKg),
      bagsPurchased: String(p.bagsPurchased),
      unitPriceZmw: String(p.unitPriceZmw),
      purchaseDate: new Date(p.purchaseDate).toISOString().split("T")[0],
      notes: p.notes || "",
    });
    setPurchaseOpen(true);
  }

  async function handleSavePurchase() {
    setSavingPurchase(true);
    try {
      const body = {
        flockId,
        feedStageId: purchaseForm.feedStageId || undefined,
        stageName: purchaseForm.stageName,
        bagSizeKg: Number(purchaseForm.bagSizeKg),
        bagsPurchased: Number(purchaseForm.bagsPurchased),
        unitPriceZmw: Number(purchaseForm.unitPriceZmw),
        purchaseDate: purchaseForm.purchaseDate,
        notes: purchaseForm.notes || undefined,
      };
      if (editingPurchase) {
        await apiFetch(`/api/v1/feed-purchases/${editingPurchase.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/api/v1/feed-purchases", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      setPurchaseOpen(false);
      loadProjection();
      loadPurchases();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingPurchase(false);
    }
  }

  async function handleDeletePurchase(id: string) {
    if (!confirm("Delete this feed purchase? This will reverse the linked journal entry.")) return;
    try {
      await apiFetch(`/api/v1/feed-purchases/${id}`, { method: "DELETE" });
      loadProjection();
      loadPurchases();
    } catch (e: any) {
      alert(e.message);
    }
  }

  function statusBadge(status: string) {
    if (status === "complete") return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Complete</Badge>;
    if (status === "partial") return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Partial</Badge>;
    return <Badge variant="outline">Not started</Badge>;
  }

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={() => router.push(`/broiler-flocks/${flockId}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-3xl font-bold">Feed</h1>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {/* Feed Projection & Procurement */}
      {projection && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Feed Projection & Procurement
            </CardTitle>
            <CardDescription>
              Bags required per stage (based on {projection.initialCount} initial birds, adjusted for mortality) vs purchased
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projection.stages.length === 0 ? (
              <p className="text-muted-foreground">
                No feed stages configured for this flock&rsquo;s supplier{projection.supplierName ? ` (${projection.supplierName})` : ""}.
                Assign a supplier with feed stages to see projections.
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stage</TableHead>
                      <TableHead>Day Range</TableHead>
                      <TableHead>Bag Size</TableHead>
                      <TableHead className="text-right">Required</TableHead>
                      <TableHead className="text-right">Purchased</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                      <TableHead className="text-right">Proj. Cost</TableHead>
                      <TableHead>Status</TableHead>
                      {canEdit && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projection.stages.map((s) => (
                      <TableRow key={s.feedStageId}>
                        <TableCell className="font-medium">{s.stageName}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {s.dayRangeStart != null ? `Day ${s.dayRangeStart}${s.dayRangeEnd != null ? `-${s.dayRangeEnd}` : "+"}` : "-"}
                        </TableCell>
                        <TableCell>{s.bagSizeKg}kg</TableCell>
                        <TableCell className="text-right font-medium">{s.bagsRequired}</TableCell>
                        <TableCell className="text-right">{s.bagsPurchased}</TableCell>
                        <TableCell className={`text-right font-medium ${s.bagsRemaining > 0 ? "text-amber-600" : "text-green-600"}`}>
                          {s.bagsRemaining}
                        </TableCell>
                        <TableCell className="text-right">ZMW {s.projectedCostZmw.toLocaleString()}</TableCell>
                        <TableCell>{statusBadge(s.status)}</TableCell>
                        {canEdit && (
                          <TableCell>
                            <Button variant="outline" size="sm" onClick={() => openAddPurchase(s)}>
                              <Plus className="h-3 w-3 mr-1" /> Purchase
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell>Total</TableCell>
                      <TableCell colSpan={2} />
                      <TableCell className="text-right">{projection.totals.bagsRequired}</TableCell>
                      <TableCell className="text-right">{projection.totals.bagsPurchased}</TableCell>
                      <TableCell className={`text-right ${projection.totals.bagsRemaining > 0 ? "text-amber-600" : "text-green-600"}`}>
                        {projection.totals.bagsRemaining}
                      </TableCell>
                      <TableCell className="text-right">ZMW {projection.totals.projectedCostZmw.toLocaleString()}</TableCell>
                      <TableCell colSpan={canEdit ? 2 : 1} />
                    </TableRow>
                  </TableBody>
                </Table>

                {/* Existing purchases */}
                {purchases.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-semibold mb-2">Purchase History ({purchases.length})</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Stage</TableHead>
                          <TableHead>Bag Size</TableHead>
                          <TableHead className="text-right">Bags</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Total Cost</TableHead>
                          <TableHead>Supplier</TableHead>
                          {canEdit && <TableHead>Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchases.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>{new Date(p.purchaseDate).toLocaleDateString()}</TableCell>
                            <TableCell className="font-medium">{p.stageName}</TableCell>
                            <TableCell>{p.bagSizeKg}kg</TableCell>
                            <TableCell className="text-right">{p.bagsPurchased}</TableCell>
                            <TableCell className="text-right">ZMW {Number(p.unitPriceZmw).toFixed(2)}</TableCell>
                            <TableCell className="text-right font-medium">ZMW {Number(p.totalCostZmw).toFixed(2)}</TableCell>
                            <TableCell className="text-muted-foreground">{p.supplier?.name || "-"}</TableCell>
                            {canEdit && (
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => openEditPurchase(p)}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  {user?.role === "owner" && (
                                    <Button variant="ghost" size="sm" onClick={() => handleDeletePurchase(p.id)}>
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" />Ross 308 Feed Calculator</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Number of Birds</label>
              <input type="number" className="w-full border rounded-md p-2 mt-1 bg-background text-foreground" value={calc.birds} onChange={(e) => setCalc({ ...calc, birds: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-sm font-medium">Age Range (days)</label>
              <input type="number" className="w-full border rounded-md p-2 mt-1 bg-background text-foreground" value={calc.days} onChange={(e) => setCalc({ ...calc, days: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-sm font-medium">Feed Type</label>
              <select className="w-full border rounded-md p-2 mt-1 bg-background text-foreground" value={calc.feedType} onChange={(e) => setCalc({ ...calc, feedType: e.target.value })}>
                <option value="">{feedStages.length > 0 ? "Select feed type..." : "Loading..."}</option>
                {feedStages.map((s: any) => (
                  <option key={s.id} value={s.stageName}>{s.stageName}</option>
                ))}
              </select>
            </div>
            <Button onClick={runCalculator} className="w-full">Calculate</Button>
            {result && (
              <div className="mt-4 p-4 bg-muted rounded-lg space-y-2 text-sm">
                <div className="flex justify-between"><span>Total Feed</span><span className="font-medium">{result.totalFeedKg} kg</span></div>
                <div className="flex justify-between"><span>50kg Bags Needed</span><span className="font-medium">{result.bags50kg} bags</span></div>
                <div className="flex justify-between"><span>Total Cost</span><span className="font-medium">ZMW {result.totalCostZmw}</span></div>
                <div className="flex justify-between"><span>Cost per Bird</span><span className="font-medium">ZMW {result.costPerBird}</span></div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Actual Feed Summary</CardTitle></CardHeader>
          <CardContent>
            {summary ? (
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-muted-foreground">Total Feed</span><span className="font-medium">{Number(summary.totalFeedKg).toFixed(1)} kg</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total Cost</span><span className="font-medium">ZMW {Number(summary.totalCostZmw).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Cost per Bird</span><span className="font-medium">ZMW {Number(summary.costPerBird).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Current Birds</span><span className="font-medium">{summary.currentCount}</span></div>
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium mb-2">By Feed Type</p>
                  {summary.summary?.map((s: any) => (
                    <div key={s.feedType} className="flex justify-between text-sm py-1 capitalize">
                      <span>{s.feedType}</span>
                      <span>{Number(s._sum.quantityKg).toFixed(1)} kg | ZMW {Number(s._sum.costZmw || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No feed records yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Purchase Dialog */}
      <Dialog open={purchaseOpen} onOpenChange={setPurchaseOpen}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>{editingPurchase ? "Edit Purchase" : "Record Feed Purchase"}</DialogTitle>
            <DialogDescription>
              {editingPurchase ? "Update purchase details" : "Record bags of feed purchased for this flock"}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-4 space-y-4">
            <div>
              <Label>Feed Stage</Label>
              <select
                className="w-full border rounded-md p-2 bg-background text-foreground"
                value={purchaseForm.feedStageId}
                onChange={(e) => {
                  const stage = projection?.stages.find((s) => s.feedStageId === e.target.value);
                  setPurchaseForm({
                    ...purchaseForm,
                    feedStageId: e.target.value,
                    stageName: stage?.stageName || purchaseForm.stageName,
                    bagSizeKg: stage ? String(stage.bagSizeKg) : purchaseForm.bagSizeKg,
                    unitPriceZmw: stage ? String(stage.unitPriceZmw) : purchaseForm.unitPriceZmw,
                  });
                }}
                disabled={!!editingPurchase}
              >
                <option value="">Select stage...</option>
                {projection?.stages.map((s) => (
                  <option key={s.feedStageId} value={s.feedStageId}>{s.stageName} ({s.bagSizeKg}kg)</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Stage Name</Label>
              <Input value={purchaseForm.stageName} onChange={(e) => setPurchaseForm({ ...purchaseForm, stageName: e.target.value })} disabled={!!purchaseForm.feedStageId} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Bag Size (kg)</Label>
                <Input type="number" step="0.001" value={purchaseForm.bagSizeKg} onChange={(e) => setPurchaseForm({ ...purchaseForm, bagSizeKg: e.target.value })} />
              </div>
              <div>
                <Label>Bags Purchased</Label>
                <Input type="number" value={purchaseForm.bagsPurchased} onChange={(e) => setPurchaseForm({ ...purchaseForm, bagsPurchased: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Unit Price (ZMW)</Label>
                <Input type="number" step="0.01" value={purchaseForm.unitPriceZmw} onChange={(e) => setPurchaseForm({ ...purchaseForm, unitPriceZmw: e.target.value })} />
              </div>
              <div>
                <Label>Purchase Date</Label>
                <Input type="date" value={purchaseForm.purchaseDate} onChange={(e) => setPurchaseForm({ ...purchaseForm, purchaseDate: e.target.value })} />
              </div>
            </div>
            {purchaseForm.bagsPurchased && purchaseForm.unitPriceZmw && (
              <p className="text-xs text-muted-foreground">
                Total cost: ZMW {(Number(purchaseForm.bagsPurchased) * Number(purchaseForm.unitPriceZmw)).toFixed(2)}
              </p>
            )}
            <div>
              <Label>Notes</Label>
              <Input value={purchaseForm.notes} onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter className="p-6 pt-0">
            <Button variant="outline" onClick={() => setPurchaseOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSavePurchase}
              disabled={savingPurchase || !purchaseForm.stageName || !purchaseForm.bagsPurchased || !purchaseForm.unitPriceZmw || !purchaseForm.bagSizeKg}
            >
              {savingPurchase ? "Saving..." : editingPurchase ? "Save Changes" : "Record Purchase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
