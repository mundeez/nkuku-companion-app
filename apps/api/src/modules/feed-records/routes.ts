import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';
import { bulkRateLimit } from '../../core/security/rate-limiter.js';

const FeedRecordCreateSchema = z.object({
  flockId: z.string().uuid(),
  supplierId: z.string().uuid().optional(),
  recordDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  feedType: z.string().min(1).max(50),
  feedBrand: z.string().optional(),
  quantityKg: z.number().positive(),
  costZmw: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export async function buildFeedRecordModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({
      flockId: z.string().uuid().optional(),
    }).parse(request.query);
    const authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    if (flockId) {
      const flock = await prisma.broilerFlock.findFirst({
        where: { id: flockId, organizationId },
      });
      if (!flock) return { error: 'NOT_FOUND' };

      return prisma.feedRecord.findMany({
        where: { flockId },
        orderBy: { recordDate: 'asc' },
        include: { supplier: { select: { name: true } } },
      });
    }

    // No flockId provided — return all feed records for the user's flocks
    return prisma.feedRecord.findMany({
      where: { flock: { organizationId } },
      orderBy: { recordDate: 'asc' },
      include: { supplier: { select: { name: true } } },
    });
  });

  app.get('/summary', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({
      flockId: z.string().uuid(),
    }).parse(request.query);
    const authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, organizationId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    const summary = await prisma.feedRecord.groupBy({
      by: ['feedType'],
      where: { flockId },
      _sum: { quantityKg: true, costZmw: true },
      _count: true,
    });

    const supplierBreakdown = await prisma.feedRecord.groupBy({
      by: ['feedBrand'],
      where: { flockId },
      _sum: { quantityKg: true, costZmw: true },
    });

    const totalFeed = await prisma.feedRecord.aggregate({
      where: { flockId },
      _sum: { quantityKg: true, costZmw: true },
    });

    const costPerBird = flock.currentCount > 0 && totalFeed._sum.costZmw
      ? Number(totalFeed._sum.costZmw) / flock.currentCount
      : 0;

    return {
      summary,
      supplierBreakdown,
      totalFeedKg: totalFeed._sum.quantityKg ?? 0,
      totalCostZmw: totalFeed._sum.costZmw ?? 0,
      costPerBird,
      currentCount: flock.currentCount,
    };
  });

  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const { flockId, ...data } = FeedRecordCreateSchema.parse(request.body);
    const authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, organizationId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    // Auto-derive feedBrand from supplier name if not provided
    let feedBrand = data.feedBrand;
    if (data.supplierId && !feedBrand) {
      const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
      feedBrand = supplier?.name ?? null;
    }

    const record = await prisma.feedRecord.create({
      data: {
        ...data,
        feedBrand,
        recordDate: new Date(data.recordDate),
        flockId,
      },
    });

    // Auto-create financial record for feed cost
    if (data.costZmw && data.costZmw > 0) {
      await prisma.financialRecord.create({
        data: {
          flockId,
          sourceRecordId: record.id,
          sourceTable: 'feed_records',
          recordDate: new Date(data.recordDate),
          category: 'feed',
          description: `Feed - ${feedBrand || data.feedType} (${data.quantityKg}kg)`,
          amountZmw: data.costZmw,
          isIncome: false,
          isSystemGenerated: true,
          notes: 'Auto-generated from feed record',
        },
      });
    }

    return record;
  });



  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = FeedRecordCreateSchema.partial().omit({ flockId: true, supplierId: true }).parse(request.body);
    const authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const record = await prisma.feedRecord.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.organizationId !== organizationId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    const updated = await prisma.feedRecord.update({
      where: { id },
      data: {
        ...data,
        recordDate: data.recordDate ? new Date(data.recordDate) : undefined,
      },
    });

    // Sync financial record
    const finRecord = await prisma.financialRecord.findFirst({ where: { sourceRecordId: id } });
    if (data.costZmw !== undefined) {
      if (data.costZmw > 0) {
        const desc = `Feed - ${data.feedBrand || record.feedBrand || updated.feedType} (${data.quantityKg ?? record.quantityKg}kg)`;
        if (finRecord) {
          await prisma.financialRecord.update({
            where: { id: finRecord.id },
            data: {
              amountZmw: data.costZmw,
              description: desc,
              recordDate: data.recordDate ? new Date(data.recordDate) : finRecord.recordDate,
              sourceTable: 'feed_records',
              isSystemGenerated: true,
            },
          });
        } else {
          await prisma.financialRecord.create({
            data: {
              flockId: record.flockId,
              sourceRecordId: id,
              sourceTable: 'feed_records',
              recordDate: new Date(data.recordDate || record.recordDate),
              category: 'feed',
              description: desc,
              amountZmw: data.costZmw,
              isIncome: false,
              isSystemGenerated: true,
              notes: 'Auto-generated from feed record',
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

    const record = await prisma.feedRecord.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.organizationId !== organizationId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    // Delete linked financial record
    const finRecord = await prisma.financialRecord.findFirst({ where: { sourceRecordId: id } });
    if (finRecord) await prisma.financialRecord.delete({ where: { id: finRecord.id } });

    await prisma.feedRecord.delete({ where: { id } });
    return { deleted: true };
  });

  // POST /bulk — bulk create or bulk delete feed records
  app.post('/bulk', { preHandler: [authenticate, requireRole('owner', 'manager'), bulkRateLimit] }, async (request, reply) => {
    const body = z.object({
      action: z.enum(['create', 'delete']),
      records: z.array(FeedRecordCreateSchema).max(500).optional(),
      ids: z.array(z.string().uuid()).min(1).max(500).optional(),
    }).parse(request.body);
    const authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    if (body.action === 'create') {
      if (!body.records?.length) return reply.status(400).send({ error: 'RECORDS_REQUIRED' });

      const flockIds = [...new Set(body.records.map((r) => r.flockId))];
      const flocks = await prisma.broilerFlock.findMany({
        where: { id: { in: flockIds }, organizationId },
        select: { id: true },
      });
      const validFlockIds = new Set(flocks.map((f: any) => f.id));

      // Pre-fetch suppliers for auto-deriving feedBrand (org-scoped to prevent cross-tenant supplier references)
      const supplierIds = [...new Set(body.records.map((r) => r.supplierId).filter(Boolean))] as string[];
      const suppliers = supplierIds.length
        ? await prisma.supplier.findMany({ where: { id: { in: supplierIds }, organizationId }, select: { id: true, name: true } })
        : [];
      const supplierMap: Map<string, string> = new Map(suppliers.map((s: any) => [s.id, s.name] as [string, string]));
      const validSupplierIds = new Set(suppliers.map((s: any) => s.id));

      const validRecords = body.records.filter((r) => validFlockIds.has(r.flockId) && (!r.supplierId || validSupplierIds.has(r.supplierId)));

      const created = await prisma.$transaction(async (tx: any) => {
        const results: any[] = [];
        for (const r of validRecords) {
          let feedBrand = r.feedBrand;
          if (r.supplierId && !feedBrand) {
            feedBrand = supplierMap.get(r.supplierId) ?? undefined;
          }
          const record = await tx.feedRecord.create({
            data: {
              flockId: r.flockId,
              supplierId: r.supplierId,
              recordDate: new Date(r.recordDate),
              feedType: r.feedType,
              feedBrand,
              quantityKg: r.quantityKg,
              costZmw: r.costZmw,
              notes: r.notes,
            },
          });
          // Auto-create financial record for feed cost
          if (r.costZmw && r.costZmw > 0) {
            await tx.financialRecord.create({
              data: {
                flockId: r.flockId,
                sourceRecordId: record.id,
                sourceTable: 'feed_records',
                recordDate: new Date(r.recordDate),
                category: 'feed',
                description: `Feed - ${feedBrand || r.feedType} (${r.quantityKg}kg)`,
                amountZmw: r.costZmw,
                isIncome: false,
                isSystemGenerated: true,
                notes: 'Auto-generated from feed record',
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

      const records = await prisma.feedRecord.findMany({
        where: { id: { in: body.ids } },
        include: { flock: { select: { organizationId: true } } },
      });
      const validIds = records
        .filter((r: any) => r.flock.organizationId === organizationId)
        .map((r: any) => r.id);

      await prisma.$transaction(async (tx: any) => {
        // Delete linked financial records
        await tx.financialRecord.deleteMany({
          where: { sourceRecordId: { in: validIds }, sourceTable: 'feed_records' },
        });
        await tx.feedRecord.deleteMany({ where: { id: { in: validIds } } });
      });
      return { action: 'delete', affected: validIds.length, skipped: body.ids.length - validIds.length };
    }

    return reply.status(400).send({ error: 'INVALID_ACTION' });
  });
}
