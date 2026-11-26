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
  supportiveTreatments: string;
  imageUrl: string;
  videoUrl: string;
  videoProvider: string;
  sourcesJson: string;
  regionalNotesJson: string;
  evidenceJson: string;
}

const EMPTY: DiseaseDraft = {
  name: "",
  category: "",
  incubation: "",
  mortalityRate: "",
  symptoms: "",
  prevention: "",
  treatment: "",
  supportiveTreatments: "",
  imageUrl: "",
  videoUrl: "",
  videoProvider: "",
  sourcesJson: "",
  regionalNotesJson: "",
  evidenceJson: "",
};

const TEXT_FIELDS: { key: keyof DiseaseDraft; label: string; textarea?: boolean }[] = [
  { key: "incubation", label: "Incubation period" },
  { key: "mortalityRate", label: "Mortality rate" },
  { key: "symptoms", label: "Symptoms", textarea: true },
  { key: "prevention", label: "Prevention", textarea: true },
  { key: "treatment", label: "Treatment", textarea: true },
  { key: "supportiveTreatments", label: "Supportive & traditional care", textarea: true },
];

function parseJsonField<T>(raw: string, field: string): T | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(`${field} is not valid JSON`);
  }
}

function jsonOrEmpty(value: unknown): string {
  return value == null ? "" : JSON.stringify(value, null, 2);
}

export function DiseasesTab() {
  return (
    <EntityCrud<CatalogueDisease, DiseaseDraft>
      entity="diseases"
      title="Diseases"
      description="Global disease reference — symptoms, prevention, treatments, media, sources and regional notes"
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
        {
          header: "Media",
          cell: (d) => (
            <span className="text-muted-foreground">
              {[d.imageUrl ? "img" : null, d.videoUrl ? "vid" : null].filter(Boolean).join(" + ") || "—"}
            </span>
          ),
        },
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
        supportiveTreatments: d.supportiveTreatments ?? "",
        imageUrl: d.imageUrl ?? "",
        videoUrl: d.videoUrl ?? "",
        videoProvider: d.videoProvider ?? "",
        sourcesJson: jsonOrEmpty(d.sources),
        regionalNotesJson: jsonOrEmpty(d.regionalNotes),
        evidenceJson: jsonOrEmpty(d.evidence),
      })}
      toPayload={(d) => ({
        name: d.name.trim(),
        category: d.category.trim(),
        incubation: d.incubation.trim() || undefined,
        mortalityRate: d.mortalityRate.trim() || undefined,
        symptoms: d.symptoms.trim() || undefined,
        prevention: d.prevention.trim() || undefined,
        treatment: d.treatment.trim() || undefined,
        supportiveTreatments: d.supportiveTreatments.trim() || undefined,
        // Explicit null clears media fields (PATCH/POST accept null).
        imageUrl: d.imageUrl.trim() || null,
        videoUrl: d.videoUrl.trim() || null,
        videoProvider: d.videoProvider || null,
        sources: parseJsonField(d.sourcesJson, "Sources"),
        regionalNotes: parseJsonField(d.regionalNotesJson, "Regional notes"),
        evidence: parseJsonField(d.evidenceJson, "Evidence"),
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
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="d-imageUrl">Image URL (https)</Label>
              <Input
                id="d-imageUrl"
                placeholder="https://…"
                value={draft.imageUrl}
                onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="d-videoUrl">Video URL (https)</Label>
              <Input
                id="d-videoUrl"
                placeholder="https://…"
                value={draft.videoUrl}
                onChange={(e) => setDraft({ ...draft, videoUrl: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="d-videoProvider">Video provider</Label>
              <select
                id="d-videoProvider"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft.videoProvider}
                onChange={(e) => setDraft({ ...draft, videoProvider: e.target.value })}
              >
                <option value="">—</option>
                <option value="youtube">YouTube</option>
                <option value="vimeo">Vimeo</option>
                <option value="external">External</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-sourcesJson">Sources (JSON array)</Label>
            <Textarea
              id="d-sourcesJson"
              rows={4}
              className="font-mono text-xs"
              placeholder='[{"title":"…","url":"https://…","publisher":"…","type":"government"}]'
              value={draft.sourcesJson}
              onChange={(e) => setDraft({ ...draft, sourcesJson: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-regionalNotesJson">Regional notes (JSON object, ISO country codes + "general")</Label>
            <Textarea
              id="d-regionalNotesJson"
              rows={4}
              className="font-mono text-xs"
              placeholder='{"general":"…","ZM":"…","KE":"…"}'
              value={draft.regionalNotesJson}
              onChange={(e) => setDraft({ ...draft, regionalNotesJson: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-evidenceJson">Evidence levels (JSON object)</Label>
            <Textarea
              id="d-evidenceJson"
              rows={3}
              className="font-mono text-xs"
              placeholder='{"prevention":"veterinary-recommended","treatment":"standard-practice","supportiveTreatments":"traditional-limited-evidence"}'
              value={draft.evidenceJson}
              onChange={(e) => setDraft({ ...draft, evidenceJson: e.target.value })}
            />
          </div>
        </>
      )}
    />
  );
}
