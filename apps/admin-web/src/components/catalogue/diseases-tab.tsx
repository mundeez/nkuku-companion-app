"use client";

import { EntityCrud } from "./entity-crud";
import type { CatalogueDisease } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface DiseaseDraft {
  name: string;
  category: string;
  incubation: string;
  mortalityRate: string;
  symptoms: string;
  prevention: string;
  treatment: string;
  organicTreatments: string;
}

const EMPTY: DiseaseDraft = {
  name: "",
  category: "",
  incubation: "",
  mortalityRate: "",
  symptoms: "",
  prevention: "",
  treatment: "",
  organicTreatments: "",
};

const TEXT_FIELDS: { key: keyof DiseaseDraft; label: string; textarea?: boolean }[] = [
  { key: "incubation", label: "Incubation period" },
  { key: "mortalityRate", label: "Mortality rate" },
  { key: "symptoms", label: "Symptoms", textarea: true },
  { key: "prevention", label: "Prevention", textarea: true },
  { key: "treatment", label: "Treatment", textarea: true },
  { key: "organicTreatments", label: "Organic treatments", textarea: true },
];

export function DiseasesTab() {
  return (
    <EntityCrud<CatalogueDisease, DiseaseDraft>
      entity="diseases"
      title="Diseases"
      description="Global disease reference — symptoms, prevention and organic treatments"
      searchPlaceholder="Search name, category, symptoms…"
      searchText={(d) => `${d.name} ${d.category} ${d.symptoms ?? ""}`}
      createLabel="New disease"
      columns={[
        { header: "Name", cell: (d) => <span className="font-medium">{d.name}</span> },
        { header: "Category", cell: (d) => <Badge variant="secondary">{d.category}</Badge> },
        {
          header: "Symptoms",
          className: "max-w-[320px]",
          cell: (d) => (
            <span className="block truncate text-muted-foreground" title={d.symptoms ?? ""}>
              {d.symptoms ?? "—"}
            </span>
          ),
        },
        { header: "Mortality", cell: (d) => d.mortalityRate ?? "—" },
      ]}
      emptyDraft={() => ({ ...EMPTY })}
      draftFrom={(d) => ({
        name: d.name,
        category: d.category,
        incubation: d.incubation ?? "",
        mortalityRate: d.mortalityRate ?? "",
        symptoms: d.symptoms ?? "",
        prevention: d.prevention ?? "",
        treatment: d.treatment ?? "",
        organicTreatments: d.organicTreatments ?? "",
      })}
      toPayload={(d) => ({
        name: d.name.trim(),
        category: d.category.trim(),
        incubation: d.incubation.trim() || undefined,
        mortalityRate: d.mortalityRate.trim() || undefined,
        symptoms: d.symptoms.trim() || undefined,
        prevention: d.prevention.trim() || undefined,
        treatment: d.treatment.trim() || undefined,
        organicTreatments: d.organicTreatments.trim() || undefined,
      })}
      canSubmit={(d) => !!d.name.trim() && !!d.category.trim()}
      dialogTitle={(d) => (d ? `Edit disease — ${d.name}` : "New disease")}
      renderFields={(draft, setDraft) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="d-name">Name</Label>
              <Input
                id="d-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="d-category">Category</Label>
              <Input
                id="d-category"
                placeholder="e.g. Viral, Bacterial, Parasitic"
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {TEXT_FIELDS.slice(0, 2).map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={`d-${f.key}`}>{f.label}</Label>
                <Input
                  id={`d-${f.key}`}
                  value={draft[f.key]}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          {TEXT_FIELDS.slice(2).map((f) => (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={`d-${f.key}`}>{f.label}</Label>
              <Textarea
                id={`d-${f.key}`}
                rows={2}
                value={draft[f.key]}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              />
            </div>
          ))}
        </>
      )}
    />
  );
}
