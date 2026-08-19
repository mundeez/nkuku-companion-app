"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface OrgDetail {
  id: string;
  name: string;
  planCode: string;
  country: string;
  currency: string;
  createdAt: string;
  _count: { users: number; broilerFlocks: number; subscriptions: number; invoices: number };
  subscriptions: {
    id: string;
    planCode: string;
    status: string;
    billingCycle: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  }[];
  invoices: {
    id: string;
    status: string;
    amountDue: number;
    amountPaid: number;
    currency: string;
    createdAt: string;
    paidAt: string | null;
  }[];
  users: {
    id: string;
    email: string;
    role: string;
    isPlatformAdmin: boolean;
    createdAt: string;
  }[];
}

export default function AdminOrgDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && (!user || !user.isPlatformAdmin)) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.isPlatformAdmin && params?.id) {
      apiFetch<OrgDetail>(`/api/v1/admin/organizations/${params.id}`)
        .then(setOrg)
        .catch((e) => setError(e.message));
    }
  }, [user, params]);

  if (isLoading || !user || !user.isPlatformAdmin) {
    return <div className="max-w-5xl mx-auto px-4 py-8"><Skeleton className="h-8 w-64 mb-4" /></div>;
  }

  if (error) return <div className="p-8 text-destructive">{error}</div>;
  if (!org) return <div className="max-w-5xl mx-auto px-4 py-8"><Skeleton className="h-8 w-64 mb-4" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">{org.name}</h1>
        <div className="flex items-center gap-3 text-muted-foreground text-sm">
          <Badge>{org.planCode}</Badge>
          <span>{org.country || "—"}</span>
          <span>{org.currency}</span>
          <span>Created {new Date(org.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* ── Stats ─────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Users</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{org._count.users}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Flocks</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{org._count.broilerFlocks}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Subscriptions</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{org._count.subscriptions}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Invoices</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{org._count.invoices}</div></CardContent>
        </Card>
      </div>

      {/* ── Subscriptions ─────────────────────── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Subscriptions</CardTitle>
          <CardDescription>Recent subscription history</CardDescription>
        </CardHeader>
        <CardContent>
          {org.subscriptions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Plan</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Status</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Cycle</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Period Start</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Period End</th>
                  </tr>
                </thead>
                <tbody>
                  {org.subscriptions.map((s) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{s.planCode}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={s.status === "active" ? "default" : s.status === "past_due" ? "secondary" : "destructive"}>
                          {s.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">{s.billingCycle}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{new Date(s.currentPeriodStart).toLocaleDateString()}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{new Date(s.currentPeriodEnd).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No subscriptions.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Invoices ──────────────────────────── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Recent Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {org.invoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Status</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Amount Due</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Amount Paid</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Created</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {org.invoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        <Badge variant={inv.status === "paid" ? "default" : inv.status === "open" ? "secondary" : "destructive"}>
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">{inv.amountDue} {inv.currency}</td>
                      <td className="py-2 pr-4">{inv.amountPaid} {inv.currency}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString()}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No invoices.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Users ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users ({org.users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Email</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Role</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Platform Admin</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Joined</th>
                </tr>
              </thead>
              <tbody>
                {org.users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{u.email}</td>
                    <td className="py-2 pr-4">{u.role}</td>
                    <td className="py-2 pr-4">{u.isPlatformAdmin ? "Yes" : "No"}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
