import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';

const dateOrIso = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

const VaccineInventoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  disease: z.string().max(100).optional(),
  supplier: z.string().max(100).optional(),
  batchNumber: z.string().min(1).max(100),
  quantityDoses: z.number().int().min(0),
  expiryDate: dateOrIso,
  status: z.enum(['available', 'in_use', 'expired', 'depleted']).optional(),
  costZmw: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export async function buildVaccineInventoryModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const query = z.object({
      status: z.enum(['available', 'in_use', 'expired', 'depleted']).optional(),
    }).parse(request.query);

    const where: any = {};
    if (query.status) where.status = query.status;

    return prisma.vaccineInventory.findMany({
      where,
      orderBy: [{ status: 'asc' }, { expiryDate: 'asc' }],
    });
  });

  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const data = VaccineInventoryCreateSchema.parse(request.body);
    const authUser = (request as any).authUser;

    const expiryDate = new Date(data.expiryDate);
    const status = data.status || (expiryDate < new Date() ? 'expired' : 'available');

    const record = await prisma.vaccineInventory.create({
      data: {
        ...data,
        expiryDate,
        status,
      },
    });

    return record;
  });

  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = VaccineInventoryCreateSchema.partial().parse(request.body);
    const authUser = (request as any).authUser;

    const record = await prisma.vaccineInventory.findUnique({ where: { id } });
    if (!record) return reply.status(404).send({ error: 'NOT_FOUND' });

    const expiryDate = data.expiryDate ? new Date(data.expiryDate) : record.expiryDate;
    const status = data.status || (expiryDate < new Date() ? 'expired' : record.status);

    const updated = await prisma.vaccineInventory.update({
      where: { id },
      data: {
        ...data,
        expiryDate,
        status,
      },
    });

    return updated;
  });

  app.delete('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const authUser = (request as any).authUser;

    const record = await prisma.vaccineInventory.findUnique({ where: { id } });
    if (!record) return reply.status(404).send({ error: 'NOT_FOUND' });

    await prisma.vaccineInventory.delete({ where: { id } });
    return { deleted: true };
  });
}
