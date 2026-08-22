import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { authenticate, requireRole } from '../auth/routes.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';
import { checkUserLimit } from '../../core/billing/feature-gate.js';
import { sendInviteEmail } from '../../core/security/email.service.js';

const OrgUpdateSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  country: z.string().length(2).optional(),
  currency: z.string().length(3).optional(),
});

const InviteCreateSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'manager', 'flock_minder', 'sales_person', 'viewer']),
});

const INVITE_EXPIRY_DAYS = 7;

export async function buildOrganizationModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // GET /api/v1/organizations/me — current organization's settings
  app.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true, name: true, country: true, currency: true, planCode: true,
        isActive: true, createdAt: true,
        _count: { select: { members: true } },
      },
    });
    if (!org) return reply.status(404).send({ error: 'NOT_FOUND' });
    return org;
  });

  // PATCH /api/v1/organizations/me — update org settings (owner only)
  app.patch('/me', { preHandler: [authenticate, requireRole('owner')] }, async (request) => {
    const organizationId = getOrganizationId(request);
    const data = OrgUpdateSchema.parse(request.body);
    const updateData: any = { ...data };
    if (updateData.country) updateData.country = updateData.country.toUpperCase();
    if (updateData.currency) updateData.currency = updateData.currency.toUpperCase();
    return prisma.organization.update({ where: { id: organizationId }, data: updateData });
  });

  // GET /api/v1/organizations/members — list members of current org
  app.get('/members', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const organizationId = getOrganizationId(request);
    const members = await prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, email: true, name: true, isActive: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return members.map((m: any) => ({
      membershipId: m.id,
      role: m.role,
      joinedAt: m.joinedAt,
      user: m.user,
    }));
  });

  // DELETE /api/v1/organizations/members/:id — remove a member (owner only)
  app.delete('/members/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const _authUser = (request as any).authUser;

    const membership = await prisma.organizationMember.findFirst({ where: { id, organizationId } });
    if (!membership) return reply.status(404).send({ error: 'NOT_FOUND' });
    if (membership.userId === _authUser.userId) {
      return reply.status(400).send({ error: 'CANNOT_REMOVE_SELF' });
    }
    await prisma.organizationMember.delete({ where: { id } });
    return { removed: true };
  });

  // POST /api/v1/organizations/invites — invite a user to the current org (owner/manager)
  app.post('/invites', { preHandler: [authenticate, requireRole('owner', 'manager'), checkUserLimit] }, async (request) => {
    const organizationId = getOrganizationId(request);
    const _authUser = (request as any).authUser;
    const data = InviteCreateSchema.parse(request.body);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const invite = await prisma.invite.create({
      data: {
        organizationId,
        email: data.email,
        role: data.role,
        token,
        invitedBy: _authUser.userId,
        expiresAt,
      },
    });

    const webBaseUrl = process.env.WEB_BASE_URL || '';
    const inviteUrl = `${webBaseUrl}/accept-invite?token=${token}`;

    // Send invite email via nodemailer (falls back to console log if EMAIL_DISABLED)
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    const inviter = await prisma.user.findUnique({ where: { id: _authUser.userId } });
    const emailResult = await sendInviteEmail(
      data.email,
      inviteUrl,
      org?.name || 'your organization',
      inviter?.name || 'A team member',
    );

    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      inviteUrl,
      emailSent: emailResult.success,
      emailMessage: emailResult.message,
    };
  });

  // GET /api/v1/organizations/invites — list pending invites (owner/manager)
  app.get('/invites', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const organizationId = getOrganizationId(request);
    return prisma.invite.findMany({
      where: { organizationId, acceptedAt: null },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  // DELETE /api/v1/organizations/invites/:id — revoke a pending invite
  app.delete('/invites/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const invite = await prisma.invite.findFirst({ where: { id, organizationId } });
    if (!invite) return reply.status(404).send({ error: 'NOT_FOUND' });
    await prisma.invite.delete({ where: { id } });
    return { revoked: true };
  });
}
