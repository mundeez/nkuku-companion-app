import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';

const dateOrIso = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

const FlockCreateSchema = z.object({
  name: z.string().min(1).max(100),
  breedId: z.string().uuid(),
  supplierId: z.string().uuid().optional(),
  startDate: dateOrIso,
  initialCount: z.number().int().min(1),
  targetWeight: z.number().positive().optional(),
  targetAge: z.number().int().positive().optional(),
  feedTransitionDay: z.number().int().min(1).max(21).optional(),
  chickPriceZmw: z.number().nonnegative().optional(),
  chicksCollected: z.boolean().optional(),
  collectionDate: dateOrIso.nullable().optional(),
  chickQualityNotes: z.string().max(500).optional().nullable(),
});

const FlockUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  breedId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional().nullable(),
  targetWeight: z.number().positive().optional(),
  targetAge: z.number().int().positive().optional(),
  feedTransitionDay: z.number().int().min(1).max(21).optional(),
  chickPriceZmw: z.number().nonnegative().optional().nullable(),
  chicksCollected: z.boolean().optional(),
  collectionDate: dateOrIso.nullable().optional(),
  chickQualityNotes: z.string().max(500).optional().nullable(),
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
    const collectionDate = data.collectionDate ? new Date(data.collectionDate) : null;

    const flock = await prisma.broilerFlock.create({
      data: {
        name: data.name,
        breedId: data.breedId,
        supplierId: data.supplierId,
        startDate,
        initialCount: data.initialCount,
        currentCount: data.initialCount,
        targetWeight: data.targetWeight,
        targetAge: data.targetAge,
        feedTransitionDay: data.feedTransitionDay ?? 11,
        chickPriceZmw: data.chickPriceZmw,
        chicksCollected: data.chicksCollected ?? false,
        collectionDate,
        chickQualityNotes: data.chickQualityNotes,
        createdBy: authUser.userId,
      },
      include: { breed: true, supplier: { select: { name: true } } },
    });

    // Auto-create a financial record for chick purchase
    if (data.supplierId && data.chickPriceZmw && data.chickPriceZmw > 0) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: data.supplierId },
        select: { name: true },
      });
      await prisma.financialRecord.create({
        data: {
          flockId: flock.id,
          recordDate: startDate,
          category: 'chick_purchase',
          description: `Day-old chicks - ${supplier?.name || 'Unknown'} (${data.initialCount} birds)`,
          amountZmw: data.chickPriceZmw * data.initialCount,
          isIncome: false,
          notes: 'Auto-generated from flock creation',
        },
      });
    }

    return flock;
  });

  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const raw = FlockUpdateSchema.parse(request.body);
    const authUser = (request as any).authUser;

    const updateData: any = { ...raw };
    if (raw.collectionDate) updateData.collectionDate = new Date(raw.collectionDate);
    if (raw.collectionDate === null) updateData.collectionDate = null;
    if (raw.chickQualityNotes === '') updateData.chickQualityNotes = null;

    const flock = await prisma.broilerFlock.updateMany({
      where: { id, createdBy: authUser.userId },
      data: updateData,
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
