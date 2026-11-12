// ── DB-BACKED PLAN STORE (P4) ────────────────────────────
// Runtime source of truth for subscription plans: reads the `plans` +
// `plan_prices` tables (staff-editable via /api/v1/platform/plans) with a
// ~60 s in-process cache. Any plan code missing from the DB falls back to
// the PLANS const in plans.ts — so the API keeps working on an un-seeded
// database, and plans.ts remains the offline authority.
//
// Call invalidatePlanCache() after any staff-side plan write so edits take
// effect immediately instead of waiting out the cache window.

import type { PrismaClient } from '@prisma/client';
import {
  PLANS,
  PLAN_CODE_ALIASES,
  resolvePlanCode,
  type Plan,
  type PlanLimits,
  type PlanPricing,
} from './plans.js';

const PLAN_CACHE_MS = 60_000;

/** A plan row as served to the app — the DB shape normalised to the
 *  plans.ts `Plan` shape (features folded into limits for compatibility). */
export interface StoredPlan {
  code: string;
  name: string;
  description: string;
  sortOrder: number;
  isSelfServe: boolean;
  isActive: boolean;
  isTrial: boolean;
  trialDays: number | null;
  limits: PlanLimits;
  pricing: PlanPricing;
  /** true when this came from the plans table; false = static fallback. */
  fromDb: boolean;
}

interface CacheEntry {
  at: number;
  // canonical code → StoredPlan
  plans: Map<string, StoredPlan>;
}

let cache: CacheEntry | null = null;

type CycleKey = keyof PlanPricing; // 'monthly' | 'cycle_3mo' | 'annual'
const CYCLES: CycleKey[] = ['monthly', 'cycle_3mo', 'annual'];

/** Normalise a plans.ts Plan into the StoredPlan shape. */
function fromStatic(plan: Plan): StoredPlan {
  return {
    code: plan.code,
    name: plan.name,
    description: plan.description,
    sortOrder: plan.sortOrder,
    isSelfServe: plan.isSelfServe,
    isActive: true,
    isTrial: plan.isTrial,
    trialDays: plan.trialDays,
    limits: plan.limits,
    pricing: plan.pricing,
    fromDb: false,
  };
}

/** Normalise a Prisma Plan (+prices) row into the StoredPlan shape. */
function fromDb(row: any): StoredPlan {
  const rawLimits = (row.limits && typeof row.limits === 'object' ? row.limits : {}) as Record<string, any>;
  const features = Array.isArray(row.features) ? (row.features as string[]) : [];
  const pricing: PlanPricing = {
    monthly: { ZMW: 0, BWP: 0, USD: 0 },
    cycle_3mo: { ZMW: 0, BWP: 0, USD: 0 },
    annual: { ZMW: 0, BWP: 0, USD: 0 },
  };
  for (const p of row.prices ?? []) {
    const cycle = p.billingCycle as CycleKey;
    if (!CYCLES.includes(cycle)) continue;
    const cur = String(p.currency);
    if (!(cur in pricing[cycle])) continue;
    (pricing[cycle] as any)[cur] = Number(p.amount);
  }
  return {
    code: row.code,
    name: row.name,
    description: row.description,
    sortOrder: row.sortOrder ?? 0,
    isSelfServe: row.isSelfServe ?? true,
    isActive: row.isActive ?? true,
    isTrial: row.isTrial ?? false,
    trialDays: row.trialDays ?? null,
    limits: {
      maxActiveFlocks: rawLimits.maxActiveFlocks ?? 0,
      maxUsers: rawLimits.maxUsers ?? 0,
      maxCyclesHistory: rawLimits.maxCyclesHistory ?? 0,
      maxDocumentsPerRecord: rawLimits.maxDocumentsPerRecord ?? 0,
      features,
    },
    pricing,
    fromDb: true,
  };
}

async function loadCache(prisma: PrismaClient): Promise<CacheEntry> {
  if (cache && Date.now() - cache.at < PLAN_CACHE_MS) return cache;

  const plans = new Map<string, StoredPlan>();
  try {
    const rows = await prisma.plan.findMany({
      include: { prices: true },
      orderBy: { sortOrder: 'asc' },
    });
    for (const row of rows) plans.set(row.code, fromDb(row));
  } catch {
    // Fail open to the static const — e.g. plans table not migrated yet.
  }

  // Static fallback for any canonical code missing from the DB.
  for (const [code, plan] of Object.entries(PLANS)) {
    if (!plans.has(code)) plans.set(code, fromStatic(plan));
  }

  cache = { at: Date.now(), plans };
  return cache;
}

/** Drop the in-process plan cache (called by staff plan-edit endpoints). */
export function invalidatePlanCache(): void {
  cache = null;
}

/**
 * All plans known to the store, sorted by sortOrder. Includes inactive
 * rows — filter on isActive where the caller needs it.
 */
export async function getPlans(prisma: PrismaClient): Promise<StoredPlan[]> {
  const entry = await loadCache(prisma);
  return [...entry.plans.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Self-serve + active plans for the public pricing surface. */
export async function getSelfServePlans(prisma: PrismaClient): Promise<StoredPlan[]> {
  return (await getPlans(prisma)).filter((p) => p.isSelfServe && p.isActive);
}

/**
 * Single-plan lookup. Accepts legacy aliases ('free' → 'basic').
 * Returns undefined for unknown codes.
 */
export async function getPlanByCode(
  prisma: PrismaClient,
  code: string | null | undefined,
): Promise<StoredPlan | undefined> {
  if (!code) return undefined;
  const resolved = resolvePlanCode(code);
  const entry = await loadCache(prisma);
  const found = resolved ? entry.plans.get(resolved) : entry.plans.get(code);
  if (found) return found;
  // DB may hold a staff-created code unknown to the const — check raw code.
  return entry.plans.get(code);
}

/**
 * Price lookup for a (planCode, billingCycle, currency) triple. DB price
 * rows win; falls back to the static PLANS pricing matrix, then 0.
 */
export async function getPrice(
  prisma: PrismaClient,
  planCode: string,
  billingCycle: 'monthly' | 'cycle_3mo' | 'annual',
  currency: string,
): Promise<number> {
  const plan = await getPlanByCode(prisma, planCode);
  if (!plan) return 0;
  const cyclePricing = plan.pricing[billingCycle];
  if (!cyclePricing) return 0;
  const curr = currency as keyof typeof cyclePricing;
  return (cyclePricing as any)[curr] ?? cyclePricing.USD;
}

/** Feature check against the DB-backed plan (aliases resolved). */
export async function dbHasFeature(
  prisma: PrismaClient,
  planCode: string,
  feature: string,
): Promise<boolean> {
  const plan = await getPlanByCode(prisma, planCode);
  if (!plan) return false;
  return plan.limits.features.includes(feature);
}

/** Whether a stored code names a real plan tier (incl. aliases) — used to
 *  distinguish plan-tier Subscription rows from add-on rows. */
export function isPlanCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return !!resolvePlanCode(code) || code in PLANS || code in PLAN_CODE_ALIASES;
}
