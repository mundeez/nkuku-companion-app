"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useReauth } from "@/components/reauth-modal";
import {
  createFlag,
  deleteFlag,
  listFlags,
  listPlans,
  updateFlag,
} from "@/lib/api/platform";
import type { FeatureFlag, PlatformPlan } from "@/lib/types";
import { cn } from "@/lib/utils";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  ChevronDown,
  ChevronRight,
  Flag,
  Plus,
  Trash2,
  X,
} from "lucide-react";

/** Tri-state override editor: inherit (no override) / force on / force off. */
function TriState({
  value,
  onChange,
  disabled,
}: {
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
  disabled?: boolean;
}) {
  const opts: { label: string; v: boolean | undefined }[] = [
    { label: "Inherit", v: undefined },
    { label: "On", v: true },
    { label: "Off", v: false },
  ];
  return (
    <div className="inline-flex overflow-hidden rounded-md border">
      {opts.map((o) => (
        <button
          key={o.label}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.v)}
          className={cn(
            "px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50",
            value === o.v
              ? o.v === false
                ? "bg-destructive/20 text-destructive"
                : o.v === true
                  ? "bg-green-500/20 text-green-400"
                  : "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function FlagsPage() {
  const router = useRouter();
  const { user, isLoading, hasPermission } = useAuth();
  const { withReauth } = useReauth();

  const [flags, setFlags] = useState<FeatureFlag[] | null>(null);
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // New-flag dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDefault, setNewDefault] = useState(false);

  // Org-override input per flag key
  const [orgInputs, setOrgInputs] = useState<Record<string, string>>({});
  const [orgValues, setOrgValues] = useState<Record<string, boolean>>({});

  const [deleteTarget, setDeleteTarget] = useState<FeatureFlag | null>(null);

  const canWrite = hasPermission("flags.write");

  const load = useCallback(() => {
    listFlags()
      .then(setFlags)
      .catch((e) => setError(e.message));
    listPlans()
      .then((items) =>
        setPlans([...items].sort((a, b) => a.sortOrder - b.sortOrder))
      )
      .catch(() => setPlans([])); // plan list is a nicety, not fatal
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (!canWrite) {
      router.replace("/");
      return;
    }
    load();
  }, [user, isLoading, canWrite, load, router]);

  async function patchFlag(flag: FeatureFlag, patch: Parameters<typeof updateFlag>[1]) {
    setError("");
    setNotice("");
    setBusy(flag.key);
    try {
      await withReauth(() => updateFlag(flag.key, patch));
      load();
    } catch (e: any) {
      if (e?.code !== "CANCELLED") setError(e.message || "Update failed");
    } finally {
      setBusy(null);
    }
  }

  function setPlanOverride(flag: FeatureFlag, planCode: string, v: boolean | undefined) {
    const next = { ...flag.planOverrides };
    if (v === undefined) delete next[planCode];
    else next[planCode] = v;
    patchFlag(flag, { planOverrides: next });
  }

  function addOrgOverride(flag: FeatureFlag) {
    const orgId = (orgInputs[flag.key] ?? "").trim();
    if (!orgId) return;
    const v = orgValues[flag.key] ?? true;
    patchFlag(flag, { orgOverrides: { ...flag.orgOverrides, [orgId]: v } });
    setOrgInputs({ ...orgInputs, [flag.key]: "" });
  }

  function removeOrgOverride(flag: FeatureFlag, orgId: string) {
    const next = { ...flag.orgOverrides };
    delete next[orgId];
    patchFlag(flag, { orgOverrides: next });
  }

  async function doCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy("create");
    try {
      await withReauth(() =>
        createFlag({
          key: newKey.trim(),
          description: newDesc.trim() || undefined,
          enabledByDefault: newDefault,
        })
      );
      setNotice(`Flag "${newKey.trim()}" created.`);
      setCreateOpen(false);
      setNewKey("");
      setNewDesc("");
      setNewDefault(false);
      load();
    } catch (e: any) {
      if (e?.code !== "CANCELLED") setError(e.message || "Create failed");
    } finally {
      setBusy(null);
    }
  }

  async function doDelete() {
    if (!deleteTarget) return;
    setError("");
    setBusy(`delete:${deleteTarget.key}`);
    try {
      await withReauth(() => deleteFlag(deleteTarget.key));
      setNotice(`Flag "${deleteTarget.key}" deleted.`);
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      if (e?.code !== "CANCELLED") setError(e.message || "Delete failed");
    } finally {
      setBusy(null);
    }
  }

  if (isLoading || !user) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Feature Flags</h1>
          <p className="text-muted-foreground">
            Platform-wide defaults with per-plan and per-organisation overrides
          </p>
        </div>
        <Button
          onClick={() => {
            setCreateOpen(true);
            setError("");
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> New flag
        </Button>
      </div>

      {notice && (
        <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-400">{notice}</div>
      )}
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Flags ({flags?.length ?? 0})</CardTitle>
          <CardDescription>
            Expand a row to manage overrides — plan overrides are tri-state (inherit / on / off);
            org overrides win over plan overrides.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {flags === null ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : flags.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No flags defined yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground"></th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Key</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Description</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Default</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Overrides</th>
                    <th className="pb-2 font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {flags.map((f) => {
                    const isOpen = !!expanded[f.key];
                    const planOverrideCount = Object.keys(f.planOverrides ?? {}).length;
                    const orgOverrideCount = Object.keys(f.orgOverrides ?? {}).length;
                    return (
                      <Fragment key={f.key}>
                        <tr className="border-b">
                          <td className="py-2.5 pr-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setExpanded({ ...expanded, [f.key]: !isOpen })
                              }
                            >
                              {isOpen ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </td>
                          <td className="py-2.5 pr-4 font-mono text-xs font-medium">
                            <Flag className="mr-1.5 inline h-3.5 w-3.5 text-muted-foreground" />
                            {f.key}
                          </td>
                          <td className="max-w-[320px] py-2.5 pr-4 text-muted-foreground">
                            {f.description ?? "—"}
                          </td>
                          <td className="py-2.5 pr-4">
                            <Switch
                              checked={f.enabledByDefault}
                              disabled={busy !== null}
                              onCheckedChange={(v) => patchFlag(f, { enabledByDefault: v })}
                            />
                          </td>
                          <td className="py-2.5 pr-4">
                            <div className="flex gap-1">
                              {planOverrideCount > 0 && (
                                <Badge variant="secondary">{planOverrideCount} plan</Badge>
                              )}
                              {orgOverrideCount > 0 && (
                                <Badge variant="secondary">{orgOverrideCount} org</Badge>
                              )}
                              {planOverrideCount + orgOverrideCount === 0 && (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Delete flag"
                              disabled={busy !== null}
                              onClick={() => setDeleteTarget(f)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b">
                            <td colSpan={6} className="bg-muted/20 px-6 py-4">
                              <div className="grid gap-6 lg:grid-cols-2">
                                {/* Plan overrides */}
                                <div>
                                  <div className="mb-2 text-sm font-medium">Plan overrides</div>
                                  {plans.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                      Plan list unavailable — overrides can still be read below.
                                    </p>
                                  ) : (
                                    <div className="space-y-2">
                                      {plans.map((p) => (
                                        <div
                                          key={p.code}
                                          className="flex items-center justify-between gap-3"
                                        >
                                          <span className="text-sm">
                                            {p.name}{" "}
                                            <span className="font-mono text-xs text-muted-foreground">
                                              ({p.code})
                                            </span>
                                          </span>
                                          <TriState
                                            value={f.planOverrides?.[p.code]}
                                            disabled={busy !== null}
                                            onChange={(v) => setPlanOverride(f, p.code, v)}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {/* Overrides for plan codes not in the fetched list */}
                                  {Object.keys(f.planOverrides ?? {})
                                    .filter((c) => !plans.some((p) => p.code === c))
                                    .map((c) => (
                                      <div
                                        key={c}
                                        className="mt-2 flex items-center justify-between gap-3"
                                      >
                                        <span className="font-mono text-xs text-muted-foreground">
                                          {c} (unknown plan)
                                        </span>
                                        <TriState
                                          value={f.planOverrides[c]}
                                          disabled={busy !== null}
                                          onChange={(v) => setPlanOverride(f, c, v)}
                                        />
                                      </div>
                                    ))}
                                </div>

                                {/* Org overrides */}
                                <div>
                                  <div className="mb-2 text-sm font-medium">Org overrides</div>
                                  <div className="mb-3 space-y-1.5">
                                    {Object.entries(f.orgOverrides ?? {}).map(([orgId, v]) => (
                                      <div
                                        key={orgId}
                                        className="flex items-center justify-between gap-2 rounded-md border px-2 py-1"
                                      >
                                        <span className="font-mono text-xs">{orgId}</span>
                                        <span className="flex items-center gap-2">
                                          <Badge
                                            variant="outline"
                                            className={
                                              v
                                                ? "border-green-500/50 text-green-400"
                                                : "border-destructive/50 text-destructive"
                                            }
                                          >
                                            {v ? "on" : "off"}
                                          </Badge>
                                          <button
                                            type="button"
                                            title="Remove override (inherit)"
                                            disabled={busy !== null}
                                            onClick={() => removeOrgOverride(f, orgId)}
                                            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        </span>
                                      </div>
                                    ))}
                                    {orgOverrideCount === 0 && (
                                      <p className="text-xs text-muted-foreground">
                                        No org overrides — everyone inherits the plan/default value.
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      className="h-8 font-mono text-xs"
                                      placeholder="organisation id (uuid)"
                                      value={orgInputs[f.key] ?? ""}
                                      onChange={(e) =>
                                        setOrgInputs({ ...orgInputs, [f.key]: e.target.value })
                                      }
                                    />
                                    <Select
                                      value={String(orgValues[f.key] ?? true)}
                                      onValueChange={(v) =>
                                        setOrgValues({ ...orgValues, [f.key]: v === "true" })
                                      }
                                    >
                                      <SelectTrigger className="h-8 w-20">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="true">On</SelectItem>
                                        <SelectItem value="false">Off</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={busy !== null || !(orgInputs[f.key] ?? "").trim()}
                                      onClick={() => addOrgOverride(f)}
                                    >
                                      Add
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New flag dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New feature flag</DialogTitle>
            <DialogDescription>
              Keys are referenced from application code — use snake_case and coordinate with the
              release that consumes the flag.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={doCreate} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="flag-key">Key</Label>
              <Input
                id="flag-key"
                className="font-mono"
                placeholder="e.g. flock_health_v2"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="flag-desc">Description</Label>
              <Input
                id="flag-desc"
                placeholder="What does this flag gate?"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={newDefault} onCheckedChange={setNewDefault} />
              Enabled by default
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy === "create" || !newKey.trim()}>
                {busy === "create" ? "Creating…" : "Create flag"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete flag &quot;{deleteTarget?.key}&quot;?</DialogTitle>
            <DialogDescription>
              Removes the flag and all of its plan/org overrides. Application code reading it will
              fall back to its built-in default.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={doDelete} disabled={busy !== null}>
              {busy ? "Deleting…" : "Delete flag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
