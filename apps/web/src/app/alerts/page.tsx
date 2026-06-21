"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { Alert } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCircle, Clock, AlertTriangle, Info, RefreshCw } from "lucide-react";

export default function AlertsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("open");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  function loadAlerts() {
    setLoading(true);
    const status = filter === "all" ? "" : `?status=${filter}`;
    apiFetch<Alert[]>(`/api/v1/alerts${status}`)
      .then(setAlerts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) loadAlerts();
  }, [user, isLoading, router, filter]);

  async function handleResolve(alertId: string) {
    try {
      await apiFetch(`/api/v1/alerts/${alertId}`, {
        method: "PATCH",
        body: JSON.stringify({ isResolved: true }),
      });
      loadAlerts();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleRead(alertId: string) {
    try {
      await apiFetch(`/api/v1/alerts/${alertId}`, {
        method: "PATCH",
        body: JSON.stringify({ isRead: true }),
      });
      loadAlerts();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      await apiFetch("/api/v1/alerts/generate", { method: "POST", body: JSON.stringify({}) });
      loadAlerts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  function getSeverityIcon(severity: string) {
    switch (severity) {
      case "critical": return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case "warning": return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      default: return <Info className="h-5 w-5 text-blue-600" />;
    }
  }

  function getSeverityBadge(severity: string) {
    switch (severity) {
      case "critical": return <Badge variant="destructive">Critical</Badge>;
      case "warning": return <Badge className="bg-amber-100 text-amber-800">Warning</Badge>;
      default: return <Badge variant="outline">Info</Badge>;
    }
  }

  function getAlertTypeLabel(type: string) {
    return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  const openCount = alerts.filter((a) => !a.isResolved).length;
  const resolvedCount = alerts.filter((a) => a.isResolved).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Alerts</h1>
          <p className="text-muted-foreground">
            {openCount} open, {resolvedCount} resolved
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadAlerts} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={handleGenerate} disabled={generating}>
            <Bell className="h-4 w-4 mr-1" />
            {generating ? "Generating..." : "Generate Alerts"}
          </Button>
        </div>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <div className="flex gap-2 mb-6">
        {(["open", "resolved", "all"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {alerts.length === 0 && (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No alerts found.</p>
            <p className="text-sm text-muted-foreground mt-1">Click "Generate Alerts" to scan your flocks for pending actions.</p>
          </div>
        )}
        {alerts.map((alert) => (
          <Card key={alert.id} className={alert.isResolved ? "opacity-60" : ""}>
            <CardContent className="py-4">
              <div className="flex items-start gap-4">
                <div className="mt-1">{getSeverityIcon(alert.severity)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`font-medium ${alert.isRead ? "" : "text-primary"}`}>{alert.title}</h3>
                    {getSeverityBadge(alert.severity)}
                    <Badge variant="outline">{getAlertTypeLabel(alert.alertType)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Due: {new Date(alert.dueDate).toLocaleDateString()}
                    </span>
                    {alert.flock?.name && <span>Flock: {alert.flock.name}</span>}
                  </div>
                </div>
                {!alert.isResolved && (
                  <div className="flex gap-2">
                    {!alert.isRead && (
                      <Button variant="ghost" size="sm" onClick={() => handleRead(alert.id)}>
                        Mark Read
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleResolve(alert.id)}>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Resolve
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
