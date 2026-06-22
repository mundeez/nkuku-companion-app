import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';

const FlockCreateSchema = z.object({
  name: z.string().min(1).max(100),
  breedId: z.string().uuid(),
  supplierId: z.string().uuid().optional(),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  initialCount: z.number().int().min(1),
  targetWeight: z.number().positive().optional(),
  targetAge: z.number().int().positive().optional(),
  feedTransitionDay: z.number().int().min(1).max(21).optional(),
  chickPriceZmw: z.number().nonnegative().optional(),
});

const FlockUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  breedId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional().nullable(),
  targetWeight: z.number().positive().optional(),
  targetAge: z.number().int().positive().optional(),
  feedTransitionDay: z.number().int().min(1).max(21).optional(),
  chickPriceZmw: z.number().nonnegative().optional().nullable(),
  status: z.enum(['active', 'completed', 'cancelled']).optional(),
  currentCount: z.number().int().min(0).optional(),
});

export async function buildBroilerFlockModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const authUser = (request as any).authUser;
    const query = z.object({
      status: z.enum(['active', 'completed', 'cancelled']).optional(),
      breedId: z.string().uuid().optional(),
    }).parse(request.query);

    const where: any = { createdBy: authUser.userId };
    if (query.status) where.status = query.status;
    if (query.breedId) where.breedId = query.breedId;

    return prisma.broilerFlock.findMany({
      where,
      include: { breed: true, supplier: { select: { id: true, name: true, feedStages: true } } },
      orderBy: { startDate: 'desc' },
    });
  });

  app.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const authUser = (request as any).authUser;
    const flock = await prisma.broilerFlock.findFirst({
      where: { id, createdBy: authUser.userId },
      include: {
        breed: { include: { performanceTargets: { orderBy: { ageDays: 'asc' } } } },
        supplier: { select: { id: true, name: true, feedStages: true } },
        growthRecords: { orderBy: { recordDate: 'desc' }, take: 1 },
        _count: {
          select: {
            growthRecords: true,
            feedRecords: true,
            mortalityEvents: true,
            vaccinationEvents: true,
            financialRecords: true,
          },
        },
      },
    });
    if (!flock) return reply.status(404).send({ error: 'NOT_FOUND' });
    return flock;
  });

  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const data = FlockCreateSchema.parse(request.body);
    const authUser = (request as any).authUser;
    const startDate = new Date(data.startDate);
    return prisma.broilerFlock.create({
      data: {
        ...data,
        startDate,
        currentCount: data.initialCount,
        feedTransitionDay: data.feedTransitionDay ?? 11,
        createdBy: authUser.userId,
      },
      include: { breed: true },
    });
  });

  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = FlockUpdateSchema.parse(request.body);
    const authUser = (request as any).authUser;
    const flock = await prisma.broilerFlock.updateMany({
      where: { id, createdBy: authUser.userId },
      data,
    });
    if (flock.count === 0) return reply.status(404).send({ error: 'NOT_FOUND' });
    return prisma.broilerFlock.findUnique({ where: { id }, include: { breed: true, supplier: { select: { id: true, name: true, feedStages: true } } } });
  });

  app.delete('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const authUser = (request as any).authUser;
    const result = await prisma.broilerFlock.deleteMany({
      where: { id, createdBy: authUser.userId },
    });
    if (result.count === 0) return reply.status(404).send({ error: 'NOT_FOUND' });
    return { deleted: true };
  });

  // GET /api/v1/broiler-flocks/:id/dashboard - Dashboard data
  app.get('/:id/dashboard', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const authUser = (request as any).authUser;
    const flock = await prisma.broilerFlock.findFirst({
      where: { id, createdBy: authUser.userId },
      include: {
        breed: true,
        growthRecords: { orderBy: { recordDate: 'desc' }, take: 1 },
        feedRecords: { orderBy: { recordDate: 'desc' }, take: 5 },
        mortalityEvents: { orderBy: { eventDate: 'desc' }, take: 5 },
        vaccinationEvents: { orderBy: { adminDate: 'desc' }, take: 5 },
        alerts: { where: { isResolved: false }, orderBy: { dueDate: 'asc' } },
        _count: {
          select: {
            growthRecords: true,
            feedRecords: true,
            waterRecords: true,
            mortalityEvents: true,
            vaccinationEvents: true,
            financialRecords: true,
          },
        },
      },
    });
    if (!flock) return reply.status(404).send({ error: 'NOT_FOUND' });

    // Calculate current age in days
    const today = new Date();
    const startDate = new Date(flock.startDate);
    const ageDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Get target weight for current age
    const target = await prisma.performanceTarget.findUnique({
      where: { breedId_ageDays: { breedId: flock.breedId, ageDays } },
    });

    // Calculate mortality rate
    const totalMortality = await prisma.mortalityEvent.aggregate({
      where: { flockId: id },
      _sum: { count: true },
    });
    const mortalityRate = flock.initialCount > 0
      ? ((totalMortality._sum.count ?? 0) / flock.initialCount) * 100
      : 0;

    return {
      flock,
      ageDays,
      targetWeight: target?.targetWeight ?? null,
      targetFcr: target?.targetFcr ?? null,
      mortalityRate,
    };
  });
}
