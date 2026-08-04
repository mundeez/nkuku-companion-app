import { Decimal } from 'decimal.js';
import { PrismaClient } from '@prisma/client';

// ── Types ──────────────────────────────────────────────

export interface IncomeStatementLine {
  accountCode: string;
  accountName: string;
  debitBalance: string;
  creditBalance: string;
  netBalance: string;
}

export interface IncomeStatement {
  asOfDate: string;
  periodFrom: string;
  periodTo: string;
  generatedAt: string;
  revenue: IncomeStatementLine[];
  totalRevenue: string;
  costOfGoodsSold: IncomeStatementLine[];
  totalCogs: string;
  grossProfit: string;
  operatingExpenses: IncomeStatementLine[];
  totalOperatingExpenses: string;
  operatingProfit: string;   // EBIT
  netProfit: string;
}

export interface BalanceSheetLine {
  accountCode: string;
  accountName: string;
  balance: string;
}

export interface BalanceSheet {
  asOfDate: string;
  generatedAt: string;
  assets: BalanceSheetLine[];
  totalAssets: string;
  liabilities: BalanceSheetLine[];
  totalLiabilities: string;
  equity: BalanceSheetLine[];
  totalEquity: string;
  totalLiabilitiesAndEquity: string;
  isBalanced: boolean;
}

export interface CashFlowLine {
  label: string;
  amount: string;
}

export interface CashFlowStatement {
  periodFrom: string;
  periodTo: string;
  generatedAt: string;
  operatingActivities: CashFlowLine[];
  netOperatingCashFlow: string;
  investingActivities: CashFlowLine[];
  netInvestingCashFlow: string;
  financingActivities: CashFlowLine[];
  netFinancingCashFlow: string;
  netCashFlow: string;
}

// ── Service ────────────────────────────────────────────

export class GaapStatementService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Get net balance (debits - credits) for a set of accounts up to a date.
   * Returns a map of accountId -> { account, debitSum, creditSum, netBalance }
   */
  private async getAccountBalances(
    accountType: string,
    asOfDate: Date,
    fromDate?: Date,
  ): Promise<{ account: any; debitSum: Decimal; creditSum: Decimal; netBalance: Decimal }[]> {
    const accounts = await this.prisma.account.findMany({
      where: { accountType: accountType as any, isActive: true },
      orderBy: { code: 'asc' },
    });

    const results: { account: any; debitSum: Decimal; creditSum: Decimal; netBalance: Decimal }[] = [];

    for (const account of accounts) {
      const where: any = {
        accountId: account.id,
        journal: { entryDate: { lte: asOfDate } },
      };
      if (fromDate) {
        where.journal.entryDate = { gte: fromDate, lte: asOfDate };
      }

      const agg = await this.prisma.journalLine.aggregate({
        where,
        _sum: { debitZmw: true, creditZmw: true },
      });

      const debitSum = new Decimal(agg._sum.debitZmw?.toString() ?? '0');
      const creditSum = new Decimal(agg._sum.creditZmw?.toString() ?? '0');
      const netBalance = debitSum.minus(creditSum);

      // Skip accounts with zero activity
      if (!debitSum.isZero() || !creditSum.isZero()) {
        results.push({ account, debitSum, creditSum, netBalance });
      }
    }

    return results;
  }

  async generateIncomeStatement(fromDate: Date, toDate: Date): Promise<IncomeStatement> {
    const [revenueBalances, expenseBalances] = await Promise.all([
      this.getAccountBalances('revenue', toDate, fromDate),
      this.getAccountBalances('expense', toDate, fromDate),
    ]);

    // Split expenses into COGS (5xxx) and Operating Expenses (6xxx)
    const cogs = expenseBalances.filter((r) => r.account.code.startsWith('5'));
    const opex = expenseBalances.filter((r) => r.account.code.startsWith('6'));

    const toLine = (r: typeof revenueBalances[0]): IncomeStatementLine => ({
      accountCode: r.account.code,
      accountName: r.account.name,
      debitBalance: r.debitSum.toFixed(2),
      creditBalance: r.creditSum.toFixed(2),
      netBalance: r.netBalance.abs().toFixed(2),
    });

    const revenueLines = revenueBalances.map(toLine);
    const cogsLines = cogs.map(toLine);
    const opexLines = opex.map(toLine);

    const totalRevenue = revenueBalances.reduce(
      (sum, r) => sum.plus(r.netBalance.abs()),
      new Decimal(0),
    );
    const totalCogs = cogs.reduce(
      (sum, r) => sum.plus(r.netBalance.abs()),
      new Decimal(0),
    );
    const totalOpex = opex.reduce(
      (sum, r) => sum.plus(r.netBalance.abs()),
      new Decimal(0),
    );

    const grossProfit = totalRevenue.minus(totalCogs);
    const operatingProfit = grossProfit.minus(totalOpex);
    // Net profit = operating profit (no interest/tax accounts yet)
    const netProfit = operatingProfit;

    return {
      asOfDate: toDate.toISOString().substring(0, 10),
      periodFrom: fromDate.toISOString().substring(0, 10),
      periodTo: toDate.toISOString().substring(0, 10),
      generatedAt: new Date().toISOString(),
      revenue: revenueLines,
      totalRevenue: totalRevenue.toFixed(2),
      costOfGoodsSold: cogsLines,
      totalCogs: totalCogs.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      operatingExpenses: opexLines,
      totalOperatingExpenses: totalOpex.toFixed(2),
      operatingProfit: operatingProfit.toFixed(2),
      netProfit: netProfit.toFixed(2),
    };
  }

  async generateBalanceSheet(asOfDate: Date): Promise<BalanceSheet> {
    const [assetBalances, liabilityBalances, equityBalances] = await Promise.all([
      this.getAccountBalances('asset', asOfDate),
      this.getAccountBalances('liability', asOfDate),
      this.getAccountBalances('equity', asOfDate),
    ]);

    // Compute current period net income (revenue - expenses up to asOfDate)
    // This is needed because before year-end close, net income is not yet in equity accounts
    const [revenueBalances, expenseBalances] = await Promise.all([
      this.getAccountBalances('revenue', asOfDate),
      this.getAccountBalances('expense', asOfDate),
    ]);
    const totalRevenue = revenueBalances.reduce(
      (sum, r) => sum.plus(r.netBalance.abs()),
      new Decimal(0),
    );
    const totalExpense = expenseBalances.reduce(
      (sum, r) => sum.plus(r.netBalance.abs()),
      new Decimal(0),
    );
    const netIncome = totalRevenue.minus(totalExpense);

    const toLine = (r: typeof assetBalances[0]): BalanceSheetLine => ({
      accountCode: r.account.code,
      accountName: r.account.name,
      balance: r.netBalance.abs().toFixed(2),
    });

    const assetLines = assetBalances.map(toLine);
    const liabilityLines = liabilityBalances.map(toLine);
    const equityLines = equityBalances.map(toLine);

    // Add current period net income as an equity line (if non-zero)
    if (!netIncome.isZero()) {
      equityLines.push({
        accountCode: '3030',
        accountName: 'Current Period Net Income',
        balance: netIncome.toFixed(2),
      });
    }

    // For assets, debit-normal → positive net balance is the balance
    const totalAssets = assetBalances.reduce(
      (sum, r) => sum.plus(r.netBalance),
      new Decimal(0),
    );
    // For liabilities, credit-normal → negative net balance means credit balance
    const totalLiabilities = liabilityBalances.reduce(
      (sum, r) => sum.plus(r.netBalance.abs()),
      new Decimal(0),
    );
    // For equity, credit-normal → negate net balance (credit = positive equity, debit = negative)
    // This correctly handles accumulated losses (debit RE) as negative equity
    const equityTotal = equityBalances.reduce(
      (sum, r) => sum.plus(r.netBalance.negated()),
      new Decimal(0),
    );
    const totalEquity = equityTotal.plus(netIncome);

    const totalLE = totalLiabilities.plus(totalEquity);
    const isBalanced = totalAssets.eq(totalLE);

    return {
      asOfDate: asOfDate.toISOString().substring(0, 10),
      generatedAt: new Date().toISOString(),
      assets: assetLines,
      totalAssets: totalAssets.toFixed(2),
      liabilities: liabilityLines,
      totalLiabilities: totalLiabilities.toFixed(2),
      equity: equityLines,
      totalEquity: totalEquity.toFixed(2),
      totalLiabilitiesAndEquity: totalLE.toFixed(2),
      isBalanced,
    };
  }

  async generateCashFlow(fromDate: Date, toDate: Date): Promise<CashFlowStatement> {
    // Indirect method: start from net income, adjust for non-cash items and working capital changes

    // 1. Get net income for the period
    const incomeStmt = await this.generateIncomeStatement(fromDate, toDate);
    const netIncome = new Decimal(incomeStmt.netProfit);

    // 2. Get balance changes for non-cash accounts
    // Cash account (1010) is excluded — it's the plug
    const cashAccount = await this.prisma.account.findUnique({ where: { code: '1010' } });
    let netCashChange = new Decimal(0);

    if (cashAccount) {
      const openingCash = await this.prisma.journalLine.aggregate({
        where: {
          accountId: cashAccount.id,
          journal: { entryDate: { lt: fromDate } },
        },
        _sum: { debitZmw: true, creditZmw: true },
      });
      const closingCash = await this.prisma.journalLine.aggregate({
        where: {
          accountId: cashAccount.id,
          journal: { entryDate: { lte: toDate } },
        },
        _sum: { debitZmw: true, creditZmw: true },
      });
      const opening = new Decimal(openingCash._sum.debitZmw?.toString() ?? '0')
        .minus(new Decimal(openingCash._sum.creditZmw?.toString() ?? '0'));
      const closing = new Decimal(closingCash._sum.debitZmw?.toString() ?? '0')
        .minus(new Decimal(closingCash._sum.creditZmw?.toString() ?? '0'));
      netCashChange = closing.minus(opening);
    }

    // 3. Get changes in receivables, inventory, payables (working capital)
    const workingCapitalCodes = ['1020', '1030', '1040', '1050', '1060', '1070', '2010', '2020'];
    const workingCapitalAccounts = await this.prisma.account.findMany({
      where: { code: { in: workingCapitalCodes } },
    });

    const operatingActivities: CashFlowLine[] = [
      { label: 'Net Income', amount: netIncome.toFixed(2) },
    ];

    let netOperating = netIncome;

    for (const account of workingCapitalAccounts) {
      const opening = await this.prisma.journalLine.aggregate({
        where: {
          accountId: account.id,
          journal: { entryDate: { lt: fromDate } },
        },
        _sum: { debitZmw: true, creditZmw: true },
      });
      const closing = await this.prisma.journalLine.aggregate({
        where: {
          accountId: account.id,
          journal: { entryDate: { lte: toDate } },
        },
        _sum: { debitZmw: true, creditZmw: true },
      });

      const openingNet = new Decimal(opening._sum.debitZmw?.toString() ?? '0')
        .minus(new Decimal(opening._sum.creditZmw?.toString() ?? '0'));
      const closingNet = new Decimal(closing._sum.debitZmw?.toString() ?? '0')
        .minus(new Decimal(closing._sum.creditZmw?.toString() ?? '0'));
      const change = closingNet.minus(openingNet);

      if (!change.isZero()) {
        // For debit-normal accounts (assets), increase = cash outflow (negative)
        // For credit-normal accounts (liabilities), increase = cash inflow (positive)
        const isDebitNormal = account.normalBalance === 'debit';
        const cashEffect = isDebitNormal ? change.negated() : change;
        operatingActivities.push({
          label: `Change in ${account.name}`,
          amount: cashEffect.toFixed(2),
        });
        netOperating = netOperating.plus(cashEffect);
      }
    }

    operatingActivities.push({
      label: 'Net Cash from Operating Activities',
      amount: netOperating.toFixed(2),
    });

    // 4. Investing activities: equipment purchases (1080)
    const investingAccounts = await this.prisma.account.findMany({
      where: { code: { in: ['1080', '1081'] } },
    });

    const investingActivities: CashFlowLine[] = [];
    let netInvesting = new Decimal(0);

    for (const account of investingAccounts) {
      const periodAgg = await this.prisma.journalLine.aggregate({
        where: {
          accountId: account.id,
          journal: { entryDate: { gte: fromDate, lte: toDate } },
        },
        _sum: { debitZmw: true, creditZmw: true },
      });
      const periodNet = new Decimal(periodAgg._sum.debitZmw?.toString() ?? '0')
        .minus(new Decimal(periodAgg._sum.creditZmw?.toString() ?? '0'));

      if (!periodNet.isZero()) {
        // Equipment purchases are cash outflows (negative)
        const cashEffect = account.normalBalance === 'debit' ? periodNet.negated() : periodNet;
        investingActivities.push({
          label: account.name,
          amount: cashEffect.toFixed(2),
        });
        netInvesting = netInvesting.plus(cashEffect);
      }
    }

    investingActivities.push({
      label: 'Net Cash from Investing Activities',
      amount: netInvesting.toFixed(2),
    });

    // 5. Financing activities: owner's capital (3010), retained earnings (3020)
    const financingAccounts = await this.prisma.account.findMany({
      where: { code: { in: ['3010'] } },
    });

    const financingActivities: CashFlowLine[] = [];
    let netFinancing = new Decimal(0);

    for (const account of financingAccounts) {
      const periodAgg = await this.prisma.journalLine.aggregate({
        where: {
          accountId: account.id,
          journal: { entryDate: { gte: fromDate, lte: toDate } },
        },
        _sum: { debitZmw: true, creditZmw: true },
      });
      const periodNet = new Decimal(periodAgg._sum.debitZmw?.toString() ?? '0')
        .minus(new Decimal(periodAgg._sum.creditZmw?.toString() ?? '0'));

      if (!periodNet.isZero()) {
        // Owner capital increase = cash inflow (positive)
        const cashEffect = account.normalBalance === 'credit' ? periodNet : periodNet.negated();
        financingActivities.push({
          label: account.name,
          amount: cashEffect.toFixed(2),
        });
        netFinancing = netFinancing.plus(cashEffect);
      }
    }

    financingActivities.push({
      label: 'Net Cash from Financing Activities',
      amount: netFinancing.toFixed(2),
    });

    const netCashFlow = netOperating.plus(netInvesting).plus(netFinancing);

    return {
      periodFrom: fromDate.toISOString().substring(0, 10),
      periodTo: toDate.toISOString().substring(0, 10),
      generatedAt: new Date().toISOString(),
      operatingActivities,
      netOperatingCashFlow: netOperating.toFixed(2),
      investingActivities,
      netInvestingCashFlow: netInvesting.toFixed(2),
      financingActivities,
      netFinancingCashFlow: netFinancing.toFixed(2),
      netCashFlow: netCashFlow.toFixed(2),
    };
  }
}
