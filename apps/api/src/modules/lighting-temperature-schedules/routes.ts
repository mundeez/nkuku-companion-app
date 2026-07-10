import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';
import { getLightingTemperatureScheduleForFlock } from '../../core/lighting-temperature-schedule.service.js';

const dateOrIso = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

const LightingTemperatureScheduleCreateSchema = z.object({
  name: z.string().min(1).max(100),
  breedId: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  housingType: z.enum(['whole_house', 'spot_brooding']),
  isDefault: z.boolean().optional(),
  items: z.array(z.object({
    ageDays: z.number().int().min(0).max(100),
    lightHours: z.number().min(0).max(24).optional().nullable(),
    darkHours: z.number().min(0).max(24).optional().nullable(),
    lightIntensityLux: z.number().int().min(0).optional().nullable(),
    darkIntensityLux: z.number().int().min(0).optional().nullable(),
    targetTempC: z.number().min(0).max(60).optional().nullable(),
    targetTempMinC: z.number().min(0).max(60).optional().nullable(),
    targetTempMaxC: z.number().min(0).max(60).optional().nullable(),
    targetRhMinPct: z.number().int().min(0).max(100).optional().nullable(),
    targetRhMaxPct: z.number().int().min(0).max(100).optional().nullable(),
    notes: z.string().optional().nullable(),
  })).optional(),
});

const LightingTemperatureScheduleItemUpdateSchema = z.object({
  ageDays: z.number().int().min(0).max(100).optional(),
  lightHours: z.number().min(0).max(24).optional().nullable(),
  darkHours: z.number().min(0).max(24).optional().nullable(),
  lightIntensityLux: z.number().int().min(0).optional().nullable(),
  darkIntensityLux: z.number().int().min(0).optional().nullable(),
  targetTempC: z.number().min(0).max(60).optional().nullable(),
  targetTempMinC: z.number().min(0).max(60).optional().nullable(),
  targetTempMaxC: z.number().min(0).max(60).optional().nullable(),
  targetRhMinPct: z.number().int().min(0).max(100).optional().nullable(),
  targetRhMaxPct: z.number().int().min(0).max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function buildLightingTemperatureScheduleModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  async function getScheduleForFlock(flock: any, userId: string) {
    return getLightingTemperatureScheduleForFlock(prisma, flock, userId);
  }

  // GET /api/v1/lighting-temperature-schedules - list schedules
  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const authUser = (request as any).authUser;
    return prisma.lightingTemperatureSchedule.findMany({
      where: { OR: [{ createdBy: authUser.userId }, { createdBy: null }] },
      include: { items: { orderBy: { ageDays: 'asc' } }, breed: { select: { name: true } } },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  });

  // GET /api/v1/lighting-temperature-schedules/current?flockId=...
  app.get('/current', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({ flockId: z.string().uuid() }).parse(request.query);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
      include: { breed: true },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    const today = new Date();
    const startDate = new Date(flock.startDate);
    const ageDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const schedule = await getScheduleForFlock(flock, authUser.userId);
    const item = schedule?.items?.find((i: any) => i.ageDays === ageDays);

    return {
      schedule: schedule ? { id: schedule.id, name: schedule.name, description: schedule.description } : null,
      ageDays,
      item: item || null,
    };
  });

  // GET /api/v1/lighting-temperature-schedules/:id
  app.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const authUser = (request as any).authUser;

    const schedule = await prisma.lightingTemperatureSchedule.findFirst({
      where: { id, OR: [{ createdBy: authUser.userId }, { createdBy: null }] },
      include: { items: { orderBy: { ageDays: 'asc' } }, breed: { select: { name: true } } },
    });
    if (!schedule) return reply.status(404).send({ error: 'NOT_FOUND' });

    return schedule;
  });

  // POST /api/v1/lighting-temperature-schedules - create schedule (owner/manager)
  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const data = LightingTemperatureScheduleCreateSchema.parse(request.body);
    const authUser = (request as any).authUser;

    const schedule = await prisma.lightingTemperatureSchedule.create({
      data: {
        name: data.name,
        breedId: data.breedId,
        description: data.description,
        housingType: data.housingType,
        isDefault: data.isDefault ?? false,
        createdBy: authUser.userId,
        items: {
          create: (data.items || []).map((item, idx) => ({ ...item, sortOrder: idx })),
        },
      },
      include: { items: { orderBy: { ageDays: 'asc' } } },
    });

    return schedule;
  });

  // PATCH /api/v1/lighting-temperature-schedules/:id - update schedule metadata
  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = LightingTemperatureScheduleCreateSchema.partial().parse(request.body);
    const authUser = (request as any).authUser;

    const schedule = await prisma.lightingTemperatureSchedule.findFirst({
      where: { id },
    });
    if (!schedule || (schedule.createdBy && schedule.createdBy !== authUser.userId)) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    const updated = await prisma.lightingTemperatureSchedule.update({
      where: { id },
      data: {
        name: data.name,
        breedId: data.breedId,
        description: data.description,
        housingType: data.housingType,
        isDefault: data.isDefault,
      },
      include: { items: { orderBy: { ageDays: 'asc' } } },
    });

    return updated;
  });

  // DELETE /api/v1/lighting-temperature-schedules/:id
  app.delete('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const authUser = (request as any).authUser;

    const schedule = await prisma.lightingTemperatureSchedule.findFirst({
      where: { id },
    });
    if (!schedule || (schedule.createdBy && schedule.createdBy !== authUser.userId)) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    await prisma.lightingTemperatureSchedule.delete({ where: { id } });
    return { deleted: true };
  });

  // POST /api/v1/lighting-temperature-schedules/:id/items - create item
  app.post('/:id/items', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = LightingTemperatureScheduleItemUpdateSchema.parse(request.body);
    const authUser = (request as any).authUser;

    const schedule = await prisma.lightingTemperatureSchedule.findFirst({
      where: { id },
    });
    if (!schedule || (schedule.createdBy && schedule.createdBy !== authUser.userId)) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    const item = await prisma.lightingTemperatureScheduleItem.create({
      data: {
        ...data,
        scheduleId: id,
      },
    });

    return item;
  });

  // PATCH /api/v1/lighting-temperature-schedules/:id/items/:itemId
  app.patch('/:id/items/:itemId', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const { id, itemId } = z.object({ id: z.string().uuid(), itemId: z.string().uuid() }).parse(request.params);
    const data = LightingTemperatureScheduleItemUpdateSchema.partial().parse(request.body);
    const authUser = (request as any).authUser;

    const schedule = await prisma.lightingTemperatureSchedule.findFirst({
      where: { id },
    });
    if (!schedule || (schedule.createdBy && schedule.createdBy !== authUser.userId)) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    const item = await prisma.lightingTemperatureScheduleItem.update({
      where: { id: itemId },
      data,
    });

    return item;
  });

  // DELETE /api/v1/lighting-temperature-schedules/:id/items/:itemId
  app.delete('/:id/items/:itemId', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id, itemId } = z.object({ id: z.string().uuid(), itemId: z.string().uuid() }).parse(request.params);
    const authUser = (request as any).authUser;

    const schedule = await prisma.lightingTemperatureSchedule.findFirst({
      where: { id },
    });
    if (!schedule || (schedule.createdBy && schedule.createdBy !== authUser.userId)) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    await prisma.lightingTemperatureScheduleItem.delete({ where: { id: itemId } });
    return { deleted: true };
  });

  // Expose helper for other modules
  (app as any).getLightingTemperatureScheduleForFlock = getScheduleForFlock;
}
