import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authenticate, requireRole } from '../auth/routes.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';

const UserCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(6).max(100),
  role: z.enum(['owner', 'manager', 'flock_minder', 'sales_person', 'viewer']),
  isActive: z.boolean().optional(),
});

const UserUpdateSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(100).optional(),
  password: z.string().min(6).max(100).optional(),
  role: z.enum(['owner', 'manager', 'flock_minder', 'sales_person', 'viewer']).optional(),
  isActive: z.boolean().optional(),
});

// NOTE: This module is being superseded by the invite flow
// (POST /api/v1/organizations/invites + POST /api/v1/auth/accept-invite),
// which is the correct multi-tenant way to add a user to an organization
// (the invited person sets their own password and explicitly accepts
// consent). It's kept for backward compatibility and scoped to the
// organization's own membership list; every user it touches must already
// be (or become) a member of the caller's organization.
export async function buildUserModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // GET /api/v1/users — members of the caller's organization only
  app.get('/', { preHandler: [authenticate, requireRole('owner')] }, async (request) => {
    const organizationId = getOrganizationId(request);
    const members = await prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, updatedAt: true } } },
      orderBy: { user: { name: 'asc' } },
    });
    return members.map((m: any) => m.user);
  });

  // GET /api/v1/users/:id
  app.get('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId, userId: id },
      include: { user: { select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, updatedAt: true } } },
    });
    if (!membership) return reply.status(404).send({ error: 'NOT_FOUND' });
    return membership.user;
  });

  // POST /api/v1/users — create a user and add them to the caller's organization
  app.post('/', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const data = UserCreateSchema.parse(request.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return reply.status(409).send({ error: 'EMAIL_ALREADY_REGISTERED' });

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.$transaction(async (tx: any) => {
      const created = await tx.user.create({
        data: { email: data.email, name: data.name, passwordHash, role: data.role, isActive: data.isActive ?? true },
        select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, updatedAt: true },
      });
      await tx.organizationMember.create({
        data: { organizationId, userId: created.id, role: data.role },
      });
      return created;
    });
    return reply.status(201).send(user);
  });

  // PATCH /api/v1/users/:id
  app.patch('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const membership = await prisma.organizationMember.findFirst({ where: { organizationId, userId: id } });
    if (!membership) return reply.status(404).send({ error: 'NOT_FOUND' });

    const data = UserUpdateSchema.parse(request.body);
    const updateData: any = { ...data };
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
      delete updateData.password;
    }
    // NOTE: User.role and OrganizationMember.role are kept in sync — a user
    // belongs to exactly one organization today (multi-org membership is a
    // later concern), so there's no case yet where they should diverge.
    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, updatedAt: true },
    });
    if (data.role && data.role !== membership.role) {
      await prisma.organizationMember.update({ where: { id: membership.id }, data: { role: data.role } });
    }
    return updated;
  });

  // DELETE /api/v1/users/:id — remove from the caller's organization (soft delete if it's their only org)
  app.delete('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const membership = await prisma.organizationMember.findFirst({ where: { organizationId, userId: id } });
    if (!membership) return reply.status(404).send({ error: 'NOT_FOUND' });

    await prisma.organizationMember.delete({ where: { id: membership.id } });
    const remainingMemberships = await prisma.organizationMember.count({ where: { userId: id } });
    if (remainingMemberships === 0) {
      await prisma.user.update({ where: { id }, data: { isActive: false } });
    }
    return { deleted: true };
  });
}
