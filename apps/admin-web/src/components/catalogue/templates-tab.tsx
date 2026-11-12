"use client";

import { ActiveBadge, EntityCrud } from "./entity-crud";
import type {
  CatalogueSupplierTemplate,
  CatalogueTemplateItem,
  TemplateItemType,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X } from "lucide-react";

interface TemplateDraft {
  category: string;
  name: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
  items: CatalogueTemplateItem[];
}

const ITEM_TYPES: { value: TemplateItemType; label: string }[] = [
  { value: "feed", label: "Feed" },
  { value: "chick", label: "Chick" },
  { value: "medication", label: "Medication" },
  { value: "other", label: "Other" },
];

const EMPTY: TemplateDraft = {
  category: "",
  name: "",
  description: "",
  sortOrder: "0",
  isActive: true,
  items: [],
};

const EMPTY_ITEM: CatalogueTemplateItem = {
  itemName: "",
  itemType: "feed",
  sortOrder: 0,
  isRequired: true,
  isActive: true,
};

export function TemplatesTab() {
  return (
    <EntityCrud<CatalogueSupplierTemplate, TemplateDraft>
      entity="supplier-category-templates"
      title="Category Templates"
      description="Supplier-category intake forms — the line items tenants fill per supplier"
      searchPlaceholder="Search template name or category…"
      searchText={(t) => `${t.name} ${t.category} ${t.description ?? ""}`}
      createLabel="New template"
      columns={[
        { header: "Name", cell: (t) => <span className="font-medium">{t.name}</span> },
        { header: "Category", cell: (t) => <code className="text-xs">{t.category}</code> },
        { header: "Items", cell: (t) => `${t.items?.length ?? 0}` },
        { header: "Sort", cell: (t) => <span className="text-muted-foreground">{t.sortOrder}</span> },
        { header: "Status", cell: (t) => <ActiveBadge active={t.isActive} /> },
      ]}
      emptyDraft={() => ({ ...EMPTY, items: [{ ...EMPTY_ITEM }] })}
      draftFrom={(t) => ({
        category: t.category,
        name: t.name,
        description: t.description ?? "",
        sortOrder: String(t.sortOrder ?? 0),
        isActive: t.isActive,
        items: (t.items ?? [])
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((i) => ({
            id: i.id,
            itemName: i.itemName,
            itemType: i.itemType,
            sortOrder: i.sortOrder,
            isRequired: i.isRequired,
            isActive: i.isActive ?? true,
          })),
      })}
      toPayload={(d, editing) => ({
        // Category is the unique key — only send on create.
        ...(editing ? {} : { category: d.category.trim() }),
        name: d.name.trim(),
        description: d.description.trim() || null,
        sortOrder: parseInt(d.sortOrder, 10) || 0,
        isActive: d.isActive,
        items: d.items
          .filter((i) => i.itemName.trim())
          .map((i, idx) => ({
            itemName: i.itemName.trim(),
            itemType: i.itemType,
            sortOrder: idx,
            isRequired: i.isRequired,
            isActive: i.isActive ?? true,
          })),
      })}
      canSubmit={(d) => !!d.name.trim() && !!d.category.trim()}
      dialogTitle={(t) => (t ? `Edit template — ${t.name}` : "New category template")}
      dialogDescription="Items replace the whole list on save — remove rows to delete them."
      dialogClassName="max-h-[90vh] max-w-3xl overflow-y-auto"
      renderFields={(draft, setDraft, editing) => (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="ct-category">Category key</Label>
              <Input
                id="ct-category"
                className="font-mono"
                placeholder="e.g. feed, chicks, vet"
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                required
                disabled={!!editing}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="ct-name">Name</Label>
              <Input
                id="ct-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="ct-desc">Description</Label>
              <Textarea
                id="ct-desc"
                rows={2}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ct-sort">Sort order</Label>
              <Input
                id="ct-sort"
                type="number"
                value={draft.sortOrder}
                onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={draft.isActive}
              onCheckedChange={(v) => setDraft({ ...draft, isActive: v })}
            />
            Active
          </label>

          {/* Items editor */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Line items ({draft.items.length})</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDraft({ ...draft, items: [...draft.items, { ...EMPTY_ITEM }] })}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add item
              </Button>
            </div>
            {draft.items.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                No items — add the first line item.
              </p>
            ) : (
              <div className="space-y-2">
                {draft.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_140px_96px_32px] items-center gap-2 rounded-md border p-2"
                  >
                    <Input
                      className="h-8"
                      placeholder="Item name (e.g. Starter Crumble)"
                      value={item.itemName}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          items: draft.items.map((x, j) =>
                            j === idx ? { ...x, itemName: e.target.value } : x
                          ),
                        })
                      }
                    />
                    <Select
                      value={String(item.itemType)}
                      onValueChange={(v) =>
                        setDraft({
                          ...draft,
                          items: draft.items.map((x, j) =>
                            j === idx ? { ...x, itemType: v } : x
                          ),
                        })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEM_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={item.isRequired}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            items: draft.items.map((x, j) =>
                              j === idx ? { ...x, isRequired: e.target.checked } : x
                            ),
                          })
                        }
                      />
                      Required
                    </label>
                    <button
                      type="button"
                      title="Remove item"
                      onClick={() =>
                        setDraft({ ...draft, items: draft.items.filter((_, j) => j !== idx) })
                      }
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    />
  );
}
