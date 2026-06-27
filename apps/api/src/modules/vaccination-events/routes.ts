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
  costZmw: z.number().nonnegative().optional(),
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

    const record = await prisma.vaccinationEvent.create({
      data: {
        vaccineType: data.vaccineType || data.vaccineName,
        ...data,
        adminDate: new Date(data.adminDate),
        nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : null,
        flockId,
      },
    });

    // Auto-create financial record for vaccine cost
    if (data.costZmw && data.costZmw > 0) {
      await prisma.financialRecord.create({
        data: {
          flockId,
          sourceRecordId: record.id,
          sourceTable: 'vaccination_events',
          recordDate: new Date(data.adminDate),
          category: 'vaccines',
          description: `Vaccine - ${data.vaccineName} (${data.adminMethod})`,
          amountZmw: data.costZmw,
          isIncome: false,
          isSystemGenerated: true,
          notes: 'Auto-generated from vaccination record',
        },
      });
    }

    return record;
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

    const updated = await prisma.vaccinationEvent.update({
      where: { id },
      data: {
        vaccineType: data.vaccineType || data.vaccineName,
        ...data,
        adminDate: data.adminDate ? new Date(data.adminDate) : undefined,
        nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : undefined,
      },
    });

    // Sync financial record
    const finRecord = await prisma.financialRecord.findFirst({ where: { sourceRecordId: id } });
    if (data.costZmw !== undefined) {
      if (data.costZmw > 0) {
        const desc = `Vaccine - ${data.vaccineName || event.vaccineName} (${data.adminMethod || event.adminMethod})`;
        if (finRecord) {
          await prisma.financialRecord.update({
            where: { id: finRecord.id },
            data: {
              amountZmw: data.costZmw,
              description: desc,
              recordDate: data.adminDate ? new Date(data.adminDate) : finRecord.recordDate,
              sourceTable: 'vaccination_events',
              isSystemGenerated: true,
            },
          });
        } else {
          await prisma.financialRecord.create({
            data: {
              flockId: event.flockId,
              sourceRecordId: id,
              sourceTable: 'vaccination_events',
              recordDate: new Date(data.adminDate || event.adminDate),
              category: 'vaccines',
              description: desc,
              amountZmw: data.costZmw,
              isIncome: false,
              isSystemGenerated: true,
              notes: 'Auto-generated from vaccination record',
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

    const event = await prisma.vaccinationEvent.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!event || event.flock.createdBy !== authUser.userId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    // Delete linked financial record
    const finRecord = await prisma.financialRecord.findFirst({ where: { sourceRecordId: id } });
    if (finRecord) await prisma.financialRecord.delete({ where: { id: finRecord.id } });

    await prisma.vaccinationEvent.delete({ where: { id } });
    return { deleted: true };
  });
}
