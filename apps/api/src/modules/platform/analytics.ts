// ── PLATFORM ANALYTICS (/api/v1/platform/analytics) ─────
// P5 (PLAN-super-admin-console §6): growth & finance analytics over the
// materialised platform_daily_stats rollups + a live cohort computation.
// Staff-only (analytics.read); demo orgs/staff are excluded upstream in
// analytics.service.ts. Manual rollup = POST /ops/cron/platform_analytics/run.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireStaff } from '../../core/staff-auth/staff-auth.service.js';
import { computeCohorts } from '../../core/platform-analytics/analytics.service.js';

const RangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const DAY_MS = 24 * 60 * 60 * 1000;

export async function buildPlatformAnalyticsModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  const range = (q: any) => {
    const { from, to } = RangeSchema.parse(q);
    const end = to ? new Date(`${to}T00:00:00Z`) : new Date(Date.now() + DAY_MS);
    const start = from ? new Date(`${from}T00:00:00Z`) : new Date(end.getTime() - 30 * DAY_MS);
    return { start, end };
  };

  const toRow = (s: any) => ({
    date: s.statDate.toISOString().slice(0, 10),
    signups: s.signups,
    activations: s.activations,
    wau: s.wau,
    mau: s.mau,
    mrrBasic: Number(s.mrrBasic),
    mrrGrower: Number(s.mrrGrower),
    mrrBusiness: Number(s.mrrBusiness),
    mrrEnterprise: Number(s.mrrEnterprise),
    mrrTotal: Number(s.mrrBasic) + Number(s.mrrGrower) + Number(s.mrrBusiness) + Number(s.mrrEnterprise),
    newMrr: Number(s.newMrr),
    expansionMrr: Number(s.expansionMrr),
    churnedMrr: Number(s.churnedMrr),
    failedPayments: s.failedPayments,
    failedPaymentRecoveries: s.failedPaymentRecoveries,
    countries: s.countriesJson,
    funnel: s.funnelJson,
  });

  // KPI cards + full daily series for the charts.
  app.get('/analytics/overview', { preHandler: [requireStaff('analytics.read')] }, async (request) => {
    const { start, end } = range(request.query);
    const rows = await prisma.platformDailyStats.findMany({
      where: { statDate: { gte: start, lte: end } },
      orderBy: { statDate: 'asc' },
    });
    const series = rows.map(toRow);
    const latest = series[series.length - 1] ?? null;
    const prior = series.length > 1 ? series[series.length - 2] : null;
    return { latest, prior, series };
  });

  // Signup-month × months-active retention grid (computed live).
  app.get('/analytics/cohorts', { preHandler: [requireStaff('analytics.read')] }, async () => {
    return { cohorts: await computeCohorts(prisma) };
  });

  // CSV export of the daily rollups.
  app.get('/analytics/export.csv', { preHandler: [requireStaff('analytics.read')] }, async (request, reply) => {
    const { start, end } = range(request.query);
    const rows = await prisma.platformDailyStats.findMany({
      where: { statDate: { gte: start, lte: end } },
      orderBy: { statDate: 'asc' },
    });
    const header =
      'date,signups,activations,wau,mau,mrr_basic,mrr_grower,mrr_business,mrr_enterprise,mrr_total,new_mrr,expansion_mrr,churned_mrr,failed_payments,failed_payment_recoveries';
    const lines = rows.map((s: any) => {
      const r = toRow(s);
      return `${r.date},${r.signups},${r.activations},${r.wau},${r.mau},${r.mrrBasic},${r.mrrGrower},${r.mrrBusiness},${r.mrrEnterprise},${r.mrrTotal},${r.newMrr},${r.expansionMrr},${r.churnedMrr},${r.failedPayments},${r.failedPaymentRecoveries}`;
    });
    reply
      .header('content-type', 'text/csv')
      .header('content-disposition', `attachment; filename="platform-analytics-${start.toISOString().slice(0, 10)}_${end.toISOString().slice(0, 10)}.csv"`);
    return [header, ...lines].join('\n');
  });
}
