"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ImpersonationSession, TenantDetail } from "@/lib/types";
import { listImpersonations } from "@/lib/api/platform";
import { formatDateTime, timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function TenantAuditTab({ tenant }: { tenant: TenantDetail }) {
  const [sessions, setSessions] = useState<ImpersonationSession[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    listImpersonations({ orgId: tenant.id })
      .then((r) => setSessions(r.items))
      .catch((e) => setErr(e.message));
  }, [tenant.id]);

  const audit = tenant.recentAudit ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Impersonation Sessions</CardTitle>
          <CardDescription>Staff act-as sessions for this organization</CardDescription>
        </CardHeader>
        <CardContent>
          {err ? (
            <p className="text-sm text-destructive">{err}</p>
          ) : sessions === null ? (
            <Skeleton className="h-20 w-full" />
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No impersonation sessions.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Target user</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Reason</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Started</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => {
                    const active = !s.endedAt && (!s.expiresAt || new Date(s.expiresAt).getTime() > Date.now());
                    return (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{s.targetEmail ?? s.targetUserId}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{s.reason ?? "—"}</td>
                        <td className="py-2 pr-4 text-muted-foreground" title={formatDateTime(s.startedAt)}>
                          {timeAgo(s.startedAt)}
                        </td>
                        <td className="py-2 pr-4">
                          {s.endedAt ? (
                            <Badge variant="secondary">ended</Badge>
                          ) : active ? (
                            <Badge variant="default">active</Badge>
                          ) : (
                            <Badge variant="outline">expired</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform Audit Events</CardTitle>
          <CardDescription>
            Recent platform-level events for this organization.{" "}
            <Link href={`/audit?orgId=${tenant.id}`} className="text-primary hover:underline">
              Full audit log →
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent platform events.</p>
          ) : (
            <div className="space-y-2">
              {audit.map((e, i) => (
                <div key={e.id ?? i} className="flex items-baseline justify-between gap-4 border-b pb-2 text-sm last:border-0">
                  <div>
                    <span className="font-medium">{e.action}</span>
                    {e.reason && <span className="ml-2 text-muted-foreground">— {e.reason}</span>}
                    <div className="text-xs text-muted-foreground">
                      {e.actorEmail ?? e.actor ?? e.actorStaffId ?? "system"}
                      {e.actorRole ? ` (${e.actorRole})` : ""}
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted-foreground" title={formatDateTime(e.occurredAt)}>
                    {timeAgo(e.occurredAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
