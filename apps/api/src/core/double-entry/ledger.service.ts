import Decimal from 'decimal.js';
import { PrismaClient } from '@prisma/client';

export interface LedgerEntry {
  date: Date;
  journalNumber: string;
  description: string;
  debitZmw: string | null;
  creditZmw: string | null;
  runningBalance: string;
}

export interface AccountLedger {
  account: { code: string; name: string; accountType: string; normalBalance: string };
  periodLabel: string;
  openingBalance: string;
  entries: LedgerEntry[];
  closingBalance: string;
  totalDebits: string;
  totalCredits: string;
}

export interface TrialBalanceLine {
  accountCode: string;
  accountName: string;
  accountType: string;
  debitBalance: string;
  creditBalance: string;
}

export interface TrialBalance {
  asOfDate: string;
  generatedAt: string;
  lines: TrialBalanceLine[];
  totalDebits: string;
  totalCredits: string;
  isBalanced: boolean;
}

export class LedgerService {
  constructor(private readonly prisma: PrismaClient) {}

  async generateTrialBalance(asOfDate: Date): Promise<TrialBalance> {
    const rows = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        journal: { entryDate: { lte: asOfDate } },
      },
      _sum: { debitZmw: true, creditZmw: true },
    });

    const accounts = await this.prisma.account.findMany({
      where: { id: { in: rows.map((r) => r.accountId) }, isActive: true },
    });

    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);
    const lines: TrialBalanceLine[] = [];

    for (const row of rows) {
      const account = accountMap.get(row.accountId);
      if (!account) continue;

      const debitSum = new Decimal(row._sum.debitZmw?.toString() ?? '0');
      const creditSum = new Decimal(row._sum.creditZmw?.toString() ?? '0');
      const netBalance = debitSum.minus(creditSum);

      // Place net balance in the correct column based on sign:
      // positive net (debits > credits) → debit column
      // negative net (credits > debits) → credit column
      const debitBalance = netBalance.gt(0) ? netBalance : new Decimal(0);
      const creditBalance = netBalance.lt(0) ? netBalance.abs() : new Decimal(0);

      totalDebits = totalDebits.plus(debitBalance);
      totalCredits = totalCredits.plus(creditBalance);

      lines.push({
        accountCode: account.code,
        accountName: account.name,
        accountType: account.accountType,
        debitBalance: debitBalance.toFixed(2),
        creditBalance: creditBalance.toFixed(2),
      });
    }

    lines.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    return {
      asOfDate: asOfDate.toISOString().substring(0, 10),
      generatedAt: new Date().toISOString(),
      lines,
      totalDebits: totalDebits.toFixed(2),
      totalCredits: totalCredits.toFixed(2),
      isBalanced: totalDebits.eq(totalCredits),
    };
  }

  async getAccountLedger(
    accountCode: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<AccountLedger> {
    const account = await this.prisma.account.findUnique({
      where: { code: accountCode },
    });
    if (!account) throw new Error(`ACCOUNT_NOT_FOUND: ${accountCode}`);

    // Opening balance: sum of all lines before fromDate
    const opening = await this.prisma.journalLine.aggregate({
      where: {
        accountId: account.id,
        journal: { entryDate: { lt: fromDate } },
      },
      _sum: { debitZmw: true, creditZmw: true },
    });

    const openingDebit = new Decimal(opening._sum.debitZmw?.toString() ?? '0');
    const openingCredit = new Decimal(opening._sum.creditZmw?.toString() ?? '0');
    const openingNet = openingDebit.minus(openingCredit);
    const isDebitNormal = account.normalBalance === 'debit';
    const openingBalance = (isDebitNormal ? openingNet : openingNet.negated()).toFixed(2);

    // Period entries
    const lines = await this.prisma.journalLine.findMany({
      where: {
        accountId: account.id,
        journal: { entryDate: { gte: fromDate, lte: toDate } },
      },
      include: { journal: true },
      orderBy: { journal: { entryDate: 'asc' } },
    });

    let runningBalance = isDebitNormal ? openingNet : openingNet.negated();
    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);
    const entries: LedgerEntry[] = [];

    for (const line of lines) {
      const debit = new Decimal(line.debitZmw?.toString() ?? '0');
      const credit = new Decimal(line.creditZmw?.toString() ?? '0');
      totalDebits = totalDebits.plus(debit);
      totalCredits = totalCredits.plus(credit);

      if (isDebitNormal) {
        runningBalance = runningBalance.plus(debit).minus(credit);
      } else {
        runningBalance = runningBalance.plus(credit).minus(debit);
      }

      entries.push({
        date: line.journal.entryDate,
        journalNumber: line.journal.entryNumber,
        description: line.description ?? line.journal.description,
        debitZmw: debit.gt(0) ? debit.toFixed(2) : null,
        creditZmw: credit.gt(0) ? credit.toFixed(2) : null,
        runningBalance: runningBalance.toFixed(2),
      });
    }

    const closingBalance = runningBalance.toFixed(2);

    return {
      account: {
        code: account.code,
        name: account.name,
        accountType: account.accountType,
        normalBalance: account.normalBalance,
      },
      periodLabel: `${fromDate.toISOString().substring(0, 10)} to ${toDate.toISOString().substring(0, 10)}`,
      openingBalance,
      entries,
      closingBalance,
      totalDebits: totalDebits.toFixed(2),
      totalCredits: totalCredits.toFixed(2),
    };
  }

  async closePeriod(periodLabel: string): Promise<{ accountsProcessed: number }> {
    const periodDate = new Date(`${periodLabel}-01`);
    const nextPeriod = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 1);

    const rows = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        journal: { entryDate: { gte: periodDate, lt: nextPeriod } },
      },
      _sum: { debitZmw: true, creditZmw: true },
    });

    let count = 0;
    for (const row of rows) {
      const periodDebit = new Decimal(row._sum.debitZmw?.toString() ?? '0');
      const periodCredit = new Decimal(row._sum.creditZmw?.toString() ?? '0');

      // Opening = sum before this period
      const opening = await this.prisma.journalLine.aggregate({
        where: {
          accountId: row.accountId,
          journal: { entryDate: { lt: periodDate } },
        },
        _sum: { debitZmw: true, creditZmw: true },
      });
      const openingDebit = new Decimal(opening._sum.debitZmw?.toString() ?? '0');
      const openingCredit = new Decimal(opening._sum.creditZmw?.toString() ?? '0');

      const closingDebit = openingDebit.plus(periodDebit);
      const closingCredit = openingCredit.plus(periodCredit);

      await this.prisma.ledgerBalance.upsert({
        where: {
          accountId_periodLabel: { accountId: row.accountId, periodLabel },
        },
        update: {
          openingDebit, openingCredit, periodDebit, periodCredit,
          closingDebit, closingCredit, computedAt: new Date(),
        },
        create: {
          accountId: row.accountId, periodLabel,
          openingDebit, openingCredit, periodDebit, periodCredit,
          closingDebit, closingCredit,
        },
      });
      count++;
    }

    return { accountsProcessed: count };
  }
}
