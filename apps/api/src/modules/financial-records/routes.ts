import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';
import { AuditService } from '../../core/financial-engine/audit.service.js';

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

  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({ flockId: z.string().uuid().optional() }).parse(request.query);
    const authUser = (request as any).authUser;
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
    const authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const record = await prisma.financialRecord.findFirst({
      where: { id },
      include: { flock: true, documents: { orderBy: { createdAt: 'desc' } } },
    });
    if (!record || record.flock.organizationId !== organizationId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    // Strip sensitive fields from documents
    const { flock, documents, ...safe } = record;
    return {
      ...safe,
      documents: documents.map((doc: any) => {
        const { filePath, storageKey, contentText, ...docSafe } = doc;
        return { ...docSafe, downloadUrl: `/api/v1/documents/${doc.id}/download` };
      }),
    };
  });

  app.get('/summary', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({ flockId: z.string().uuid().optional() }).parse(request.query);
    const authUser = (request as any).authUser;
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

  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const { flockId, ...data } = FinancialRecordCreateSchema.parse(request.body);
    const authUser = (request as any).authUser;
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
      userId: authUser.userId,
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
    const data = FinancialRecordCreateSchema.partial().parse(request.body);
    const authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const record = await prisma.financialRecord.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.organizationId !== organizationId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    const updated = await prisma.financialRecord.update({
      where: { id },
      data: {
        ...data,
        recordDate: data.recordDate ? new Date(data.recordDate) : undefined,
      },
    });

    await audit.log({
      userId: authUser.userId,
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
    const authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const record = await prisma.financialRecord.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.organizationId !== organizationId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    await prisma.financialRecord.delete({ where: { id } });

    await audit.log({
      userId: authUser.userId,
      entityType: 'FinancialRecord',
      entityId: id,
      action: 'delete',
      previousState: record,
      ipAddress: request.ip,
    });

    return { deleted: true };
  });
}
