// P5 — platform growth & finance analytics (PLAN-super-admin-console §6).
//
// The 00:30 'platform_analytics' cron calls backfillDailyStats() which upserts
// one platform_daily_stats row per UTC day. Demo orgs (is_demo) and staff are
// excluded everywhere — staff actions land on the staff_* tables, not here;
// impersonated tenant actions are excluded from activity counts via
// impersonatedByStaffId.
//
// Metric definitions (kept deliberately invoice-driven so backfills agree with
// live rows):
//   signups      orgs (non-demo, non-deleted) created on the day
//   activations  orgs whose FIRST flock was created on the day
//   wau / mau    distinct tenant user_ids with an audit_log row in the trailing
//                7d / 30d window, impersonated actions excluded
//   mrr_*        Σ normalized monthly ZMW: paid invoice covering the day ÷ its
//                cycle months; for the freshest ~36h also counts active /
//                past_due subs without a covering invoice (priceOverride ??
//                plan ZMW price) so a same-day upgrade isn't invisible
//   newMrr       first-ever paid invoice normalized, by paid_at day
//   expansionMrr paid invoice normalized > the org's previous paid invoice → Δ
//   churnedMrr   subs cancelled that day or set suspended that day → their
//                last normalized invoice amount
//   failedPayments          invoices with a dunning touch (lastReminderAt) that day
//   failedPaymentRecoveries invoices paid that day that had ≥1 reminder
//   countriesJson active orgs by ISO country at day end
//   funnelJson   live subscription-status counts + ever-paid orgs

import type { PrismaClient } from '@prisma/client';

const DAY_MS = 24 * 60 * 60 * 1000;
const CYCLE_MONTHS: Record<string, number> = { monthly: 1, cycle_3mo: 3, annual: 12 };

function dayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function monthlyZmw(amount: number, billingCycle: string): number {
  return amount / (CYCLE_MONTHS[billingCycle] ?? 1);
}

type FunnelJson = {
  trialing: number;
  active: number;
  past_due: number;
  suspended: number;
  cancelled: number;
  everPaid: number;
};

export async function computeDailyStats(prisma: PrismaClient, statDate: Date) {
  const d0 = dayStart(statDate);
  const d1 = new Date(d0.getTime() + DAY_MS);
  const live = d1.getTime() > Date.now() - 36 * 3600 * 1000; // fresh window: include live subs

  // ── Orgs in scope (never demo; not deleted yet at day end) ──
  const orgs = await prisma.organization.findMany({
    where: { isDemo: false, createdAt: { lt: d1 }, OR: [{ deletedAt: null }, { deletedAt: { gte: d1 } }] },
    select: { id: true, country: true, createdAt: true, suspendedAt: true },
  });
  const orgIds = orgs.map((o) => o.id);
  const orgSet = new Set(orgIds);

  // ── signups / activations / countries ──
  const signups = orgs.filter((o) => o.createdAt >= d0 && o.createdAt < d1).length;

  const firstFlocks = await prisma.broilerFlock.groupBy({
    by: ['organizationId'],
    where: { organizationId: { in: orgIds } },
    _min: { createdAt: true },
  });
  const activations = firstFlocks.filter(
    (f) => f._min.createdAt && f._min.createdAt >= d0 && f._min.createdAt < d1
  ).length;

  const countriesJson: Record<string, number> = {};
  for (const o of orgs) {
    if (o.suspendedAt && o.suspendedAt < d1) continue; // active orgs only
    countriesJson[o.country ?? '??'] = (countriesJson[o.country ?? '??'] ?? 0) + 1;
  }

  // ── WAU / MAU (audit-activity windows, non-impersonated) ──
  const activeSince = (days: number) =>
    prisma.auditLog.findMany({
      where: {
        organizationId: { in: orgIds },
        userId: { not: null },
        impersonatedByStaffId: null,
        occurredAt: { gte: new Date(d1.getTime() - days * DAY_MS), lt: d1 },
      },
      select: { userId: true },
      distinct: ['userId'],
    }).then((rows) => rows.length);
  const [wau, mau] = await Promise.all([activeSince(7), activeSince(30)]);

  // ── Paid invoices covering the day → MRR buckets + movement ──
  const covering = await prisma.invoice.findMany({
    where: {
      status: 'paid',
      periodStart: { lte: d1 },
      periodEnd: { gt: d0 },
      subscription: { organizationId: { in: orgIds } },
    },
    select: { organizationId: true, planCode: true, amountPaid: true, billingCycle: true },
  });
  const mrr = { basic: 0, grower: 0, business: 0, enterprise: 0 };
  const coveredOrgs = new Set<string>();
  for (const inv of covering) {
    const plan = inv.planCode as keyof typeof mrr;
    if (plan in mrr) {
      mrr[plan] += monthlyZmw(Number(inv.amountPaid), inv.billingCycle);
      coveredOrgs.add(inv.organizationId);
    }
  }

  // Live-window fallback: active/past_due subs without a covering invoice
  // (fresh upgrades whose first invoice hasn't been issued/paid yet).
  if (live) {
    const liveSubs = await prisma.subscription.findMany({
      where: {
        organizationId: { in: orgIds.filter((id) => !coveredOrgs.has(id)) },
        status: { in: ['active', 'past_due'] },
        planCode: { in: ['basic', 'grower', 'business', 'enterprise'] },
      },
      select: { planCode: true, billingCycle: true, priceOverride: true },
    });
    if (liveSubs.length) {
      const planPrices = await prisma.planPrice.findMany({
        where: { currency: 'ZMW' },
        select: { billingCycle: true, amount: true, plan: { select: { code: true } } },
      });
      const priceFor = (code: string, cycle: string) =>
        Number(planPrices.find((p) => p.plan.code === code && p.billingCycle === cycle)?.amount ?? 0);
      for (const s of liveSubs) {
        const amount = s.priceOverride != null ? Number(s.priceOverride) : priceFor(s.planCode, s.billingCycle);
        const plan = s.planCode as keyof typeof mrr;
        if (plan in mrr) mrr[plan] += monthlyZmw(amount, s.billingCycle);
      }
    }
  }

  // ── Movement: invoices paid on the day → new / expansion MRR ──
  const paidToday = await prisma.invoice.findMany({
    where: { status: 'paid', paidAt: { gte: d0, lt: d1 }, subscription: { organizationId: { in: orgIds } } },
    orderBy: { paidAt: 'asc' },
    select: {
      organizationId: true, planCode: true, amountPaid: true, billingCycle: true,
      remindersSent: true, createdAt: true,
    },
  });

  let newMrr = 0;
  let expansionMrr = 0;
  let failedPaymentRecoveries = 0;
  for (const inv of paidToday) {
    const prior = await prisma.invoice.findFirst({
      where: {
        organizationId: inv.organizationId,
        status: 'paid',
        paidAt: { lt: d0 },
      },
      orderBy: { paidAt: 'desc' },
      select: { amountPaid: true, billingCycle: true },
    });
    const monthly = monthlyZmw(Number(inv.amountPaid), inv.billingCycle);
    if (!prior) newMrr += monthly;
    else {
      const prev = monthlyZmw(Number(prior.amountPaid), prior.billingCycle);
      if (monthly > prev) expansionMrr += monthly - prev;
    }
    if (inv.remindersSent > 0) failedPaymentRecoveries += 1;
  }

  const churned = await prisma.subscription.findMany({
    where: {
      organizationId: { in: orgIds },
      OR: [
        { canceledAt: { gte: d0, lt: d1 } },
        { status: 'suspended', updatedAt: { gte: d0, lt: d1 } },
      ],
    },
    select: { organizationId: true },
  });
  let churnedMrr = 0;
  for (const s of churned) {
    const last = await prisma.invoice.findFirst({
      where: { organizationId: s.organizationId, status: 'paid' },
      orderBy: { paidAt: 'desc' },
      select: { amountPaid: true, billingCycle: true },
    });
    if (last) churnedMrr += monthlyZmw(Number(last.amountPaid), last.billingCycle);
  }

  const failedPayments = await prisma.invoice.count({
    where: {
      lastReminderAt: { gte: d0, lt: d1 },
      subscription: { organizationId: { in: orgIds } },
    },
  });

  // ── Funnel snapshot ──
  const [statusCounts, everPaid] = await Promise.all([
    prisma.subscription.groupBy({
      by: ['status'],
      where: { organizationId: { in: orgIds } },
      _count: { _all: true },
    }),
    prisma.invoice.findMany({
      where: { status: 'paid', paidAt: { lt: d1 }, subscription: { organizationId: { in: orgIds } } },
      select: { organizationId: true },
      distinct: ['organizationId'],
    }),
  ]);
  const funnelJson: FunnelJson = {
    trialing: 0, active: 0, past_due: 0, suspended: 0, cancelled: 0,
    everPaid: everPaid.length,
  };
  for (const s of statusCounts) {
    if (s.status in funnelJson) (funnelJson as any)[s.status] = s._count._all;
  }

  const data = {
    signups, activations, wau, mau,
    mrrBasic: mrr.basic, mrrGrower: mrr.grower, mrrBusiness: mrr.business, mrrEnterprise: mrr.enterprise,
    newMrr, expansionMrr, churnedMrr,
    failedPayments, failedPaymentRecoveries,
    countriesJson, funnelJson: funnelJson as any,
  };

  return prisma.platformDailyStats.upsert({
    where: { statDate: d0 },
    create: { statDate: d0, ...data },
    update: data,
  });
}

/** Backfill + upsert the trailing `days` days (inclusive of yesterday by
 *  default usage from the cron — today's partial day is written too so the
 *  dashboard shows same-day movement). */
export async function backfillDailyStats(prisma: PrismaClient, days = 90) {
  const results = [];
  const today = dayStart(new Date());
  for (let i = days - 1; i >= 0; i--) {
    results.push(await computeDailyStats(prisma, new Date(today.getTime() - i * DAY_MS)));
  }
  return results;
}

/** Retention cohorts: signup-month × months-active grid. An org counts as
 *  active in a month if it produced ≥1 audit event that month (non-impersonated)
 *  or the month is its signup month. Returned as [{ cohort, size, months: {0: %, 1: %, …} }]. */
export async function computeCohorts(prisma: PrismaClient) {
  const orgs = await prisma.organization.findMany({
    where: { isDemo: false },
    select: { id: true, createdAt: true, deletedAt: true },
  });
  if (!orgs.length) return [];

  const rows = await prisma.$queryRaw<{ organizationId: string; m: Date }[]>`
    SELECT DISTINCT al.organization_id AS "organizationId", date_trunc('month', al.occurred_at) AS m
    FROM audit_logs al
    WHERE al.user_id IS NOT NULL AND al.impersonated_by_staff_id IS NULL
  `;
  const activeMonths = new Map<string, Set<number>>();
  for (const r of rows) {
    const m = Date.UTC(r.m.getUTCFullYear(), r.m.getUTCMonth());
    if (!activeMonths.has(r.organizationId)) activeMonths.set(r.organizationId, new Set());
    activeMonths.get(r.organizationId)!.add(m);
  }

  const cohorts = new Map<number, { size: number; months: Map<number, number> }>();
  for (const o of orgs) {
    if (o.deletedAt) continue;
    const c = Date.UTC(o.createdAt.getUTCFullYear(), o.createdAt.getUTCMonth());
    if (!cohorts.has(c)) cohorts.set(c, { size: 0, months: new Map() });
    const co = cohorts.get(c)!;
    co.size += 1;
    const seen = activeMonths.get(o.id) ?? new Set<number>();
    seen.add(c); // signup month always counts
    for (const m of seen) {
      const elapsed = (m - c) / (1000 * 30.44 * DAY_MS);
      const bucket = Math.round(elapsed);
      co.months.set(bucket, (co.months.get(bucket) ?? 0) + 1);
    }
  }

  return [...cohorts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([c, v]) => ({
      cohort: new Date(c).toISOString().slice(0, 7),
      size: v.size,
      months: Object.fromEntries([...v.months.entries()].map(([m, n]) => [m, Math.round((n / v.size) * 100)])),
    }));
}
