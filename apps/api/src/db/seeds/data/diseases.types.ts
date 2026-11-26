// Shared contract types for disease catalogue seed data.
// These mirror the zod contracts in apps/api/src/modules/diseases/schemas.ts —
// keep them in sync. regionalNotes keys are ISO-3166 alpha-2 codes plus
// the mandatory "general" fallback.

export type DiseaseSourceType =
  | 'peer-reviewed'
  | 'government'
  | 'university-extension'
  | 'industry'
  | 'ngo';

export interface DiseaseSource {
  title: string;
  url: string; // https only
  publisher: string;
  type: DiseaseSourceType;
}

export type EvidenceLevel =
  | 'veterinary-recommended'
  | 'standard-practice'
  | 'traditional-limited-evidence';

export interface DiseaseRecord {
  name: string;
  category: string; // Viral | Bacterial | Parasitic | Fungal | Nutritional | Management
  incubation?: string;
  mortalityRate?: string;
  symptoms?: string;
  prevention?: string;
  treatment?: string;
  supportiveTreatments?: string;
  imageUrl?: string; // https, royalty-free (CC/CC0/public domain)
  videoUrl?: string; // https canonical embed URL (e.g. youtube.com/embed/<id>)
  videoProvider?: 'youtube' | 'vimeo' | 'external';
  sources?: DiseaseSource[];
  regionalNotes?: Record<string, string>;
  evidence?: Record<string, EvidenceLevel>;
  // Phase F: free-text cause-matching terms (synonyms, abbreviations,
  // common misspellings) and the typical peak-risk age window in days.
  keywords?: string[];
  susceptibleAgeMinDays?: number | null;
  susceptibleAgeMaxDays?: number | null;
}
