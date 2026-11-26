import { z } from 'zod';

// Shared disease catalogue field contracts — used by both the tenant-facing
// /api/v1/diseases routes and the staff /api/v1/platform/catalogue routes so
// validation can never drift between the two write surfaces.

export const SOURCE_TYPES = ['peer-reviewed', 'government', 'university-extension', 'industry', 'ngo'] as const;
export const EVIDENCE_LEVELS = ['veterinary-recommended', 'standard-practice', 'traditional-limited-evidence'] as const;
export const EVIDENCE_SECTIONS = ['prevention', 'treatment', 'supportiveTreatments'] as const;
export const VIDEO_PROVIDERS = ['youtube', 'vimeo', 'external'] as const;

// Matches the VARCHAR(500) columns — longer URLs must 400 here, not 500 at the DB.
const HttpsUrl = z
  .string()
  .max(500)
  .url()
  .refine((u) => u.startsWith('https://'), { message: 'must be https' });

export const DiseaseSourceSchema = z.object({
  title: z.string().min(1).max(300),
  url: HttpsUrl,
  publisher: z.string().min(1).max(200),
  type: z.enum(SOURCE_TYPES),
});

const ISO_ALPHA2 = /^[A-Z]{2}$/;

export const RegionalNotesSchema = z
  .record(z.string().min(1).max(4000))
  .superRefine((notes, ctx) => {
    const keys = Object.keys(notes);
    if (keys.length === 0) return;
    for (const key of keys) {
      if (key !== 'general' && !ISO_ALPHA2.test(key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `regionalNotes key "${key}" must be an ISO-3166 alpha-2 code or "general"` });
      }
    }
    if (!('general' in notes)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'regionalNotes must include a "general" fallback entry' });
    }
  });

export const EvidenceSchema = z
  .record(z.enum(EVIDENCE_LEVELS))
  .superRefine((ev, ctx) => {
    for (const key of Object.keys(ev)) {
      if (!(EVIDENCE_SECTIONS as readonly string[]).includes(key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `evidence key "${key}" must be one of: ${EVIDENCE_SECTIONS.join(', ')}` });
      }
    }
  });

// Canonical embed forms only — clients iframe videoUrl verbatim for
// youtube/vimeo, so the stored URL must already be an embed/player URL.
const YOUTUBE_EMBED = /^https:\/\/(www\.)?youtube\.com\/embed\/[A-Za-z0-9_-]{11}([?#].*)?$/;
const VIMEO_PLAYER = /^https:\/\/player\.vimeo\.com\/video\/\d+([?#].*)?$/;

interface VideoFields {
  videoUrl?: string | null;
  videoProvider?: string | null;
}

// Returns human-readable problems for the videoUrl/videoProvider pair.
// Used by the create schema's superRefine AND by PATCH handlers after
// merging the patch body with the stored row (so partial updates are
// validated against effective state, not the fragment alone).
export function videoFieldsIssues(d: VideoFields): string[] {
  const issues: string[] = [];
  const url = d.videoUrl || undefined;
  const provider = d.videoProvider || undefined;
  if (url && !provider) issues.push('videoProvider is required when videoUrl is set');
  if (provider && !url) issues.push('videoUrl is required when videoProvider is set');
  if (url && provider === 'youtube' && !YOUTUBE_EMBED.test(url)) {
    issues.push('youtube videoUrl must be a canonical embed URL: https://www.youtube.com/embed/<11-char-id>');
  }
  if (url && provider === 'vimeo' && !VIMEO_PLAYER.test(url)) {
    issues.push('vimeo videoUrl must be a canonical player URL: https://player.vimeo.com/video/<id>');
  }
  return issues;
}

export const DiseaseObjectSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  incubation: z.string().optional(),
  mortalityRate: z.string().optional(),
  symptoms: z.string().optional(),
  prevention: z.string().optional(),
  treatment: z.string().optional(),
  supportiveTreatments: z.string().optional(),
  // Nullable so PATCH can clear media with explicit null.
  imageUrl: HttpsUrl.nullable().optional(),
  videoUrl: HttpsUrl.nullable().optional(),
  videoProvider: z.enum(VIDEO_PROVIDERS).nullable().optional(),
  sources: z.array(DiseaseSourceSchema).max(50).optional(),
  regionalNotes: RegionalNotesSchema.optional(),
  evidence: EvidenceSchema.optional(),
});

export const DiseaseCreateSchema = DiseaseObjectSchema.superRefine((d, ctx) => {
  for (const msg of videoFieldsIssues(d)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
  }
});

// No pair/format refine here — PATCH bodies are fragments; handlers merge
// with the stored row and call videoFieldsIssues on the effective state.
export const DiseasePatchSchema = DiseaseObjectSchema.partial();

// Deprecated alias for pre-rename mobile clients: mirror supportiveTreatments
// as organicTreatments until the mobile min-version ships. Sunset TBD.
export function withLegacyAlias<T extends { supportiveTreatments?: string | null }>(disease: T) {
  return { ...disease, organicTreatments: disease.supportiveTreatments ?? null };
}
