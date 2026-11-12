// ── FEATURE FLAGS (P4) ───────────────────────────────────
// Org/plan-targeted feature toggles backed by the `feature_flags` table.
// Evaluation order (per the P4 spec):
//     orgOverrides[orgId]  >  planOverrides[planCode]  >  enabledByDefault
//
// This is DISTINCT from both:
//   - plan feature lists (plans.ts `features[]` — what a tier includes,
//     enforced by feature-gate.ts requireFeature); and
//   - PlatformFlag (platform_flags table — platform-wide settings like
//     maintenance_mode; see core/platform-flags/flags.service.ts).
// Feature flags here are for staff to roll out/kill-switch capabilities
// independent of the billing tier ("beta_chat", "new_dashboard", ...).
//
// The whole table is cached in-process for FLAG_CACHE_MS — flag checks can
// run on every request. Staff writes (platform routes) call
// invalidateFeatureFlagCache() so changes apply immediately.

import type { PrismaClient } from '@prisma/client';

const FLAG_CACHE_MS = 60_000;

export interface FeatureFlagRow {
  key: string;
  description: string;
  enabledByDefault: boolean;
  planOverrides: Record<string, boolean>;
  orgOverrides: Record<string, boolean>;
}

let cache: { at: number; flags: Map<string, FeatureFlagRow> } | null = null;

function normalize(row: any): FeatureFlagRow {
  return {
    key: row.key,
    description: row.description ?? '',
    enabledByDefault: row.enabledByDefault ?? true,
    planOverrides:
      row.planOverrides && typeof row.planOverrides === 'object' && !Array.isArray(row.planOverrides)
        ? (row.planOverrides as Record<string, boolean>)
        : {},
    orgOverrides:
      row.orgOverrides && typeof row.orgOverrides === 'object' && !Array.isArray(row.orgOverrides)
        ? (row.orgOverrides as Record<string, boolean>)
        : {},
  };
}

async function loadFlags(prisma: PrismaClient): Promise<Map<string, FeatureFlagRow>> {
  if (cache && Date.now() - cache.at < FLAG_CACHE_MS) return cache.flags;
  const flags = new Map<string, FeatureFlagRow>();
  try {
    const rows = await prisma.featureFlag.findMany();
    for (const row of rows) flags.set(row.key, normalize(row));
  } catch {
    // Fail open to "no flags" — a flag-store hiccup must not break requests.
  }
  cache = { at: Date.now(), flags };
  return flags;
}

/** Drop the in-process flag cache (called after staff flag writes). */
export function invalidateFeatureFlagCache(): void {
  cache = null;
}

/**
 * Evaluate one flag for an org context.
 * Missing flag → false (fail closed: an unknown key is "off").
 * Precedence: org override → plan override → enabledByDefault.
 * `planCode` should be the org's EFFECTIVE plan code (TenantOverride-aware).
 */
export async function isEnabled(
  prisma: PrismaClient,
  key: string,
  ctx: { orgId?: string | null; planCode?: string | null },
): Promise<boolean> {
  const flags = await loadFlags(prisma);
  const flag = flags.get(key);
  if (!flag) return false;
  if (ctx.orgId && ctx.orgId in flag.orgOverrides) {
    return flag.orgOverrides[ctx.orgId] === true;
  }
  if (ctx.planCode && ctx.planCode in flag.planOverrides) {
    return flag.planOverrides[ctx.planCode] === true;
  }
  return flag.enabledByDefault;
}

/**
 * The { key: bool } map of every flag as evaluated for this org — what the
 * tenant apps consume at boot (GET /api/v1/me/flags).
 */
export async function listForOrg(
  prisma: PrismaClient,
  orgId: string,
  planCode?: string | null,
): Promise<Record<string, boolean>> {
  const flags = await loadFlags(prisma);
  const out: Record<string, boolean> = {};
  for (const flag of flags.values()) {
    let value = flag.enabledByDefault;
    if (planCode && planCode in flag.planOverrides) value = flag.planOverrides[planCode] === true;
    if (orgId in flag.orgOverrides) value = flag.orgOverrides[orgId] === true;
    out[flag.key] = value;
  }
  return out;
}

/** All flags for the staff console (no caching concerns — small table). */
export async function listAll(prisma: PrismaClient): Promise<FeatureFlagRow[]> {
  const rows = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  return rows.map(normalize);
}
