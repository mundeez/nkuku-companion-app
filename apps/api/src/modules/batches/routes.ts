import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';

const BatchCreateSchema = z.object({
  cycleId: z.string().uuid(),
  supplierId: z.string().uuid(),
  shootLabel: z.string().min(1).max(20),
  targetExecutionDt: z.string().datetime(),
  salesDate: z.string().datetime(),
  growthQtyAdded: z.number().int().default(0),
  totalQtyAtHand: z.number().int(),
  revenueTargetZmw: z.coerce.number().optional(),
  salesPricePerBird: z.coerce.number().optional(),
  mortalityPctAssumed: z.coerce.number().min(0).max(1).default(0.05),
  status: z.enum(['planned', 'active', 'harvested', 'closed']).default('planned'),
});

const BatchUpdateSchema = BatchCreateSchema.partial();

export async function buildBatchModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // GET /api/v1/batches
  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const query = z.object({
      cycleId: z.string().uuid().optional(),
      status: z.enum(['planned', 'active', 'harvested', 'closed']).optional(),
    }).parse(request.query);
    return prisma.batch.findMany({
      where: {
        cycleId: query.cycleId,
        status: query.status,
      },
      include: { supplier: true, cycle: true },
      orderBy: { targetExecutionDt: 'asc' },
    });
  });

  // GET /api/v1/batches/:id
  app.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const batch = await prisma.batch.findUnique({
      where: { id },
      include: {
        supplier: { include: { feedStages: true } },
        cycle: true,
        expenses: { include: { feedStage: true } },
        overheadCosts: true,
        mortalityRecords: { orderBy: { recordedAt: 'asc' } },
        projections: { orderBy: { calculatedAt: 'desc' }, take: 1 },
      },
    });
    if (!batch) return reply.status(404).send({ error: 'NOT_FOUND' });
    return batch;
  });

  // POST /api/v1/batches
  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const data = BatchCreateSchema.parse(request.body);
    const authUser = (request as any).authUser;
    return prisma.batch.create({
      data: { ...data, createdBy: authUser.userId },
      include: { supplier: true, cycle: true },
    });
  });

  // PATCH /api/v1/batches/:id
  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = BatchUpdateSchema.parse(request.body);
    return prisma.batch.update({
      where: { id },
      data,
      include: { supplier: true, cycle: true },
    });
  });

  // DELETE /api/v1/batches/:id
  app.delete('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await prisma.batch.delete({ where: { id } });
    return { deleted: true };
  });
}

