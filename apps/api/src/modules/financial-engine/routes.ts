import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';
import { UnifiedFinancialService } from '../../core/financial-engine/unified-financial.service.js';
import { FinancialStatementService } from '../../core/financial-engine/statements.service.js';
import { AuditService } from '../../core/financial-engine/audit.service.js';
import { ReportGenerationService } from '../../core/financial-engine/report-generation.service.js';
import { SchedulerService } from '../../core/financial-engine/scheduler.service.js';
import { OverheadAllocationService } from '../../core/financial-engine/overhead-allocation.service.js';
import { HarvestProjectionService } from '../../core/financial-engine/harvest-projection.service.js';

const dateOrIso = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

export async function buildFinancialEngineModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  const unified = new UnifiedFinancialService(prisma);
  const statements = new FinancialStatementService(prisma);
  const audit = new AuditService(prisma);
  const reports = new ReportGenerationService();
  const scheduler = new SchedulerService(prisma);
  const overheads = new OverheadAllocationService(prisma);
  const projections = new HarvestProjectionService(prisma);

  // ── DEPRECATION NOTICE ─────────────────────
  // v0.8.0 single-entry financial engine is superseded by v0.9.3+ double-entry GAAP statements.
  // Successor endpoints: /api/v1/ledger/income-statement, /balance-sheet, /cash-flow
  app.addHook('onRequest', async (_request, reply) => {
    reply.header('Deprecation', 'true');
    reply.header('Sunset', 'Sun, 01 Jan 2027 00:00:00 GMT');
    reply.header('Link', '</api/v1/ledger/income-statement>; rel="successor-version"');
  });

  // ── UNIFIED SUMMARY ──────────────────────
  app.get('/summary', { preHandler: [authenticate] }, async (request) => {
    const _authUser = (request as any).authUser;
    const query = z.object({
      startDate: dateOrIso.optional(),
      endDate: dateOrIso.optional(),
      flockIds: z.string().optional(),
    }).parse(request.query);

    return unified.getUnifiedSummary({
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      flockIds: query.flockIds ? query.flockIds.split(',') : undefined,
      userId: _authUser.userId,
    });
  });

  // ── INCOME STATEMENT ───────────────────────
  app.get('/income-statement', { preHandler: [authenticate] }, async (request) => {
    const _authUser = (request as any).authUser;
    const query = z.object({
      startDate: dateOrIso.optional(),
      endDate: dateOrIso.optional(),
      flockIds: z.string().optional(),
    }).parse(request.query);

    return statements.getIncomeStatement({
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      flockIds: query.flockIds ? query.flockIds.split(',') : undefined,
      userId: _authUser.userId,
    });
  });

  // ── BALANCE SHEET ──────────────────────────
  app.get('/balance-sheet', { preHandler: [authenticate] }, async (request) => {
    const _authUser = (request as any).authUser;
    const query = z.object({
      asOfDate: dateOrIso.optional(),
    }).parse(request.query);

    return statements.getBalanceSheet(
      query.asOfDate ? new Date(query.asOfDate) : new Date(),
      _authUser.userId,
    );
  });

  // ── CASH FLOW ──────────────────────────────
  app.get('/cash-flow', { preHandler: [authenticate] }, async (request) => {
    const _authUser = (request as any).authUser;
    const query = z.object({
      startDate: dateOrIso.optional(),
      endDate: dateOrIso.optional(),
      flockIds: z.string().optional(),
    }).parse(request.query);

    return statements.getCashFlow({
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      flockIds: query.flockIds ? query.flockIds.split(',') : undefined,
      userId: _authUser.userId,
    });
  });

  // ── AUDIT LOG ──────────────────────────────
  app.get('/audit-log', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const _authUser = (request as any).authUser;
    const query = z.object({
      startDate: dateOrIso.optional(),
      endDate: dateOrIso.optional(),
      entityType: z.string().optional(),
      page: z.string().optional().transform((v) => (v ? Number(v) : undefined)),
      limit: z.string().optional().transform((v) => (v ? Number(v) : undefined)),
    }).parse(request.query);

    return audit.query({
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      entityType: query.entityType,
      page: query.page,
      limit: query.limit,
    }, _authUser.organizationId);
  });

  // ── PERIOD CLOSE ───────────────────────────
  app.post('/periods/close', { preHandler: [authenticate, requireRole('owner')] }, async (request) => {
    const _authUser = (request as any).authUser;
    const body = z.object({
      label: z.string().min(1).max(20),
      periodType: z.enum(['monthly', 'quarterly', 'annual']),
      startDate: dateOrIso,
      endDate: dateOrIso,
    }).parse(request.body);

    const period = await prisma.financialPeriod.create({
      data: {
        label: body.label,
        periodType: body.periodType,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        isClosed: true,
        closedAt: new Date(),
      },
    });

    await audit.log({
      organizationId: _authUser.organizationId,
      userId: _authUser.userId,
      entityType: 'FinancialPeriod',
      entityId: period.id,
      action: 'period_close',
      newState: period,
    });

    return period;
  });

  // ── MONTHLY TREND ──────────────────────────
  app.get('/monthly-trend', { preHandler: [authenticate] }, async (request) => {
    const _authUser = (request as any).authUser;
    const query = z.object({
      year: z.string().transform(Number),
    }).parse(request.query);

    return unified.getMonthlyTrend(query.year, _authUser.userId);
  });

  // ── FLOCK PROFITABILITY ────────────────────
  app.get('/flock-profitability', { preHandler: [authenticate] }, async (request) => {
    const _authUser = (request as any).authUser;
    return unified.getFlockProfitability(_authUser.userId);
  });

  // ── EXPORT: INCOME STATEMENT ───────────────
  app.get('/export/income-statement', { preHandler: [authenticate] }, async (request, reply) => {
    const _authUser = (request as any).authUser;
    const query = z.object({
      format: z.enum(['csv']),
      startDate: dateOrIso.optional(),
      endDate: dateOrIso.optional(),
    }).parse(request.query);

    const stmt = await statements.getIncomeStatement({
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      userId: _authUser.userId,
    });

    const buf = reports.generateCsvIncomeStatement(stmt);
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="income-statement.csv"');
    return buf;
  });

  // ── EXPORT: BALANCE SHEET ──────────────────
  app.get('/export/balance-sheet', { preHandler: [authenticate] }, async (request, reply) => {
    const _authUser = (request as any).authUser;
    const query = z.object({
      format: z.enum(['csv']),
      asOfDate: dateOrIso.optional(),
    }).parse(request.query);

    const sheet = await statements.getBalanceSheet(
      query.asOfDate ? new Date(query.asOfDate) : new Date(),
      _authUser.userId,
    );

    const buf = reports.generateCsvBalanceSheet(sheet);
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="balance-sheet.csv"');
    return buf;
  });

  // ── EXPORT: CASH FLOW ──────────────────────
  app.get('/export/cash-flow', { preHandler: [authenticate] }, async (request, reply) => {
    const _authUser = (request as any).authUser;
    const query = z.object({
      format: z.enum(['csv']),
      startDate: dateOrIso.optional(),
      endDate: dateOrIso.optional(),
    }).parse(request.query);

    const cf = await statements.getCashFlow({
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      userId: _authUser.userId,
    });

    const buf = reports.generateCsvCashFlow(cf);
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="cash-flow.csv"');
    return buf;
  });

  // ── SCHEDULED REPORTS ──────────────────────
  app.post('/scheduled-reports', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const _authUser = (request as any).authUser;
    const body = z.object({
      name: z.string().min(1).max(100),
      reportType: z.enum(['income_statement', 'balance_sheet', 'cash_flow', 'cost_breakdown', 'flock_profitability', 'cycle_summary']),
      frequency: z.enum(['weekly', 'monthly', 'quarterly']),
      scope: z.enum(['global', 'flock', 'cycle']),
      scopeId: z.string().uuid().optional(),
      recipients: z.array(z.string().email()).min(1),
      format: z.enum(['pdf', 'csv', 'excel']),
      isActive: z.boolean().optional(),
    }).parse(request.body);

    return scheduler.createSchedule({ ...body, createdBy: _authUser.userId });
  });

  app.get('/scheduled-reports', { preHandler: [authenticate] }, async (request) => {
    const _authUser = (request as any).authUser;
    return scheduler.listSchedules(_authUser.userId);
  });

  app.patch('/scheduled-reports/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      name: z.string().min(1).max(100).optional(),
      reportType: z.enum(['income_statement', 'balance_sheet', 'cash_flow', 'cost_breakdown', 'flock_profitability', 'cycle_summary']).optional(),
      frequency: z.enum(['weekly', 'monthly', 'quarterly']).optional(),
      scope: z.enum(['global', 'flock', 'cycle']).optional(),
      scopeId: z.string().uuid().optional().nullable(),
      recipients: z.array(z.string().email()).min(1).optional(),
      format: z.enum(['pdf', 'csv', 'excel']).optional(),
      isActive: z.boolean().optional(),
    }).parse(request.body);

    return scheduler.updateSchedule(id, { ...body, scopeId: body.scopeId ?? undefined });
  });

  app.delete('/scheduled-reports/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await scheduler.deleteSchedule(id);
    reply.status(204).send();
  });

  app.get('/scheduled-reports/:id/executions', { preHandler: [authenticate] }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    return scheduler.getExecutions(id);
  });

  // ── MONTHLY OVERHEADS ──────────────────────
  app.get('/overheads', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const _authUser = (request as any).authUser;
    return overheads.listMonthlyOverheads(_authUser.organizationId);
  });

  app.post('/overheads', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const _authUser = (request as any).authUser;
    const body = z.object({
      yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
      category: z.enum(['medication', 'vaccination', 'labour', 'electricity', 'water', 'litter', 'transport_to_market', 'other']),
      description: z.string().optional(),
      amountZmw: z.number().positive(),
      contractType: z.enum(['monthly', 'weekly', 'daily', 'once_off']),
    }).parse(request.body);

    const created = await overheads.createMonthlyOverhead({ ...body, createdBy: _authUser.userId, organizationId: _authUser.organizationId });
    await overheads.allocateOverheadForMonth(body.yearMonth, _authUser.organizationId);
    return created;
  });

  app.delete('/overheads/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const _authUser = (request as any).authUser;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const result = await overheads.deleteMonthlyOverhead(id, _authUser.organizationId);
    if (!result) return reply.status(404).send({ error: 'NOT_FOUND' });
    reply.status(204).send();
  });

  app.post('/overheads/allocate/:yearMonth', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const _authUser = (request as any).authUser;
    const { yearMonth } = z.object({ yearMonth: z.string().regex(/^\d{4}-\d{2}$/) }).parse(request.params);
    return overheads.allocateOverheadForMonth(yearMonth, _authUser.organizationId);
  });

  // ── HARVEST PROJECTIONS ────────────────────
  app.get('/projections', { preHandler: [authenticate] }, async (request) => {
    const _authUser = (request as any).authUser;
    return projections.getProjections(_authUser.userId);
  });

  app.post('/projections/refresh', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    // Harvest projection auto-generation DISABLED
    reply.header('Sunset', 'Sun, 01 Jan 2027 00:00:00 GMT');
    reply.header('Deprecation', 'true');
    return { error: 'Harvest projection auto-generation has been disabled. Projections are no longer auto-created as financial records.' };
  });
}
