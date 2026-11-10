"use client";

import { useState } from "react";
import type { TenantDetail, TenantMember } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";
import { useReauth } from "@/components/reauth-modal";
import {
  changeTenantOwner,
  tenantMemberOp,
} from "@/lib/api/platform";
import { formatDate, formatDateTime } from "@/lib/utils";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Crown,
  KeyRound,
  LogOut,
  MailCheck,
  MoreHorizontal,
} from "lucide-react";

export function MembersTab({
  tenant,
  onChanged,
}: {
  tenant: TenantDetail;
  onChanged: () => void;
}) {
  const { hasPermission } = useAuth();
  const { withReauth } = useReauth();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [ownerTarget, setOwnerTarget] = useState<TenantMember | null>(null);
  const [ownerReason, setOwnerReason] = useState("");

  const canSupportOps = hasPermission("tenants.support_ops");

  async function run(op: "reset-password" | "force-logout" | "resend-verification", m: TenantMember) {
    setError("");
    setNotice("");
    setBusy(`${op}:${m.userId}`);
    try {
      await withReauth(() => tenantMemberOp(tenant.id, m.userId, op));
      const verb =
        op === "reset-password"
          ? "Password reset email sent"
          : op === "force-logout"
            ? "User logged out of all sessions"
            : "Verification email re-sent";
      setNotice(`${verb} for ${m.email}.`);
    } catch (e: any) {
      if (e?.code !== "CANCELLED") setError(e.message || "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function confirmChangeOwner() {
    if (!ownerTarget) return;
    setError("");
    setBusy(`owner:${ownerTarget.userId}`);
    try {
      await withReauth(() =>
        changeTenantOwner(tenant.id, {
          newOwnerUserId: ownerTarget.userId,
          reason: ownerReason,
        })
      );
      setNotice(`Ownership transferred to ${ownerTarget.email}.`);
      setOwnerTarget(null);
      setOwnerReason("");
      onChanged();
    } catch (e: any) {
      if (e?.code !== "CANCELLED") setError(e.message || "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Members ({tenant.members.length})</CardTitle>
        <CardDescription>
          Tenant users. Support ops require re-authentication and are audit-logged.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {notice && <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-400">{notice}</div>}
        {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 pr-4 font-medium text-muted-foreground">Email</th>
                <th className="pb-2 pr-4 font-medium text-muted-foreground">Name</th>
                <th className="pb-2 pr-4 font-medium text-muted-foreground">Role</th>
                <th className="pb-2 pr-4 font-medium text-muted-foreground">Joined</th>
                <th className="pb-2 pr-4 font-medium text-muted-foreground">Last login</th>
                {canSupportOps && <th className="pb-2 font-medium text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {tenant.members.map((m) => (
                <tr key={m.id || m.userId} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{m.email}</td>
                  <td className="py-2 pr-4">{m.name || "—"}</td>
                  <td className="py-2 pr-4">
                    <Badge variant={m.isOwner ? "default" : "secondary"}>{m.role}</Badge>
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">{formatDate(m.createdAt)}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{formatDateTime(m.lastLoginAt)}</td>
                  {canSupportOps && (
                    <td className="py-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" disabled={busy !== null}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => run("reset-password", m)}>
                            <KeyRound className="mr-2 h-4 w-4" /> Reset password
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => run("force-logout", m)}>
                            <LogOut className="mr-2 h-4 w-4" /> Force logout
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => run("resend-verification", m)}>
                            <MailCheck className="mr-2 h-4 w-4" /> Resend verification
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={m.isOwner}
                            onClick={() => {
                              setOwnerTarget(m);
                              setOwnerReason("");
                              setError("");
                            }}
                          >
                            <Crown className="mr-2 h-4 w-4" /> Make owner
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {tenant.members.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No members.</p>
          )}
        </div>

        {/* Change-owner confirm dialog */}
        <Dialog open={!!ownerTarget} onOpenChange={(v) => !v && setOwnerTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transfer ownership</DialogTitle>
              <DialogDescription>
                Make <strong>{ownerTarget?.email}</strong> the owner of{" "}
                <strong>{tenant.name}</strong>. The current owner is demoted. This is
                audit-logged and requires re-authentication.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1">
              <Label htmlFor="owner-reason">Reason (required)</Label>
              <Textarea
                id="owner-reason"
                value={ownerReason}
                onChange={(e) => setOwnerReason(e.target.value)}
                placeholder="e.g. Support ticket #1234 — owner lost access"
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOwnerTarget(null)}>Cancel</Button>
              <Button
                onClick={confirmChangeOwner}
                disabled={!ownerReason.trim() || busy !== null}
              >
                {busy ? "Working…" : "Transfer ownership"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
