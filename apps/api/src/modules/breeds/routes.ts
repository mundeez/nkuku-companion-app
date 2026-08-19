import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';

const BreedCreateSchema = z.object({
  name: z.string().min(1).max(100),
  supplier: z.string().min(1).max(100),
  isPrimary: z.boolean().optional(),
});

const BreedUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  supplier: z.string().min(1).max(100).optional(),
  isPrimary: z.boolean().optional(),
});

export async function buildBreedModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  app.get('/', { preHandler: [authenticate] }, async (_request, reply) => {
    // Breeds + performance targets are global reference data (not org-scoped),
    // so a short private browser cache is safe and cuts repeat round-trips.
    reply.header('Cache-Control', 'private, max-age=300, stale-while-revalidate=600');
    return prisma.breed.findMany({
      include: { performanceTargets: { orderBy: { ageDays: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  });

  app.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    reply.header('Cache-Control', 'private, max-age=300, stale-while-revalidate=600');
    const breed = await prisma.breed.findUnique({
      where: { id },
      include: { performanceTargets: { orderBy: { ageDays: 'asc' } } },
    });
    if (!breed) return reply.status(404).send({ error: 'NOT_FOUND' });
    return breed;
  });

  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const data = BreedCreateSchema.parse(request.body);
    return prisma.breed.create({ data });
  });

  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, _reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = BreedUpdateSchema.parse(request.body);
    const breed = await prisma.breed.update({ where: { id }, data });
    return breed;
  });

  app.delete('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, _reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await prisma.breed.delete({ where: { id } });
    return { deleted: true };
  });
}
