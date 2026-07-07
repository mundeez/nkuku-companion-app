import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';
import { LedgerService } from '../../core/double-entry/ledger.service.js';

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

  // GET /trial-balance — trial balance as of date
  app.get('/trial-balance', { preHandler: [authenticate] }, async (request, reply) => {
    const { asOf } = TrialBalanceQuerySchema.parse(request.query);
    const asOfDate = asOf ? new Date(asOf) : new Date();
    const tb = await ledgerService.generateTrialBalance(asOfDate);

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
    const { code } = z.object({ code: z.string() }).parse(request.params);
    const { fromDate, toDate } = AccountLedgerQuerySchema.parse(request.query);

    try {
      const ledger = await ledgerService.getAccountLedger(code, new Date(fromDate), new Date(toDate));
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
    const { asOf } = TrialBalanceQuerySchema.parse(request.query);
    const asOfDate = asOf ? new Date(asOf) : new Date();
    const tb = await ledgerService.generateTrialBalance(asOfDate);

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="trial-balance-${tb.asOfDate}.csv"`);
    return reply.send(trialBalanceToCsv(tb));
  });

  // POST /period-close — materialise LedgerBalance rows and close period
  app.post('/period-close', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { periodLabel } = PeriodCloseSchema.parse(request.body);
    try {
      const result = await ledgerService.closePeriod(periodLabel);
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
}
