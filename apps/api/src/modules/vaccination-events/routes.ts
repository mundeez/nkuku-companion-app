import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';

const VaccinationEventCreateSchema = z.object({
  flockId: z.string().uuid(),
  vaccineName: z.string().min(1).max(100),
  vaccineType: z.string().max(100).optional(),
  adminDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  adminMethod: z.string().min(1).max(50),
  ageDays: z.number().int().min(0),
  nextDueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  notes: z.string().optional(),
});

export async function buildVaccinationEventModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({ flockId: z.string().uuid() }).parse(request.query);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    return prisma.vaccinationEvent.findMany({
      where: { flockId },
      orderBy: { adminDate: 'asc' },
    });
  });

  app.get('/schedule', { preHandler: [authenticate] }, async (request) => {
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

    // Get completed vaccinations
    const completed = await prisma.vaccinationEvent.findMany({
      where: { flockId },
      orderBy: { adminDate: 'asc' },
    });

    // Get schedule items for breed
    const schedule = await prisma.vaccinationSchedule.findFirst({
      where: { name: 'Ross 308 Comprehensive Schedule' },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    const upcoming = schedule?.items.filter(item => item.ageDays > ageDays) ?? [];
    const overdue = schedule?.items.filter(item => item.ageDays <= ageDays && !completed.some(c => c.vaccineName === item.vaccineName && Math.abs(c.ageDays - item.ageDays) <= 2)) ?? [];

    return {
      completed,
      upcoming,
      overdue,
      ageDays,
    };
  });

  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const { flockId, ...data } = VaccinationEventCreateSchema.parse(request.body);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    return prisma.vaccinationEvent.create({
      data: {
        vaccineType: data.vaccineType || data.vaccineName,
        ...data,
        adminDate: new Date(data.adminDate),
        nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : null,
        flockId,
      },
    });
  });

  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = VaccinationEventCreateSchema.partial().parse(request.body);
    const authUser = (request as any).authUser;

    const event = await prisma.vaccinationEvent.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!event || event.flock.createdBy !== authUser.userId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    return prisma.vaccinationEvent.update({
      where: { id },
      data: {
        vaccineType: data.vaccineType || data.vaccineName,
        ...data,
        adminDate: data.adminDate ? new Date(data.adminDate) : undefined,
        nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : undefined,
      },
    });
  });

  app.delete('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const authUser = (request as any).authUser;

    const event = await prisma.vaccinationEvent.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!event || event.flock.createdBy !== authUser.userId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    await prisma.vaccinationEvent.delete({ where: { id } });
    return { deleted: true };
  });
}
