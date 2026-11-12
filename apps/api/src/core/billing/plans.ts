// ── BILLING PLAN DEFINITIONS ─────────────────────────────
// TypeScript source of truth for the subscription tiers — pricing, limits,
// and metadata. The `Plan`/`PlanPrice` DB tables (P4) are seeded from this
// file and become the runtime source of truth via plan-store.ts; this file
// remains the seed source, the type authority, and the offline fallback.
// See docs/MONETIZATION_PLAN.md for the approved pricing decisions.

export type PlanCode = 'trial' | 'basic' | 'grower' | 'business' | 'enterprise';

/**
 * Retired plan codes that still appear on legacy rows. Resolution order
 * everywhere: alias → canonical PlanCode. 'free' retired 2026-11-11 (P4) —
 * grandfathered orgs were backfilled to 'basic' with Subscription.
 * priceOverride = 0 (free forever); stray 'free' reads still map to basic.
 */
export const PLAN_CODE_ALIASES: Record<string, PlanCode> = {
  free: 'basic',
};

export interface PlanLimits {
  maxActiveFlocks: number; // -1 = unlimited
  maxUsers: number; // -1 = unlimited
  maxCyclesHistory: number; // -1 = unlimited (cycles of flock history retained)
  maxDocumentsPerRecord: number; // -1 = unlimited
  features: string[]; // feature flags enabled for this tier
}

export interface PlanPricing {
  // Price per billing cycle, in each supported currency
  monthly: { ZMW: number; BWP: number; USD: number };
  cycle_3mo: { ZMW: number; BWP: number; USD: number }; // per 3-month cycle
  annual: { ZMW: number; BWP: number; USD: number };
}

export interface Plan {
  code: PlanCode;
  name: string;
  description: string;
  pricing: PlanPricing;
  limits: PlanLimits;
  isSelfServe: boolean; // false for trial (auto-assigned) and enterprise (sales-assisted)
  sortOrder: number; // pricing-page display order
  isTrial: boolean; // true only for the signup trial tier
  trialDays: number | null; // isTrial → length of the trial window
}

export const PLANS: Record<PlanCode, Plan> = {
  // ── Trial: 14-day all-access at the Business feature level. Auto-assigned
  // at signup (P4); not purchasable. Expiry is handled by the billing cron
  // (trialing → past_due → suspended → read-only lock).
  trial: {
    code: 'trial',
    name: 'Free Trial',
    description: '14-day full-feature trial (Business level) — no card required',
    pricing: {
      monthly: { ZMW: 0, BWP: 0, USD: 0 },
      cycle_3mo: { ZMW: 0, BWP: 0, USD: 0 },
      annual: { ZMW: 0, BWP: 0, USD: 0 },
    },
    limits: {
      maxActiveFlocks: -1,
      maxUsers: 5,
      maxCyclesHistory: -1,
      maxDocumentsPerRecord: 20,
      features: [
        'core_tracking',
        'disease_db',
        'basic_alerts',
        'financial_dashboard',
        'double_entry_ledger',
        'document_attachments',
        'full_alerts',
        'multi_site',
        'gaap_statements',
        'csv_pdf_export',
        'priority_support',
      ],
    },
    isSelfServe: false,
    sortOrder: 0,
    isTrial: true,
    trialDays: 14,
  },
  // ── Basic: the paid entry tier. Replaces 'free' — existing free orgs were
  // grandfathered to basic at K0 via Subscription.priceOverride = 0 (P4).
  basic: {
    code: 'basic',
    name: 'Basic',
    description: 'For smallholders — core tracking + simple income/expense, 12 flocks, 1 user',
    pricing: {
      monthly: { ZMW: 150, BWP: 55, USD: 8 },
      cycle_3mo: { ZMW: 400, BWP: 150, USD: 22 },
      annual: { ZMW: 1500, BWP: 550, USD: 80 },
    },
    limits: {
      maxActiveFlocks: 12,
      maxUsers: 1,
      maxCyclesHistory: -1,
      maxDocumentsPerRecord: 0, // no document attachments
      features: [
        'core_tracking', // growth/feed/water/mortality/vaccination
        'disease_db',
        'basic_alerts',
        'basic_financials', // simple income/expense — NO double-entry/exports/documents
      ],
    },
    isSelfServe: true,
    sortOrder: 1,
    isTrial: false,
    trialDays: null,
  },
  grower: {
    code: 'grower',
    name: 'Grower',
    description: 'For small commercial farmers — unlimited flocks, financial dashboard, 2 users',
    pricing: {
      monthly: { ZMW: 250, BWP: 95, USD: 12 },
      cycle_3mo: { ZMW: 650, BWP: 250, USD: 32 },
      annual: { ZMW: 2500, BWP: 950, USD: 120 },
    },
    limits: {
      maxActiveFlocks: -1,
      maxUsers: 2,
      maxCyclesHistory: -1,
      maxDocumentsPerRecord: 20,
      features: [
        'core_tracking',
        'disease_db',
        'basic_alerts',
        'financial_dashboard',
        'double_entry_ledger',
        'document_attachments',
        'full_alerts',
      ],
    },
    isSelfServe: true,
    sortOrder: 2,
    isTrial: false,
    trialDays: null,
  },
  business: {
    code: 'business',
    name: 'Business',
    description: 'For multi-site operations — GAAP statements, exports, 5 users',
    pricing: {
      monthly: { ZMW: 800, BWP: 300, USD: 40 },
      cycle_3mo: { ZMW: 2100, BWP: 800, USD: 105 },
      annual: { ZMW: 8000, BWP: 3000, USD: 400 },
    },
    limits: {
      maxActiveFlocks: -1,
      maxUsers: 5,
      maxCyclesHistory: -1,
      maxDocumentsPerRecord: 20,
      features: [
        'core_tracking',
        'disease_db',
        'basic_alerts',
        'financial_dashboard',
        'double_entry_ledger',
        'document_attachments',
        'full_alerts',
        'multi_site',
        'gaap_statements',
        'csv_pdf_export',
        // NOTE: 'api_access' deliberately NOT here — enterprise-only (P4).
        'priority_support',
      ],
    },
    isSelfServe: true,
    sortOrder: 3,
    isTrial: false,
    trialDays: null,
  },
  enterprise: {
    code: 'enterprise',
    name: 'Enterprise / White-label',
    description: 'For agribusiness, co-ops, NGOs — unlimited users, API access, white-label, SLA',
    pricing: {
      monthly: { ZMW: 0, BWP: 0, USD: 0 }, // custom-quoted
      cycle_3mo: { ZMW: 0, BWP: 0, USD: 0 },
      annual: { ZMW: 0, BWP: 0, USD: 0 },
    },
    limits: {
      maxActiveFlocks: -1,
      maxUsers: -1,
      maxCyclesHistory: -1,
      maxDocumentsPerRecord: -1,
      features: [
        'core_tracking',
        'disease_db',
        'basic_alerts',
        'financial_dashboard',
        'double_entry_ledger',
        'document_attachments',
        'full_alerts',
        'multi_site',
        'gaap_statements',
        'csv_pdf_export',
        'api_access',
        'priority_support',
        'white_label',
        'dedicated_onboarding',
        'sla',
        'self_hosted',
      ],
    },
    isSelfServe: false,
    sortOrder: 4,
    isTrial: false,
    trialDays: null,
  },
};

/** Canonical codes + legacy aliases — for subscription planCode filters. */
export const PLAN_CODES: string[] = [
  ...Object.keys(PLANS),
  ...Object.keys(PLAN_CODE_ALIASES),
];

/** Map any stored plan code (incl. retired aliases) to a canonical PlanCode. */
export function resolvePlanCode(code: string | null | undefined): PlanCode | undefined {
  if (!code) return undefined;
  const alias = PLAN_CODE_ALIASES[code];
  if (alias) return alias;
  return (code as PlanCode) in PLANS ? (code as PlanCode) : undefined;
}

export const SELF_SERVE_PLANS = Object.values(PLANS).filter((p) => p.isSelfServe);

/** Static plan lookup from the const — resolves aliases. Async DB-backed
 *  reads (with staff edits applied) live in plan-store.ts; prefer that on
 *  request paths. This stays correct as the offline/static fallback. */
export function getPlan(code: string): Plan | undefined {
  const resolved = resolvePlanCode(code);
  return resolved ? PLANS[resolved] : undefined;
}

export function getPlanPrice(planCode: PlanCode | string, billingCycle: 'monthly' | 'cycle_3mo' | 'annual', currency: string): number {
  const resolved = resolvePlanCode(planCode);
  const plan = resolved ? PLANS[resolved] : undefined;
  if (!plan) return 0;
  const cyclePricing = plan.pricing[billingCycle];
  const curr = currency as keyof typeof cyclePricing;
  return cyclePricing[curr] ?? cyclePricing.USD;
}

export function hasFeature(planCode: string, feature: string): boolean {
  const plan = getPlan(planCode);
  if (!plan) return false;
  return plan.limits.features.includes(feature);
}
