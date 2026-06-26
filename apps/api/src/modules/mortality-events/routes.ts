import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';

const MortalityEventCreateSchema = z.object({
  flockId: z.string().uuid(),
  eventDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  count: z.number().int().min(1),
  cause: z.string().optional(),
  ageDays: z.number().int().optional(),
  costZmw: z.number().nonnegative().optional(),
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
    const { flockId, ...data } = MortalityEventCreateSchema.parse(request.body);
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

    const record = await prisma.mortalityEvent.create({
      data: {
        ...data,
        eventDate: new Date(data.eventDate),
        flockId,
      },
    });

    // Auto-create financial record for mortality/disposal cost
    if (data.costZmw && data.costZmw > 0) {
      await prisma.financialRecord.create({
        data: {
          flockId,
          sourceRecordId: record.id,
          recordDate: new Date(data.eventDate),
          category: 'other',
          description: `Mortality/Disposal - ${data.count} birds (${data.cause || 'Unknown cause'})`,
          amountZmw: data.costZmw,
          isIncome: false,
          notes: 'Auto-generated from mortality record',
        },
      });
    }

    return record;
  });



  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = MortalityEventCreateSchema.partial().parse(request.body);
    const authUser = (request as any).authUser;

    const record = await prisma.mortalityEvent.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.createdBy !== authUser.userId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    // Adjust flock count if count changed
    if (data.count !== undefined && record.flock) {
      const delta = record.count - data.count;
      await prisma.broilerFlock.update({
        where: { id: record.flockId },
        data: { currentCount: { increment: delta } },
      });
    }

    const updated = await prisma.mortalityEvent.update({
      where: { id },
      data: {
        ...data,
        eventDate: data.eventDate ? new Date(data.eventDate) : undefined,
      },
    });

    // Sync financial record
    const finRecord = await prisma.financialRecord.findFirst({ where: { sourceRecordId: id } });
    if (data.costZmw !== undefined) {
      if (data.costZmw > 0) {
        const desc = `Mortality/Disposal - ${data.count ?? record.count} birds (${data.cause ?? record.cause ?? 'Unknown cause'})`;
        if (finRecord) {
          await prisma.financialRecord.update({
            where: { id: finRecord.id },
            data: {
              amountZmw: data.costZmw,
              description: desc,
              recordDate: data.eventDate ? new Date(data.eventDate) : finRecord.recordDate,
            },
          });
        } else {
          await prisma.financialRecord.create({
            data: {
              flockId: record.flockId,
              sourceRecordId: id,
              recordDate: new Date(data.eventDate || record.eventDate),
              category: 'other',
              description: desc,
              amountZmw: data.costZmw,
              isIncome: false,
              notes: 'Auto-generated from mortality record',
            },
          });
        }
      } else if (finRecord) {
        await prisma.financialRecord.delete({ where: { id: finRecord.id } });
      }
    }

    return updated;
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

    // Delete linked financial record
    const finRecord = await prisma.financialRecord.findFirst({ where: { sourceRecordId: id } });
    if (finRecord) await prisma.financialRecord.delete({ where: { id: finRecord.id } });

    await prisma.mortalityEvent.delete({ where: { id } });
    return { deleted: true };
  });
}
