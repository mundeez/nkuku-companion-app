import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';

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
    const query = z.object({ supplierId: z.string().uuid().optional() }).parse(request.query);
    return prisma.feedStage.findMany({
      where: query.supplierId ? { supplierId: query.supplierId } : undefined,
      orderBy: { sortOrder: 'asc' },
      include: { supplier: true },
    });
  });

  // POST /api/v1/feed-stages
  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const data = FeedStageCreateSchema.parse(request.body);
    return prisma.feedStage.create({ data, include: { supplier: true } });
  });

  // PATCH /api/v1/feed-stages/:id
  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = FeedStageUpdateSchema.parse(request.body);
    return prisma.feedStage.update({ where: { id }, data, include: { supplier: true } });
  });

  // DELETE /api/v1/feed-stages/:id
  app.delete('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await prisma.feedStage.delete({ where: { id } });
    return { deleted: true };
  });
}

