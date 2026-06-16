import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';

const WaterRecordCreateSchema = z.object({
  recordDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  quantityLiters: z.number().positive(),
  ph: z.number().min(0).max(14).optional(),
  temperature: z.number().optional(),
  notes: z.string().optional(),
});

export async function buildWaterRecordModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({ flockId: z.string().uuid() }).parse(request.query);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    return prisma.waterRecord.findMany({
      where: { flockId },
      orderBy: { recordDate: 'asc' },
    });
  });

  app.get('/ratio', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({ flockId: z.string().uuid() }).parse(request.query);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    const totalWater = await prisma.waterRecord.aggregate({
      where: { flockId },
      _sum: { quantityLiters: true },
    });

    const totalFeed = await prisma.feedRecord.aggregate({
      where: { flockId },
      _sum: { quantityKg: true },
    });

    const waterToFeedRatio = totalFeed._sum.quantityKg && Number(totalFeed._sum.quantityKg) > 0
      ? (Number(totalWater._sum.quantityLiters) / Number(totalFeed._sum.quantityKg)).toFixed(2)
      : null;

    return {
      totalWaterLiters: totalWater._sum.quantityLiters ?? 0,
      totalFeedKg: totalFeed._sum.quantityKg ?? 0,
      waterToFeedRatio,
    };
  });

  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const data = WaterRecordCreateSchema.parse(request.body);
    const { flockId } = z.object({ flockId: z.string().uuid() }).parse(request.query);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    return prisma.waterRecord.create({
      data: {
        ...data,
        recordDate: new Date(data.recordDate),
        flockId,
      },
    });
  });

  app.delete('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const authUser = (request as any).authUser;

    const record = await prisma.waterRecord.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.createdBy !== authUser.userId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    await prisma.waterRecord.delete({ where: { id } });
    return { deleted: true };
  });
}
