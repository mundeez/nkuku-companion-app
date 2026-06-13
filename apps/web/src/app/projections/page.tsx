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

export default function ProjectionsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [birdCount, setBirdCount] = useState("1000");
  const [salePrice, setSalePrice] = useState("140");
  const [projection, setProjection] = useState<ProjectionResult | null>(null);
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

  async function calculate() {
    if (!selectedSupplier) return;
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<ProjectionResult>("/api/v1/projections/calculate", {
        method: "POST",
        body: JSON.stringify({
          birdCount: Number(birdCount),
          supplierId: selectedSupplier,
          salesPricePerBird: Number(salePrice),
        }),
      });
      setProjection(result);
    } catch (err: any) {
      setError(err.message || "Calculation failed");
    } finally {
      setLoading(false);
    }
  }

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  const chartData = projection
    ? projection.breakdown.map((b) => ({
        name: b.stageName,
        cost: Number(b.subtotalZmw),
      }))
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-2">Projection Calculator</h1>
      <p className="text-muted-foreground mb-6">
        Calculate feed costs, revenue, and profit for a given batch
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
          <Button className="mt-4" onClick={calculate} disabled={loading}>
            {loading ? "Calculating..." : "Calculate Projection"}
          </Button>
        </CardContent>
      </Card>

      {projection && (
        <>
          <div className="grid gap-4 md:grid-cols-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ZMW {Number(projection.totalExpenses).toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Projected Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  ZMW {Number(projection.projectedRevenue).toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${Number(projection.grossProfit) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  ZMW {Number(projection.grossProfit).toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${Number(projection.netProfit) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  ZMW {Number(projection.netProfit).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Cost Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stage</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projection.breakdown.map((b) => (
                      <TableRow key={b.stageName}>
                        <TableCell className="font-medium">{b.stageName}</TableCell>
                        <TableCell>{b.itemsRoundedUp}</TableCell>
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

            <Card>
              <CardHeader>
                <CardTitle>Cost Chart</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="cost" fill="#2563eb" name="Cost (ZMW)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

