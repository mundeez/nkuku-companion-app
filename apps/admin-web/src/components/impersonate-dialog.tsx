"use client";

import { useState } from "react";
import { useReauth } from "@/components/reauth-modal";
import { TENANT_APP_URL, setImpersonation } from "@/lib/api/client";
import { impersonateTenant } from "@/lib/api/platform";
import { Button } from "@/components/ui/button";
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
import { Copy, ExternalLink, Eye } from "lucide-react";

/**
 * Self-contained "impersonate this user" button + dialog — the same flow as
 * tenants/[id] → Danger Zone, but with the target user already chosen (used
 * from a support ticket's requester card). Reason is pre-filled by the caller.
 */
export function ImpersonateButton({
  orgId,
  orgName,
  targetUserId,
  targetEmail,
  defaultReason = "",
  ticketId,
  onStarted,
}: {
  orgId: string;
  orgName: string;
  targetUserId: string;
  targetEmail?: string | null;
  defaultReason?: string;
  ticketId?: string;
  onStarted?: () => void;
}) {
  const { withReauth } = useReauth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<{ token: string; expiresAt?: string; banner?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function doImpersonate() {
    setError("");
    setBusy(true);
    try {
      const res = await withReauth(() =>
        impersonateTenant(orgId, {
          targetUserId,
          reason,
          ticketId: ticketId || undefined,
        })
      );
      setImpersonation({
        sessionId: res.sessionId ?? null,
        orgId,
        orgName,
        targetUserId,
        targetEmail: targetEmail ?? null,
        expiresAt: res.expiresAt ?? null,
      });
      setResult(res);
      onStarted?.();
    } catch (e: any) {
      if (e?.code !== "CANCELLED") setError(e.message || "Impersonation failed");
    } finally {
      setBusy(false);
    }
  }

  const impersonateUrl = result
    ? `${TENANT_APP_URL}?impersonate=${encodeURIComponent(result.token)}`
    : "";

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
        onClick={() => {
          setOpen(true);
          setResult(null);
          setReason(defaultReason);
          setError("");
        }}
      >
        <Eye className="mr-2 h-4 w-4" /> Impersonate
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Impersonate {targetEmail ?? "user"}</DialogTitle>
            <DialogDescription>
              Mints a 30-minute, non-refreshable tenant token for{" "}
              <strong>{orgName}</strong>. Password/MFA changes, billing and delete
              actions stay blocked. The tenant sees an &quot;acting as&quot; banner and
              every mutation lands in their audit log.
            </DialogDescription>
          </DialogHeader>

          {!result ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="imp-reason">Reason (required)</Label>
                <Textarea
                  id="imp-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Reproducing reported bug in growth chart"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={doImpersonate} disabled={busy || !reason.trim()}>
                  {busy ? "Minting…" : "Start impersonation"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300">
                Impersonation session started{result.expiresAt ? ` — expires ${new Date(result.expiresAt).toLocaleTimeString()}` : ""}.
              </div>
              {result.banner && <p className="text-xs text-muted-foreground">{result.banner}</p>}
              <div className="space-y-1">
                <Label>Tenant token (30 min, non-refreshable)</Label>
                <div className="flex gap-2">
                  <Input readOnly value={result.token} className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard?.writeText(result.token);
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
                <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
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
    </>
  );
}
