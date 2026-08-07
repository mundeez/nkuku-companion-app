import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';
import { LedgerService } from '../../core/double-entry/ledger.service.js';
import { GaapStatementService } from '../../core/double-entry/gaap-statement.service.js';
import { ClosingService } from '../../core/double-entry/closing.service.js';
import { JournalEngine } from '../../core/double-entry/journal.engine.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';

const TrialBalanceQuerySchema = z.object({
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const AccountLedgerQuerySchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const PeriodCloseSchema = z.object({
  periodLabel: z.string().regex(/^\d{4}-\d{2}$/),
});

const StatementQuerySchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const YearEndCloseSchema = z.object({
  year: z.number().int().min(2000).max(2100),
});

function trialBalanceToCsv(tb: any): string {
  const header = 'Account Code,Account Name,Account Type,Debit Balance,Credit Balance';
  const rows = tb.lines.map((l: any) =>
    `${l.accountCode},${l.accountName},${l.accountType},${l.debitBalance},${l.creditBalance}`,
  );
  const footer = `,,Totals,${tb.totalDebits},${tb.totalCredits}`;
  return [header, ...rows, footer].join('\n');
}

export async function buildLedgerModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  const ledgerService = new LedgerService(prisma);
  const gaapService = new GaapStatementService(prisma);
  const engine = new JournalEngine(prisma);
  const closingService = new ClosingService(prisma, engine);

  // GET /trial-balance — trial balance as of date
  app.get('/trial-balance', { preHandler: [authenticate] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const { asOf } = TrialBalanceQuerySchema.parse(request.query);
    const asOfDate = asOf ? new Date(asOf) : new Date();
    const tb = await ledgerService.generateTrialBalance(asOfDate, organizationId);

    const { format } = z.object({ format: z.string().optional() }).parse(request.query);
    if (format === 'csv') {
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="trial-balance-${tb.asOfDate}.csv"`);
      return reply.send(trialBalanceToCsv(tb));
    }

    return tb;
  });

  // GET /account/:code — general ledger for one account (date range)
  app.get('/account/:code', { preHandler: [authenticate] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const { code } = z.object({ code: z.string() }).parse(request.params);
    const { fromDate, toDate } = AccountLedgerQuerySchema.parse(request.query);

    try {
      const ledger = await ledgerService.getAccountLedger(code, new Date(fromDate), new Date(toDate), organizationId);
      return ledger;
    } catch (err: any) {
      if (err.message.includes('NOT_FOUND')) {
        return reply.status(404).send({ error: err.message });
      }
      return reply.status(400).send({ error: err.message });
    }
  });

  // GET /export/trial-balance — export trial balance as CSV
  app.get('/export/trial-balance', { preHandler: [authenticate] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const { asOf } = TrialBalanceQuerySchema.parse(request.query);
    const asOfDate = asOf ? new Date(asOf) : new Date();
    const tb = await ledgerService.generateTrialBalance(asOfDate, organizationId);

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="trial-balance-${tb.asOfDate}.csv"`);
    return reply.send(trialBalanceToCsv(tb));
  });

  // POST /period-close — materialise LedgerBalance rows and close period
  app.post('/period-close', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const { periodLabel } = PeriodCloseSchema.parse(request.body);
    try {
      const result = await ledgerService.closePeriod(periodLabel, organizationId);
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // GET /income-statement — GAAP income statement from account balances
  app.get('/income-statement', { preHandler: [authenticate] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const q = StatementQuerySchema.parse(request.query);
    const toDate = q.toDate ? new Date(q.toDate) : new Date();
    const fromDate = q.fromDate ? new Date(q.fromDate) : new Date(new Date().getFullYear(), 0, 1);

    const { format } = z.object({ format: z.string().optional() }).parse(request.query);
    const stmt = await gaapService.generateIncomeStatement(fromDate, toDate, organizationId);

    if (format === 'csv') {
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="income-statement-${stmt.periodFrom}-to-${stmt.periodTo}.csv"`);
      return reply.send(incomeStatementToCsv(stmt));
    }

    return stmt;
  });

  // GET /balance-sheet — GAAP balance sheet from account balances
  app.get('/balance-sheet', { preHandler: [authenticate] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const q = StatementQuerySchema.parse(request.query);
    const asOfDate = q.asOf ? new Date(q.asOf) : new Date();

    const { format } = z.object({ format: z.string().optional() }).parse(request.query);
    const stmt = await gaapService.generateBalanceSheet(asOfDate, organizationId);

    if (format === 'csv') {
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="balance-sheet-${stmt.asOfDate}.csv"`);
      return reply.send(balanceSheetToCsv(stmt));
    }

    return stmt;
  });

  // GET /cash-flow — cash flow statement (indirect method)
  app.get('/cash-flow', { preHandler: [authenticate] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const q = StatementQuerySchema.parse(request.query);
    const toDate = q.toDate ? new Date(q.toDate) : new Date();
    const fromDate = q.fromDate ? new Date(q.fromDate) : new Date(new Date().getFullYear(), 0, 1);

    const stmt = await gaapService.generateCashFlow(fromDate, toDate, organizationId);
    return stmt;
  });

  // POST /year-end-close — post closing entries, reset income/expense accounts
  app.post('/year-end-close', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const { year } = YearEndCloseSchema.parse(request.body);
    const authUser = (request as any).authUser;
    try {
      const result = await closingService.yearEndClose(year, organizationId, authUser.userId);
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
}

// ── CSV Export Helpers ─────────────────────────────────

function incomeStatementToCsv(stmt: any): string {
  const lines: string[] = [];
  lines.push(`Income Statement: ${stmt.periodFrom} to ${stmt.periodTo}`);
  lines.push('');
  lines.push('REVENUE');
  lines.push('Account Code,Account Name,Amount');
  stmt.revenue.forEach((l: any) => lines.push(`${l.accountCode},${l.accountName},${l.netBalance}`));
  lines.push(`,Total Revenue,${stmt.totalRevenue}`);
  lines.push('');
  lines.push('COST OF GOODS SOLD');
  stmt.costOfGoodsSold.forEach((l: any) => lines.push(`${l.accountCode},${l.accountName},${l.netBalance}`));
  lines.push(`,Total COGS,${stmt.totalCogs}`);
  lines.push(`,Gross Profit,${stmt.grossProfit}`);
  lines.push('');
  lines.push('OPERATING EXPENSES');
  stmt.operatingExpenses.forEach((l: any) => lines.push(`${l.accountCode},${l.accountName},${l.netBalance}`));
  lines.push(`,Total Operating Expenses,${stmt.totalOperatingExpenses}`);
  lines.push(`,Operating Profit (EBIT),${stmt.operatingProfit}`);
  lines.push(`,Net Profit,${stmt.netProfit}`);
  return lines.join('\n');
}

function balanceSheetToCsv(stmt: any): string {
  const lines: string[] = [];
  lines.push(`Balance Sheet as of ${stmt.asOfDate}`);
  lines.push('');
  lines.push('ASSETS');
  lines.push('Account Code,Account Name,Balance');
  stmt.assets.forEach((l: any) => lines.push(`${l.accountCode},${l.accountName},${l.balance}`));
  lines.push(`,Total Assets,${stmt.totalAssets}`);
  lines.push('');
  lines.push('LIABILITIES');
  stmt.liabilities.forEach((l: any) => lines.push(`${l.accountCode},${l.accountName},${l.balance}`));
  lines.push(`,Total Liabilities,${stmt.totalLiabilities}`);
  lines.push('');
  lines.push('EQUITY');
  stmt.equity.forEach((l: any) => lines.push(`${l.accountCode},${l.accountName},${l.balance}`));
  lines.push(`,Total Equity,${stmt.totalEquity}`);
  lines.push(`,Total Liabilities + Equity,${stmt.totalLiabilitiesAndEquity}`);
  lines.push('');
  lines.push(`Balanced: ${stmt.isBalanced}`);
  return lines.join('\n');
}
