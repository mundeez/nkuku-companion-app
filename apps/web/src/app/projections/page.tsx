"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { Supplier, ProjectionResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type ChartView = "25kg" | "50kg" | "comparison";

export default function ProjectionsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [birdCount, setBirdCount] = useState("1000");
  const [salePrice, setSalePrice] = useState("140");
  const [projection25, setProjection25] = useState<ProjectionResult | null>(null);
  const [projection50, setProjection50] = useState<ProjectionResult | null>(null);
  const [chartView, setChartView] = useState<ChartView>("comparison");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      apiFetch<Supplier[]>("/api/v1/suppliers")
        .then(setSuppliers)
        .catch(() => {});
    }
  }, [user, isLoading, router]);

  // Check which bag sizes are available for the selected supplier
  const selectedSupplierData = suppliers.find((s) => s.id === selectedSupplier);
  const has25kg = selectedSupplierData?.feedStages.some(
    (fs) => fs.stageType === "feed" && fs.unitSizeKg === 25
  );
  const has50kg = selectedSupplierData?.feedStages.some(
    (fs) => fs.stageType === "feed" && fs.unitSizeKg === 50
  );

  async function calculate() {
    if (!selectedSupplier) return;
    setLoading(true);
    setError("");
    setProjection25(null);
    setProjection50(null);
    try {
      const baseBody = {
        birdCount: Number(birdCount),
        supplierId: selectedSupplier,
        salesPricePerBird: Number(salePrice),
      };

      const requests: Promise<ProjectionResult>[] = [];
      const requestLabels: string[] = [];

      if (has25kg) {
        requests.push(
          apiFetch<ProjectionResult>("/api/v1/projections/calculate", {
            method: "POST",
            body: JSON.stringify({ ...baseBody, bagSize: 25 }),
          })
        );
        requestLabels.push("25kg");
      }
      if (has50kg) {
        requests.push(
          apiFetch<ProjectionResult>("/api/v1/projections/calculate", {
            method: "POST",
            body: JSON.stringify({ ...baseBody, bagSize: 50 }),
          })
        );
        requestLabels.push("50kg");
      }

      // If supplier has no explicit 25/50 split, just calculate with all stages
      if (requests.length === 0) {
        requests.push(
          apiFetch<ProjectionResult>("/api/v1/projections/calculate", {
            method: "POST",
            body: JSON.stringify(baseBody),
          })
        );
        requestLabels.push("default");
      }

      const results = await Promise.all(requests);
      for (let i = 0; i < results.length; i++) {
        if (requestLabels[i] === "25kg") setProjection25(results[i]);
        else if (requestLabels[i] === "50kg") setProjection50(results[i]);
        else {
          // Default — assign to whichever is null
          if (!projection25) setProjection25(results[i]);
          else setProjection50(results[i]);
        }
      }

      // Set default chart view
      if (has25kg && has50kg) setChartView("comparison");
      else if (has25kg) setChartView("25kg");
      else if (has50kg) setChartView("50kg");
    } catch (err: any) {
      setError(err.message || "Calculation failed");
    } finally {
      setLoading(false);
    }
  }

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  // Build chart data based on selected view
  const buildChartData = () => {
    if (chartView === "comparison" && projection25 && projection50) {
      // Compare 25kg vs 50kg side by side for each stage
      const stages25 = projection25.breakdown.filter((b) => b.stageType === "feed");
      const stages50 = projection50.breakdown.filter((b) => b.stageType === "feed");
      const stageNames = stages25.map((b) => b.stageName);
      return stageNames.map((name, i) => ({
        name,
        "25kg": Number(stages25[i]?.subtotalZmw ?? 0),
        "50kg": Number(stages50[i]?.subtotalZmw ?? 0),
      }));
    }
    const proj = chartView === "25kg" ? projection25 : projection50;
    if (!proj) return [];
    return proj.breakdown.map((b) => ({
      name: b.stageName,
      cost: Number(b.subtotalZmw),
    }));
  };

  const chartData = buildChartData();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-2">Projection Calculator</h1>
      <p className="text-muted-foreground mb-6">
        Calculate feed costs, revenue, and profit for a given batch — compare 25kg vs 50kg bag sizes
      </p>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Batch Parameters</CardTitle>
          <CardDescription>Enter your production numbers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSupplierData && (
                <p className="text-xs text-muted-foreground">
                  Available bag sizes:{" "}
                  {[
                    ...(has25kg ? ["25kg"] : []),
                    ...(has50kg ? ["50kg"] : []),
                    ...(!has25kg && !has50kg ? ["default (all stages)"] : []),
                  ].join(", ")}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Bird Count</Label>
              <Input
                type="number"
                value={birdCount}
                onChange={(e) => setBirdCount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Sale Price per Bird (ZMW)</Label>
              <Input
                type="number"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive mt-4">{error}</p>}
          <Button className="mt-4" onClick={calculate} disabled={loading || !selectedSupplier}>
            {loading ? "Calculating..." : "Calculate Projection"}
          </Button>
        </CardContent>
      </Card>

      {(projection25 || projection50) && (
        <>
          {/* Summary cards — side by side */}
          <div className="grid gap-4 md:grid-cols-2 mb-8">
            {projection25 && (
              <Card className={chartView === "25kg" ? "ring-2 ring-primary" : ""}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    25kg Bag Projection
                    <span className="text-sm font-normal text-muted-foreground">
                      {projection25.supplierName}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <SummaryCard label="Total Expenses" value={projection25.totalExpenses} />
                    <SummaryCard label="Feed Cost" value={projection25.totalFeedCost} />
                    <SummaryCard label="Revenue" value={projection25.projectedRevenue} positive />
                    <SummaryCard label="Gross Profit" value={projection25.grossProfit} profit />
                    <SummaryCard label="Chick Cost" value={projection25.totalChickCost} />
                    <SummaryCard label="Net Profit" value={projection25.netProfit} profit />
                  </div>
                </CardContent>
              </Card>
            )}
            {projection50 && (
              <Card className={chartView === "50kg" ? "ring-2 ring-primary" : ""}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    50kg Bag Projection
                    <span className="text-sm font-normal text-muted-foreground">
                      {projection50.supplierName}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <SummaryCard label="Total Expenses" value={projection50.totalExpenses} />
                    <SummaryCard label="Feed Cost" value={projection50.totalFeedCost} />
                    <SummaryCard label="Revenue" value={projection50.projectedRevenue} positive />
                    <SummaryCard label="Gross Profit" value={projection50.grossProfit} profit />
                    <SummaryCard label="Chick Cost" value={projection50.totalChickCost} />
                    <SummaryCard label="Net Profit" value={projection50.netProfit} profit />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Profit comparison summary */}
          {projection25 && projection50 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>25kg vs 50kg Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Cost Difference (50kg - 25kg):</span>
                    <div className={`text-lg font-bold ${Number(projection50.totalExpenses) - Number(projection25.totalExpenses) >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                      ZMW {(Number(projection50.totalExpenses) - Number(projection25.totalExpenses)).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Profit Difference (25kg - 50kg):</span>
                    <div className={`text-lg font-bold ${Number(projection25.netProfit) - Number(projection50.netProfit) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      ZMW {(Number(projection25.netProfit) - Number(projection50.netProfit)).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Better Option:</span>
                    <div className="text-lg font-bold text-emerald-600">
                      {Number(projection25.netProfit) > Number(projection50.netProfit) ? "25kg bags" : "50kg bags"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Chart with dropdown */}
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Cost Chart</CardTitle>
                {projection25 && projection50 && (
                  <Select value={chartView} onValueChange={(v) => setChartView(v as ChartView)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comparison">Comparison (25kg vs 50kg)</SelectItem>
                      <SelectItem value="25kg">25kg Bags Only</SelectItem>
                      <SelectItem value="50kg">50kg Bags Only</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => `ZMW ${Number(value).toLocaleString()}`} />
                  <Legend />
                  {chartView === "comparison" ? (
                    <>
                      <Bar dataKey="25kg" fill="#2563eb" name="25kg Bags (ZMW)" />
                      <Bar dataKey="50kg" fill="#f59e0b" name="50kg Bags (ZMW)" />
                    </>
                  ) : (
                    <Bar dataKey="cost" fill={chartView === "25kg" ? "#2563eb" : "#f59e0b"} name="Cost (ZMW)" />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Breakdown tables */}
          <div className="grid gap-6 lg:grid-cols-2 mb-8">
            {projection25 && (
              <Card>
                <CardHeader>
                  <CardTitle>25kg Bag Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Stage</TableHead>
                        <TableHead>Bag Size</TableHead>
                        <TableHead>Bags</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projection25.breakdown.map((b, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{b.stageName}</TableCell>
                          <TableCell>{b.stageType === "feed" ? `${b.unitSizeKg}kg` : "-"}</TableCell>
                          <TableCell>{b.itemsRoundedUp ?? "-"}</TableCell>
                          <TableCell>ZMW {Number(b.unitPriceZmw).toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            ZMW {Number(b.subtotalZmw).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
            {projection50 && (
              <Card>
                <CardHeader>
                  <CardTitle>50kg Bag Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Stage</TableHead>
                        <TableHead>Bag Size</TableHead>
                        <TableHead>Bags</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projection50.breakdown.map((b, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{b.stageName}</TableCell>
                          <TableCell>{b.stageType === "feed" ? `${b.unitSizeKg}kg` : "-"}</TableCell>
                          <TableCell>{b.itemsRoundedUp ?? "-"}</TableCell>
                          <TableCell>ZMW {Number(b.unitPriceZmw).toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            ZMW {Number(b.subtotalZmw).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, positive, profit }: { label: string; value: string; positive?: boolean; profit?: boolean }) {
  const num = Number(value);
  const color = profit ? (num >= 0 ? "text-emerald-600" : "text-red-600") : positive ? "text-emerald-600" : "";
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${color}`}>
        ZMW {num.toLocaleString()}
      </div>
    </div>
  );
}
