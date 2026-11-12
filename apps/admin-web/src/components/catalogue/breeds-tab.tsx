"use client";

import { EntityCrud } from "./entity-crud";
import type { CatalogueBreed } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface BreedDraft {
  name: string;
  supplier: string;
  isPrimary: boolean;
}

const EMPTY: BreedDraft = { name: "", supplier: "", isPrimary: false };

export function BreedsTab() {
  return (
    <EntityCrud<CatalogueBreed, BreedDraft>
      entity="breeds"
      title="Breeds"
      description="Broiler breeds offered to tenants (e.g. Ross 308, Cobb 500)"
      searchPlaceholder="Search breed or supplier…"
      searchText={(b) => `${b.name} ${b.supplier}`}
      createLabel="New breed"
      columns={[
        {
          header: "Name",
          cell: (b) => (
            <span className="font-medium">
              {b.name}
              {b.isPrimary && (
                <Badge variant="default" className="ml-2">
                  primary
                </Badge>
              )}
            </span>
          ),
        },
        { header: "Supplier", cell: (b) => b.supplier },
        {
          header: "Targets",
          cell: (b) => (
            <span className="text-muted-foreground">
              {b.performanceTargets?.length ?? 0} day-rows
            </span>
          ),
        },
      ]}
      emptyDraft={() => ({ ...EMPTY })}
      draftFrom={(b) => ({ name: b.name, supplier: b.supplier, isPrimary: b.isPrimary })}
      toPayload={(d) => ({
        name: d.name.trim(),
        supplier: d.supplier.trim(),
        isPrimary: d.isPrimary,
      })}
      canSubmit={(d) => !!d.name.trim() && !!d.supplier.trim()}
      dialogTitle={(b) => (b ? `Edit breed — ${b.name}` : "New breed")}
      renderFields={(draft, setDraft) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="b-name">Name</Label>
              <Input
                id="b-name"
                placeholder="e.g. Ross 308"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="b-supplier">Supplier</Label>
              <Input
                id="b-supplier"
                placeholder="e.g. Aviagen"
                value={draft.supplier}
                onChange={(e) => setDraft({ ...draft, supplier: e.target.value })}
                required
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={draft.isPrimary}
              onCheckedChange={(v) => setDraft({ ...draft, isPrimary: v })}
            />
            Primary breed (pre-selected for new flocks)
          </label>
        </>
      )}
    />
  );
}
