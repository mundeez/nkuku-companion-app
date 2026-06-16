import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';

const MortalityEventCreateSchema = z.object({
  eventDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  count: z.number().int().min(1),
  cause: z.string().optional(),
  ageDays: z.number().int().optional(),
  notes: z.string().optional(),
});

export async function buildMortalityEventModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({ flockId: z.string().uuid() }).parse(request.query);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    return prisma.mortalityEvent.findMany({
      where: { flockId },
      orderBy: { eventDate: 'asc' },
    });
  });

  app.get('/summary', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({ flockId: z.string().uuid() }).parse(request.query);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    const totalDeaths = await prisma.mortalityEvent.aggregate({
      where: { flockId },
      _sum: { count: true },
    });

    const mortalityRate = flock.initialCount > 0
      ? ((totalDeaths._sum.count ?? 0) / flock.initialCount) * 100
      : 0;

    const causeBreakdown = await prisma.mortalityEvent.groupBy({
      by: ['cause'],
      where: { flockId },
      _sum: { count: true },
    });

    return {
      totalDeaths: totalDeaths._sum.count ?? 0,
      mortalityRate: mortalityRate.toFixed(2),
      initialCount: flock.initialCount,
      currentCount: flock.currentCount,
      causeBreakdown,
    };
  });

  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const data = MortalityEventCreateSchema.parse(request.body);
    const { flockId } = z.object({ flockId: z.string().uuid() }).parse(request.query);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    // Update current count
    await prisma.broilerFlock.update({
      where: { id: flockId },
      data: { currentCount: Math.max(0, flock.currentCount - data.count) },
    });

    return prisma.mortalityEvent.create({
      data: {
        ...data,
        eventDate: new Date(data.eventDate),
        flockId,
      },
    });
  });

  app.delete('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const authUser = (request as any).authUser;

    const event = await prisma.mortalityEvent.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!event || event.flock.createdBy !== authUser.userId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    // Restore count
    await prisma.broilerFlock.update({
      where: { id: event.flockId },
      data: { currentCount: { increment: event.count } },
    });

    await prisma.mortalityEvent.delete({ where: { id } });
    return { deleted: true };
  });
}
