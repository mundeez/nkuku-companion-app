import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';

const TemplateItemCreateSchema = z.object({
  itemName: z.string().min(1).max(50),
  itemType: z.enum(['feed', 'chick', 'medication', 'other']).default('feed'),
  sortOrder: z.number().int().default(0),
  defaultFields: z.record(z.any()).optional(),
  isRequired: z.boolean().default(true),
  isActive: z.boolean().optional(),
});

const TemplateItemUpdateSchema = TemplateItemCreateSchema.partial();

export async function buildSupplierTemplateModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // GET /api/v1/supplier-templates
  app.get('/', { preHandler: [authenticate] }, async () => {
    return prisma.supplierCategoryTemplate.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  });

  // GET /api/v1/supplier-templates/:category
  app.get('/:category', { preHandler: [authenticate] }, async (request, reply) => {
    const { category } = z.object({ category: z.string().min(1) }).parse(request.params);
    const template = await prisma.supplierCategoryTemplate.findUnique({
      where: { category },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!template) return reply.status(404).send({ error: 'NOT_FOUND' });
    return template;
  });

  // GET /api/v1/supplier-templates/:category/items
  app.get('/:category/items', { preHandler: [authenticate] }, async (request, reply) => {
    const { category } = z.object({ category: z.string().min(1) }).parse(request.params);
    const template = await prisma.supplierCategoryTemplate.findUnique({
      where: { category },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!template) return reply.status(404).send({ error: 'NOT_FOUND' });
    return template.items;
  });

  // POST /api/v1/supplier-templates (admin only)
  app.post('/', { preHandler: [authenticate, requireRole('owner')] }, async (request) => {
    const data = z.object({
      category: z.string().min(1).max(50),
      name: z.string().min(1).max(100),
      description: z.string().optional(),
      sortOrder: z.number().int().default(0),
    }).parse(request.body);

    return prisma.supplierCategoryTemplate.create({
      data,
      include: { items: true },
    });
  });

  // PATCH /api/v1/supplier-templates/:id
  app.patch('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().optional(),
      sortOrder: z.number().int().optional(),
      isActive: z.boolean().optional(),
    }).parse(request.body);

    return prisma.supplierCategoryTemplate.update({
      where: { id },
      data,
      include: { items: true },
    });
  });

  // POST /api/v1/supplier-templates/:id/items
  app.post('/:id/items', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = TemplateItemCreateSchema.parse(request.body);

    return prisma.supplierCategoryTemplateItem.create({
      data: { ...data, templateId: id },
    });
  });

  // PATCH /api/v1/supplier-templates/items/:itemId
  app.patch('/items/:itemId', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { itemId } = z.object({ itemId: z.string().uuid() }).parse(request.params);
    const data = TemplateItemUpdateSchema.parse(request.body);

    return prisma.supplierCategoryTemplateItem.update({
      where: { id: itemId },
      data,
    });
  });

  // DELETE /api/v1/supplier-templates/items/:itemId
  app.delete('/items/:itemId', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { itemId } = z.object({ itemId: z.string().uuid() }).parse(request.params);
    await prisma.supplierCategoryTemplateItem.delete({ where: { id: itemId } });
    return { deleted: true };
  });

  // PATCH /api/v1/supplier-templates/:id/reorder
  // Body: { items: [{ id: string, sortOrder: number }] }
  app.patch('/:id/reorder', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { items } = z.object({
      items: z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int() })),
    }).parse(request.body);

    await prisma.$transaction(
      items.map((item) =>
        prisma.supplierCategoryTemplateItem.update({
          where: { id: item.id, templateId: id },
          data: { sortOrder: item.sortOrder },
        })
      )
    );

    return prisma.supplierCategoryTemplate.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  });
}
