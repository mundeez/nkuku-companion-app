"use client";

import { EntityCrud, useCatalogueBreeds } from "./entity-crud";
import type { CataloguePerformanceTarget } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TargetDraft {
  breedId: string;
  ageDays: string;
  targetWeight: string;
  targetFeed: string;
  targetFcr: string;
  targetWater: string;
}

const EMPTY: TargetDraft = {
  breedId: "",
  ageDays: "",
  targetWeight: "",
  targetFeed: "",
  targetFcr: "",
  targetWater: "",
};

/** Decimal fields may serialise as strings from Prisma — coerce for display. */
function num(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

export function TargetsTab() {
  const breeds = useCatalogueBreeds(true);

  return (
    <EntityCrud<CataloguePerformanceTarget, TargetDraft>
      entity="performance-targets"
      title="Performance Targets"
      description="Daily breed growth/feed/FCR benchmarks (e.g. official Aviagen tables)"
      searchPlaceholder="Search breed or day…"
      searchText={(t) =>
        `${breeds.find((b) => b.id === t.breedId)?.name ?? t.breed?.name ?? ""} day ${t.ageDays}`
      }
      createLabel="New target"
      columns={[
        {
          header: "Breed",
          cell: (t) => (
            <span className="font-medium">
              {breeds.find((b) => b.id === t.breedId)?.name ?? t.breed?.name ?? t.breedId.slice(0, 8)}
            </span>
          ),
        },
        { header: "Day", cell: (t) => t.ageDays },
        { header: "Weight (g)", cell: (t) => num(t.targetWeight) },
        { header: "Feed (g)", cell: (t) => num(t.targetFeed) },
        { header: "FCR", cell: (t) => num(t.targetFcr) },
        { header: "Water (ml)", cell: (t) => num(t.targetWater) || "—" },
      ]}
      emptyDraft={() => ({ ...EMPTY })}
      draftFrom={(t) => ({
        breedId: t.breedId,
        ageDays: String(t.ageDays),
        targetWeight: num(t.targetWeight),
        targetFeed: num(t.targetFeed),
        targetFcr: num(t.targetFcr),
        targetWater: num(t.targetWater),
      })}
      toPayload={(d) => ({
        breedId: d.breedId,
        ageDays: parseInt(d.ageDays, 10),
        targetWeight: Number(d.targetWeight),
        targetFeed: Number(d.targetFeed),
        targetFcr: Number(d.targetFcr),
        ...(d.targetWater.trim() ? { targetWater: Number(d.targetWater) } : {}),
      })}
      canSubmit={(d) =>
        !!d.breedId &&
        d.ageDays.trim() !== "" &&
        d.targetWeight.trim() !== "" &&
        d.targetFeed.trim() !== "" &&
        d.targetFcr.trim() !== ""
      }
      dialogTitle={(t) =>
        t ? `Edit target — day ${t.ageDays}` : "New performance target"
      }
      dialogDescription="One row per breed per day-of-age — the (breed, day) pair must be unique."
      renderFields={(draft, setDraft, editing) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Breed</Label>
              <Select
                value={draft.breedId || undefined}
                onValueChange={(v) => setDraft({ ...draft, breedId: v })}
                disabled={!!editing} /* breed+day is the natural key — keep it stable on edit */
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select breed" />
                </SelectTrigger>
                <SelectContent>
                  {breeds.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="t-day">Day of age</Label>
              <Input
                id="t-day"
                type="number"
                min={0}
                max={200}
                value={draft.ageDays}
                onChange={(e) => setDraft({ ...draft, ageDays: e.target.value })}
                required
                disabled={!!editing}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="t-weight">Target weight (g)</Label>
              <Input
                id="t-weight"
                type="number"
                min={0}
                step="0.001"
                value={draft.targetWeight}
                onChange={(e) => setDraft({ ...draft, targetWeight: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="t-feed">Target cumulative feed (g)</Label>
              <Input
                id="t-feed"
                type="number"
                min={0}
                step="0.001"
                value={draft.targetFeed}
                onChange={(e) => setDraft({ ...draft, targetFeed: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="t-fcr">Target FCR</Label>
              <Input
                id="t-fcr"
                type="number"
                min={0}
                step="0.001"
                value={draft.targetFcr}
                onChange={(e) => setDraft({ ...draft, targetFcr: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="t-water">Target water (ml, optional)</Label>
              <Input
                id="t-water"
                type="number"
                min={0}
                step="0.001"
                value={draft.targetWater}
                onChange={(e) => setDraft({ ...draft, targetWater: e.target.value })}
              />
            </div>
          </div>
        </>
      )}
    />
  );
}
