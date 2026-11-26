"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { useApiQuery } from "@/lib/api/hooks";
import { Disease, DiseaseEvidenceLevel, OrganizationSettings } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search, HeartPulse, X, ExternalLink, MapPin, BookOpen, AlertTriangle,
} from "lucide-react";

const EVIDENCE_LABELS: Record<DiseaseEvidenceLevel, string> = {
  "veterinary-recommended": "Veterinary recommended",
  "standard-practice": "Standard practice",
  "traditional-limited-evidence": "Traditional — limited evidence",
};

const EVIDENCE_VARIANTS: Record<DiseaseEvidenceLevel, "default" | "secondary" | "outline"> = {
  "veterinary-recommended": "default",
  "standard-practice": "secondary",
  "traditional-limited-evidence": "outline",
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  "peer-reviewed": "Peer-reviewed",
  "government": "Government / OIE",
  "university-extension": "University extension",
  "industry": "Industry reference",
  "ngo": "NGO / International org",
};

function videoEmbedUrl(disease: Disease): string | null {
  if (!disease.videoUrl || !disease.videoProvider) return null;
  // Server validates canonical forms; derive defensively anyway.
  if (disease.videoProvider === "youtube") {
    return disease.videoUrl.includes("/embed/") ? disease.videoUrl : null;
  }
  if (disease.videoProvider === "vimeo") {
    const m =
      disease.videoUrl.match(/player\.vimeo\.com\/video\/(\d+)/) ??
      disease.videoUrl.match(/vimeo\.com\/(\d+)/);
    return m ? `https://player.vimeo.com/video/${m[1]}` : null;
  }
  return null;
}

export default function DiseasesPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [diseases, setDiseases] = useState<Disease[]>([]);
  const [filtered, setFiltered] = useState<Disease[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [selectedDisease, setSelectedDisease] = useState<Disease | null>(null);
  const [regionOverride, setRegionOverride] = useState<string | null>(null);
  const { data: org } = useApiQuery<OrganizationSettings>("/api/v1/organizations/me");

  const orgCountry = org?.country?.toUpperCase();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      apiFetch<Disease[]>("/api/v1/diseases")
        .then((d) => { setDiseases(d); setFiltered(d); setCategories(["All", ...Array.from(new Set(d.map((x) => x.category)))]); })
        .catch((err) => setError(err.message));
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    let result = diseases;
    if (selectedCategory !== "All") result = result.filter((d) => d.category === selectedCategory);
    if (search) result = result.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()) || (d.symptoms && d.symptoms.toLowerCase().includes(search.toLowerCase())));
    setFiltered(result);
  }, [search, selectedCategory, diseases]);

  const regionalNote = useMemo(() => {
    if (!selectedDisease?.regionalNotes) return null;
    const notes = selectedDisease.regionalNotes;
    const key = regionOverride ?? orgCountry;
    if (key && notes[key]) return { code: key, text: notes[key] };
    if (notes.general) return { code: "general", text: notes.general };
    const first = Object.entries(notes)[0];
    return first ? { code: first[0], text: first[1] } : null;
  }, [selectedDisease, regionOverride, orgCountry]);

  const regionalOptions = useMemo(() => {
    if (!selectedDisease?.regionalNotes) return [] as string[];
    const keys = Object.keys(selectedDisease.regionalNotes).filter((k) => k !== "general");
    return keys.sort();
  }, [selectedDisease]);

  const embedUrl = selectedDisease ? videoEmbedUrl(selectedDisease) : null;

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Disease Database</h1>
        <p className="text-muted-foreground">Common poultry diseases, symptoms, prevention, and treatments — with cited sources and regional notes</p>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Search diseases or symptoms..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <Badge key={cat} variant={selectedCategory === cat ? "default" : "outline"} className="cursor-pointer" onClick={() => setSelectedCategory(cat)}>
              {cat}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((disease) => (
          <Card key={disease.id} className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden" onClick={() => { setSelectedDisease(disease); setRegionOverride(null); }}>
            {disease.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={disease.imageUrl} alt={disease.name} className="h-40 w-full object-cover" loading="lazy" />
            )}
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{disease.name}</CardTitle>
                <Badge variant="secondary">{disease.category}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {disease.symptoms && <p className="text-sm text-muted-foreground line-clamp-2">{disease.symptoms}</p>}
              {disease.mortalityRate && <p className="text-sm text-red-600 mt-2">Mortality: {disease.mortalityRate}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && <div className="text-center py-12"><HeartPulse className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">No diseases found matching your search.</p></div>}

      {selectedDisease && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedDisease(null)}>
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {selectedDisease.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedDisease.imageUrl} alt={selectedDisease.name} className="w-full h-56 object-cover" />
            )}
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{selectedDisease.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{selectedDisease.category}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedDisease(null)}><X className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedDisease.incubation && <div><h4 className="font-medium mb-1">Incubation</h4><p className="text-sm text-muted-foreground">{selectedDisease.incubation}</p></div>}
              {selectedDisease.mortalityRate && <div><h4 className="font-medium mb-1">Mortality Rate</h4><p className="text-sm text-red-600">{selectedDisease.mortalityRate}</p></div>}
              {selectedDisease.symptoms && <div><h4 className="font-medium mb-1">Symptoms</h4><p className="text-sm text-muted-foreground">{selectedDisease.symptoms}</p></div>}

              {embedUrl && (
                <div>
                  <h4 className="font-medium mb-1">Video</h4>
                  <div className="aspect-video rounded-lg overflow-hidden border">
                    <iframe src={embedUrl} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                  </div>
                </div>
              )}
              {selectedDisease.videoUrl && !embedUrl && (
                <div>
                  <h4 className="font-medium mb-1">Video</h4>
                  <a href={selectedDisease.videoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary inline-flex items-center gap-1 hover:underline">
                    Watch video <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {selectedDisease.evidence && Object.keys(selectedDisease.evidence).length > 0 && (
                <div>
                  <h4 className="font-medium mb-1">Evidence level</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(selectedDisease.evidence).map(([section, level]) => (
                      <Badge key={section} variant={EVIDENCE_VARIANTS[level as DiseaseEvidenceLevel] ?? "outline"}>
                        {section}: {EVIDENCE_LABELS[level as DiseaseEvidenceLevel] ?? level}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedDisease.prevention && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">Prevention</h4>
                    {selectedDisease.evidence?.prevention && (
                      <Badge variant={EVIDENCE_VARIANTS[selectedDisease.evidence.prevention] ?? "outline"} className="text-[10px]">
                        {EVIDENCE_LABELS[selectedDisease.evidence.prevention]}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedDisease.prevention}</p>
                </div>
              )}
              {selectedDisease.treatment && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">Treatment</h4>
                    {selectedDisease.evidence?.treatment && (
                      <Badge variant={EVIDENCE_VARIANTS[selectedDisease.evidence.treatment] ?? "outline"} className="text-[10px]">
                        {EVIDENCE_LABELS[selectedDisease.evidence.treatment]}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedDisease.treatment}</p>
                </div>
              )}
              {(selectedDisease.supportiveTreatments || selectedDisease.organicTreatments) && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-green-700">Supportive &amp; Traditional Care</h4>
                    {selectedDisease.evidence?.supportiveTreatments && (
                      <Badge variant={EVIDENCE_VARIANTS[selectedDisease.evidence.supportiveTreatments] ?? "outline"} className="text-[10px]">
                        {EVIDENCE_LABELS[selectedDisease.evidence.supportiveTreatments]}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedDisease.supportiveTreatments || selectedDisease.organicTreatments}</p>
                </div>
              )}

              {regionalNote && (
                <div className="rounded-lg border bg-muted/40 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-medium text-sm">
                      Regional note{regionalNote.code !== "general" ? ` — ${regionalNote.code}` : ""}
                    </h4>
                    {regionalOptions.length > 0 && (
                      <select
                        className="ml-auto text-xs border rounded px-1 py-0.5 bg-background"
                        value={regionOverride ?? ""}
                        onChange={(e) => setRegionOverride(e.target.value || null)}
                      >
                        <option value="">{orgCountry ? `My region (${orgCountry})` : "Auto"}</option>
                        {regionalOptions.map((k) => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                        <option value="__general__">General</option>
                      </select>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{regionalNote.text}</p>
                </div>
              )}

              {selectedDisease.sources && selectedDisease.sources.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-medium">Sources &amp; references</h4>
                  </div>
                  <ul className="space-y-1.5">
                    {selectedDisease.sources.map((s, i) => (
                      <li key={i} className="text-sm">
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                          {s.title} <ExternalLink className="h-3 w-3" />
                        </a>
                        <span className="text-muted-foreground"> — {s.publisher}</span>
                        <Badge variant="outline" className="ml-2 text-[10px]">{SOURCE_TYPE_LABELS[s.type] ?? s.type}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  This information is for general educational purposes only and is not a substitute for
                  professional veterinary advice, diagnosis, or treatment. Always consult a licensed
                  veterinarian and follow local regulations — some diseases are notifiable.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
