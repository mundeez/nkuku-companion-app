import type { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';

export interface IncomeStatement {
  period: { startDate: Date; endDate: Date };
  revenue: { total: number; byCategory: Record<string, number> };
  cogs: { total: number; byCategory: Record<string, number> };
  grossProfit: number;
  grossMargin: number;
  operatingExpenses: { total: number; byCategory: Record<string, number> };
  netProfit: number;
  netMargin: number;
}

export interface BalanceSheet {
  asOfDate: Date;
  assets: {
    current: { cash: number; receivables: number; inventory: number; total: number };
    fixed: { equipment: number; facilities: number; total: number };
    total: number;
  };
  liabilities: {
    current: { payables: number; shortTermDebt: number; total: number };
    longTerm: { loans: number; total: number };
    total: number;
  };
  equity: { ownerCapital: number; retainedEarnings: number; total: number };
  totalLiabilitiesAndEquity: number;
}

export interface CashFlowStatement {
  period: { startDate: Date; endDate: Date };
  operating: { inflows: number; outflows: number; net: number };
  investing: { inflows: number; outflows: number; net: number };
  financing: { inflows: number; outflows: number; net: number };
  netChange: number;
  openingBalance: number;
  closingBalance: number;
}

export interface StatementFilters {
  startDate?: Date;
  endDate?: Date;
  flockIds?: string[];
  userId: string;
}

export class FinancialStatementService {
  constructor(private prisma: PrismaClient) {}

  async getIncomeStatement(filters: StatementFilters): Promise<IncomeStatement> {
    const { startDate, endDate, flockIds, userId } = filters;

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const flockWhere: any = { createdBy: userId };
    if (flockIds && flockIds.length > 0) flockWhere.id = { in: flockIds };

    const flocks = await this.prisma.broilerFlock.findMany({
      where: flockWhere,
      select: { id: true },
    });
    const allFlockIds = flocks.map(f => f.id);

    const recordWhere: any = {
      flockId: { in: allFlockIds },
      ...(Object.keys(dateFilter).length > 0 ? { recordDate: dateFilter } : {}),
    };

    const records = await this.prisma.financialRecord.findMany({
      where: recordWhere,
      select: { category: true, amountZmw: true, isIncome: true },
    });

    const revenue: Record<string, Decimal> = {};
    const cogs: Record<string, Decimal> = {};
    const opex: Record<string, Decimal> = {};

    for (const r of records) {
      const amount = new Decimal(r.amountZmw.toString());
      if (r.isIncome) {
        revenue[r.category] = (revenue[r.category] ?? new Decimal(0)).plus(amount);
      } else {
        const cogsCategories = ['chick_purchase', 'feed', 'vaccines', 'medication'];
        if (cogsCategories.includes(r.category)) {
          cogs[r.category] = (cogs[r.category] ?? new Decimal(0)).plus(amount);
        } else {
          opex[r.category] = (opex[r.category] ?? new Decimal(0)).plus(amount);
        }
      }
    }

    const totalRevenue = Object.values(revenue).reduce((sum, v) => sum.plus(v), new Decimal(0));
    const totalCogs = Object.values(cogs).reduce((sum, v) => sum.plus(v), new Decimal(0));
    const totalOpex = Object.values(opex).reduce((sum, v) => sum.plus(v), new Decimal(0));
    const grossProfit = totalRevenue.minus(totalCogs);
    const netProfit = grossProfit.minus(totalOpex);

    const toObj = (map: Record<string, Decimal>) => {
      const obj: Record<string, number> = {};
      for (const [k, v] of Object.entries(map)) obj[k] = v.toNumber();
      return obj;
    };

    const revTotal = totalRevenue.toNumber();
    const cogsTotal = totalCogs.toNumber();
    const opexTotal = totalOpex.toNumber();
    const gp = grossProfit.toNumber();
    const np = netProfit.toNumber();

    return {
      period: {
        startDate: startDate ?? new Date('2000-01-01'),
        endDate: endDate ?? new Date(),
      },
      revenue: { total: revTotal, byCategory: toObj(revenue) },
      cogs: { total: cogsTotal, byCategory: toObj(cogs) },
      grossProfit: gp,
      grossMargin: revTotal > 0 ? (gp / revTotal) * 100 : 0,
      operatingExpenses: { total: opexTotal, byCategory: toObj(opex) },
      netProfit: np,
      netMargin: revTotal > 0 ? (np / revTotal) * 100 : 0,
    };
  }

  async getBalanceSheet(asOfDate: Date, userId: string): Promise<BalanceSheet> {
    const flocks = await this.prisma.broilerFlock.findMany({
      where: { createdBy: userId },
      select: { id: true },
    });
    const flockIds = flocks.map(f => f.id);

    const records = await this.prisma.financialRecord.findMany({
      where: {
        flockId: { in: flockIds },
        recordDate: { lte: asOfDate },
      },
      select: { category: true, amountZmw: true, isIncome: true },
    });

    let cash = new Decimal(0);
    let inventory = new Decimal(0);
    let equipment = new Decimal(0);
    let payables = new Decimal(0);
    let loans = new Decimal(0);
    let retainedEarnings = new Decimal(0);

    for (const r of records) {
      const amount = new Decimal(r.amountZmw.toString());
      if (r.isIncome) {
        cash = cash.plus(amount);
        retainedEarnings = retainedEarnings.plus(amount);
      } else {
        cash = cash.minus(amount);
        retainedEarnings = retainedEarnings.minus(amount);
        if (r.category === 'equipment') equipment = equipment.plus(amount);
        if (r.category === 'feed' || r.category === 'chick_purchase') inventory = inventory.plus(amount);
        if (r.category === 'utilities' || r.category === 'labor') payables = payables.plus(amount);
      }
    }

    const currentAssets = cash.plus(inventory);
    const fixedAssets = equipment;
    const totalAssets = currentAssets.plus(fixedAssets);
    const currentLiabilities = payables;
    const longTermLiabilities = loans;
    const totalLiabilities = currentLiabilities.plus(longTermLiabilities);
    const equity = retainedEarnings;
    const totalLiabilitiesAndEquity = totalLiabilities.plus(equity);

    return {
      asOfDate,
      assets: {
        current: { cash: cash.toNumber(), receivables: 0, inventory: inventory.toNumber(), total: currentAssets.toNumber() },
        fixed: { equipment: equipment.toNumber(), facilities: 0, total: fixedAssets.toNumber() },
        total: totalAssets.toNumber(),
      },
      liabilities: {
        current: { payables: payables.toNumber(), shortTermDebt: 0, total: currentLiabilities.toNumber() },
        longTerm: { loans: loans.toNumber(), total: longTermLiabilities.toNumber() },
        total: totalLiabilities.toNumber(),
      },
      equity: { ownerCapital: 0, retainedEarnings: retainedEarnings.toNumber(), total: equity.toNumber() },
      totalLiabilitiesAndEquity: totalLiabilitiesAndEquity.toNumber(),
    };
  }

  async getCashFlow(filters: StatementFilters): Promise<CashFlowStatement> {
    const { startDate, endDate, flockIds, userId } = filters;

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const flockWhere: any = { createdBy: userId };
    if (flockIds && flockIds.length > 0) flockWhere.id = { in: flockIds };

    const flocks = await this.prisma.broilerFlock.findMany({
      where: flockWhere,
      select: { id: true },
    });
    const allFlockIds = flocks.map(f => f.id);

    const recordWhere: any = {
      flockId: { in: allFlockIds },
      ...(Object.keys(dateFilter).length > 0 ? { recordDate: dateFilter } : {}),
    };

    const records = await this.prisma.financialRecord.findMany({
      where: recordWhere,
      select: { category: true, amountZmw: true, isIncome: true },
    });

    let opIn = new Decimal(0), opOut = new Decimal(0);
    let invIn = new Decimal(0), invOut = new Decimal(0);
    let finIn = new Decimal(0), finOut = new Decimal(0);

    for (const r of records) {
      const amount = new Decimal(r.amountZmw.toString());
      if (r.isIncome) {
        opIn = opIn.plus(amount);
      } else {
        opOut = opOut.plus(amount);
        if (r.category === 'equipment') {
          invOut = invOut.plus(amount);
        } else if (r.category === 'utilities' || r.category === 'labor') {
          finOut = finOut.plus(amount);
        }
      }
    }

    const opNet = opIn.minus(opOut);
    const invNet = invIn.minus(invOut);
    const finNet = finIn.minus(finOut);
    const netChange = opNet.plus(invNet).plus(finNet);

    // Opening balance = all records before startDate
    let openingBalance = new Decimal(0);
    if (startDate) {
      const priorRecords = await this.prisma.financialRecord.findMany({
        where: {
          flockId: { in: allFlockIds },
          recordDate: { lt: startDate },
        },
        select: { amountZmw: true, isIncome: true },
      });
      for (const r of priorRecords) {
        const amount = new Decimal(r.amountZmw.toString());
        openingBalance = r.isIncome ? openingBalance.plus(amount) : openingBalance.minus(amount);
      }
    }

    return {
      period: {
        startDate: startDate ?? new Date('2000-01-01'),
        endDate: endDate ?? new Date(),
      },
      operating: { inflows: opIn.toNumber(), outflows: opOut.toNumber(), net: opNet.toNumber() },
      investing: { inflows: invIn.toNumber(), outflows: invOut.toNumber(), net: invNet.toNumber() },
      financing: { inflows: finIn.toNumber(), outflows: finOut.toNumber(), net: finNet.toNumber() },
      netChange: netChange.toNumber(),
      openingBalance: openingBalance.toNumber(),
      closingBalance: openingBalance.plus(netChange).toNumber(),
    };
  }
}
