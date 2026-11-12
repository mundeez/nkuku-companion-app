"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useReauth } from "@/components/reauth-modal";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  listPlans,
  updateAnnouncement,
} from "@/lib/api/platform";
import type {
  AnnouncementAudience,
  AnnouncementPayload,
  AnnouncementSeverity,
  PlatformAnnouncement,
  PlatformPlan,
} from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";
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
import { Textarea } from "@/components/ui/textarea";
import { Megaphone, Pencil, Plus, Trash2, X } from "lucide-react";

const SEVERITY_STYLES: Record<string, string> = {
  info: "border-blue-500/50 text-blue-400",
  warning: "border-amber-500/50 text-amber-400",
  critical: "border-red-500/50 text-red-400",
};

function isActiveNow(a: PlatformAnnouncement): boolean {
  const now = Date.now();
  const start = a.startsAt ? new Date(a.startsAt).getTime() : null;
  const end = a.endsAt ? new Date(a.endsAt).getTime() : null;
  if (start !== null && start > now) return false;
  if (end !== null && end < now) return false;
  return true;
}

function audienceSummary(a: PlatformAnnouncement): string {
  if (a.audience === "plans") {
    const codes = a.planCodes ?? [];
    return codes.length ? `Plans: ${codes.join(", ")}` : "Plans (none selected)";
  }
  if (a.audience === "orgs") {
    const ids = a.orgIds ?? [];
    return `${ids.length} org${ids.length === 1 ? "" : "s"}`;
  }
  return "All tenants";
}

/** ISO → value for <input type="datetime-local">. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

interface AnnouncementDraft {
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  audience: AnnouncementAudience;
  planCodes: string[];
  orgIds: string[];
  linkUrl: string;
  linkLabel: string;
  startsAt: string; // datetime-local
  endsAt: string;
  isDismissible: boolean;
}

const EMPTY_DRAFT: AnnouncementDraft = {
  title: "",
  body: "",
  severity: "info",
  audience: "all",
  planCodes: [],
  orgIds: [],
  linkUrl: "",
  linkLabel: "",
  startsAt: "",
  endsAt: "",
  isDismissible: true,
};

function draftFrom(a: PlatformAnnouncement): AnnouncementDraft {
  return {
    title: a.title,
    body: a.body,
    severity: (a.severity as AnnouncementSeverity) ?? "info",
    audience: (a.audience as AnnouncementAudience) ?? "all",
    planCodes: a.planCodes ?? [],
    orgIds: a.orgIds ?? [],
    linkUrl: a.linkUrl ?? "",
    linkLabel: a.linkLabel ?? "",
    startsAt: toLocalInput(a.startsAt),
    endsAt: toLocalInput(a.endsAt),
    isDismissible: a.isDismissible,
  };
}

export default function AnnouncementsPage() {
  const router = useRouter();
  const { user, isLoading, hasPermission } = useAuth();
  const { withReauth } = useReauth();

  const [items, setItems] = useState<PlatformAnnouncement[] | null>(null);
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PlatformAnnouncement | null>(null);
  const [draft, setDraft] = useState<AnnouncementDraft>(EMPTY_DRAFT);
  const [orgInput, setOrgInput] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PlatformAnnouncement | null>(null);

  const canWrite = hasPermission("announcements.write");

  const load = useCallback(() => {
    listAnnouncements()
      .then(setItems)
      .catch((e) => setError(e.message));
    listPlans()
      .then((p) => setPlans([...p].sort((a, b) => a.sortOrder - b.sortOrder)))
      .catch(() => setPlans([]));
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

  function openCreate() {
    setEditTarget(null);
    setDraft(EMPTY_DRAFT);
    setOrgInput("");
    setError("");
    setEditorOpen(true);
  }

  function openEdit(a: PlatformAnnouncement) {
    setEditTarget(a);
    setDraft(draftFrom(a));
    setOrgInput("");
    setError("");
    setEditorOpen(true);
  }

  function togglePlanCode(code: string) {
    const has = draft.planCodes.includes(code);
    setDraft({
      ...draft,
      planCodes: has
        ? draft.planCodes.filter((c) => c !== code)
        : [...draft.planCodes, code],
    });
  }

  function addOrgId() {
    const id = orgInput.trim();
    if (!id || draft.orgIds.includes(id)) return;
    setDraft({ ...draft, orgIds: [...draft.orgIds, id] });
    setOrgInput("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy("save");
    const payload: AnnouncementPayload = {
      title: draft.title.trim(),
      body: draft.body,
      severity: draft.severity,
      audience: draft.audience,
      planCodes: draft.audience === "plans" ? draft.planCodes : null,
      orgIds: draft.audience === "orgs" ? draft.orgIds : null,
      linkUrl: draft.linkUrl.trim() || null,
      linkLabel: draft.linkLabel.trim() || null,
      startsAt: fromLocalInput(draft.startsAt),
      endsAt: fromLocalInput(draft.endsAt),
      isDismissible: draft.isDismissible,
    };
    try {
      await withReauth(() =>
        editTarget
          ? updateAnnouncement(editTarget.id, payload)
          : createAnnouncement(payload)
      );
      setNotice(editTarget ? "Announcement updated." : "Announcement created.");
      setEditorOpen(false);
      setEditTarget(null);
      load();
    } catch (e: any) {
      if (e?.code !== "CANCELLED") setError(e.message || "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function doDelete() {
    if (!deleteTarget) return;
    setError("");
    setBusy(`delete:${deleteTarget.id}`);
    try {
      await withReauth(() => deleteAnnouncement(deleteTarget.id));
      setNotice(`Announcement "${deleteTarget.title}" deleted.`);
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
          <h1 className="text-3xl font-bold">Announcements</h1>
          <p className="text-muted-foreground">
            In-app banners shown to tenant users — schedule, target and track dismissals
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New announcement
        </Button>
      </div>

      {notice && (
        <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-400">{notice}</div>
      )}
      {error && !editorOpen && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <Megaphone className="mr-2 inline h-4 w-4" />
            All announcements ({items?.length ?? 0})
          </CardTitle>
          <CardDescription>Includes scheduled and expired entries</CardDescription>
        </CardHeader>
        <CardContent>
          {items === null ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No announcements yet — create the first one.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Title</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Severity</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Audience</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Window</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Dismissals</th>
                    <th className="pb-2 font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => {
                    const active = isActiveNow(a);
                    const upcoming = a.startsAt && new Date(a.startsAt).getTime() > Date.now();
                    return (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="max-w-[280px] py-2.5 pr-4 font-medium">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-block h-2 w-2 shrink-0 rounded-full",
                                active ? "bg-green-500" : upcoming ? "bg-blue-500" : "bg-muted-foreground/40"
                              )}
                              title={active ? "Live now" : upcoming ? "Scheduled" : "Inactive/expired"}
                            />
                            <span className="truncate" title={a.title}>{a.title}</span>
                          </div>
                          {a.linkUrl && (
                            <div className="truncate pl-4 text-xs font-normal text-muted-foreground">
                              ↗ {a.linkLabel || a.linkUrl}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 pr-4">
                          <Badge variant="outline" className={SEVERITY_STYLES[a.severity] ?? ""}>
                            {a.severity}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{audienceSummary(a)}</td>
                        <td className="whitespace-nowrap py-2.5 pr-4 text-xs text-muted-foreground">
                          {a.startsAt || a.endsAt ? (
                            <>
                              {a.startsAt ? formatDateTime(a.startsAt) : "now"}
                              {" → "}
                              {a.endsAt ? formatDateTime(a.endsAt) : "open-ended"}
                            </>
                          ) : (
                            "always on"
                          )}
                        </td>
                        <td className="py-2.5 pr-4">
                          {a.dismissalCount}
                          {!a.isDismissible && (
                            <span className="ml-1 text-xs text-muted-foreground">(sticky)</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy !== null}
                              onClick={() => setDeleteTarget(a)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
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

      {/* Create / edit dialog */}
      <Dialog open={editorOpen} onOpenChange={(v) => !v && setEditorOpen(false)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit announcement" : "New announcement"}</DialogTitle>
            <DialogDescription>
              Target by plan or specific organisations; leave the window empty for an always-on
              banner.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="ann-title">Title</Label>
              <Input
                id="ann-title"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ann-body">Body</Label>
              <Textarea
                id="ann-body"
                rows={4}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Severity</Label>
                <Select
                  value={draft.severity}
                  onValueChange={(v) => setDraft({ ...draft, severity: v as AnnouncementSeverity })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Audience</Label>
                <Select
                  value={draft.audience}
                  onValueChange={(v) => setDraft({ ...draft, audience: v as AnnouncementAudience })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tenants</SelectItem>
                    <SelectItem value="plans">Specific plans</SelectItem>
                    <SelectItem value="orgs">Specific organisations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {draft.audience === "plans" && (
              <div className="space-y-2">
                <Label>Plan codes</Label>
                <div className="flex flex-wrap gap-2">
                  {plans.map((p) => {
                    const on = draft.planCodes.includes(p.code);
                    return (
                      <button
                        key={p.code}
                        type="button"
                        onClick={() => togglePlanCode(p.code)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          on
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {p.name} ({p.code})
                      </button>
                    );
                  })}
                  {plans.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Plan list unavailable — save plan codes via org IDs or retry after the plans
                      endpoint is reachable.
                    </p>
                  )}
                </div>
              </div>
            )}

            {draft.audience === "orgs" && (
              <div className="space-y-2">
                <Label>Organisation IDs</Label>
                <div className="flex gap-2">
                  <Input
                    className="font-mono text-xs"
                    placeholder="organisation id (uuid)"
                    value={orgInput}
                    onChange={(e) => setOrgInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addOrgId();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addOrgId} disabled={!orgInput.trim()}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {draft.orgIds.map((id) => (
                    <Badge key={id} variant="secondary" className="gap-1 font-mono text-xs">
                      {id}
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({ ...draft, orgIds: draft.orgIds.filter((o) => o !== id) })
                        }
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {draft.orgIds.length === 0 && (
                    <p className="text-xs text-muted-foreground">No organisations added yet.</p>
                  )}
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="ann-link-url">Link URL (optional)</Label>
                <Input
                  id="ann-link-url"
                  type="url"
                  placeholder="https://…"
                  value={draft.linkUrl}
                  onChange={(e) => setDraft({ ...draft, linkUrl: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ann-link-label">Link label</Label>
                <Input
                  id="ann-link-label"
                  placeholder="Learn more"
                  value={draft.linkLabel}
                  onChange={(e) => setDraft({ ...draft, linkLabel: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ann-starts">Starts at</Label>
                <Input
                  id="ann-starts"
                  type="datetime-local"
                  value={draft.startsAt}
                  onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ann-ends">Ends at</Label>
                <Input
                  id="ann-ends"
                  type="datetime-local"
                  value={draft.endsAt}
                  onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={draft.isDismissible}
                onCheckedChange={(v) => setDraft({ ...draft, isDismissible: v })}
              />
              Users can dismiss this announcement
            </label>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy === "save" || !draft.title.trim() || !draft.body.trim()}>
                {busy === "save" ? "Saving…" : editTarget ? "Save changes" : "Create announcement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &quot;{deleteTarget?.title}&quot;?</DialogTitle>
            <DialogDescription>
              The banner disappears from tenant apps immediately. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={doDelete} disabled={busy !== null}>
              {busy ? "Deleting…" : "Delete announcement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
