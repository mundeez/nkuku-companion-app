"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TenantDetail } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";
import { useReauth } from "@/components/reauth-modal";
import { TENANT_APP_URL, setImpersonation } from "@/lib/api/client";
import { deleteTenant, impersonateTenant } from "@/lib/api/platform";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Copy, ExternalLink, Eye, Trash2 } from "lucide-react";

export function DangerZone({
  tenant,
  onChanged,
}: {
  tenant: TenantDetail;
  onChanged: () => void;
}) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const { withReauth } = useReauth();

  const canImpersonate = hasPermission("tenants.impersonate");
  const canDelete = hasPermission("tenants.delete");

  // ── impersonate ──
  const [impOpen, setImpOpen] = useState(false);
  const [impUser, setImpUser] = useState("");
  const [impReason, setImpReason] = useState("");
  const [impTicketId, setImpTicketId] = useState("");
  const [impResult, setImpResult] = useState<{ token: string; expiresAt?: string; banner?: string } | null>(null);

  // ── delete ──
  const [delOpen, setDelOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [delReason, setDelReason] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function doImpersonate() {
    setError("");
    setBusy(true);
    try {
      const res = await withReauth(() =>
        impersonateTenant(tenant.id, {
          targetUserId: impUser,
          reason: impReason,
          ticketId: impTicketId || undefined,
        })
      );
      setImpersonation({
        sessionId: res.sessionId ?? null,
        orgId: tenant.id,
        orgName: tenant.name,
        targetUserId: impUser,
        targetEmail: tenant.members.find((m) => m.userId === impUser)?.email ?? null,
        expiresAt: res.expiresAt ?? null,
      });
      setImpResult(res);
      onChanged();
    } catch (e: any) {
      if (e?.code !== "CANCELLED") setError(e.message || "Impersonation failed");
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    setError("");
    setBusy(true);
    try {
      await withReauth(() =>
        deleteTenant(tenant.id, { confirmName, reason: delReason })
      );
      setDelOpen(false);
      router.replace("/tenants");
    } catch (e: any) {
      if (e?.code !== "CANCELLED") setError(e.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const impersonateUrl = impResult
    ? `${TENANT_APP_URL}?impersonate=${encodeURIComponent(impResult.token)}`
    : "";

  if (!canImpersonate && !canDelete) return null;

  return (
    <Card className="border-red-500/40">
      <CardHeader>
        <CardTitle className="text-base text-red-400">Danger Zone</CardTitle>
        <CardDescription>
          Irreversible or high-impact actions. All require re-authentication and are audit-logged.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {canImpersonate && (
          <Button
            variant="outline"
            className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
            onClick={() => {
              setImpOpen(true);
              setImpResult(null);
              setImpUser("");
              setImpReason("");
              setImpTicketId("");
              setError("");
            }}
          >
            <Eye className="mr-2 h-4 w-4" /> Impersonate user…
          </Button>
        )}
        {canDelete && (
          <Button
            variant="destructive"
            onClick={() => {
              setDelOpen(true);
              setConfirmName("");
              setDelReason("");
              setError("");
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete organization…
          </Button>
        )}

        {/* ── Impersonate dialog ── */}
        <Dialog open={impOpen} onOpenChange={setImpOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Impersonate a member of {tenant.name}</DialogTitle>
              <DialogDescription>
                Mints a 30-minute, non-refreshable tenant token. Password/MFA changes, billing and
                delete actions stay blocked. The tenant sees an &quot;acting as&quot; banner and every
                mutation lands in their audit log.
              </DialogDescription>
            </DialogHeader>

            {!impResult ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Member to act as</Label>
                  <Select value={impUser} onValueChange={setImpUser}>
                    <SelectTrigger><SelectValue placeholder="Select member…" /></SelectTrigger>
                    <SelectContent>
                      {tenant.members.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.email} ({m.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="imp-reason">Reason (required)</Label>
                  <Textarea
                    id="imp-reason"
                    value={impReason}
                    onChange={(e) => setImpReason(e.target.value)}
                    placeholder="e.g. Reproducing reported bug in growth chart"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="imp-ticket">Support ticket ID (optional)</Label>
                  <Input
                    id="imp-ticket"
                    value={impTicketId}
                    onChange={(e) => setImpTicketId(e.target.value)}
                    placeholder="e.g. T-1024"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setImpOpen(false)}>Cancel</Button>
                  <Button onClick={doImpersonate} disabled={busy || !impUser || !impReason.trim()}>
                    {busy ? "Minting…" : "Start impersonation"}
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300">
                  Impersonation session started{impResult.expiresAt ? ` — expires ${new Date(impResult.expiresAt).toLocaleTimeString()}` : ""}.
                </div>
                {impResult.banner && <p className="text-xs text-muted-foreground">{impResult.banner}</p>}
                <div className="space-y-1">
                  <Label>Tenant token (30 min, non-refreshable)</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={impResult.token} className="font-mono text-xs" />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard?.writeText(impResult.token);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  {copied && <p className="text-xs text-muted-foreground">Copied.</p>}
                </div>
                <DialogFooter className="sm:justify-between">
                  <Button variant="ghost" onClick={() => setImpOpen(false)}>Close</Button>
                  <a href={impersonateUrl} target="_blank" rel="noreferrer">
                    <Button>
                      <ExternalLink className="mr-2 h-4 w-4" /> Open tenant app as this user
                    </Button>
                  </a>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Delete dialog ── */}
        <Dialog open={delOpen} onOpenChange={setDelOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-red-400">Delete {tenant.name}</DialogTitle>
              <DialogDescription>
                GDPR org delete — removes the organization and all its data. Export the tenant
                data ZIP from the tenant app first if required. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="del-confirm">
                  Type <strong>{tenant.name}</strong> to confirm
                </Label>
                <Input
                  id="del-confirm"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={tenant.name}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="del-reason">Reason (required)</Label>
                <Textarea
                  id="del-reason"
                  value={delReason}
                  onChange={(e) => setDelReason(e.target.value)}
                  placeholder="e.g. GDPR erasure request received 2026-11-09"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDelOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={doDelete}
                disabled={busy || confirmName !== tenant.name || !delReason.trim()}
              >
                {busy ? "Deleting…" : "Permanently delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
