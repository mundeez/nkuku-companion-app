import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';
import { bulkRateLimit } from '../../core/security/rate-limiter.js';
import { checkFlockNotLocked, assertFlockNotCompleted } from '../broiler-flocks/check-flock-locked.js';

const VaccinationEventCreateSchema = z.object({
  flockId: z.string().uuid(),
  vaccineName: z.string().min(1).max(100),
  vaccineType: z.string().max(100).optional(),
  adminDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  adminMethod: z.string().min(1).max(50),
  ageDays: z.number().int().min(0),
  costZmw: z.number().nonnegative().optional(),
  nextDueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  batchNumber: z.string().max(100).optional(),
  expiryDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
  vaccineInventoryId: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
});

export async function buildVaccinationEventModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  const flockLock = checkFlockNotLocked(prisma);

  // GET /api/v1/vaccination-events/schedules - list all vaccination schedules
  app.get('/schedules', { preHandler: [authenticate] }, async (_request, reply) => {
    // Vaccination schedules are global reference data; cache briefly.
    reply.header('Cache-Control', 'private, max-age=300, stale-while-revalidate=600');
    return prisma.vaccinationSchedule.findMany({
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { isDefault: 'desc' },
    });
  });

  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({ flockId: z.string().uuid().optional() }).parse(request.query);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    if (flockId) {
      const flock = await prisma.broilerFlock.findFirst({
        where: { id: flockId, organizationId },
      });
      if (!flock) return { error: 'NOT_FOUND' };

      return prisma.vaccinationEvent.findMany({
        where: { flockId },
        orderBy: { adminDate: 'asc' },
      });
    }

    // No flockId provided — return all vaccination events for the user's flocks
    return prisma.vaccinationEvent.findMany({
      where: { flock: { organizationId } },
      orderBy: { adminDate: 'asc' },
    });
  });

  app.get('/schedule', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({ flockId: z.string().uuid() }).parse(request.query);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, organizationId },
      include: { breed: true },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    // If chicks not yet collected (no startDate), return empty schedule
    if (!flock.startDate) {
      return { schedule: [], ageDays: null };
    }

    const today = new Date();
    const startDate = new Date(flock.startDate);
    const ageDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Get completed vaccinations
    const completed = await prisma.vaccinationEvent.findMany({
      where: { flockId },
      orderBy: { adminDate: 'asc' },
    });

    // Get schedule items for breed
    const scheduleName = flock.breed?.name === 'Ross 308' ? 'Ross 308 Zambia Schedule' : 'Standard Broiler Schedule';
    const schedule = await prisma.vaccinationSchedule.findFirst({
      where: { name: scheduleName },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    const upcoming = schedule?.items.filter((item: any) => item.ageDays > ageDays) ?? [];
    const overdue = schedule?.items.filter((item: any) => item.ageDays <= ageDays && !completed.some((c: any) => c.vaccineName === item.vaccineName && Math.abs(c.ageDays - item.ageDays) <= 2)) ?? [];

    return {
      completed,
      upcoming,
      overdue,
      ageDays,
    };
  });

  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager'), flockLock] }, async (request) => {
    const { flockId, ...data } = VaccinationEventCreateSchema.parse(request.body);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, organizationId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    const record = await prisma.vaccinationEvent.create({
      data: {
        vaccineType: data.vaccineType || data.vaccineName,
        ...data,
        adminDate: new Date(data.adminDate),
        nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : null,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
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
    const data = VaccinationEventCreateSchema.partial().omit({ flockId: true, vaccineInventoryId: true }).parse(request.body);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const event = await prisma.vaccinationEvent.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!event || event.flock.organizationId !== organizationId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    if (assertFlockNotCompleted(reply, event.flock.status, (request as any).authUser?.role)) return;

    const updated = await prisma.vaccinationEvent.update({
      where: { id },
      data: {
        vaccineType: data.vaccineType || data.vaccineName,
        ...data,
        adminDate: data.adminDate ? new Date(data.adminDate) : undefined,
        nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : undefined,
        expiryDate: data.expiryDate !== undefined ? (data.expiryDate ? new Date(data.expiryDate) : null) : undefined,
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
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const event = await prisma.vaccinationEvent.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!event || event.flock.organizationId !== organizationId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    if (assertFlockNotCompleted(reply, event.flock.status, (request as any).authUser?.role)) return;

    // Delete linked financial record
    const finRecord = await prisma.financialRecord.findFirst({ where: { sourceRecordId: id } });
    if (finRecord) await prisma.financialRecord.delete({ where: { id: finRecord.id } });

    await prisma.vaccinationEvent.delete({ where: { id } });
    return { deleted: true };
  });

  // POST /bulk — bulk create or bulk delete vaccination events
  app.post('/bulk', { preHandler: [authenticate, requireRole('owner', 'manager'), bulkRateLimit] }, async (request, reply) => {
    const body = z.object({
      action: z.enum(['create', 'delete']),
      records: z.array(VaccinationEventCreateSchema).max(500).optional(),
      ids: z.array(z.string().uuid()).min(1).max(500).optional(),
    }).parse(request.body);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    if (body.action === 'create') {
      if (!body.records?.length) return reply.status(400).send({ error: 'RECORDS_REQUIRED' });

      const flockIds = [...new Set(body.records.map((r) => r.flockId))];
      const flocks = await prisma.broilerFlock.findMany({
        where: { id: { in: flockIds }, organizationId },
        select: { id: true, status: true },
      });
      const validFlockIds = new Set(flocks.map((f: any) => f.id));

      // Check for completed flocks (non-owner cannot create records on completed flocks)
      const authUser = (request as any).authUser;
      if (authUser?.role !== 'owner') {
        const completedFlocks = flocks.filter((f: any) => f.status === 'completed');
        if (completedFlocks.length > 0) {
          return reply.status(403).send({
            error: 'FLOCK_COMPLETED',
            message: 'Cannot create records on a completed flock. Only the owner can modify completed flocks.',
          });
        }
      }

      const validRecords = body.records.filter((r) => validFlockIds.has(r.flockId));

      const created = await prisma.$transaction(async (tx: any) => {
        const results: any[] = [];
        for (const r of validRecords) {
          const record = await tx.vaccinationEvent.create({
            data: {
              flockId: r.flockId,
              vaccineName: r.vaccineName,
              vaccineType: r.vaccineType || r.vaccineName,
              adminDate: new Date(r.adminDate),
              adminMethod: r.adminMethod,
              ageDays: r.ageDays,
              costZmw: r.costZmw,
              nextDueDate: r.nextDueDate ? new Date(r.nextDueDate) : null,
              batchNumber: r.batchNumber,
              expiryDate: r.expiryDate ? new Date(r.expiryDate) : null,
              vaccineInventoryId: r.vaccineInventoryId,
              notes: r.notes,
            },
          });
          if (r.costZmw && r.costZmw > 0) {
            await tx.financialRecord.create({
              data: {
                flockId: r.flockId,
                sourceRecordId: record.id,
                sourceTable: 'vaccination_events',
                recordDate: new Date(r.adminDate),
                category: 'vaccines',
                description: `Vaccine - ${r.vaccineName} (${r.adminMethod})`,
                amountZmw: r.costZmw,
                isIncome: false,
                isSystemGenerated: true,
                notes: 'Auto-generated from vaccination record',
              },
            });
          }
          results.push(record);
        }
        return results;
      });
      return { action: 'create', affected: created.length, skipped: body.records.length - created.length, records: created };
    }

    if (body.action === 'delete') {
      if (!body.ids?.length) return reply.status(400).send({ error: 'IDS_REQUIRED' });

      if (_authUser.role !== 'owner') {
        return reply.status(403).send({ error: 'FORBIDDEN' });
      }

      const events = await prisma.vaccinationEvent.findMany({
        where: { id: { in: body.ids } },
        include: { flock: { select: { organizationId: true } } },
      });
      const validIds = events
        .filter((e: any) => e.flock.organizationId === organizationId)
        .map((e: any) => e.id);

      await prisma.$transaction(async (tx: any) => {
        await tx.financialRecord.deleteMany({
          where: { sourceRecordId: { in: validIds }, sourceTable: 'vaccination_events' },
        });
        await tx.vaccinationEvent.deleteMany({ where: { id: { in: validIds } } });
      });
      return { action: 'delete', affected: validIds.length, skipped: body.ids.length - validIds.length };
    }

    return reply.status(400).send({ error: 'INVALID_ACTION' });
  });
}
