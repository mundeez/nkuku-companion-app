"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { ProductionCycle } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingUp } from "lucide-react";

export default function ExpansionPlanPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [cycles, setCycles] = useState<ProductionCycle[]>([]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      apiFetch<ProductionCycle[]>("/api/v1/expansion-plan")
        .then(setCycles)
        .catch(() => {});
    }
  }, [user, isLoading, router]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-2">Expansion Plan</h1>
      <p className="text-muted-foreground mb-6">
        Staggered production cycles and growth trajectory
      </p>

      <div className="space-y-6">
        {cycles.map((cycle) => (
          <Card key={cycle.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{cycle.label || `Cycle ${cycle.cycleNumber}`}</CardTitle>
                <Badge variant={cycle.status === "active" ? "default" : "outline"}>
                  {cycle.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {cycle.batches.map((batch) => (
                  <div
                    key={batch.id}
                    className="rounded-lg border p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">{batch.shootLabel}</Badge>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Exec: {new Date(batch.targetExecutionDt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Sale: {new Date(batch.salesDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-3.5 w-3.5 text-primary" />
                        <span className="font-medium">{batch.totalQtyAtHand.toLocaleString()} birds</span>
                      </div>
                      {batch.revenueTargetZmw && (
                        <div className="text-xs text-muted-foreground">
                          Target: ZMW {Number(batch.revenueTargetZmw).toLocaleString()}
                        </div>
                      )}
                      {batch.growthQtyAdded > 0 && (
                        <div className="text-xs text-emerald-600">
                          +{batch.growthQtyAdded} new birds
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
