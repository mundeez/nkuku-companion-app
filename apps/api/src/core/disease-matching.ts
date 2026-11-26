// ── Disease ↔ mortality-cause matching (Phase F) ──────────
// Scores a free-text mortality `cause` against the global diseases table.
// Pure/token-based — no DB access — so it can be unit-tested cheaply and
// reused by insights endpoints.

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with',
  'by', 'from', 'is', 'was', 'were', 'are', 'be', 'been', 'it', 'its', 'this',
  'that', 'these', 'those', 'as', 'due', 'caused', 'cause', 'death', 'deaths',
  'dead', 'died', 'die', 'bird', 'birds', 'flock', 'found', 'seen', 'see',
  'many', 'some', 'all', 'not', 'no', 'yes', 'we', 'had', 'has', 'have',
  'day', 'days', 'old', 'age', 'aged', 'approx', 'about', 'around', 'very',
  // Generic clinical filler that appears in many disease names — matching on
  // these produces noise ("disease outbreak" would hit every "* Disease").
  'disease', 'diseases', 'infectious', 'infection', 'infections', 'virus',
  'viral', 'syndrome', 'disorder', 'condition', 'illness', 'ailment',
]);

export interface MatchableDisease {
  id: string;
  name: string;
  keywords?: string[] | null;
}

export interface DiseaseMatch {
  disease: { id: string; name: string };
  score: number;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Score `cause` against each disease. Returns top-5 matches with score ≥ 3.
 * Score = 3 per cause-token matching a disease-name token
 *       + 1 per cause-token matching a keyword token.
 * Multi-word keywords additionally match on normalized phrase containment.
 */
export function scoreCauseAgainstDiseases(
  cause: string | null | undefined,
  diseases: MatchableDisease[],
): DiseaseMatch[] {
  if (!cause || !cause.trim()) return [];

  const causeTokens = new Set(tokenize(cause));
  if (causeTokens.size === 0) return [];
  const normalizedCause = ` ${normalize(cause)} `;

  const scored: DiseaseMatch[] = [];
  for (const disease of diseases) {
    let score = 0;

    // Name tokens: each shared token contributes 3.
    const nameTokens = new Set(tokenize(disease.name));
    for (const t of causeTokens) {
      if (nameTokens.has(t)) score += 3;
    }

    // Keyword tokens: each shared token contributes 1. Multi-word keyword
    // phrases also match on containment in the normalized cause.
    for (const kw of disease.keywords ?? []) {
      if (!kw || !kw.trim()) continue;
      const kwTokens = tokenize(kw);
      if (kwTokens.length === 0) continue;
      for (const t of kwTokens) {
        if (causeTokens.has(t)) score += 1;
      }
      const kwNorm = normalize(kw);
      if (kwNorm.includes(' ') && normalizedCause.includes(` ${kwNorm} `)) {
        score += kwTokens.length; // phrase hit — reward each phrase token once more
      }
    }

    if (score >= 3) {
      scored.push({ disease: { id: disease.id, name: disease.name }, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || a.disease.name.localeCompare(b.disease.name))
    .slice(0, 5);
}
