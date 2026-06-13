"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { Supplier } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function SuppliersPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      apiFetch<Supplier[]>("/api/v1/suppliers")
        .then(setSuppliers)
        .catch((err) => setError(err.message));
    }
  }, [user, isLoading, router]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-2">Suppliers</h1>
      <p className="text-muted-foreground mb-6">Feed suppliers and their pricing</p>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-6">
        {suppliers.map((supplier) => (
          <Card key={supplier.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{supplier.name}</CardTitle>
                <div className="flex gap-2">
                  {supplier.isDefault && (
                    <Badge variant="default">Default</Badge>
                  )}
                  {supplier.chickenType && (
                    <Badge variant="secondary">{supplier.chickenType}</Badge>
                  )}
                </div>
              </div>
              {supplier.description && (
                <p className="text-sm text-muted-foreground">{supplier.description}</p>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stage</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Unit Size</TableHead>
                    <TableHead>Unit Price (ZMW)</TableHead>
                    <TableHead>Intake/Bird (kg)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.feedStages.map((stage) => (
                    <TableRow key={stage.id}>
                      <TableCell className="font-medium">{stage.stageName}</TableCell>
                      <TableCell>
                        <Badge variant={stage.stageType === "chick" ? "secondary" : "outline"}>
                          {stage.stageType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {stage.dayRangeStart != null && stage.dayRangeEnd != null
                          ? `${stage.dayRangeStart}-${stage.dayRangeEnd}`
                          : "-"}
                      </TableCell>
                      <TableCell>{stage.unitSizeKg} kg</TableCell>
                      <TableCell>{stage.unitPriceZmw.toLocaleString()}</TableCell>
                      <TableCell>{stage.intakePerBirdKg}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

