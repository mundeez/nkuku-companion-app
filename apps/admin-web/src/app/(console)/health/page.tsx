"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useReauth } from "@/components/reauth-modal";
import {
  getPlatformHealth,
  runCronJob,
  setMaintenanceMode,
} from "@/lib/api/platform";
import type { PlatformHealth, RagStatus } from "@/lib/types";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CheckCircle2,
  HeartPulse,
  Play,
  RefreshCw,
  Wrench,
  XCircle,
} from "lucide-react";

const REFRESH_MS = 30_000;
const MAINT_KEY = "nkuku_last_maintenance";

/** GET /health doesn't report maintenance state today — remember the last
 *  toggle this session so the card shows more than "unknown". */
function getCachedMaintenance(): { enabled: boolean; message?: string | null } | null {
  try {
    const raw = sessionStorage.getItem(MAINT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedMaintenance(m: { enabled: boolean; message?: string | null }) {
  try {
    sessionStorage.setItem(MAINT_KEY, JSON.stringify(m));
  } catch {
    // non-fatal
  }
}

const RAG_TEXT: Record<RagStatus, string> = {
  green: "All systems operational",
  amber: "Degraded — some checks need attention",
  red: "Outage or failing checks — investigate now",
};

const RAG_STYLES: Record<RagStatus, string> = {
  green: "border-green-500/40 bg-green-500/10 text-green-300",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  red: "border-red-500/40 bg-red-500/10 text-red-300",
};

const RAG_DOT: Record<RagStatus, string> = {
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

function StatusDot({ status }: { status: RagStatus }) {
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full", RAG_DOT[status] ?? "bg-muted")} />;
}

function formatBytes(bytes?: number | null) {
  if (bytes === undefined || bytes === null || !Number.isFinite(bytes)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toFixed(v >= 10 || u === 0 ? 0 : 1)} ${units[u]}`;
}

function formatUptime(sec?: number | null) {
  if (sec === undefined || sec === null || !Number.isFinite(sec)) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatAge(minutes?: number | null) {
  if (minutes === undefined || minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)}h`;
  return `${(minutes / 1440).toFixed(1)}d`;
}

export default function HealthPage() {
  const router = useRouter();
  const { user, isLoading, hasPermission } = useAuth();
  const { withReauth } = useReauth();

  const [health, setHealth] = useState<PlatformHealth | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [maintOpen, setMaintOpen] = useState(false);
  const [maintMessage, setMaintMessage] = useState("");

  const canOps = hasPermission("system.ops");

  const load = useCallback(() => {
    getPlatformHealth()
      .then((h) => {
        // Prefer the API's state; fall back to this session's last toggle.
        if (h.maintenance == null) h.maintenance = getCachedMaintenance();
        setHealth(h);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (!hasPermission("platform.dashboard.read")) {
      router.replace("/");
      return;
    }
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [user, isLoading, hasPermission, load, router]);

  async function doRunCron(name: string) {
    setError("");
    setNotice("");
    setBusy(`cron:${name}`);
    try {
      await withReauth(() => runCronJob(name));
      setNotice(`Cron job "${name}" started — results appear on the next refresh.`);
      setTimeout(load, 3000);
    } catch (e: any) {
      if (e?.code !== "CANCELLED") setError(e.message || "Run failed");
    } finally {
      setBusy(null);
    }
  }

  async function doMaintenanceToggle() {
    if (!health) return;
    const enabling = !(health.maintenance?.enabled ?? false);
    setError("");
    setBusy("maintenance");
    try {
      const res = await withReauth(() =>
        setMaintenanceMode({
          enabled: enabling,
          message: enabling && maintMessage.trim() ? maintMessage.trim() : undefined,
        })
      );
      setCachedMaintenance({ enabled: res.enabled, message: res.message });
      setNotice(`Maintenance mode ${res.enabled ? "enabled" : "disabled"}.`);
      setMaintOpen(false);
      setMaintMessage("");
      load();
    } catch (e: any) {
      if (e?.code !== "CANCELLED") setError(e.message || "Toggle failed");
    } finally {
      setBusy(null);
    }
  }

  if (isLoading || !user || (!health && !error)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !health) {
    return <div className="rounded-md bg-destructive/10 p-4 text-destructive">{error}</div>;
  }

  const h = health!;
  const maintenanceEnabled = h.maintenance?.enabled ?? false;
  const OverallIcon = h.overall === "green" ? CheckCircle2 : h.overall === "amber" ? AlertTriangle : XCircle;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Health</h1>
          <p className="text-muted-foreground">
            Live platform status — auto-refreshes every {REFRESH_MS / 1000}s
            {h.checkedAt ? ` · checked ${timeAgo(h.checkedAt)}` : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {notice && <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-400">{notice}</div>}
      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {/* Overall RAG banner */}
      <div className={cn("flex items-center gap-3 rounded-lg border p-4", RAG_STYLES[h.overall] ?? RAG_STYLES.amber)}>
        <OverallIcon className="h-6 w-6" />
        <div>
          <div className="font-semibold capitalize">{h.overall}</div>
          <div className="text-sm opacity-90">{RAG_TEXT[h.overall] ?? "Unknown state"}</div>
        </div>
        {h.system?.version && (
          <Badge variant="outline" className="ml-auto">v{h.system.version}</Badge>
        )}
      </div>

      {/* Checks */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {h.checks.map((c) => (
          <Card key={c.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{c.name}</CardTitle>
              <StatusDot status={c.status} />
            </CardHeader>
            <CardContent>
              <div className="text-sm capitalize">{c.status}</div>
              <p className="text-xs text-muted-foreground">
                {c.latencyMs !== undefined && c.latencyMs !== null ? `${Math.round(c.latencyMs)} ms` : ""}
                {c.latencyMs != null && (c.detail || c.error) ? " · " : ""}
                {c.error ?? c.detail ?? ""}
              </p>
            </CardContent>
          </Card>
        ))}
        {h.checks.length === 0 && (
          <p className="text-sm text-muted-foreground">No dependency checks reported.</p>
        )}
      </div>

      {/* System stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Uptime</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatUptime(h.system?.uptimeSec)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Version</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{h.system?.version ?? "—"}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">DB size</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatBytes(h.system?.dbSizeBytes)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Disk free</CardTitle></CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", (h.system?.diskFreePct ?? 100) < 10 ? "text-red-500" : (h.system?.diskFreePct ?? 100) < 20 ? "text-amber-500" : "")}>
              {h.system?.diskFreePct !== undefined && h.system?.diskFreePct !== null ? `${h.system.diskFreePct}%` : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Cron jobs */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HeartPulse className="h-4 w-4" /> Scheduled jobs
            </CardTitle>
            <CardDescription>Last run, age vs expected interval, and staleness</CardDescription>
          </CardHeader>
          <CardContent>
            {h.cron.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cron jobs reported.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Job</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Last run</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Status</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Age</th>
                      {canOps && <th className="pb-2 font-medium text-muted-foreground"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {h.cron.map((j) => (
                      <tr key={j.name} className="border-b last:border-0">
                        <td className="py-2.5 pr-4 font-medium">
                          {j.name}
                          {j.schedule && (
                            <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">{j.schedule}</span>
                          )}
                          {j.stale && (
                            <Badge variant="outline" className="ml-2 border-amber-500/50 text-amber-400">stale</Badge>
                          )}
                          {j.detail && (
                            <div className="text-xs font-normal text-muted-foreground">{j.detail}</div>
                          )}
                        </td>
                        <td className="whitespace-nowrap py-2.5 pr-4 text-muted-foreground" title={formatDateTime(j.lastRunAt)}>
                          {j.lastRunAt ? timeAgo(j.lastRunAt) : "never"}
                        </td>
                        <td className="py-2.5 pr-4">
                          {j.lastStatus ? (
                            <Badge variant={j.lastStatus === "ok" || j.lastStatus === "success" ? "default" : "destructive"}>
                              {j.lastStatus}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground">
                          {formatAge(j.ageMinutes)}
                          {j.expectedMinutes ? ` / ${formatAge(j.expectedMinutes)}` : ""}
                        </td>
                        {canOps && (
                          <td className="py-2.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Run now (requires re-auth)"
                              disabled={busy !== null}
                              onClick={() => doRunCron(j.name)}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Maintenance mode */}
        <Card className={maintenanceEnabled ? "border-amber-500/40" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4" /> Maintenance mode
            </CardTitle>
            <CardDescription>
              Tenant apps show a notice and the API serves 503 to non-staff while enabled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              {h.maintenance === null || h.maintenance === undefined ? (
                <Badge variant="secondary">state unknown</Badge>
              ) : maintenanceEnabled ? (
                <Badge variant="outline" className="border-amber-500/50 text-amber-400">enabled</Badge>
              ) : (
                <Badge variant="default">disabled</Badge>
              )}
            </div>
            {maintenanceEnabled && h.maintenance?.message && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs">
                {h.maintenance.message}
              </p>
            )}
            {canOps && (
              <Button
                variant={maintenanceEnabled ? "default" : "outline"}
                className={maintenanceEnabled ? "" : "border-amber-500/40 text-amber-300 hover:bg-amber-500/10"}
                onClick={() => {
                  setMaintOpen(true);
                  setMaintMessage(h.maintenance?.message ?? "");
                  setError("");
                }}
              >
                {maintenanceEnabled ? "Disable maintenance mode" : "Enable maintenance mode…"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Maintenance confirm dialog */}
      <Dialog open={maintOpen} onOpenChange={setMaintOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {maintenanceEnabled ? "Disable maintenance mode" : "Enable maintenance mode"}
            </DialogTitle>
            <DialogDescription>
              {maintenanceEnabled
                ? "Tenant apps and the public API resume normal service immediately."
                : "Tenant users will be blocked (503 + notice) until disabled. Staff endpoints stay up. Requires re-authentication."}
            </DialogDescription>
          </DialogHeader>
          {!maintenanceEnabled && (
            <div className="space-y-1">
              <Label htmlFor="maint-message">Message shown to users (optional)</Label>
              <Input
                id="maint-message"
                value={maintMessage}
                onChange={(e) => setMaintMessage(e.target.value)}
                placeholder="e.g. Scheduled maintenance — back by 14:00 CAT"
              />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMaintOpen(false)}>Cancel</Button>
            <Button
              variant={maintenanceEnabled ? "default" : "destructive"}
              onClick={doMaintenanceToggle}
              disabled={busy === "maintenance"}
            >
              {busy === "maintenance"
                ? "Applying…"
                : maintenanceEnabled
                  ? "Disable"
                  : "Enable maintenance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
