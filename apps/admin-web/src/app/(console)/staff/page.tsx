"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useReauth } from "@/components/reauth-modal";
import {
  changeStaffRole,
  disableStaff,
  inviteStaff,
  listStaff,
  resetStaffTotp,
} from "@/lib/api/platform";
import { ROLE_LABELS, ROLE_SUMMARIES, STAFF_ROLES } from "@/lib/rbac";
import type { StaffRole, StaffUser } from "@/lib/types";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  KeyRound,
  MoreHorizontal,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
} from "lucide-react";

export default function StaffPage() {
  const router = useRouter();
  const { user, isLoading, hasPermission } = useAuth();
  const { withReauth } = useReauth();

  const [staff, setStaff] = useState<StaffUser[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // dialogs
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [invName, setInvName] = useState("");
  const [invRole, setInvRole] = useState<StaffRole>("support");
  const [inviteResult, setInviteResult] = useState<{ emailSent: boolean; devInviteUrl?: string } | null>(null);

  const [roleTarget, setRoleTarget] = useState<StaffUser | null>(null);
  const [newRole, setNewRole] = useState<StaffRole>("support");
  const [disableTarget, setDisableTarget] = useState<StaffUser | null>(null);
  const [totpTarget, setTotpTarget] = useState<StaffUser | null>(null);

  const load = useCallback(() => {
    listStaff()
      .then((r) => setStaff(r.items))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (!hasPermission("staff.manage")) {
      router.replace("/");
      return;
    }
    load();
  }, [user, isLoading, hasPermission, load, router]);

  async function doInvite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy("invite");
    try {
      const res = await withReauth(() =>
        inviteStaff({ email: invEmail, name: invName, role: invRole })
      );
      setInviteResult(res);
      load();
    } catch (e: any) {
      if (e?.code !== "CANCELLED") setError(e.message || "Invite failed");
    } finally {
      setBusy(null);
    }
  }

  async function doDisable() {
    if (!disableTarget) return;
    setError("");
    setBusy(`disable:${disableTarget.id}`);
    try {
      await withReauth(() => disableStaff(disableTarget.id));
      setNotice(`${disableTarget.email} disabled — all sessions revoked.`);
      setDisableTarget(null);
      load();
    } catch (e: any) {
      if (e?.code !== "CANCELLED") setError(e.message || "Disable failed");
    } finally {
      setBusy(null);
    }
  }

  async function doChangeRole() {
    if (!roleTarget) return;
    setError("");
    setBusy(`role:${roleTarget.id}`);
    try {
      await withReauth(() => changeStaffRole(roleTarget.id, newRole));
      setNotice(`${roleTarget.email} is now ${ROLE_LABELS[newRole]}.`);
      setRoleTarget(null);
      load();
    } catch (e: any) {
      if (e?.code !== "CANCELLED") setError(e.message || "Role change failed");
    } finally {
      setBusy(null);
    }
  }

  async function doResetTotp() {
    if (!totpTarget) return;
    setError("");
    setBusy(`totp:${totpTarget.id}`);
    try {
      await withReauth(() => resetStaffTotp(totpTarget.id));
      setNotice(`${totpTarget.email}'s TOTP reset — they re-enrol at next login.`);
      setTotpTarget(null);
      load();
    } catch (e: any) {
      if (e?.code !== "CANCELLED") setError(e.message || "TOTP reset failed");
    } finally {
      setBusy(null);
    }
  }

  if (isLoading || !user) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Staff</h1>
          <p className="text-muted-foreground">Platform staff accounts — separate from tenant users</p>
        </div>
        <Button
          onClick={() => {
            setInviteOpen(true);
            setInviteResult(null);
            setInvEmail("");
            setInvName("");
            setInvRole("support");
            setError("");
          }}
        >
          <UserPlus className="mr-2 h-4 w-4" /> Invite staff
        </Button>
      </div>

      {notice && <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-400">{notice}</div>}
      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff accounts ({staff?.length ?? 0})</CardTitle>
          <CardDescription>Least-privilege roles — see PLAN §3 matrix</CardDescription>
        </CardHeader>
        <CardContent>
          {staff === null ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Name</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Email</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Role</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">2FA</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Last login</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Status</th>
                    <th className="pb-2 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => {
                    const isSelf = s.id === user.id;
                    return (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-2.5 pr-4 font-medium">
                          {s.name || "—"}
                          {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                        </td>
                        <td className="py-2.5 pr-4">{s.email}</td>
                        <td className="py-2.5 pr-4">
                          <Badge variant={s.role === "super_admin" ? "default" : "secondary"}>
                            {ROLE_LABELS[s.role] ?? s.role}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-4">
                          {s.totpEnrolled ? (
                            <span className="inline-flex items-center gap-1 text-green-500"><ShieldCheck className="h-3.5 w-3.5" /> enrolled</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-500"><ShieldAlert className="h-3.5 w-3.5" /> pending</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{formatDateTime(s.lastLoginAt)}</td>
                        <td className="py-2.5 pr-4">
                          <Badge variant={s.isActive ? "default" : "destructive"}>
                            {s.isActive ? "active" : "disabled"}
                          </Badge>
                        </td>
                        <td className="py-2.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" disabled={busy !== null}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setRoleTarget(s);
                                  setNewRole(s.role);
                                  setError("");
                                }}
                              >
                                Change role…
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setTotpTarget(s);
                                  setError("");
                                }}
                              >
                                <KeyRound className="mr-2 h-4 w-4" /> Reset TOTP…
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                disabled={isSelf || !s.isActive}
                                onClick={() => {
                                  setDisableTarget(s);
                                  setError("");
                                }}
                              >
                                Disable account…
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite staff member</DialogTitle>
            <DialogDescription>
              They receive a one-time bootstrap link to set their password, then must enrol TOTP.
            </DialogDescription>
          </DialogHeader>
          {!inviteResult ? (
            <form onSubmit={doInvite} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="inv-name">Name</Label>
                <Input id="inv-name" value={invName} onChange={(e) => setInvName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="inv-email">Email</Label>
                <Input id="inv-email" type="email" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>Role</Label>
                <Select value={invRole} onValueChange={(v) => setInvRole(v as StaffRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAFF_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{ROLE_SUMMARIES[invRole]}</p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={busy === "invite"}>
                  {busy === "invite" ? "Sending…" : "Send invite"}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300">
                Invite created{inviteResult.emailSent ? " and emailed" : " (email not sent — share the link manually)"}.
              </div>
              {inviteResult.devInviteUrl && (
                <div className="space-y-1">
                  <Label>Invite link (dev)</Label>
                  <Input readOnly value={inviteResult.devInviteUrl} className="font-mono text-xs" />
                </div>
              )}
              <DialogFooter>
                <Button onClick={() => setInviteOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Change role dialog */}
      <Dialog open={!!roleTarget} onOpenChange={(v) => !v && setRoleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role — {roleTarget?.email}</DialogTitle>
            <DialogDescription>Takes effect immediately on their next request.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label>New role</Label>
            <Select value={newRole} onValueChange={(v) => setNewRole(v as StaffRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAFF_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{ROLE_SUMMARIES[newRole]}</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRoleTarget(null)}>Cancel</Button>
            <Button onClick={doChangeRole} disabled={busy !== null || newRole === roleTarget?.role}>
              {busy ? "Saving…" : "Change role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable dialog */}
      <Dialog open={!!disableTarget} onOpenChange={(v) => !v && setDisableTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable {disableTarget?.email}?</DialogTitle>
            <DialogDescription>
              Revokes all sessions and blocks sign-in. The last active super_admin cannot be disabled.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDisableTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={doDisable} disabled={busy !== null}>
              {busy ? "Disabling…" : "Disable account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset TOTP dialog */}
      <Dialog open={!!totpTarget} onOpenChange={(v) => !v && setTotpTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset TOTP — {totpTarget?.email}</DialogTitle>
            <DialogDescription>
              Clears their authenticator secret + recovery codes and revokes sessions; they re-enrol
              at next login. Resetting a super_admin requires a <em>different</em> super_admin
              (two-person break-glass).
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTotpTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={doResetTotp} disabled={busy !== null}>
              {busy ? "Resetting…" : "Reset TOTP"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
