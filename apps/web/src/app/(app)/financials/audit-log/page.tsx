"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AuditLogPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>({ items: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } });
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (user && user.role === "viewer") { router.push("/financials"); return; }
    if (user) {
      apiFetch(`/api/v1/financial-engine/audit-log?page=${page}&limit=20`)
        .then(setData)
        .catch((err) => setError(err.message));
    }
  }, [user, isLoading, router, page]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/financials"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
        <h1 className="text-3xl font-bold">Audit Log</h1>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <Card>
        <CardHeader><CardTitle>Financial Record Changes</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Time</th>
                  <th className="text-left py-2">Action</th>
                  <th className="text-left py-2">Entity</th>
                  <th className="text-left py-2">Entity ID</th>
                  <th className="text-left py-2">User</th>
                  <th className="text-left py-2">Period</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((log: any) => (
                  <tr key={log.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 whitespace-nowrap">{new Date(log.occurredAt).toLocaleString()}</td>
                    <td className="py-2"><span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">{log.action}</span></td>
                    <td className="py-2">{log.entityType}</td>
                    <td className="py-2 font-mono text-xs">{log.entityId.slice(0, 8)}...</td>
                    <td className="py-2">{log.userId ? log.userId.slice(0, 8) + "..." : "System"}</td>
                    <td className="py-2">{log.periodId ? log.periodId.slice(0, 8) + "..." : "—"}</td>
                  </tr>
                ))}
                {data.items.length === 0 && <tr><td colSpan={6} className="py-4 text-muted-foreground text-center">No audit entries yet.</td></tr>}
              </tbody>
            </table>
          </div>

          {data.pagination.pages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Button>
              <span className="text-sm py-1">Page {page} of {data.pagination.pages}</span>
              <Button variant="outline" size="sm" disabled={page >= data.pagination.pages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
