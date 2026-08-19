import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';

const FeedStageCreateSchema = z.object({
  supplierId: z.string().uuid(),
  stageName: z.string().min(1).max(50),
  stageType: z.enum(['feed', 'chick', 'medication', 'other']).default('feed'),
  dayRangeStart: z.number().int().optional(),
  dayRangeEnd: z.number().int().optional(),
  unitSizeKg: z.coerce.number().positive(),
  unitPriceZmw: z.coerce.number().nonnegative(),
  intakePerBirdKg: z.coerce.number().nonnegative(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().optional(),
});

const FeedStageUpdateSchema = FeedStageCreateSchema.partial();

export async function buildFeedStageModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // GET /api/v1/feed-stages?supplierId=...
  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const organizationId = getOrganizationId(request);
    const query = z.object({ supplierId: z.string().uuid().optional() }).parse(request.query);
    return prisma.feedStage.findMany({
      where: { supplierId: query.supplierId, supplier: { organizationId } },
      orderBy: { sortOrder: 'asc' },
      include: { supplier: true },
    });
  });

  // POST /api/v1/feed-stages
  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const data = FeedStageCreateSchema.parse(request.body);
    const supplier = await prisma.supplier.findFirst({ where: { id: data.supplierId, organizationId } });
    if (!supplier) return reply.status(404).send({ error: 'SUPPLIER_NOT_FOUND' });
    return prisma.feedStage.create({ data, include: { supplier: true } });
  });

  // PATCH /api/v1/feed-stages/:id
  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = FeedStageUpdateSchema.parse(request.body);
    const _authUser = (request as any).authUser;

    // Fetch the existing record to compare price/size before updating
    const existing = await prisma.feedStage.findFirst({ where: { id, supplier: { organizationId } } });
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' });

    const updated = await prisma.feedStage.update({
      where: { id },
      data,
      include: { supplier: true },
    });

    // Record price/size change in audit trail if either field changed
    const priceChanged = data.unitPriceZmw !== undefined && Number(data.unitPriceZmw) !== Number(existing.unitPriceZmw);
    const sizeChanged = data.unitSizeKg !== undefined && Number(data.unitSizeKg) !== Number(existing.unitSizeKg);
    if (priceChanged || sizeChanged) {
      await prisma.feedStagePriceHistory.create({
        data: {
          feedStageId: id,
          oldUnitPriceZmw: existing.unitPriceZmw,
          newUnitPriceZmw: data.unitPriceZmw !== undefined ? data.unitPriceZmw : existing.unitPriceZmw,
          oldUnitSizeKg: existing.unitSizeKg,
          newUnitSizeKg: data.unitSizeKg !== undefined ? data.unitSizeKg : existing.unitSizeKg,
          changedBy: _authUser?.userId ?? null,
        },
      });
    }

    return updated;
  });

  // GET /api/v1/feed-stages/:id/price-history
  app.get('/:id/price-history', { preHandler: [authenticate] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const stage = await prisma.feedStage.findFirst({ where: { id, supplier: { organizationId } } });
    if (!stage) return reply.status(404).send({ error: 'NOT_FOUND' });
    return prisma.feedStagePriceHistory.findMany({
      where: { feedStageId: id },
      orderBy: { changedAt: 'desc' },
    });
  });

  // DELETE /api/v1/feed-stages/:id
  app.delete('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const existing = await prisma.feedStage.findFirst({ where: { id, supplier: { organizationId } } });
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' });
    await prisma.feedStage.delete({ where: { id } });
    return { deleted: true };
  });
}

