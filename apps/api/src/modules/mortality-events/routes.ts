import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';
import { bulkRateLimit } from '../../core/security/rate-limiter.js';

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
    const { flockId } = z.object({ flockId: z.string().uuid().optional() }).parse(request.query);
    const authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    if (flockId) {
      const flock = await prisma.broilerFlock.findFirst({
        where: { id: flockId, organizationId },
      });
      if (!flock) return { error: 'NOT_FOUND' };

      return prisma.mortalityEvent.findMany({
        where: { flockId },
        orderBy: { eventDate: 'asc' },
      });
    }

    // No flockId provided — return all mortality events for the user's flocks
    return prisma.mortalityEvent.findMany({
      where: { flock: { organizationId } },
      orderBy: { eventDate: 'asc' },
    });
  });

  app.get('/summary', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({ flockId: z.string().uuid() }).parse(request.query);
    const authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, organizationId },
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
    const organizationId = getOrganizationId(request);

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, organizationId },
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
    const data = MortalityEventCreateSchema.partial().omit({ flockId: true }).parse(request.body);
    const authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const record = await prisma.mortalityEvent.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.organizationId !== organizationId) {
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
    const organizationId = getOrganizationId(request);

    const event = await prisma.mortalityEvent.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!event || event.flock.organizationId !== organizationId) {
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

  // POST /bulk — bulk create or bulk delete mortality events
  app.post('/bulk', { preHandler: [authenticate, requireRole('owner', 'manager'), bulkRateLimit] }, async (request, reply) => {
    const body = z.object({
      action: z.enum(['create', 'delete']),
      records: z.array(MortalityEventCreateSchema).max(500).optional(),
      ids: z.array(z.string().uuid()).min(1).max(500).optional(),
    }).parse(request.body);
    const authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    if (body.action === 'create') {
      if (!body.records?.length) return reply.status(400).send({ error: 'RECORDS_REQUIRED' });

      const flockIds = [...new Set(body.records.map((r) => r.flockId))];
      const flocks = await prisma.broilerFlock.findMany({
        where: { id: { in: flockIds }, organizationId },
        select: { id: true, currentCount: true },
      });
      const flockMap = new Map(flocks.map((f: any) => [f.id, f]));

      const validRecords = body.records.filter((r) => flockMap.has(r.flockId));

      const created = await prisma.$transaction(async (tx: any) => {
        const results: any[] = [];
        // Track per-flock count adjustments
        const countAdjustments = new Map<string, number>();
        for (const r of validRecords) {
          countAdjustments.set(r.flockId, (countAdjustments.get(r.flockId) ?? 0) + r.count);
        }
        // Apply flock count decrements atomically (avoids stale-read race)
        for (const [flockId, totalDeaths] of countAdjustments) {
          await tx.broilerFlock.updateMany({
            where: { id: flockId, currentCount: { gte: totalDeaths } },
            data: { currentCount: { decrement: totalDeaths } },
          });
        }
        for (const r of validRecords) {
          const record = await tx.mortalityEvent.create({
            data: {
              flockId: r.flockId,
              eventDate: new Date(r.eventDate),
              count: r.count,
              cause: r.cause,
              ageDays: r.ageDays,
              costZmw: r.costZmw,
              notes: r.notes,
            },
          });
          if (r.costZmw && r.costZmw > 0) {
            await tx.financialRecord.create({
              data: {
                flockId: r.flockId,
                sourceRecordId: record.id,
                sourceTable: 'mortality_events',
                recordDate: new Date(r.eventDate),
                category: 'other',
                description: `Mortality/Disposal - ${r.count} birds (${r.cause || 'Unknown cause'})`,
                amountZmw: r.costZmw,
                isIncome: false,
                isSystemGenerated: true,
                notes: 'Auto-generated from mortality record',
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

      if (authUser.role !== 'owner') {
        return reply.status(403).send({ error: 'FORBIDDEN' });
      }

      const events = await prisma.mortalityEvent.findMany({
        where: { id: { in: body.ids } },
        include: { flock: { select: { organizationId: true } } },
      });
      const validEvents = events.filter((e: any) => e.flock.organizationId === organizationId);
      const validIds = validEvents.map((e: any) => e.id);

      await prisma.$transaction(async (tx: any) => {
        // Restore flock counts (group by flockId)
        const countRestorations = new Map<string, number>();
        for (const e of validEvents) {
          countRestorations.set(e.flockId, (countRestorations.get(e.flockId) ?? 0) + e.count);
        }
        for (const [flockId, totalRestored] of countRestorations) {
          await tx.broilerFlock.update({
            where: { id: flockId },
            data: { currentCount: { increment: totalRestored } },
          });
        }
        // Delete linked financial records
        await tx.financialRecord.deleteMany({
          where: { sourceRecordId: { in: validIds }, sourceTable: 'mortality_events' },
        });
        await tx.mortalityEvent.deleteMany({ where: { id: { in: validIds } } });
      });
      return { action: 'delete', affected: validIds.length, skipped: body.ids.length - validIds.length };
    }

    return reply.status(400).send({ error: 'INVALID_ACTION' });
  });
}
