import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';
import { UnifiedFinancialService } from '../../core/financial-engine/unified-financial.service.js';
import { FinancialStatementService } from '../../core/financial-engine/statements.service.js';
import { AuditService } from '../../core/financial-engine/audit.service.js';
import { ReportGenerationService } from '../../core/financial-engine/report-generation.service.js';
import { SchedulerService } from '../../core/financial-engine/scheduler.service.js';

const dateOrIso = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

export async function buildFinancialEngineModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  const unified = new UnifiedFinancialService(prisma);
  const statements = new FinancialStatementService(prisma);
  const audit = new AuditService(prisma);
  const reports = new ReportGenerationService();
  const scheduler = new SchedulerService(prisma);

  // ── UNIFIED SUMMARY ──────────────────────
  app.get('/summary', { preHandler: [authenticate] }, async (request) => {
    const authUser = (request as any).authUser;
    const query = z.object({
      startDate: dateOrIso.optional(),
      endDate: dateOrIso.optional(),
      flockIds: z.string().optional(),
    }).parse(request.query);

    return unified.getUnifiedSummary({
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      flockIds: query.flockIds ? query.flockIds.split(',') : undefined,
      userId: authUser.userId,
    });
  });

  // ── INCOME STATEMENT ───────────────────────
  app.get('/income-statement', { preHandler: [authenticate] }, async (request) => {
    const authUser = (request as any).authUser;
    const query = z.object({
      startDate: dateOrIso.optional(),
      endDate: dateOrIso.optional(),
      flockIds: z.string().optional(),
    }).parse(request.query);

    return statements.getIncomeStatement({
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      flockIds: query.flockIds ? query.flockIds.split(',') : undefined,
      userId: authUser.userId,
    });
  });

  // ── BALANCE SHEET ──────────────────────────
  app.get('/balance-sheet', { preHandler: [authenticate] }, async (request) => {
    const authUser = (request as any).authUser;
    const query = z.object({
      asOfDate: dateOrIso.optional(),
    }).parse(request.query);

    return statements.getBalanceSheet(
      query.asOfDate ? new Date(query.asOfDate) : new Date(),
      authUser.userId,
    );
  });

  // ── CASH FLOW ──────────────────────────────
  app.get('/cash-flow', { preHandler: [authenticate] }, async (request) => {
    const authUser = (request as any).authUser;
    const query = z.object({
      startDate: dateOrIso.optional(),
      endDate: dateOrIso.optional(),
      flockIds: z.string().optional(),
    }).parse(request.query);

    return statements.getCashFlow({
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      flockIds: query.flockIds ? query.flockIds.split(',') : undefined,
      userId: authUser.userId,
    });
  });

  // ── AUDIT LOG ──────────────────────────────
  app.get('/audit-log', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const query = z.object({
      startDate: dateOrIso.optional(),
      endDate: dateOrIso.optional(),
      entityType: z.string().optional(),
      page: z.string().optional().transform(Number),
      limit: z.string().optional().transform(Number),
    }).parse(request.query);

    return audit.query({
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      entityType: query.entityType,
      page: query.page,
      limit: query.limit,
    }, '');
  });

  // ── PERIOD CLOSE ───────────────────────────
  app.post('/periods/close', { preHandler: [authenticate, requireRole('owner')] }, async (request) => {
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
      entityType: 'FinancialPeriod',
      entityId: period.id,
      action: 'period_close',
      newState: period,
    });

    return period;
  });

  // ── MONTHLY TREND ──────────────────────────
  app.get('/monthly-trend', { preHandler: [authenticate] }, async (request) => {
    const authUser = (request as any).authUser;
    const query = z.object({
      year: z.string().transform(Number),
    }).parse(request.query);

    return unified.getMonthlyTrend(query.year, authUser.userId);
  });

  // ── FLOCK PROFITABILITY ────────────────────
  app.get('/flock-profitability', { preHandler: [authenticate] }, async (request) => {
    const authUser = (request as any).authUser;
    return unified.getFlockProfitability(authUser.userId);
  });

  // ── EXPORT: INCOME STATEMENT ───────────────
  app.get('/export/income-statement', { preHandler: [authenticate] }, async (request, reply) => {
    const authUser = (request as any).authUser;
    const query = z.object({
      format: z.enum(['csv']),
      startDate: dateOrIso.optional(),
      endDate: dateOrIso.optional(),
    }).parse(request.query);

    const stmt = await statements.getIncomeStatement({
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      userId: authUser.userId,
    });

    const buf = reports.generateCsvIncomeStatement(stmt);
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="income-statement.csv"');
    return buf;
  });

  // ── EXPORT: BALANCE SHEET ──────────────────
  app.get('/export/balance-sheet', { preHandler: [authenticate] }, async (request, reply) => {
    const authUser = (request as any).authUser;
    const query = z.object({
      format: z.enum(['csv']),
      asOfDate: dateOrIso.optional(),
    }).parse(request.query);

    const sheet = await statements.getBalanceSheet(
      query.asOfDate ? new Date(query.asOfDate) : new Date(),
      authUser.userId,
    );

    const buf = reports.generateCsvBalanceSheet(sheet);
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="balance-sheet.csv"');
    return buf;
  });

  // ── EXPORT: CASH FLOW ──────────────────────
  app.get('/export/cash-flow', { preHandler: [authenticate] }, async (request, reply) => {
    const authUser = (request as any).authUser;
    const query = z.object({
      format: z.enum(['csv']),
      startDate: dateOrIso.optional(),
      endDate: dateOrIso.optional(),
    }).parse(request.query);

    const cf = await statements.getCashFlow({
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      userId: authUser.userId,
    });

    const buf = reports.generateCsvCashFlow(cf);
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="cash-flow.csv"');
    return buf;
  });

  // ── SCHEDULED REPORTS ──────────────────────
  app.post('/scheduled-reports', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const authUser = (request as any).authUser;
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

    return scheduler.createSchedule({ ...body, createdBy: authUser.userId });
  });

  app.get('/scheduled-reports', { preHandler: [authenticate] }, async (request) => {
    const authUser = (request as any).authUser;
    return scheduler.listSchedules(authUser.userId);
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

    return scheduler.updateSchedule(id, body);
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
}
