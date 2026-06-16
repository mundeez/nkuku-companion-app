import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';

const DiseaseCreateSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  incubation: z.string().optional(),
  mortalityRate: z.string().optional(),
  symptoms: z.string().optional(),
  prevention: z.string().optional(),
  treatment: z.string().optional(),
  organicTreatments: z.string().optional(),
});

export async function buildDiseaseModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const query = z.object({
      category: z.string().optional(),
      search: z.string().optional(),
    }).parse(request.query);

    const where: any = {};
    if (query.category) where.category = query.category;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { symptoms: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return prisma.disease.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  });

  app.get('/categories', { preHandler: [authenticate] }, async () => {
    const categories = await prisma.disease.groupBy({
      by: ['category'],
      _count: true,
    });
    return categories;
  });

  app.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const disease = await prisma.disease.findUnique({ where: { id } });
    if (!disease) return reply.status(404).send({ error: 'NOT_FOUND' });
    return disease;
  });

  app.post('/', { preHandler: [authenticate, requireRole('owner')] }, async (request) => {
    const data = DiseaseCreateSchema.parse(request.body);
    return prisma.disease.create({ data });
  });

  app.patch('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = DiseaseCreateSchema.partial().parse(request.body);
    const disease = await prisma.disease.update({ where: { id }, data });
    return disease;
  });

  app.delete('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await prisma.disease.delete({ where: { id } });
    return { deleted: true };
  });
}
