import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/routes.js';
import { requireStaffApi } from '../../core/staff-auth/staff-auth.service.js';

// ── P4 catalogue lockdown ────────────────────────────────
// The disease table is GLOBAL reference data shared by every tenant.
// Reads stay org-authenticated (authenticate); writes are staff-only
// (catalogue.write permission — content_editor / super_admin roles).
// A tenant token on a write route now gets 403 FORBIDDEN; staff manage
// the catalogue via /api/v1/platform/catalogue/diseases (or directly
// here with a staff Bearer token).

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

  app.get('/', { preHandler: [authenticate] }, async (request, reply) => {
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

    // Disease database is global reference data; cache briefly to speed up
    // repeat navigations. Search/category-filtered responses are also safe
    // to cache since the underlying data changes rarely.
    reply.header('Cache-Control', 'private, max-age=300, stale-while-revalidate=600');
    return prisma.disease.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  });

  app.get('/categories', { preHandler: [authenticate] }, async (_request, reply) => {
    reply.header('Cache-Control', 'private, max-age=300, stale-while-revalidate=600');
    const categories = await prisma.disease.groupBy({
      by: ['category'],
      _count: true,
    });
    return categories;
  });

  app.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    reply.header('Cache-Control', 'private, max-age=300, stale-while-revalidate=600');
    const disease = await prisma.disease.findUnique({ where: { id } });
    if (!disease) return reply.status(404).send({ error: 'NOT_FOUND' });
    return disease;
  });

  app.post('/', { preHandler: [requireStaffApi('catalogue.write')] }, async (request) => {
    const data = DiseaseCreateSchema.parse(request.body);
    return prisma.disease.create({ data });
  });

  app.patch('/:id', { preHandler: [requireStaffApi('catalogue.write')] }, async (request, _reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = DiseaseCreateSchema.partial().parse(request.body);
    const disease = await prisma.disease.update({ where: { id }, data });
    return disease;
  });

  app.delete('/:id', { preHandler: [requireStaffApi('catalogue.write')] }, async (request, _reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await prisma.disease.delete({ where: { id } });
    return { deleted: true };
  });
}
