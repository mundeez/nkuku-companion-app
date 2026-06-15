import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authenticate, requireRole } from '../auth/routes.js';

const UserCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(6).max(100),
  role: z.enum(['owner', 'manager', 'viewer']),
  isActive: z.boolean().optional(),
});

const UserUpdateSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(100).optional(),
  password: z.string().min(6).max(100).optional(),
  role: z.enum(['owner', 'manager', 'viewer']).optional(),
  isActive: z.boolean().optional(),
});

export async function buildUserModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // GET /api/v1/users
  app.get('/', { preHandler: [authenticate, requireRole('owner')] }, async () => {
    return prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, updatedAt: true },
      orderBy: { name: 'asc' },
    });
  });

  // GET /api/v1/users/:id
  app.get('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, updatedAt: true },
    });
    if (!user) return reply.status(404).send({ error: 'NOT_FOUND' });
    return user;
  });

  // POST /api/v1/users
  app.post('/', { preHandler: [authenticate, requireRole('owner')] }, async (request) => {
    const data = UserCreateSchema.parse(request.body);
    const passwordHash = await bcrypt.hash(data.password, 10);
    return prisma.user.create({
      data: { email: data.email, name: data.name, passwordHash, role: data.role, isActive: data.isActive ?? true },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, updatedAt: true },
    });
  });

  // PATCH /api/v1/users/:id
  app.patch('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = UserUpdateSchema.parse(request.body);
    const updateData: any = { ...data };
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
      delete updateData.password;
    }
    return prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, updatedAt: true },
    });
  });

  // DELETE /api/v1/users/:id (soft delete)
  app.delete('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    return { deleted: true };
  });
}
