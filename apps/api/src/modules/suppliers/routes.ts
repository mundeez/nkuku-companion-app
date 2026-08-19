import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';

const SupplierCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  chickenType: z.string().optional(),
  contact: z.string().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

const SupplierUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  chickenType: z.string().optional(),
  contact: z.string().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export async function buildSupplierModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // GET /api/v1/suppliers
  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const organizationId = getOrganizationId(request);
    return prisma.supplier.findMany({
      where: { organizationId },
      include: { feedStages: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  });

  // GET /api/v1/suppliers/:id
  app.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const supplier = await prisma.supplier.findFirst({
      where: { id, organizationId },
      include: { feedStages: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!supplier) return reply.status(404).send({ error: 'NOT_FOUND' });
    return supplier;
  });

  // POST /api/v1/suppliers
  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const organizationId = getOrganizationId(request);
    const data = SupplierCreateSchema.parse(request.body);
    const _authUser = (request as any).authUser;
    return prisma.supplier.create({
      data: { ...data, organizationId, createdBy: _authUser.userId },
      include: { feedStages: true },
    });
  });

  // PATCH /api/v1/suppliers/:id
  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = SupplierUpdateSchema.parse(request.body);
    const existing = await prisma.supplier.findFirst({ where: { id, organizationId } });
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' });
    const supplier = await prisma.supplier.update({
      where: { id },
      data,
      include: { feedStages: true },
    });
    return supplier;
  });



  // GET /api/v1/suppliers/:id/feed-price
  app.get('/:id/feed-price', { preHandler: [authenticate] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { feedType } = z.object({
      feedType: z.string().min(1).max(50),
    }).parse(request.query);

    const supplier = await prisma.supplier.findFirst({
      where: { id, organizationId },
      include: { feedStages: true },
    });
    if (!supplier) return reply.status(404).send({ error: 'NOT_FOUND' });

    const stage = supplier.feedStages.find(
      (s: any) => s.stageName.toLowerCase() === feedType.toLowerCase()
    );

    if (!stage) {
      return reply.status(404).send({
        error: 'NO_PRICE_FOUND',
        message: `No ${feedType} price configured for ${supplier.name}`,
      });
    }

    const pricePerKg = Number(stage.unitPriceZmw) / Number(stage.unitSizeKg);

    return {
      supplierName: supplier.name,
      stageName: stage.stageName,
      unitSizeKg: Number(stage.unitSizeKg),
      unitPriceZmw: Number(stage.unitPriceZmw),
      pricePerKg: Number(pricePerKg.toFixed(2)),
    };
  });
  // DELETE /api/v1/suppliers/:id
  app.delete('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const existing = await prisma.supplier.findFirst({ where: { id, organizationId } });
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' });
    await prisma.supplier.delete({ where: { id } });
    return { deleted: true };
  });

  // GET /api/v1/suppliers/:id/price-history
  // Returns price change history for all feed stages of this supplier
  app.get('/:id/price-history', { preHandler: [authenticate] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const supplier = await prisma.supplier.findFirst({
      where: { id, organizationId },
      select: { id: true, name: true, feedStages: { select: { id: true, stageName: true } } },
    });
    if (!supplier) return reply.status(404).send({ error: 'NOT_FOUND' });

    const stageIds = supplier.feedStages.map((s: any) => s.id);
    const history = await prisma.feedStagePriceHistory.findMany({
      where: { feedStageId: { in: stageIds } },
      orderBy: { changedAt: 'desc' },
      include: { feedStage: { select: { stageName: true } } },
    });

    return history.map((h: any) => ({
      id: h.id,
      feedStageId: h.feedStageId,
      stageName: h.feedStage.stageName,
      oldUnitPriceZmw: Number(h.oldUnitPriceZmw),
      newUnitPriceZmw: Number(h.newUnitPriceZmw),
      oldUnitSizeKg: Number(h.oldUnitSizeKg),
      newUnitSizeKg: Number(h.newUnitSizeKg),
      changedBy: h.changedBy,
      changedAt: h.changedAt,
    }));
  });
}

