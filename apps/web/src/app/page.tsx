"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";
import { Supplier, ProductionCycle, BroilerFlock } from "@/lib/types";
import { TrendingUp, Users, Calendar, DollarSign, HeartPulse, Scale, AlertTriangle, Activity } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [stats, setStats] = useState({ suppliers: 0, batches: 0, cycles: 0, activeFlocks: 0, totalBirds: 0, mortalityRate: 0 });

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      Promise.all([
        apiFetch<Supplier[]>("/api/v1/suppliers"),
        apiFetch<ProductionCycle[]>("/api/v1/expansion-plan"),
        apiFetch<BroilerFlock[]>("/api/v1/broiler-flocks"),
      ]).then(([suppliers, cycles, flocks]) => {
        const batchCount = cycles.reduce((sum, c) => sum + c.batches.length, 0);
        const activeFlocks = flocks.filter((f) => f.status === "active");
        const totalBirds = activeFlocks.reduce((sum, f) => sum + f.currentCount, 0);
        const totalInitial = activeFlocks.reduce((sum, f) => sum + f.initialCount, 0);
        const mortalityRate = totalInitial > 0 ? ((totalInitial - totalBirds) / totalInitial * 100).toFixed(1) : "0";
        setStats({
          suppliers: suppliers.length,
          batches: batchCount,
          cycles: cycles.length,
          activeFlocks: activeFlocks.length,
          totalBirds,
          mortalityRate: Number(mortalityRate),
        });
      }).catch(() => {});
    }
  }, [user, isLoading, router]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
      <p className="text-muted-foreground mb-8">Overview of your broiler production</p>

      {/* Broiler Management Stats */}
      <h2 className="text-lg font-semibold mb-4">Broiler Management</h2>
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Flocks</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeFlocks}</div>
            <p className="text-xs text-muted-foreground">Currently raising</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Birds</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBirds}</div>
            <p className="text-xs text-muted-foreground">Across all active flocks</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mortality Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.mortalityRate > 10 ? "text-red-600" : ""}`}>{stats.mortalityRate}%</div>
            <p className="text-xs text-muted-foreground">Active flocks average</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Diseases</CardTitle>
            <HeartPulse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">10</div>
            <p className="text-xs text-muted-foreground">In database</p>
          </CardContent>
        </Card>
      </div>

      {/* Production Stats */}
      <h2 className="text-lg font-semibold mb-4">Production Planning</h2>
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suppliers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.suppliers}</div>
            <p className="text-xs text-muted-foreground">Active feed suppliers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Production Cycles</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cycles}</div>
            <p className="text-xs text-muted-foreground">Planned cycles</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Batches</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.batches}</div>
            <p className="text-xs text-muted-foreground">Total shoots</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Frequently used tools</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <a href="/broiler-flocks" className="block p-4 rounded-lg border hover:bg-accent transition-colors">
            <Scale className="h-5 w-5 mb-2 text-primary" />
            <div className="font-medium">Manage Flocks</div>
            <div className="text-sm text-muted-foreground">Track growth & health</div>
          </a>
          <a href="/diseases" className="block p-4 rounded-lg border hover:bg-accent transition-colors">
            <HeartPulse className="h-5 w-5 mb-2 text-primary" />
            <div className="font-medium">Disease Database</div>
            <div className="text-sm text-muted-foreground">Symptoms & treatments</div>
          </a>
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
        </CardContent>
      </Card>
    </div>
  );
}
