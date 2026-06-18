import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';

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

  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({ flockId: z.string().uuid() }).parse(request.query);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    return prisma.financialRecord.findMany({
      where: { flockId },
      orderBy: { recordDate: 'desc' },
    });
  });

  app.get('/summary', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({ flockId: z.string().uuid() }).parse(request.query);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
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

    return {
      totalCost,
      totalRevenue,
      profit,
      profitPerBird,
      categoryBreakdown,
      currentCount: flock.currentCount,
    };
  });

  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const { flockId, ...data } = FinancialRecordCreateSchema.parse(request.body);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    return prisma.financialRecord.create({
      data: {
        ...data,
        recordDate: new Date(data.recordDate),
        flockId,
      },
    });
  });



  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = FinancialRecordCreateSchema.partial().parse(request.body);
    const authUser = (request as any).authUser;

    const record = await prisma.financialRecord.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.createdBy !== authUser.userId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    return prisma.financialRecord.update({
      where: { id },
      data: {
        ...data,
        recordDate: data.recordDate ? new Date(data.recordDate) : undefined,
      },
    });
  });

  app.delete('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const authUser = (request as any).authUser;

    const record = await prisma.financialRecord.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.createdBy !== authUser.userId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    await prisma.financialRecord.delete({ where: { id } });
    return { deleted: true };
  });
}
