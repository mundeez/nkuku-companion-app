"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";
import { Supplier, ProductionCycle } from "@/lib/types";
import { TrendingUp, Users, Calendar, DollarSign } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [stats, setStats] = useState({ suppliers: 0, batches: 0, cycles: 0 });

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      Promise.all([
        apiFetch<Supplier[]>("/api/v1/suppliers"),
        apiFetch<ProductionCycle[]>("/api/v1/expansion-plan"),
      ]).then(([suppliers, cycles]) => {
        const batchCount = cycles.reduce((sum, c) => sum + c.batches.length, 0);
        setStats({ suppliers: suppliers.length, batches: batchCount, cycles: cycles.length });
      }).catch(() => {});
    }
  }, [user, isLoading, router]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  const statCards = [
    { title: "Suppliers", value: stats.suppliers, icon: Users, desc: "Active feed suppliers" },
    { title: "Production Cycles", value: stats.cycles, icon: Calendar, desc: "Planned cycles" },
    { title: "Batches", value: stats.batches, icon: TrendingUp, desc: "Total shoots" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
      <p className="text-muted-foreground mb-8">Overview of your broiler production</p>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Frequently used tools</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <a href="/projections" className="block p-4 rounded-lg border hover:bg-accent transition-colors">
            <DollarSign className="h-5 w-5 mb-2 text-primary" />
            <div className="font-medium">Run Projection</div>
            <div className="text-sm text-muted-foreground">Calculate costs & profits</div>
          </a>
          <a href="/suppliers" className="block p-4 rounded-lg border hover:bg-accent transition-colors">
            <Users className="h-5 w-5 mb-2 text-primary" />
            <div className="font-medium">Manage Suppliers</div>
            <div className="text-sm text-muted-foreground">Update feed prices</div>
          </a>
          <a href="/expansion-plan" className="block p-4 rounded-lg border hover:bg-accent transition-colors">
            <Calendar className="h-5 w-5 mb-2 text-primary" />
            <div className="font-medium">Expansion Plan</div>
            <div className="text-sm text-muted-foreground">View staggered cycles</div>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}

