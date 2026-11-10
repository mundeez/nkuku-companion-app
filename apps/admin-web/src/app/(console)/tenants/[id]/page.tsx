"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { getTenant } from "@/lib/api/platform";
import type { TenantDetail } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { MembersTab } from "@/components/tenants/members-tab";
import { BillingTab } from "@/components/tenants/billing-tab";
import { SuspensionCard } from "@/components/tenants/suspension-card";
import { OverrideTab } from "@/components/tenants/override-tab";
import { DangerZone } from "@/components/tenants/danger-zone";
import { TenantAuditTab } from "@/components/tenants/audit-tab";

function UsageStat({
  label,
  used,
  limit,
}: {
  label: string;
  used: number | undefined;
  limit: number | undefined;
}) {
  const pct =
    used !== undefined && limit && limit > 0 ? Math.min(100, (used / limit) * 100) : null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {used ?? "—"}
          {limit !== undefined && limit !== null && (
            <span className="text-sm font-normal text-muted-foreground"> / {limit}</span>
          )}
        </div>
        {pct !== null && (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-green-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading, hasPermission } = useAuth();
  const id = String(params?.id ?? "");

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!id) return;
    getTenant(id)
      .then(setTenant)
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (!hasPermission("tenants.read")) {
      router.replace("/");
      return;
    }
    load();
  }, [user, isLoading, id, hasPermission, load, router]);

  if (isLoading || !user || (!tenant && !error)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="space-y-4">
        <Link href="/tenants">
          <Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /> Back to tenants</Button>
        </Link>
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">{error || "Tenant not found"}</div>
      </div>
    );
  }

  const limits = tenant.limits ?? {};
  const flocksLimit = limits.maxActiveFlocks ?? limits.flocks;
  const usersLimit = limits.maxUsers ?? limits.users;
  const currentSub = tenant.subscriptions?.[0] ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/tenants">
            <Button variant="ghost" size="sm" className="mb-2 -ml-2">
              <ArrowLeft className="mr-1 h-4 w-4" /> Tenants
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{tenant.name}</h1>
            <Badge>{tenant.planCode}</Badge>
            {currentSub && (
              <Badge variant={currentSub.status === "active" ? "default" : currentSub.status === "past_due" ? "secondary" : "destructive"}>
                {currentSub.status}
              </Badge>
            )}
            {tenant.suspendedAt && <Badge variant="destructive">SUSPENDED</Badge>}
            {tenant.override && <Badge variant="outline" className="border-amber-500/50 text-amber-400">OVERRIDE</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {tenant.country || "—"} · {tenant.currency} · created {formatDate(tenant.createdAt)} · id {tenant.id}
          </p>
        </div>
      </div>

      {/* Usage stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <UsageStat label="Users" used={tenant.usage?.users ?? tenant.userCount} limit={usersLimit} />
        <UsageStat label="Active flocks" used={tenant.usage?.flocks ?? tenant.flockCount} limit={flocksLimit} />
        <UsageStat label="Subscriptions" used={tenant.subscriptions.length} limit={undefined} />
        <UsageStat label="Invoices" used={tenant.invoices.length} limit={undefined} />
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="plan">Plan & Override</TabsTrigger>
          <TabsTrigger value="suspension">Suspension</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <MembersTab tenant={tenant} onChanged={load} />
        </TabsContent>
        <TabsContent value="billing" className="mt-4">
          <BillingTab tenant={tenant} />
        </TabsContent>
        <TabsContent value="plan" className="mt-4">
          <OverrideTab tenant={tenant} onChanged={load} />
        </TabsContent>
        <TabsContent value="suspension" className="mt-4">
          <SuspensionCard tenant={tenant} onChanged={load} />
        </TabsContent>
        <TabsContent value="danger" className="mt-4">
          <DangerZone tenant={tenant} onChanged={load} />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <TenantAuditTab tenant={tenant} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
