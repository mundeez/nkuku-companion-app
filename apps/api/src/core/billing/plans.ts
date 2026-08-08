// ── BILLING PLAN DEFINITIONS ─────────────────────────────
// Single source of truth for tier pricing, limits, and metadata.
// See docs/MONETIZATION_PLAN.md for the approved pricing decisions.

export type PlanCode = 'free' | 'grower' | 'business' | 'enterprise';

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
  isSelfServe: boolean; // false for enterprise (sales-assisted only)
}

export const PLANS: Record<PlanCode, Plan> = {
  free: {
    code: 'free',
    name: 'Free',
    description: 'For smallholders and trial — core tracking, 1 flock, 1 user',
    pricing: {
      monthly: { ZMW: 0, BWP: 0, USD: 0 },
      cycle_3mo: { ZMW: 0, BWP: 0, USD: 0 },
      annual: { ZMW: 0, BWP: 0, USD: 0 },
    },
    limits: {
      maxActiveFlocks: 1,
      maxUsers: 1,
      maxCyclesHistory: 2,
      maxDocumentsPerRecord: 0,
      features: [
        'core_tracking', // growth/feed/water/mortality/vaccination
        'disease_db',
        'basic_alerts',
      ],
    },
    isSelfServe: true,
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
  },
  business: {
    code: 'business',
    name: 'Business',
    description: 'For multi-site operations — GAAP statements, exports, 5 users, API access',
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
        'api_access',
        'priority_support',
      ],
    },
    isSelfServe: true,
  },
  enterprise: {
    code: 'enterprise',
    name: 'Enterprise / White-label',
    description: 'For agribusiness, co-ops, NGOs — unlimited users, white-label, SLA',
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
  },
};

export const SELF_SERVE_PLANS = Object.values(PLANS).filter((p) => p.isSelfServe);

export function getPlan(code: string): Plan | undefined {
  return PLANS[code as PlanCode];
}

export function getPlanPrice(planCode: PlanCode, billingCycle: 'monthly' | 'cycle_3mo' | 'annual', currency: string): number {
  const plan = PLANS[planCode];
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
