import { Decimal } from 'decimal.js';
import { PrismaClient } from '@prisma/client';
import { JournalEngine, JournalLineInput } from './journal.engine.js';

export class ClosingService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly engine: JournalEngine,
  ) {}

  /**
   * Year-end closing:
   * 1. Close all revenue accounts (4xxx) to Income Summary (3030)
   * 2. Close all expense accounts (5xxx, 6xxx) to Income Summary (3030)
   * 3. Transfer net income from Income Summary (3030) to Retained Earnings (3020)
   * After closing, all 4xxx, 5xxx, 6xxx accounts should have zero balance.
   */
  async yearEndClose(year: number, organizationId: string, postedBy?: string): Promise<{
    closingDate: string;
    revenueClosed: string;
    expenseClosed: string;
    netIncome: string;
    journalEntryId: string;
  }> {
    const closingDate = new Date(`${year}-12-31`);
    const incomeSummaryCode = '3030';
    const retainedEarningsCode = '3020';

    // Verify income summary and retained earnings accounts exist
    const incomeSummary = await this.prisma.account.findUnique({
      where: { code: incomeSummaryCode },
    });
    if (!incomeSummary) throw new Error('INCOME_SUMMARY_ACCOUNT_NOT_FOUND');

    const retainedEarnings = await this.prisma.account.findUnique({
      where: { code: retainedEarningsCode },
    });
    if (!retainedEarnings) throw new Error('RETAINED_EARNINGS_ACCOUNT_NOT_FOUND');

    // Get all revenue and expense accounts
    const revenueAccounts = await this.prisma.account.findMany({
      where: { accountType: 'revenue', isActive: true, isSystem: false },
    });
    const expenseAccounts = await this.prisma.account.findMany({
      where: { accountType: 'expense', isActive: true, isSystem: false },
    });

    const lines: JournalLineInput[] = [];
    let totalRevenue = new Decimal(0);
    let totalExpense = new Decimal(0);

    // Close revenue accounts: DR revenue / CR Income Summary
    for (const account of revenueAccounts) {
      const agg = await this.prisma.journalLine.aggregate({
        where: {
          accountId: account.id,
          journal: { entryDate: { lte: closingDate }, organizationId },
        },
        _sum: { debitZmw: true, creditZmw: true },
      });
      const debitSum = new Decimal(agg._sum.debitZmw?.toString() ?? '0');
      const creditSum = new Decimal(agg._sum.creditZmw?.toString() ?? '0');
      const netBalance = creditSum.minus(debitSum); // Revenue is credit-normal

      if (netBalance.abs().gte(0.01)) {
        // Debit the revenue account to zero it out
        lines.push({
          accountCode: account.code,
          debitZmw: Number(netBalance.toFixed(2)),
          description: `Year-end close: ${account.name}`,
        });
        totalRevenue = totalRevenue.plus(netBalance);
      }
    }
    // Credit Income Summary for total revenue closed
    if (totalRevenue.gte(0.01)) {
      lines.push({
        accountCode: incomeSummaryCode,
        creditZmw: Number(totalRevenue.toFixed(2)),
        description: 'Close revenue to Income Summary',
      });
    }

    // Close expense accounts: DR Income Summary / CR expense
    for (const account of expenseAccounts) {
      const agg = await this.prisma.journalLine.aggregate({
        where: {
          accountId: account.id,
          journal: { entryDate: { lte: closingDate }, organizationId },
        },
        _sum: { debitZmw: true, creditZmw: true },
      });
      const debitSum = new Decimal(agg._sum.debitZmw?.toString() ?? '0');
      const creditSum = new Decimal(agg._sum.creditZmw?.toString() ?? '0');
      const netBalance = debitSum.minus(creditSum); // Expense is debit-normal

      if (netBalance.abs().gte(0.01)) {
        // Credit the expense account to zero it out
        lines.push({
          accountCode: account.code,
          creditZmw: Number(netBalance.toFixed(2)),
          description: `Year-end close: ${account.name}`,
        });
        totalExpense = totalExpense.plus(netBalance);
      }
    }
    // Debit Income Summary for total expenses closed
    if (totalExpense.gte(0.01)) {
      lines.push({
        accountCode: incomeSummaryCode,
        debitZmw: Number(totalExpense.toFixed(2)),
        description: 'Close expenses to Income Summary',
      });
    }

    // Net income = revenue - expense
    const netIncome = totalRevenue.minus(totalExpense);

    // Transfer net income from Income Summary to Retained Earnings
    // After the above, Income Summary has: CR totalRevenue, DR totalExpense
    // Net balance of Income Summary = totalRevenue - totalExpense = netIncome (credit if positive)
    // To zero it out: DR Income Summary / CR Retained Earnings (if net income > 0)
    if (netIncome.gte(0.01)) {
      lines.push({
        accountCode: incomeSummaryCode,
        debitZmw: Number(netIncome.toFixed(2)),
        description: 'Transfer net income to Retained Earnings',
      });
      lines.push({
        accountCode: retainedEarningsCode,
        creditZmw: Number(netIncome.toFixed(2)),
        description: 'Transfer net income to Retained Earnings',
      });
    } else if (netIncome.lte(-0.01)) {
      const lossAmount = netIncome.abs();
      lines.push({
        accountCode: incomeSummaryCode,
        creditZmw: Number(lossAmount.toFixed(2)),
        description: 'Transfer net loss to Retained Earnings',
      });
      lines.push({
        accountCode: retainedEarningsCode,
        debitZmw: Number(lossAmount.toFixed(2)),
        description: 'Transfer net loss to Retained Earnings',
      });
    }

    // If there's nothing to close, return early
    if (lines.length === 0) {
      return {
        closingDate: closingDate.toISOString().substring(0, 10),
        revenueClosed: '0.00',
        expenseClosed: '0.00',
        netIncome: '0.00',
        journalEntryId: '',
      };
    }

    // Post the closing entry
    const entryId = await this.engine.post({
      entryDate: closingDate,
      description: `Year-end closing entries for ${year}`,
      reference: `YE-${year}`,
      sourceType: 'period_close',
      lines,
      postedBy,
      organizationId,
    });

    return {
      closingDate: closingDate.toISOString().substring(0, 10),
      revenueClosed: totalRevenue.toFixed(2),
      expenseClosed: totalExpense.toFixed(2),
      netIncome: netIncome.toFixed(2),
      journalEntryId: entryId,
    };
  }
}
