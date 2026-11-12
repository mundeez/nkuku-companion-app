"use client";

import { EntityCrud, useCatalogueBreeds } from "./entity-crud";
import type { CatalogueScheduleItem, CatalogueVaccinationSchedule } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
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

interface ScheduleDraft {
  name: string;
  breedId: string; // "" = generic/all breeds
  isDefault: boolean;
  description: string;
  items: CatalogueScheduleItem[];
}

const NO_BREED = "__none__";

const EMPTY: ScheduleDraft = {
  name: "",
  breedId: "",
  isDefault: false,
  description: "",
  items: [],
};

const EMPTY_ITEM: CatalogueScheduleItem = {
  vaccineName: "",
  vaccineType: "",
  ageDays: 1,
  adminMethod: "",
  sortOrder: 0,
  notes: "",
};

export function SchedulesTab() {
  const breeds = useCatalogueBreeds(true);

  return (
    <EntityCrud<CatalogueVaccinationSchedule, ScheduleDraft>
      entity="vaccination-schedules"
      title="Vaccination Schedules"
      description="Reusable vaccination calendars tenants attach to flocks"
      searchPlaceholder="Search schedule name…"
      searchText={(s) => `${s.name} ${s.description ?? ""}`}
      createLabel="New schedule"
      columns={[
        {
          header: "Name",
          cell: (s) => (
            <span className="font-medium">
              {s.name}
              {s.isDefault && (
                <Badge variant="default" className="ml-2">
                  default
                </Badge>
              )}
            </span>
          ),
        },
        {
          header: "Breed",
          cell: (s) =>
            s.breedId ? (
              <span className="text-muted-foreground">
                {breeds.find((b) => b.id === s.breedId)?.name ?? s.breedId.slice(0, 8) + "…"}
              </span>
            ) : (
              <span className="text-muted-foreground">All breeds</span>
            ),
        },
        {
          header: "Items",
          cell: (s) => `${s.items?.length ?? 0} vaccines`,
        },
        {
          header: "Schedule",
          className: "max-w-[280px]",
          cell: (s) => (
            <span className="block truncate text-xs text-muted-foreground">
              {(s.items ?? [])
                .slice()
                .sort((a, b) => a.ageDays - b.ageDays)
                .map((i) => `d${i.ageDays} ${i.vaccineName}`)
                .join(" · ") || "—"}
            </span>
          ),
        },
      ]}
      emptyDraft={() => ({ ...EMPTY, items: [{ ...EMPTY_ITEM }] })}
      draftFrom={(s) => ({
        name: s.name,
        breedId: s.breedId ?? "",
        isDefault: s.isDefault,
        description: s.description ?? "",
        items: (s.items ?? [])
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder || a.ageDays - b.ageDays)
          .map((i) => ({
            id: i.id,
            vaccineName: i.vaccineName,
            vaccineType: i.vaccineType,
            ageDays: i.ageDays,
            adminMethod: i.adminMethod,
            sortOrder: i.sortOrder,
            notes: i.notes ?? "",
          })),
      })}
      toPayload={(d) => ({
        name: d.name.trim(),
        breedId: d.breedId || null,
        isDefault: d.isDefault,
        description: d.description.trim() || null,
        items: d.items
          .filter((i) => i.vaccineName.trim())
          .map((i, idx) => ({
            vaccineName: i.vaccineName.trim(),
            vaccineType: i.vaccineType.trim() || "other",
            ageDays: Number(i.ageDays) || 0,
            adminMethod: i.adminMethod.trim() || "other",
            sortOrder: idx,
            notes: i.notes?.trim() || null,
          })),
      })}
      canSubmit={(d) => !!d.name.trim()}
      dialogTitle={(s) => (s ? `Edit schedule — ${s.name}` : "New vaccination schedule")}
      dialogDescription="Items replace the whole list on save — remove rows to delete them."
      dialogClassName="max-h-[90vh] max-w-4xl overflow-y-auto"
      renderFields={(draft, setDraft, editing) => (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="s-name">Name</Label>
              <Input
                id="s-name"
                placeholder="e.g. Standard Botswana"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Breed</Label>
              <Select
                value={draft.breedId || NO_BREED}
                onValueChange={(v) => setDraft({ ...draft, breedId: v === NO_BREED ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All breeds" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BREED}>All breeds (generic)</SelectItem>
                  {breeds.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="s-desc">Description</Label>
            <Textarea
              id="s-desc"
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={draft.isDefault}
              onCheckedChange={(v) => setDraft({ ...draft, isDefault: v })}
            />
            Default schedule for new flocks
          </label>

          {/* Items editor */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Schedule items ({draft.items.length})</Label>
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
                No items — add the first vaccine.
              </p>
            ) : (
              <div className="space-y-2">
                {draft.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_1fr_72px_1fr_1fr_32px] items-center gap-2 rounded-md border p-2"
                  >
                    <Input
                      className="h-8"
                      placeholder="Vaccine name"
                      value={item.vaccineName}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          items: draft.items.map((x, j) =>
                            j === idx ? { ...x, vaccineName: e.target.value } : x
                          ),
                        })
                      }
                    />
                    <Input
                      className="h-8"
                      placeholder="Type (e.g. live)"
                      value={item.vaccineType}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          items: draft.items.map((x, j) =>
                            j === idx ? { ...x, vaccineType: e.target.value } : x
                          ),
                        })
                      }
                    />
                    <Input
                      className="h-8"
                      type="number"
                      min={0}
                      title="Day of age"
                      placeholder="Day"
                      value={item.ageDays}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          items: draft.items.map((x, j) =>
                            j === idx ? { ...x, ageDays: Number(e.target.value) } : x
                          ),
                        })
                      }
                    />
                    <Input
                      className="h-8"
                      placeholder="Method (e.g. eye drop)"
                      value={item.adminMethod}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          items: draft.items.map((x, j) =>
                            j === idx ? { ...x, adminMethod: e.target.value } : x
                          ),
                        })
                      }
                    />
                    <Input
                      className="h-8"
                      placeholder="Notes (optional)"
                      value={item.notes ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          items: draft.items.map((x, j) =>
                            j === idx ? { ...x, notes: e.target.value } : x
                          ),
                        })
                      }
                    />
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
                <div className="grid grid-cols-[1fr_1fr_72px_1fr_1fr_32px] gap-2 px-2 text-[11px] text-muted-foreground">
                  <span>Vaccine</span>
                  <span>Type</span>
                  <span>Day</span>
                  <span>Method</span>
                  <span>Notes</span>
                  <span></span>
                </div>
              </div>
            )}
            {editing && (
              <p className="mt-2 text-xs text-muted-foreground">
                Existing rows without changes keep their values; the full list is sent on save.
              </p>
            )}
          </div>
        </>
      )}
    />
  );
}
