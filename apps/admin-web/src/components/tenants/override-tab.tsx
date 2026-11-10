"use client";

import { useState } from "react";
import type { TenantDetail } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";
import { useReauth } from "@/components/reauth-modal";
import { overrideTenant } from "@/lib/api/platform";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BadgePercent } from "lucide-react";

const KEEP = "__keep__";
const PLANS = ["free", "grower", "business", "enterprise"];

export function OverrideTab({
  tenant,
  onChanged,
}: {
  tenant: TenantDetail;
  onChanged: () => void;
}) {
  const { hasPermission } = useAuth();
  const { withReauth } = useReauth();
  const canOverride = hasPermission("billing.override");

  const [planCode, setPlanCode] = useState<string>(KEEP);
  const [compUntil, setCompUntil] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [limitsText, setLimitsText] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  let parsedLimits: Record<string, any> | undefined;
  let limitsError = "";
  if (limitsText.trim()) {
    try {
      const p = JSON.parse(limitsText);
      if (p && typeof p === "object" && !Array.isArray(p)) parsedLimits = p;
      else limitsError = "Limits must be a JSON object";
    } catch (e: any) {
      limitsError = `Invalid JSON: ${e.message}`;
    }
  }

  const ov = tenant.override;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (limitsError) {
      setError(limitsError);
      return;
    }
    setBusy(true);
    try {
      await withReauth(() =>
        overrideTenant(tenant.id, {
          planCode: planCode === KEEP ? undefined : planCode,
          limitsJson: parsedLimits,
          compUntil: compUntil ? new Date(compUntil).toISOString() : undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
          reason,
        })
      );
      setNotice("Override saved.");
      setPlanCode(KEEP);
      setCompUntil("");
      setExpiresAt("");
      setLimitsText("");
      setReason("");
      onChanged();
    } catch (e: any) {
      if (e?.code !== "CANCELLED") setError(e.message || "Override failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Current plan + active override */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan & Override</CardTitle>
          <CardDescription>
            Effective plan: <Badge className="ml-1">{tenant.planCode}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ov ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <div className="mb-2 flex items-center gap-2 font-medium text-amber-300">
                <BadgePercent className="h-4 w-4" /> Active override
              </div>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                {ov.planCode && <div><dt className="inline text-muted-foreground">Plan: </dt><dd className="inline">{ov.planCode}</dd></div>}
                {ov.compUntil && <div><dt className="inline text-muted-foreground">Comped until: </dt><dd className="inline">{formatDateTime(ov.compUntil)}</dd></div>}
                {ov.expiresAt && <div><dt className="inline text-muted-foreground">Expires: </dt><dd className="inline">{formatDateTime(ov.expiresAt)}</dd></div>}
                {ov.reason && <div><dt className="inline text-muted-foreground">Reason: </dt><dd className="inline">{ov.reason}</dd></div>}
              </dl>
              {ov.limitsJson && (
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                  {JSON.stringify(ov.limitsJson, null, 2)}
                </pre>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active override.</p>
          )}

          {tenant.limits && (
            <div>
              <div className="mb-1 text-sm font-medium">Effective limits</div>
              <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(tenant.limits, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Override form */}
      {canOverride && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Set Override</CardTitle>
            <CardDescription>
              Comp a plan, extend a trial or override limits. Requires billing.override + re-authentication; every change is audit-logged.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Plan override</Label>
                  <Select value={planCode} onValueChange={setPlanCode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={KEEP}>Keep current ({tenant.planCode})</SelectItem>
                      {PLANS.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="comp-until">Comp until (free access)</Label>
                  <Input
                    id="comp-until"
                    type="datetime-local"
                    value={compUntil}
                    onChange={(e) => setCompUntil(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="exp-at">Override expires at</Label>
                  <Input
                    id="exp-at"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ov-reason">Reason (required)</Label>
                  <Input
                    id="ov-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. NGO partnership, trial extension"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="limits-json">Limits JSON (optional)</Label>
                <Textarea
                  id="limits-json"
                  rows={5}
                  className="font-mono text-xs"
                  value={limitsText}
                  onChange={(e) => setLimitsText(e.target.value)}
                  placeholder='{"maxActiveFlocks": 25, "maxUsers": 10, "features": ["ledger", "documents"]}'
                />
                {limitsText.trim() && !limitsError && parsedLimits && (
                  <pre className="max-h-32 overflow-auto rounded-md bg-muted p-2 text-xs">
                    {JSON.stringify(parsedLimits, null, 2)}
                  </pre>
                )}
                {limitsError && <p className="text-xs text-destructive">{limitsError}</p>}
              </div>
              {notice && <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-400">{notice}</div>}
              {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
              <Button type="submit" disabled={busy || !reason.trim() || !!limitsError}>
                {busy ? "Saving…" : "Save override"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
