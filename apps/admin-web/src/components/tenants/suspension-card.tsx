"use client";

import { useState } from "react";
import type { TenantDetail } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";
import { useReauth } from "@/components/reauth-modal";
import { reactivateTenant, suspendTenant } from "@/lib/api/platform";
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
import { Textarea } from "@/components/ui/textarea";
import { Ban, PlayCircle } from "lucide-react";

export function SuspensionCard({
  tenant,
  onChanged,
}: {
  tenant: TenantDetail;
  onChanged: () => void;
}) {
  const { hasPermission } = useAuth();
  const { withReauth } = useReauth();
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const suspended = !!tenant.suspendedAt;
  const canSuspend = hasPermission("tenants.suspend");
  const canReactivate = hasPermission("tenants.reactivate");

  async function doSuspend() {
    setError("");
    setBusy(true);
    try {
      await withReauth(() =>
        suspendTenant(tenant.id, { reason, message: message || undefined })
      );
      setNotice("Organization suspended.");
      setSuspendOpen(false);
      setReason("");
      setMessage("");
      onChanged();
    } catch (e: any) {
      if (e?.code !== "CANCELLED") setError(e.message || "Suspend failed");
    } finally {
      setBusy(false);
    }
  }

  async function doReactivate() {
    setError("");
    setBusy(true);
    try {
      await withReauth(() => reactivateTenant(tenant.id, reason ? { reason } : {}));
      setNotice("Organization reactivated.");
      setReactivateOpen(false);
      setReason("");
      onChanged();
    } catch (e: any) {
      if (e?.code !== "CANCELLED") setError(e.message || "Reactivate failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={suspended ? "border-red-500/40" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {suspended ? (
            <Badge variant="destructive">Suspended</Badge>
          ) : (
            <Badge variant="default">Active</Badge>
          )}
          Organization suspension
        </CardTitle>
        <CardDescription>
          Suspended tenants cannot use the app — members see the suspension message at login.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {suspended && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm">
            <div><span className="text-muted-foreground">Since:</span> {formatDateTime(tenant.suspendedAt)}</div>
            {tenant.suspendedReason && <div><span className="text-muted-foreground">Reason:</span> {tenant.suspendedReason}</div>}
            {tenant.suspendedMessage && <div><span className="text-muted-foreground">Member-facing message:</span> {tenant.suspendedMessage}</div>}
          </div>
        )}
        {notice && <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-400">{notice}</div>}
        {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        <div className="flex gap-2">
          {!suspended && canSuspend && (
            <Button variant="destructive" onClick={() => setSuspendOpen(true)}>
              <Ban className="mr-2 h-4 w-4" /> Suspend organization
            </Button>
          )}
          {suspended && canReactivate && (
            <Button onClick={() => setReactivateOpen(true)}>
              <PlayCircle className="mr-2 h-4 w-4" /> Reactivate organization
            </Button>
          )}
          {!canSuspend && !canReactivate && (
            <p className="text-sm text-muted-foreground">
              Your role cannot suspend or reactivate tenants.
            </p>
          )}
        </div>

        {/* Suspend dialog */}
        <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Suspend {tenant.name}</DialogTitle>
              <DialogDescription>
                Members will be blocked from the app until reactivated. Requires re-authentication.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="suspend-reason">Internal reason (required)</Label>
                <Textarea
                  id="suspend-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Chargeback fraud, ToS violation…"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="suspend-message">Message shown to members (optional)</Label>
                <Input
                  id="suspend-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. Account suspended — contact support"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setSuspendOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={doSuspend} disabled={!reason.trim() || busy}>
                {busy ? "Suspending…" : "Suspend"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reactivate dialog */}
        <Dialog open={reactivateOpen} onOpenChange={setReactivateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reactivate {tenant.name}</DialogTitle>
              <DialogDescription>
                Restores app access for all members immediately. Requires re-authentication.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1">
              <Label htmlFor="reactivate-reason">Reason (optional)</Label>
              <Textarea
                id="reactivate-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Payment recovered, dispute resolved"
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setReactivateOpen(false)}>Cancel</Button>
              <Button onClick={doReactivate} disabled={busy}>
                {busy ? "Reactivating…" : "Reactivate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
