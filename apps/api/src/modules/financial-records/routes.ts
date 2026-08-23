import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';
import { AuditService } from '../../core/financial-engine/audit.service.js';
import { bulkRateLimit } from '../../core/security/rate-limiter.js';
import { checkFlockNotLocked, assertFlockNotCompleted } from '../broiler-flocks/check-flock-locked.js';

const FinancialRecordCreateSchema = z.object({
  flockId: z.string().uuid(),
  recordDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  category: z.enum(['chick_purchase', 'feed', 'vaccines', 'medication', 'labor', 'utilities', 'equipment', 'sales', 'other']),
  description: z.string().min(1).max(200),
  amountZmw: z.number().nonnegative(),
  isIncome: z.boolean().optional(),
  notes: z.string().optional(),
});

export async function buildFinancialRecordModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  const audit = new AuditService(prisma);
  const flockLock = checkFlockNotLocked(prisma);

  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({ flockId: z.string().uuid().optional() }).parse(request.query);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    if (flockId) {
      const flock = await prisma.broilerFlock.findFirst({
        where: { id: flockId, organizationId },
      });
      if (!flock) return { error: 'NOT_FOUND' };

      return prisma.financialRecord.findMany({
        where: { flockId },
        orderBy: { recordDate: 'desc' },
      });
    }

    // No flockId — return all records for the user
    return prisma.financialRecord.findMany({
      where: { flock: { organizationId } },
      orderBy: { recordDate: 'desc' },
    });
  });

  // GET /:id — single financial record with documents
  app.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const record = await prisma.financialRecord.findFirst({
      where: { id },
      include: { flock: true, documents: { orderBy: { createdAt: 'desc' } } },
    });
    if (!record || record.flock.organizationId !== organizationId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    // Strip sensitive fields from documents
    const { _flock, documents, ...safe } = record;
    return {
      ...safe,
      documents: documents.map((doc: any) => {
        const { filePath: _filePath, storageKey: _storageKey, contentText: _contentText, ...docSafe } = doc;
        return { ...docSafe, downloadUrl: `/api/v1/documents/${doc.id}/download` };
      }),
    };
  });

  app.get('/summary', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({ flockId: z.string().uuid().optional() }).parse(request.query);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const where = flockId
      ? { flockId }
      : { flock: { organizationId } };

    if (flockId) {
      const flock = await prisma.broilerFlock.findFirst({
        where: { id: flockId, organizationId },
      });
      if (!flock) return { error: 'NOT_FOUND' };

      const costs = await prisma.financialRecord.aggregate({
        where: { flockId, isIncome: false },
        _sum: { amountZmw: true },
      });

      const revenue = await prisma.financialRecord.aggregate({
        where: { flockId, isIncome: true },
        _sum: { amountZmw: true },
      });

      const categoryBreakdown = await prisma.financialRecord.groupBy({
        by: ['category'],
        where: { flockId },
        _sum: { amountZmw: true },
      });

      const totalCost = costs._sum.amountZmw ?? 0;
      const totalRevenue = revenue._sum.amountZmw ?? 0;
      const profit = totalRevenue - totalCost;
      const profitPerBird = flock.currentCount > 0 ? profit / flock.currentCount : 0;

      const mortality = await prisma.mortalityEvent.aggregate({
        where: { flockId },
        _sum: { count: true },
      });
      const totalMortality = Number(mortality._sum.count ?? 0);
      const survivors = Math.max(0, flock.initialCount - totalMortality);
      const salePricePerBird = Number(flock.salePriceZmw ?? 0);
      const projectedRevenue = salePricePerBird * survivors;
      const projectedProfit = projectedRevenue - totalCost;
      const projectedProfitPerBird = survivors > 0 ? projectedProfit / survivors : 0;

      return {
        totalCost,
        totalRevenue,
        profit,
        profitPerBird,
        categoryBreakdown,
        currentCount: flock.currentCount,
        initialCount: flock.initialCount,
        salePriceZmw: flock.salePriceZmw,
        totalMortality,
        projectedRevenue,
        projectedProfit,
        projectedProfitPerBird,
      };
    }

    // No flockId — return global summary
    const costs = await prisma.financialRecord.aggregate({
      where: { ...where, isIncome: false },
      _sum: { amountZmw: true },
    });

    const revenue = await prisma.financialRecord.aggregate({
      where: { ...where, isIncome: true },
      _sum: { amountZmw: true },
    });

    const categoryBreakdown = await prisma.financialRecord.groupBy({
      by: ['category'],
      where,
      _sum: { amountZmw: true },
    });

    const totalCost = costs._sum.amountZmw ?? 0;
    const totalRevenue = revenue._sum.amountZmw ?? 0;

    return {
      totalCost,
      totalRevenue,
      profit: totalRevenue - totalCost,
      profitPerBird: 0,
      categoryBreakdown,
      currentCount: 0,
    };
  });

  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager'), flockLock] }, async (request) => {
    const { flockId, ...data } = FinancialRecordCreateSchema.parse(request.body);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, organizationId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    const created = await prisma.financialRecord.create({
      data: {
        ...data,
        recordDate: new Date(data.recordDate),
        flockId,
      },
    });

    await audit.log({
      organizationId,
      userId: _authUser.userId,
      entityType: 'FinancialRecord',
      entityId: created.id,
      action: 'create',
      newState: created,
      ipAddress: request.ip,
    });

    return created;
  });

  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = FinancialRecordCreateSchema.partial().omit({ flockId: true }).parse(request.body);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const record = await prisma.financialRecord.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.organizationId !== organizationId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    if (assertFlockNotCompleted(reply, record.flock.status, (request as any).authUser?.role)) return;

    const updated = await prisma.financialRecord.update({
      where: { id },
      data: {
        ...data,
        recordDate: data.recordDate ? new Date(data.recordDate) : undefined,
      },
    });

    await audit.log({
      organizationId,
      userId: _authUser.userId,
      entityType: 'FinancialRecord',
      entityId: id,
      action: 'update',
      previousState: record,
      newState: updated,
      ipAddress: request.ip,
    });

    return updated;
  });

  app.delete('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const record = await prisma.financialRecord.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.organizationId !== organizationId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    if (assertFlockNotCompleted(reply, record.flock.status, (request as any).authUser?.role)) return;

    await prisma.financialRecord.delete({ where: { id } });

    await audit.log({
      organizationId,
      userId: _authUser.userId,
      entityType: 'FinancialRecord',
      entityId: id,
      action: 'delete',
      previousState: record,
      ipAddress: request.ip,
    });

    return { deleted: true };
  });

  // POST /bulk — bulk create or bulk delete financial records
  app.post('/bulk', { preHandler: [authenticate, requireRole('owner', 'manager'), bulkRateLimit] }, async (request, reply) => {
    const body = z.object({
      action: z.enum(['create', 'delete']),
      records: z.array(FinancialRecordCreateSchema).max(500).optional(),
      ids: z.array(z.string().uuid()).min(1).max(500).optional(),
    }).parse(request.body);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    if (body.action === 'create') {
      if (!body.records?.length) return reply.status(400).send({ error: 'RECORDS_REQUIRED' });

      const flockIds = [...new Set(body.records.map((r) => r.flockId))];
      const flocks = await prisma.broilerFlock.findMany({
        where: { id: { in: flockIds }, organizationId },
        select: { id: true, status: true },
      });
      const validFlockIds = new Set(flocks.map((f: any) => f.id));

      // Check for completed flocks (non-owner cannot create records on completed flocks)
      const authUser = (request as any).authUser;
      if (authUser?.role !== 'owner') {
        const completedFlocks = flocks.filter((f: any) => f.status === 'completed');
        if (completedFlocks.length > 0) {
          return reply.status(403).send({
            error: 'FLOCK_COMPLETED',
            message: 'Cannot create records on a completed flock. Only the owner can modify completed flocks.',
          });
        }
      }

      const validRecords = body.records.filter((r) => validFlockIds.has(r.flockId));

      const created = await prisma.$transaction(async (tx: any) => {
        const records = [];
        for (const r of validRecords) {
          const record = await tx.financialRecord.create({
            data: {
              flockId: r.flockId,
              recordDate: new Date(r.recordDate),
              category: r.category,
              description: r.description,
              amountZmw: r.amountZmw,
              isIncome: r.isIncome,
              notes: r.notes,
            },
          });
          await audit.log({
            organizationId,
            userId: _authUser.userId,
            entityType: 'FinancialRecord',
            entityId: record.id,
            action: 'create',
            newState: record,
            ipAddress: request.ip,
          }, tx);
          records.push(record);
        }
        return records;
      });

      return { action: 'create', affected: created.length, skipped: body.records.length - created.length, records: created };
    }

    if (body.action === 'delete') {
      if (!body.ids?.length) return reply.status(400).send({ error: 'IDS_REQUIRED' });

      if (_authUser.role !== 'owner') {
        return reply.status(403).send({ error: 'FORBIDDEN' });
      }

      const records = await prisma.financialRecord.findMany({
        where: { id: { in: body.ids } },
        include: { flock: { select: { organizationId: true } } },
      });
      const validRecords = records.filter((r: any) => r.flock.organizationId === organizationId);
      const validIds = validRecords.map((r: any) => r.id);

      await prisma.$transaction(async (tx: any) => {
        await tx.financialRecord.deleteMany({ where: { id: { in: validIds } } });
        for (const record of validRecords) {
          await audit.log({
            organizationId,
            userId: _authUser.userId,
            entityType: 'FinancialRecord',
            entityId: record.id,
            action: 'delete',
            previousState: record,
            ipAddress: request.ip,
          }, tx);
        }
      });

      return { action: 'delete', affected: validIds.length, skipped: body.ids.length - validIds.length };
    }

    return reply.status(400).send({ error: 'INVALID_ACTION' });
  });
}
