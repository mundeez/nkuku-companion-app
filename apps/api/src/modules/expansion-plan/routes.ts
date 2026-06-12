import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/routes.js';

export async function buildExpansionPlanModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // GET /api/v1/expansion-plan
  app.get('/', { preHandler: [authenticate] }, async () => {
    const cycles = await prisma.productionCycle.findMany({
      include: {
        batches: {
          include: { supplier: { select: { name: true } } },
          orderBy: { shootLabel: 'asc' },
        },
      },
      orderBy: { cycleNumber: 'asc' },
    });
    return cycles;
  });

  // GET /api/v1/expansion-plan/:cycleNumber
  app.get('/:cycleNumber', { preHandler: [authenticate] }, async (request, reply) => {
    const { cycleNumber } = z.object({ cycleNumber: z.coerce.number().int() }).parse(request.params);
    const cycle = await prisma.productionCycle.findUnique({
      where: { cycleNumber },
      include: {
        batches: {
          include: { supplier: true },
          orderBy: { shootLabel: 'asc' },
        },
      },
    });
    if (!cycle) return reply.status(404).send({ error: 'NOT_FOUND' });
    return cycle;
  });
}

