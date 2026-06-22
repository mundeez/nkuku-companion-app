import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';

const FeedRecordCreateSchema = z.object({
  flockId: z.string().uuid(),
  supplierId: z.string().uuid().optional(),
  recordDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  feedType: z.string().min(1).max(50),
  feedBrand: z.string().optional(),
  quantityKg: z.number().positive(),
  costZmw: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export async function buildFeedRecordModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({
      flockId: z.string().uuid(),
    }).parse(request.query);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    return prisma.feedRecord.findMany({
      where: { flockId },
      orderBy: { recordDate: 'asc' },
      include: { supplier: { select: { name: true } } },
    });
  });

  app.get('/summary', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({
      flockId: z.string().uuid(),
    }).parse(request.query);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    const summary = await prisma.feedRecord.groupBy({
      by: ['feedType'],
      where: { flockId },
      _sum: { quantityKg: true, costZmw: true },
      _count: true,
    });

    const supplierBreakdown = await prisma.feedRecord.groupBy({
      by: ['feedBrand'],
      where: { flockId },
      _sum: { quantityKg: true, costZmw: true },
    });

    const totalFeed = await prisma.feedRecord.aggregate({
      where: { flockId },
      _sum: { quantityKg: true, costZmw: true },
    });

    const costPerBird = flock.currentCount > 0 && totalFeed._sum.costZmw
      ? Number(totalFeed._sum.costZmw) / flock.currentCount
      : 0;

    return {
      summary,
      supplierBreakdown,
      totalFeedKg: totalFeed._sum.quantityKg ?? 0,
      totalCostZmw: totalFeed._sum.costZmw ?? 0,
      costPerBird,
      currentCount: flock.currentCount,
    };
  });

  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const { flockId, ...data } = FeedRecordCreateSchema.parse(request.body);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    // Auto-derive feedBrand from supplier name if not provided
    let feedBrand = data.feedBrand;
    if (data.supplierId && !feedBrand) {
      const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
      feedBrand = supplier?.name ?? null;
    }

    return prisma.feedRecord.create({
      data: {
        ...data,
        feedBrand,
        recordDate: new Date(data.recordDate),
        flockId,
      },
    });
  });



  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = FeedRecordCreateSchema.partial().parse(request.body);
    const authUser = (request as any).authUser;

    const record = await prisma.feedRecord.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.createdBy !== authUser.userId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    return prisma.feedRecord.update({
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

    const record = await prisma.feedRecord.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.createdBy !== authUser.userId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    await prisma.feedRecord.delete({ where: { id } });
    return { deleted: true };
  });
}
