import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';

const dateOrIso = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

const EnvironmentalRecordCreateSchema = z.object({
  flockId: z.string().uuid(),
  recordDate: dateOrIso,
  timeOfDay: z.string().max(20).optional(),
  temperatureC: z.number().min(0).max(60).optional(),
  humidityPct: z.number().min(0).max(100).optional(),
  ammoniaPpm: z.number().min(0).optional(),
  lightHours: z.number().min(0).max(24).optional(),
  litterScore: z.number().int().min(1).max(5).optional(),
  ventilationNote: z.string().optional(),
  notes: z.string().optional(),
});

export async function buildEnvironmentalRecordModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({ flockId: z.string().uuid() }).parse(request.query);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    return prisma.environmentalRecord.findMany({
      where: { flockId },
      orderBy: { recordDate: 'desc' },
    });
  });

  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const data = EnvironmentalRecordCreateSchema.parse(request.body);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: data.flockId, createdBy: authUser.userId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    const record = await prisma.environmentalRecord.create({
      data: {
        ...data,
        recordDate: new Date(data.recordDate),
      },
    });

    return record;
  });

  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = EnvironmentalRecordCreateSchema.partial().parse(request.body);
    const authUser = (request as any).authUser;

    const record = await prisma.environmentalRecord.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.createdBy !== authUser.userId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    const updated = await prisma.environmentalRecord.update({
      where: { id },
      data: {
        ...data,
        recordDate: data.recordDate ? new Date(data.recordDate) : undefined,
      },
    });

    return updated;
  });

  app.delete('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const authUser = (request as any).authUser;

    const record = await prisma.environmentalRecord.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.createdBy !== authUser.userId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    await prisma.environmentalRecord.delete({ where: { id } });
    return { deleted: true };
  });
}
