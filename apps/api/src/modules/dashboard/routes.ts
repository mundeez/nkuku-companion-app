import type { FastifyInstance } from 'fastify';
import { authenticate } from '../auth/routes.js';

export async function buildDashboardModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // ── Dashboard Summary ─────────────────────────
  app.get('/summary', { preHandler: [authenticate] }, async () => {
    const [
      flocks,
      openAlerts,
      financialRecords,
    ] = await Promise.all([
      prisma.broilerFlock.findMany({
        include: {
          breed: true,
          _count: { select: { growthRecords: true, feedRecords: true, mortalityEvents: true } },
        },
        orderBy: { startDate: 'desc' },
      }),
      prisma.alert.findMany({
        where: { isResolved: false },
        include: { flock: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.financialRecord.findMany({
        select: {
          category: true,
          amountZmw: true,
          isIncome: true,
          recordDate: true,
          flockId: true,
        },
      }),
    ]);

    // ── KPIs ─────────────────────────────────
    const activeFlocks = flocks.filter((f: any) => f.status === 'active' && f.chicksCollected);
    const pendingFlocks = flocks.filter((f: any) => f.status === 'active' && !f.chicksCollected);
    const totalBirds = activeFlocks.reduce((s: number, f: any) => s + f.currentCount, 0);
    const totalInitial = activeFlocks.reduce((s: number, f: any) => s + f.initialCount, 0);
    const mortalityRate = totalInitial > 0 ? Number(((totalInitial - totalBirds) / totalInitial * 100).toFixed(1)) : 0;

    const totalRevenue = financialRecords
      .filter((r: any) => r.isIncome)
      .reduce((s: number, r: any) => s + Number(r.amountZmw), 0);
    const totalCost = financialRecords
      .filter((r: any) => !r.isIncome)
      .reduce((s: number, r: any) => s + Number(r.amountZmw), 0);
    const netProfit = Number((totalRevenue - totalCost).toFixed(2));
    const profitPerBird = totalBirds > 0 ? Number((netProfit / totalBirds).toFixed(2)) : 0;

    // ── Monthly Trend (last 12 months) ───────
    const now = new Date();
    const monthlyTrend: Array<{ month: string; revenue: number; cost: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const monthRecords = financialRecords.filter((r: any) => {
        const rd = new Date(r.recordDate);
        return rd >= monthStart && rd <= monthEnd;
      });
      monthlyTrend.push({
        month: d.toLocaleDateString('en', { month: 'short' }),
        revenue: monthRecords.filter((r: any) => r.isIncome).reduce((s: number, r: any) => s + Number(r.amountZmw), 0),
        cost: monthRecords.filter((r: any) => !r.isIncome).reduce((s: number, r: any) => s + Number(r.amountZmw), 0),
      });
    }

    // ── Cost Breakdown by Category ──────────
    const categoryMap = new Map<string, number>();
    for (const r of financialRecords.filter((r: any) => !r.isIncome)) {
      const cat = r.category as string;
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + Number(r.amountZmw));
    }
    const costBreakdown = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({ category, amount: Number(amount.toFixed(2)) }))
      .sort((a, b) => b.amount - a.amount);

    // ── Flock Profitability ─────────────────
    const flockProfitability = flocks
      .filter((f: any) => f.status === 'active' || f.status === 'sold')
      .map((f: any) => {
        const flockFin = financialRecords.filter((r: any) => r.flockId === f.id);
        const rev = flockFin.filter((r: any) => r.isIncome).reduce((s: number, r: any) => s + Number(r.amountZmw), 0);
        const cost = flockFin.filter((r: any) => !r.isIncome).reduce((s: number, r: any) => s + Number(r.amountZmw), 0);
        const initial = f.initialCount || 0;
        const current = f.currentCount || 0;
        const mortRate = initial > 0 ? Number(((initial - current) / initial * 100).toFixed(1)) : 0;
        const ageDays = Math.floor((now.getTime() - new Date(f.startDate).getTime()) / 86400000);
        return {
          flockId: f.id,
          flockName: f.name,
          breedName: f.breed?.name || 'Unknown',
          ageDays,
          currentCount: current,
          mortalityRate: mortRate,
          profit: Number((rev - cost).toFixed(2)),
          revenue: Number(rev.toFixed(2)),
          cost: Number(cost.toFixed(2)),
          status: f.status,
        };
      })
      .sort((a, b) => b.profit - a.profit);

    // ── Alerts by Severity ──────────────────
    const alertsBySeverity = {
      critical: openAlerts.filter((a: any) => a.severity === 'critical').length,
      warning: openAlerts.filter((a: any) => a.severity === 'warning').length,
      info: openAlerts.filter((a: any) => a.severity === 'info').length,
    };

    // ── Alerts by Type ──────────────────────
    const typeMap = new Map<string, { count: number; severity: string }>();
    for (const a of openAlerts) {
      const t = a.alertType as string;
      const existing = typeMap.get(t);
      if (existing) {
        existing.count++;
        if (a.severity === 'critical') existing.severity = 'critical';
        else if (a.severity === 'warning' && existing.severity !== 'critical') existing.severity = 'warning';
      } else {
        typeMap.set(t, { count: 1, severity: a.severity });
      }
    }
    const alertsByType = Array.from(typeMap.entries())
      .map(([type, v]) => ({ type, count: v.count, severity: v.severity }))
      .sort((a, b) => b.count - a.count);

    // ── Recent Alerts (latest 8) ────────────
    const recentAlerts = openAlerts.slice(0, 8).map((a: any) => ({
      id: a.id,
      title: a.title,
      severity: a.severity,
      alertType: a.alertType,
      flockName: a.flock?.name || 'Unknown',
      createdAt: a.createdAt,
      dueDate: a.dueDate,
    }));

    return {
      kpis: {
        activeFlocks: activeFlocks.length,
        pendingFlocks: pendingFlocks.length,
        totalFlocks: flocks.length,
        totalBirds,
        mortalityRate,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalCost: Number(totalCost.toFixed(2)),
        netProfit,
        profitPerBird,
        openAlerts: openAlerts.length,
      },
      monthlyTrend,
      costBreakdown,
      flockProfitability,
      alertsBySeverity,
      alertsByType,
      recentAlerts,
    };
  });
}
