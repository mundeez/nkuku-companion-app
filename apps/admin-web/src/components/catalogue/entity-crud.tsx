"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useReauth } from "@/components/reauth-modal";
import {
  createCatalogueItem,
  deleteCatalogueItem,
  listCatalogue,
  updateCatalogueItem,
  type CatalogueEntity,
} from "@/lib/api/platform";
import type { CatalogueBreed } from "@/lib/types";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";

export interface ColumnDef<T> {
  header: React.ReactNode;
  cell: (item: T) => React.ReactNode;
  className?: string;
}

export interface EntityCrudProps<T extends { id: string }, D> {
  entity: CatalogueEntity;
  title: string;
  description: string;
  searchPlaceholder: string;
  /** Plain-text haystack used by the client-side search box. */
  searchText: (item: T) => string;
  columns: ColumnDef<T>[];
  createLabel: string;
  emptyDraft: () => D;
  draftFrom: (item: T) => D;
  toPayload: (draft: D, editing: T | null) => Record<string, any>;
  renderFields: (draft: D, setDraft: (d: D) => void, editing: T | null) => React.ReactNode;
  dialogTitle?: (editing: T | null) => string;
  dialogDescription?: string;
  dialogClassName?: string;
  canSubmit?: (draft: D) => boolean;
}

/** Shared catalogue tab shell: fetch + client-side search + table +
 *  create/edit dialog + delete confirm. Each entity supplies columns,
 *  draft shape and the form fields. */
export function EntityCrud<T extends { id: string }, D>(props: EntityCrudProps<T, D>) {
  const { withReauth } = useReauth();
  const [items, setItems] = useState<T[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [draft, setDraft] = useState<D>(props.emptyDraft());
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);

  const load = useCallback(() => {
    listCatalogue<T>(props.entity)
      .then(setItems)
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.entity]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!items) return null;
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => props.searchText(i).toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search]);

  function openCreate() {
    setEditing(null);
    setDraft(props.emptyDraft());
    setFormError("");
    setEditorOpen(true);
  }

  function openEdit(item: T) {
    setEditing(item);
    setDraft(props.draftFrom(item));
    setFormError("");
    setEditorOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setBusy("save");
    try {
      const payload = props.toPayload(draft, editing);
      await withReauth(() =>
        editing
          ? updateCatalogueItem(props.entity, editing.id, payload)
          : createCatalogueItem(props.entity, payload)
      );
      setNotice(editing ? "Saved." : "Created.");
      setEditorOpen(false);
      setEditing(null);
      load();
    } catch (e: any) {
      if (e?.code !== "CANCELLED") setFormError(e.message || "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function doDelete() {
    if (!deleteTarget) return;
    setError("");
    setBusy(`delete:${deleteTarget.id}`);
    try {
      await withReauth(() => deleteCatalogueItem(props.entity, deleteTarget.id));
      setNotice("Deleted.");
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      if (e?.code !== "CANCELLED") setError(e.message || "Delete failed");
    } finally {
      setBusy(null);
    }
  }

  const submitOk = props.canSubmit ? props.canSubmit(draft) : true;

  return (
    <div className="space-y-4">
      {notice && (
        <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-400">{notice}</div>
      )}
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">
                {props.title} ({filtered?.length ?? 0}
                {items && filtered && filtered.length !== items.length ? ` of ${items.length}` : ""})
              </CardTitle>
              <CardDescription>{props.description}</CardDescription>
            </div>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> {props.createLabel}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={props.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filtered === null ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {search ? "No matches." : "Nothing here yet."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    {props.columns.map((c, i) => (
                      <th
                        key={i}
                        className={`pb-2 pr-4 font-medium text-muted-foreground ${c.className ?? ""}`}
                      >
                        {c.header}
                      </th>
                    ))}
                    <th className="pb-2 font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      {props.columns.map((c, i) => (
                        <td key={i} className={`py-2.5 pr-4 ${c.className ?? ""}`}>
                          {c.cell(item)}
                        </td>
                      ))}
                      <td className="py-2.5">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy !== null}
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / edit dialog */}
      <Dialog open={editorOpen} onOpenChange={(v) => !v && setEditorOpen(false)}>
        <DialogContent className={props.dialogClassName ?? "max-h-[90vh] max-w-2xl overflow-y-auto"}>
          <DialogHeader>
            <DialogTitle>
              {props.dialogTitle ? props.dialogTitle(editing) : editing ? "Edit" : "Create"}
            </DialogTitle>
            {props.dialogDescription && (
              <DialogDescription>{props.dialogDescription}</DialogDescription>
            )}
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            {props.renderFields(draft, setDraft, editing)}
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy === "save" || !submitOk}>
                {busy === "save" ? "Saving…" : editing ? "Save changes" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this {props.title.toLowerCase().replace(/s$/, "")}?</DialogTitle>
            <DialogDescription>
              This is global reference data — deleting it affects every tenant. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={doDelete} disabled={busy !== null}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Breeds are needed as a foreign key by several catalogue tabs — share one fetch. */
export function useCatalogueBreeds(enabled: boolean) {
  const [breeds, setBreeds] = useState<CatalogueBreed[]>([]);
  useEffect(() => {
    if (!enabled) return;
    listCatalogue<CatalogueBreed>("breeds")
      .then(setBreeds)
      .catch(() => setBreeds([]));
  }, [enabled]);
  return breeds;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "default" : "secondary"}>{active ? "active" : "inactive"}</Badge>
  );
}
