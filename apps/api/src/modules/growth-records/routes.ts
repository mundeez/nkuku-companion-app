import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';

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
      flockId: z.string().uuid().optional(),
    }).parse(request.query);
    const authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    if (flockId) {
      // Verify flock ownership
      const flock = await prisma.broilerFlock.findFirst({
        where: { id: flockId, organizationId },
      });
      if (!flock) return { error: 'NOT_FOUND' };

      return prisma.growthRecord.findMany({
        where: { flockId },
        orderBy: { recordDate: 'asc' },
      });
    }

    // No flockId provided — return all growth records for the user's flocks
    return prisma.growthRecord.findMany({
      where: { flock: { organizationId } },
      orderBy: { recordDate: 'asc' },
    });
  });

  app.get('/analysis', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({
      flockId: z.string().uuid(),
    }).parse(request.query);
    const authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, organizationId },
      include: { breed: true },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    const records = await prisma.growthRecord.findMany({
      where: { flockId },
      orderBy: { recordDate: 'asc' },
    });

    const today = new Date();
    const ageDays = flock.startDate
      ? Math.floor((today.getTime() - new Date(flock.startDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;

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
    const organizationId = getOrganizationId(request);

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, organizationId },
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
    const organizationId = getOrganizationId(request);

    const record = await prisma.growthRecord.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.organizationId !== organizationId) {
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
    const organizationId = getOrganizationId(request);

    const record = await prisma.growthRecord.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.organizationId !== organizationId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    await prisma.growthRecord.delete({ where: { id } });
    return { deleted: true };
  });

  // POST /bulk — bulk create or bulk delete growth records
  app.post('/bulk', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const body = z.object({
      action: z.enum(['create', 'delete']),
      records: z.array(GrowthRecordCreateSchema).max(500).optional(),
      ids: z.array(z.string().uuid()).min(1).max(500).optional(),
    }).parse(request.body);
    const authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    if (body.action === 'create') {
      if (!body.records?.length) return reply.status(400).send({ error: 'RECORDS_REQUIRED' });

      // Collect unique flockIds and verify ownership in one query
      const flockIds = [...new Set(body.records.map((r) => r.flockId))];
      const flocks = await prisma.broilerFlock.findMany({
        where: { id: { in: flockIds }, organizationId },
        select: { id: true },
      });
      const validFlockIds = new Set(flocks.map((f: any) => f.id));

      const created = await prisma.$transaction(
        body.records
          .filter((r) => validFlockIds.has(r.flockId))
          .map((r) =>
            prisma.growthRecord.create({
              data: {
                ...r,
                recordDate: new Date(r.recordDate),
                flockId: r.flockId,
              },
            })
          )
      );
      return { action: 'create', affected: created.length, skipped: body.records.length - created.length, records: created };
    }

    if (body.action === 'delete') {
      if (!body.ids?.length) return reply.status(400).send({ error: 'IDS_REQUIRED' });

      // owner-only for delete
      if (authUser.role !== 'owner') {
        return reply.status(403).send({ error: 'FORBIDDEN' });
      }

      const records = await prisma.growthRecord.findMany({
        where: { id: { in: body.ids } },
        include: { flock: { select: { organizationId: true } } },
      });
      const validIds = records
        .filter((r: any) => r.flock.organizationId === organizationId)
        .map((r: any) => r.id);

      const result = await prisma.growthRecord.deleteMany({
        where: { id: { in: validIds } },
      });
      return { action: 'delete', affected: result.count, skipped: body.ids.length - result.count };
    }

    return reply.status(400).send({ error: 'INVALID_ACTION' });
  });
}
