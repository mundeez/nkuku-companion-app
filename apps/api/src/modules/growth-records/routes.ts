import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';

const GrowthRecordCreateSchema = z.object({
  flockId: z.string().uuid(),
  recordDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  sampleSize: z.number().int().min(1),
  avgWeight: z.number().positive(),
  notes: z.string().optional(),
});

export async function buildGrowthRecordModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({
      flockId: z.string().uuid(),
    }).parse(request.query);
    const authUser = (request as any).authUser;

    // Verify flock ownership
    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    return prisma.growthRecord.findMany({
      where: { flockId },
      orderBy: { recordDate: 'asc' },
    });
  });

  app.get('/analysis', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({
      flockId: z.string().uuid(),
    }).parse(request.query);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
      include: { breed: true },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    const records = await prisma.growthRecord.findMany({
      where: { flockId },
      orderBy: { recordDate: 'asc' },
    });

    const today = new Date();
    const startDate = new Date(flock.startDate);
    const ageDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Get performance targets for comparison
    const targets = await prisma.performanceTarget.findMany({
      where: { breedId: flock.breedId },
      orderBy: { ageDays: 'asc' },
    });

    // Calculate FCR if feed data exists
    const totalFeed = await prisma.feedRecord.aggregate({
      where: { flockId },
      _sum: { quantityKg: true },
    });

    const latestRecord = records[records.length - 1];
    let fcr = null;
    if (latestRecord && totalFeed._sum.quantityKg && flock.currentCount > 0) {
      const totalFeedKg = Number(totalFeed._sum.quantityKg);
      const totalWeightGain = (Number(latestRecord.avgWeight) * flock.currentCount) / 1000;
      if (totalWeightGain > 0) {
        fcr = totalFeedKg / totalWeightGain;
      }
    }

    return {
      records,
      ageDays,
      targets,
      fcr,
      currentCount: flock.currentCount,
    };
  });

  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const { flockId, ...data } = GrowthRecordCreateSchema.parse(request.body);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    return prisma.growthRecord.create({
      data: {
        ...data,
        recordDate: new Date(data.recordDate),
        flockId,
      },
    });
  });



  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = GrowthRecordCreateSchema.partial().parse(request.body);
    const authUser = (request as any).authUser;

    const record = await prisma.growthRecord.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.createdBy !== authUser.userId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    return prisma.growthRecord.update({
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

    const record = await prisma.growthRecord.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.createdBy !== authUser.userId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    await prisma.growthRecord.delete({ where: { id } });
    return { deleted: true };
  });
}
