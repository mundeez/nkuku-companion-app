import type { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';

export interface UnifiedSummaryFilters {
  startDate?: Date;
  endDate?: Date;
  flockIds?: string[];
  batchIds?: string[];
  cycleIds?: string[];
  userId: string;
}

export interface UnifiedSummary {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
  categoryBreakdown: CategoryBreakdown[];
  flockBreakdown: FlockBreakdown[];
  monthlyTrend: MonthlyTrend[];
  period: { startDate: Date; endDate: Date };
}

export interface CategoryBreakdown {
  category: string;
  revenue: number;
  cost: number;
  net: number;
}

export interface FlockBreakdown {
  flockId: string;
  flockName: string;
  revenue: number;
  cost: number;
  net: number;
}

export interface MonthlyTrend {
  label: string;
  revenue: number;
  cost: number;
  profit: number;
}

export class UnifiedFinancialService {
  constructor(private prisma: PrismaClient) {}

  async getUnifiedSummary(filters: UnifiedSummaryFilters): Promise<UnifiedSummary> {
    const { startDate, endDate, flockIds, userId } = filters;

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const flockWhere: any = { createdBy: userId };
    if (flockIds && flockIds.length > 0) {
      flockWhere.id = { in: flockIds };
    }

    // Get all flocks matching filters
    const flocks = await this.prisma.broilerFlock.findMany({
      where: flockWhere,
      select: { id: true, name: true },
    });

    const allFlockIds = flocks.map(f => f.id);

    // Aggregate financial records
    const recordWhere: any = {
      flockId: { in: allFlockIds },
      ...(Object.keys(dateFilter).length > 0 ? { recordDate: dateFilter } : {}),
    };

    const [incomeAgg, costAgg, byCategory, byFlock, monthly] = await Promise.all([
      this.prisma.financialRecord.aggregate({
        where: { ...recordWhere, isIncome: true },
        _sum: { amountZmw: true },
      }),
      this.prisma.financialRecord.aggregate({
        where: { ...recordWhere, isIncome: false },
        _sum: { amountZmw: true },
      }),
      this.prisma.financialRecord.groupBy({
        by: ['category'],
        where: recordWhere,
        _sum: { amountZmw: true },
      }),
      this.prisma.financialRecord.groupBy({
        by: ['flockId'],
        where: recordWhere,
        _sum: { amountZmw: true },
      }),
      this.prisma.financialRecord.groupBy({
        by: ['recordDate'],
        where: recordWhere,
        _sum: { amountZmw: true },
      }),
    ]);

    const totalRevenue = new Decimal(incomeAgg._sum.amountZmw ?? 0).toNumber();
    const totalCost = new Decimal(costAgg._sum.amountZmw ?? 0).toNumber();
    const grossProfit = totalRevenue - totalCost;
    const netProfit = grossProfit;

    const categoryBreakdown: CategoryBreakdown[] = byCategory.map((c: any) => {
      const amount = new Decimal(c._sum.amountZmw ?? 0).toNumber();
      return {
        category: c.category,
        revenue: 0,
        cost: amount,
        net: -amount,
      };
    });

    const flockBreakdown: FlockBreakdown[] = byFlock.map((f: any) => {
      const amount = new Decimal(f._sum.amountZmw ?? 0).toNumber();
      const flock = flocks.find(fl => fl.id === f.flockId);
      return {
        flockId: f.flockId,
        flockName: flock?.name ?? 'Unknown',
        revenue: 0,
        cost: amount,
        net: -amount,
      };
    }).sort((a, b) => b.net - a.net);

    // Monthly trend aggregation
    const monthlyMap = new Map<string, { revenue: Decimal; cost: Decimal }>();
    for (const m of monthly as any[]) {
      const label = m.recordDate.toISOString().slice(0, 7); // YYYY-MM
      const entry = monthlyMap.get(label) ?? { revenue: new Decimal(0), cost: new Decimal(0) };
      const amount = new Decimal(m._sum.amountZmw ?? 0);
      if (m.isIncome) {
        entry.revenue = entry.revenue.plus(amount);
      } else {
        entry.cost = entry.cost.plus(amount);
      }
      monthlyMap.set(label, entry);
    }

    const monthlyTrend: MonthlyTrend[] = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, vals]) => ({
        label,
        revenue: vals.revenue.toNumber(),
        cost: vals.cost.toNumber(),
        profit: vals.revenue.minus(vals.cost).toNumber(),
      }));

    const total = totalRevenue + totalCost;
    return {
      totalRevenue,
      totalCost,
      grossProfit,
      netProfit,
      grossMargin: total > 0 ? (grossProfit / total) * 100 : 0,
      netMargin: total > 0 ? (netProfit / total) * 100 : 0,
      categoryBreakdown,
      flockBreakdown,
      monthlyTrend,
      period: {
        startDate: startDate ?? new Date('2000-01-01'),
        endDate: endDate ?? new Date(),
      },
    };
  }

  async getFlockProfitability(userId: string): Promise<FlockBreakdown[]> {
    const flocks = await this.prisma.broilerFlock.findMany({
      where: { createdBy: userId, status: 'active' },
      select: { id: true, name: true },
    });

    const flockIds = flocks.map(f => f.id);
    if (flockIds.length === 0) return [];

    const byFlock = await this.prisma.financialRecord.groupBy({
      by: ['flockId', 'isIncome'],
      where: { flockId: { in: flockIds } },
      _sum: { amountZmw: true },
    });

    const map = new Map<string, { revenue: Decimal; cost: Decimal }>();
    for (const row of byFlock as any[]) {
      const entry = map.get(row.flockId) ?? { revenue: new Decimal(0), cost: new Decimal(0) };
      const amount = new Decimal(row._sum.amountZmw ?? 0);
      if (row.isIncome) {
        entry.revenue = entry.revenue.plus(amount);
      } else {
        entry.cost = entry.cost.plus(amount);
      }
      map.set(row.flockId, entry);
    }

    return Array.from(map.entries()).map(([flockId, vals]) => {
      const flock = flocks.find(f => f.id === flockId);
      return {
        flockId,
        flockName: flock?.name ?? 'Unknown',
        revenue: vals.revenue.toNumber(),
        cost: vals.cost.toNumber(),
        net: vals.revenue.minus(vals.cost).toNumber(),
      };
    }).sort((a, b) => b.net - a.net);
  }

  async getMonthlyTrend(year: number, userId: string): Promise<MonthlyTrend[]> {
    const start = new Date(`${year}-01-01`);
    const end = new Date(`${year + 1}-01-01`);

    const flocks = await this.prisma.broilerFlock.findMany({
      where: { createdBy: userId },
      select: { id: true },
    });
    const flockIds = flocks.map(f => f.id);

    const records = await this.prisma.financialRecord.groupBy({
      by: ['recordDate', 'isIncome'],
      where: {
        flockId: { in: flockIds },
        recordDate: { gte: start, lt: end },
      },
      _sum: { amountZmw: true },
    });

    const months = Array.from({ length: 12 }, (_, i) => {
      const m = (i + 1).toString().padStart(2, '0');
      return `${year}-${m}`;
    });

    const data = new Map<string, { revenue: Decimal; cost: Decimal }>();
    for (const r of records as any[]) {
      const label = r.recordDate.toISOString().slice(0, 7);
      const entry = data.get(label) ?? { revenue: new Decimal(0), cost: new Decimal(0) };
      const amount = new Decimal(r._sum.amountZmw ?? 0);
      if (r.isIncome) entry.revenue = entry.revenue.plus(amount);
      else entry.cost = entry.cost.plus(amount);
      data.set(label, entry);
    }

    return months.map(label => {
      const entry = data.get(label) ?? { revenue: new Decimal(0), cost: new Decimal(0) };
      return {
        label,
        revenue: entry.revenue.toNumber(),
        cost: entry.cost.toNumber(),
        profit: entry.revenue.minus(entry.cost).toNumber(),
      };
    });
  }
}
