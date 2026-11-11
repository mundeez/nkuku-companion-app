// ── PLATFORM TENANT OPS (/api/v1/platform/tenants + /impersonation + /audit-events) ──
// P2 of the super-admin console (PLAN-super-admin-console.md §4/§6).
// Staff-only: every route sits behind requireStaff(<permission>) and the
// module-level IP allowlist registered by buildPlatformModule. Dangerous
// actions additionally require a fresh re-auth (reauthAt ≤ 5 min, plan §3).
//
//   GET    /tenants                              tenants.read — search/filter/sort/paginate
//   GET    /tenants/:id                          tenants.read — full org dossier
//   POST   /tenants/:id/override                 billing.override + reauth
//   POST   /tenants/:id/suspend                  tenants.suspend + reauth
//   POST   /tenants/:id/reactivate               tenants.reactivate + reauth
//   POST   /tenants/:id/members/:userId/reset-password        tenants.support_ops + reauth
//   POST   /tenants/:id/members/:userId/force-logout          tenants.support_ops + reauth
//   POST   /tenants/:id/members/:userId/resend-verification   tenants.support_ops + reauth
//   POST   /tenants/:id/change-owner             tenants.support_ops + reauth
//   POST   /tenants/:id/delete                   tenants.delete + reauth (GDPR soft-delete)
//   POST   /tenants/:id/impersonate              tenants.impersonate + reauth
//   POST   /impersonation/:sessionId/end         tenants.impersonate
//   GET    /impersonation                        tenants.read — session list
//   GET    /audit-events                         audit.read — platform event feed

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import {
  requireStaff,
  requireReauth,
  getClientIp,
} from '../../core/staff-auth/staff-auth.service.js';
import { writePlatformAudit } from '../../core/staff-auth/audit.service.js';
import { denyImpersonation } from '../auth/routes.js';
import {
  getEffectivePlanCode,
  getActiveTenantOverride,
} from '../../core/billing/billing.service.js';
import { getPlanLimitsForOrg } from '../../core/billing/feature-gate.js';
import { PLANS } from '../../core/billing/plans.js';
import { sendVerificationEmail } from '../../core/security/email.service.js';
import { requestDeletion } from '../organizations/lifecycle.service.js';

const JWT_SECRET = process.env.JWT_SECRET!;

// Impersonated tenant tokens: full act-as for 30 minutes, non-refreshable.
const IMPERSONATION_TTL_MINUTES = 30;

// ── Schemas ─────────────────────────────────────────────
const ListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  // Base plan on the org row. A comp'd org keeps its real plan — the active
  // override is surfaced separately as the `override` badge.
  plan: z.string().max(30).optional(),
  status: z.enum(['active', 'suspended', 'deleted']).optional(),
  sortBy: z.enum(['createdAt', 'name']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const OverrideSchema = z
  .object({
    planCode: z.string().max(30).optional(),
    limitsJson: z.record(z.any()).optional(),
    compUntil: z.string().datetime().optional(),
    expiresAt: z.string().datetime().optional(),
    reason: z.string().min(3).max(2000),
  })
  .refine((d) => d.planCode !== undefined || d.limitsJson !== undefined || d.compUntil !== undefined, {
    message: 'Provide at least one of planCode, limitsJson, or compUntil',
  });

const SuspendSchema = z.object({
  reason: z.string().min(3).max(2000),
  message: z.string().max(2000).optional(),
});

const ReactivateSchema = z.object({
  reason: z.string().max(2000).optional(),
});

const SupportOpSchema = z.object({
  reason: z.string().max(2000).optional(),
});

const ChangeOwnerSchema = z.object({
  newOwnerUserId: z.string().uuid(),
  reason: z.string().min(3).max(2000),
});

const DeleteSchema = z.object({
  confirmName: z.string().min(1),
  reason: z.string().min(3).max(2000),
});

const ImpersonateSchema = z.object({
  targetUserId: z.string().uuid(),
  reason: z.string().min(3).max(2000),
  ticketId: z.string().max(80).optional(),
});

const ImpersonationListSchema = z.object({
  orgId: z.string().uuid().optional(),
  active: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const AuditEventsQuerySchema = z.object({
  action: z.string().max(80).optional(),
  actor: z.string().uuid().optional(),
  orgId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ── Shared helpers ──────────────────────────────────────
function auditCtx(request: any) {
  return {
    ip: getClientIp(request),
    userAgent: request.headers?.['user-agent'] ?? null,
    requestId: (request as any).id ?? null,
  };
}

function actorOf(request: any): { staffId: string; role: any; email: string } {
  const staff = request.staffUser;
  return { staffId: staff.staffId, role: staff.role, email: staff.email };
}

async function loadOrgOr404(prisma: any, id: string, reply: any) {
  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) {
    reply.status(404).send({ error: 'NOT_FOUND', message: 'Organization not found' });
    return null;
  }
  return org;
}

/** Active-override predicate — mirrors getActiveTenantOverride (billing.service). */
function activeOverrideWhere(now: Date) {
  return {
    AND: [
      { OR: [{ compUntil: null }, { compUntil: { gt: now } }] },
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    ],
  };
}

function publicOverride(o: any) {
  if (!o) return null;
  return {
    id: o.id,
    planCode: o.planCode,
    limitsJson: o.limitsJson,
    compUntil: o.compUntil,
    reason: o.reason,
    createdByStaffId: o.createdByStaffId,
    expiresAt: o.expiresAt,
    createdAt: o.createdAt,
  };
}

/**
 * Revoke every live session a tenant user holds: bump tokensValidAfter so
 * authenticate()/refresh reject all previously minted JWTs, and remove the
 * tracked refresh-token keys in Redis (best-effort — refresh validation
 * itself relies on the DB timestamp).
 */
async function revokeTenantUserTokens(prisma: any, redis: any, userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { tokensValidAfter: new Date() },
  });
  if (redis) {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', `refresh:${userId}:*`, 'COUNT', 100);
      cursor = next;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== '0');
  }
}

async function loadMemberOr404(prisma: any, organizationId: string, userId: string, reply: any) {
  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId, userId },
    include: { user: true },
  });
  if (!membership) {
    reply.status(404).send({ error: 'NOT_FOUND', message: 'User is not a member of this organization' });
    return null;
  }
  return membership;
}

export async function buildPlatformTenantsModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  const redis = (app as any).redis;

  // ══════════════════════════════════════════════════════
  // TENANT DIRECTORY
  // ══════════════════════════════════════════════════════

  // ── GET /tenants — tenant list (ported from admin-ops /organizations,
  //    extended with suspension + active-override badges) ──
  app.get('/tenants', { preHandler: [requireStaff('tenants.read')] }, async (request) => {
    const q = ListQuerySchema.parse(request.query);

    const where: any = { isDemo: false };
    if (q.status === 'suspended') {
      where.suspendedAt = { not: null };
      where.deletedAt = null;
    } else if (q.status === 'deleted') {
      where.deletedAt = { not: null };
    } else {
      // 'active' (default): live, non-deleted, non-suspended orgs.
      where.deletedAt = null;
      where.suspendedAt = null;
    }
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { planCode: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    if (q.plan) where.planCode = q.plan;

    const [orgs, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        orderBy: { [q.sortBy]: q.sortDir },
        select: {
          id: true,
          name: true,
          planCode: true,
          country: true,
          currency: true,
          createdAt: true,
          suspendedAt: true,
          suspendedReason: true,
          suspendedMessage: true,
          deletedAt: true,
          purgeAfter: true,
          _count: { select: { members: true, flocks: true } },
          subscriptions: {
            where: { status: { in: ['active', 'trialing', 'past_due', 'suspended'] } },
            select: { status: true, planCode: true, billingCycle: true, currentPeriodEnd: true },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      prisma.organization.count({ where }),
    ]);

    // Active-override badges for the page of orgs (one extra query).
    const now = new Date();
    const overrides = orgs.length
      ? await prisma.tenantOverride.findMany({
          where: { organizationId: { in: orgs.map((o: any) => o.id) }, ...activeOverrideWhere(now) },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    const overrideByOrg = new Map<string, any>();
    for (const o of overrides) if (!overrideByOrg.has(o.organizationId)) overrideByOrg.set(o.organizationId, o);

    return {
      items: orgs.map((o: any) => {
        const ov = overrideByOrg.get(o.id) ?? null;
        const sub = o.subscriptions?.[0] ?? null;
        return {
          id: o.id,
          name: o.name,
          planCode: o.planCode,
          effectivePlanCode: ov?.planCode ?? sub?.planCode ?? o.planCode,
          country: o.country,
          currency: o.currency,
          createdAt: o.createdAt,
          suspended: !!o.suspendedAt,
          suspendedAt: o.suspendedAt,
          suspendedReason: o.suspendedReason,
          suspendedMessage: o.suspendedMessage,
          deletedAt: o.deletedAt,
          purgeAfter: o.purgeAfter,
          userCount: o._count?.members ?? 0,
          flockCount: o._count?.flocks ?? 0,
          subscription: sub,
          override: publicOverride(ov),
        };
      }),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize),
    };
  });

  // ── GET /tenants/:id — org dossier: members, usage vs limits, subs,
  //    invoices, flock summary, dual audit tails, override + suspension ──
  app.get('/tenants/:id', { preHandler: [requireStaff('tenants.read')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) return reply.status(404).send({ error: 'NOT_FOUND' });

    const [
      members,
      subscriptions,
      invoices,
      flocksByStatus,
      flockBirds,
      planLimits,
      activeOverride,
      platformEvents,
      tenantAudit,
      supportTotal,
      supportOpen,
    ] = await Promise.all([
      prisma.organizationMember.findMany({
        where: { organizationId: id },
        include: {
          user: {
            select: {
              id: true, email: true, phone: true, name: true, role: true,
              isActive: true, phoneVerifiedAt: true, emailVerifiedAt: true, createdAt: true,
            },
          },
        },
        orderBy: { joinedAt: 'asc' },
      }),
      prisma.subscription.findMany({
        where: { organizationId: id },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.invoice.findMany({
        where: { organizationId: id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true, invoiceNumber: true, status: true, planCode: true,
          amountDue: true, amountPaid: true, currency: true,
          dueDate: true, paidAt: true, createdAt: true,
        },
      }),
      prisma.broilerFlock.groupBy({
        by: ['status'],
        where: { organizationId: id },
        _count: { _all: true },
      }),
      prisma.broilerFlock.aggregate({
        where: { organizationId: id },
        _sum: { currentCount: true, initialCount: true },
      }),
      getPlanLimitsForOrg(prisma, id),
      getActiveTenantOverride(prisma, id),
      prisma.platformAuditEvent.findMany({
        where: { organizationId: id },
        orderBy: { occurredAt: 'desc' },
        take: 20,
        include: { actor: { select: { id: true, email: true, name: true, role: true } } },
      }),
      prisma.auditLog.findMany({
        where: { organizationId: id },
        orderBy: { occurredAt: 'desc' },
        take: 20,
        select: {
          id: true, entityType: true, entityId: true, action: true,
          userId: true, impersonatedByStaffId: true, ipAddress: true, occurredAt: true,
        },
      }),
      prisma.supportTicket.count({ where: { organizationId: id } }),
      prisma.supportTicket.count({
        where: { organizationId: id, status: { in: ['open', 'in_progress', 'waiting_on_user'] } },
      }),
    ]);

    return {
      organization: {
        id: org.id,
        name: org.name,
        country: org.country,
        currency: org.currency,
        planCode: org.planCode,
        effectivePlanCode: await getEffectivePlanCode(prisma, id),
        isActive: org.isActive,
        isDemo: org.isDemo,
        suspendedAt: org.suspendedAt,
        suspendedReason: org.suspendedReason,
        suspendedMessage: org.suspendedMessage,
        deletedAt: org.deletedAt,
        purgeAfter: org.purgeAfter,
        createdAt: org.createdAt,
        ambientTempC: org.ambientTempC,
      },
      suspension: org.suspendedAt
        ? { suspended: true, at: org.suspendedAt, reason: org.suspendedReason, message: org.suspendedMessage }
        : { suspended: false },
      activeOverride: publicOverride(activeOverride),
      plan: planLimits,
      members: members.map((m: any) => ({
        membershipId: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user,
      })),
      subscriptions,
      invoices,
      flocks: {
        byStatus: Object.fromEntries(flocksByStatus.map((f: any) => [f.status, f._count._all])),
        totalBirds: flockBirds._sum.currentCount ?? 0,
        totalInitialBirds: flockBirds._sum.initialCount ?? 0,
      },
      // P3: real ticket counts (open = anything not resolved/closed).
      supportTickets: { open: supportOpen, total: supportTotal },
      platformAuditEvents: platformEvents,
      tenantAuditLog: tenantAudit,
    };
  });

  // ══════════════════════════════════════════════════════
  // TENANT MUTATIONS — all audited, all re-auth-gated
  // ══════════════════════════════════════════════════════

  // ── POST /tenants/:id/override — plan comp / limits override ──
  // Upserts the ACTIVE override: previous active rows are expired
  // (expiresAt = now) rather than deleted, keeping tenant_overrides as its
  // own history. getEffectivePlanCode() picks the new row up immediately.
  app.post(
    '/tenants/:id/override',
    { preHandler: [requireStaff('billing.override'), requireReauth()] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      let body;
      try {
        body = OverrideSchema.parse(request.body);
      } catch (err: any) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
      }
      if (body.planCode && !PLANS[body.planCode as keyof typeof PLANS]) {
        return reply.status(400).send({ error: 'INVALID_PLAN', message: `Unknown planCode '${body.planCode}'` });
      }
      const actor = actorOf(request);

      const org = await loadOrgOr404(prisma, id, reply);
      if (!org) return;

      const now = new Date();
      const before = await prisma.tenantOverride.findFirst({
        where: { organizationId: id, ...activeOverrideWhere(now) },
        orderBy: { createdAt: 'desc' },
      });

      const override = await prisma.$transaction(async (tx: any) => {
        // Expire every currently-active override so exactly one is live.
        await tx.tenantOverride.updateMany({
          where: { organizationId: id, ...activeOverrideWhere(now) },
          data: { expiresAt: now },
        });
        return tx.tenantOverride.create({
          data: {
            organizationId: id,
            planCode: body.planCode ?? null,
            limitsJson: body.limitsJson ?? null,
            compUntil: body.compUntil ? new Date(body.compUntil) : null,
            reason: body.reason,
            createdByStaffId: actor.staffId,
            expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
          },
        });
      });

      await writePlatformAudit(prisma, {
        actorStaffId: actor.staffId,
        actorRole: actor.role,
        action: 'tenant.override',
        targetType: 'organization',
        targetId: id,
        organizationId: id,
        reason: body.reason,
        before: publicOverride(before),
        after: publicOverride(override),
        ...auditCtx(request),
      });

      return reply.status(201).send({
        override: publicOverride(override),
        effectivePlanCode: await getEffectivePlanCode(prisma, id),
      });
    },
  );

  // ── POST /tenants/:id/suspend — block all tenant API access (423) ──
  app.post(
    '/tenants/:id/suspend',
    { preHandler: [requireStaff('tenants.suspend'), requireReauth()] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      let body;
      try {
        body = SuspendSchema.parse(request.body);
      } catch (err: any) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
      }
      const actor = actorOf(request);

      const org = await loadOrgOr404(prisma, id, reply);
      if (!org) return;
      if (org.deletedAt) {
        return reply.status(422).send({ error: 'ORG_DELETED', message: 'Organization is pending deletion' });
      }
      if (org.suspendedAt) {
        return reply.status(422).send({ error: 'ALREADY_SUSPENDED' });
      }

      const updated = await prisma.organization.update({
        where: { id },
        data: {
          suspendedAt: new Date(),
          suspendedReason: body.reason,
          suspendedMessage: body.message ?? 'This organization has been suspended. Please contact support.',
        },
      });

      await writePlatformAudit(prisma, {
        actorStaffId: actor.staffId,
        actorRole: actor.role,
        action: 'tenant.suspend',
        targetType: 'organization',
        targetId: id,
        organizationId: id,
        reason: body.reason,
        before: { suspendedAt: null },
        after: {
          suspendedAt: updated.suspendedAt,
          suspendedReason: updated.suspendedReason,
          suspendedMessage: updated.suspendedMessage,
        },
        ...auditCtx(request),
      });

      return {
        organizationId: id,
        suspendedAt: updated.suspendedAt,
        suspendedReason: updated.suspendedReason,
        suspendedMessage: updated.suspendedMessage,
      };
    },
  );

  // ── POST /tenants/:id/reactivate — clear the suspension ──
  app.post(
    '/tenants/:id/reactivate',
    { preHandler: [requireStaff('tenants.reactivate'), requireReauth()] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      let body;
      try {
        body = ReactivateSchema.parse(request.body ?? {});
      } catch (err: any) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
      }
      const actor = actorOf(request);

      const org = await loadOrgOr404(prisma, id, reply);
      if (!org) return;
      if (!org.suspendedAt) {
        return reply.status(422).send({ error: 'NOT_SUSPENDED' });
      }

      const updated = await prisma.organization.update({
        where: { id },
        data: { suspendedAt: null, suspendedReason: null, suspendedMessage: null },
      });

      await writePlatformAudit(prisma, {
        actorStaffId: actor.staffId,
        actorRole: actor.role,
        action: 'tenant.reactivate',
        targetType: 'organization',
        targetId: id,
        organizationId: id,
        reason: body.reason ?? null,
        before: { suspendedAt: org.suspendedAt, suspendedReason: org.suspendedReason },
        after: { suspendedAt: null },
        ...auditCtx(request),
      });

      return { organizationId: id, suspendedAt: updated.suspendedAt };
    },
  );

  // ══════════════════════════════════════════════════════
  // SUPPORT OPS (tenants.support_ops + reauth). Reason is optional in the
  // body but whatever is provided is recorded on the audit event.
  // ══════════════════════════════════════════════════════

  // ── POST /tenants/:id/members/:userId/reset-password ──
  // Revokes all sessions, then emails the tenant-side reset link (same
  // 'reset_password' token shape the self-serve flow uses).
  app.post(
    '/tenants/:id/members/:userId/reset-password',
    { preHandler: [requireStaff('tenants.support_ops'), requireReauth()] },
    async (request, reply) => {
      const { id, userId } = z
        .object({ id: z.string().uuid(), userId: z.string().uuid() })
        .parse(request.params);
      const body = SupportOpSchema.parse(request.body ?? {});
      const actor = actorOf(request);

      const org = await loadOrgOr404(prisma, id, reply);
      if (!org) return;
      const membership = await loadMemberOr404(prisma, id, userId, reply);
      if (!membership) return;
      const user = membership.user;
      if (!user.email) {
        return reply.status(422).send({ error: 'NO_EMAIL', message: 'User has no email — cannot send a reset link' });
      }

      await revokeTenantUserTokens(prisma, redis, user.id);

      const token = jwt.sign(
        { userId: user.id, email: user.email, action: 'reset_password' },
        JWT_SECRET,
        { expiresIn: '30m' },
      );
      const emailResult = await sendVerificationEmail(user.email, token, 'reset_password', {
        organizationId: id,
        userId: user.id,
        sentByStaffId: actor.staffId,
      });

      await writePlatformAudit(prisma, {
        actorStaffId: actor.staffId,
        actorRole: actor.role,
        action: 'tenant.reset_password',
        targetType: 'user',
        targetId: user.id,
        organizationId: id,
        reason: body.reason ?? null,
        after: { sessionsRevoked: true, emailSent: emailResult.success },
        ...auditCtx(request),
      });

      return {
        success: true,
        emailSent: emailResult.success,
        ...(emailResult.devUrl ? { devUrl: emailResult.devUrl } : {}),
      };
    },
  );

  // ── POST /tenants/:id/members/:userId/force-logout ──
  // Token invalidation only: tokensValidAfter bumps so every live JWT dies.
  app.post(
    '/tenants/:id/members/:userId/force-logout',
    { preHandler: [requireStaff('tenants.support_ops'), requireReauth()] },
    async (request, reply) => {
      const { id, userId } = z
        .object({ id: z.string().uuid(), userId: z.string().uuid() })
        .parse(request.params);
      const body = SupportOpSchema.parse(request.body ?? {});
      const actor = actorOf(request);

      const org = await loadOrgOr404(prisma, id, reply);
      if (!org) return;
      const membership = await loadMemberOr404(prisma, id, userId, reply);
      if (!membership) return;

      await revokeTenantUserTokens(prisma, redis, membership.user.id);

      await writePlatformAudit(prisma, {
        actorStaffId: actor.staffId,
        actorRole: actor.role,
        action: 'tenant.force_logout',
        targetType: 'user',
        targetId: membership.user.id,
        organizationId: id,
        reason: body.reason ?? null,
        after: { sessionsRevoked: true },
        ...auditCtx(request),
      });

      return { success: true };
    },
  );

  // ── POST /tenants/:id/members/:userId/resend-verification ──
  app.post(
    '/tenants/:id/members/:userId/resend-verification',
    { preHandler: [requireStaff('tenants.support_ops'), requireReauth()] },
    async (request, reply) => {
      const { id, userId } = z
        .object({ id: z.string().uuid(), userId: z.string().uuid() })
        .parse(request.params);
      const body = SupportOpSchema.parse(request.body ?? {});
      const actor = actorOf(request);

      const org = await loadOrgOr404(prisma, id, reply);
      if (!org) return;
      const membership = await loadMemberOr404(prisma, id, userId, reply);
      if (!membership) return;
      const user = membership.user;
      if (!user.email) {
        return reply.status(422).send({ error: 'NO_EMAIL', message: 'User has no email address' });
      }
      if (user.emailVerifiedAt) {
        return reply.status(422).send({ error: 'ALREADY_VERIFIED', message: 'Email already verified' });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email, action: 'verify_email' },
        JWT_SECRET,
        { expiresIn: '30m' },
      );
      const emailResult = await sendVerificationEmail(user.email, token, 'verify_email', {
        organizationId: id,
        userId: user.id,
        sentByStaffId: actor.staffId,
      });

      await writePlatformAudit(prisma, {
        actorStaffId: actor.staffId,
        actorRole: actor.role,
        action: 'tenant.resend_verification',
        targetType: 'user',
        targetId: user.id,
        organizationId: id,
        reason: body.reason ?? null,
        after: { emailSent: emailResult.success },
        ...auditCtx(request),
      });

      return {
        success: true,
        emailSent: emailResult.success,
        ...(emailResult.devUrl ? { devUrl: emailResult.devUrl } : {}),
      };
    },
  );

  // ── POST /tenants/:id/change-owner — hand ownership to another member ──
  // Target must be an existing member → becomes owner; every previous owner
  // demotes to manager. User.role is kept in sync with the membership role
  // (same convention as PATCH /api/v1/users/:id).
  app.post(
    '/tenants/:id/change-owner',
    { preHandler: [requireStaff('tenants.support_ops'), requireReauth()] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      let body;
      try {
        body = ChangeOwnerSchema.parse(request.body);
      } catch (err: any) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
      }
      const actor = actorOf(request);

      const org = await loadOrgOr404(prisma, id, reply);
      if (!org) return;
      if (org.deletedAt) {
        return reply.status(422).send({ error: 'ORG_DELETED' });
      }

      const target = await prisma.organizationMember.findFirst({
        where: { organizationId: id, userId: body.newOwnerUserId },
        include: { user: { select: { id: true, email: true, name: true, isActive: true } } },
      });
      if (!target) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'User is not a member of this organization' });
      }
      if (target.role === 'owner') {
        return reply.status(422).send({ error: 'ALREADY_OWNER' });
      }
      if (!target.user.isActive) {
        return reply.status(422).send({ error: 'USER_INACTIVE', message: 'Cannot make an inactive user the owner' });
      }

      const previousOwners = await prisma.organizationMember.findMany({
        where: { organizationId: id, role: 'owner' },
      });

      await prisma.$transaction([
        // Demote every current owner → manager (member row + user row).
        prisma.organizationMember.updateMany({
          where: { organizationId: id, role: 'owner' },
          data: { role: 'manager' },
        }),
        prisma.user.updateMany({
          where: {
            id: { in: previousOwners.map((m: any) => m.userId) },
          },
          data: { role: 'manager' },
        }),
        // Promote the target.
        prisma.organizationMember.update({
          where: { id: target.id },
          data: { role: 'owner' },
        }),
        prisma.user.update({
          where: { id: target.userId },
          data: { role: 'owner' },
        }),
      ]);

      await writePlatformAudit(prisma, {
        actorStaffId: actor.staffId,
        actorRole: actor.role,
        action: 'tenant.change_owner',
        targetType: 'organization',
        targetId: id,
        organizationId: id,
        reason: body.reason,
        before: { ownerUserIds: previousOwners.map((m: any) => m.userId) },
        after: { ownerUserIds: [target.userId], demotedTo: 'manager' },
        ...auditCtx(request),
      });

      return {
        success: true,
        newOwnerUserId: target.userId,
        previousOwnerUserIds: previousOwners.map((m: any) => m.userId),
      };
    },
  );

  // ── POST /tenants/:id/delete — staff-initiated GDPR delete ──
  // Same soft-delete path as the owner self-serve flow (deletedAt +
  // purgeAfter = +30d, subs cancelled, invoices voided, invites revoked) —
  // NOT a hard delete; the daily purge cron finishes the job. The existing
  // org-export mechanism (exportOrganization → GET /api/v1/organizations/
  // export) covers the "export first" requirement; a staff-side export
  // download for the console is TODO (P3+) — the 30-day grace leaves
  // plenty of room.
  app.post(
    '/tenants/:id/delete',
    { preHandler: [requireStaff('tenants.delete'), requireReauth()] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      let body;
      try {
        body = DeleteSchema.parse(request.body);
      } catch (err: any) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
      }
      const actor = actorOf(request);

      const org = await loadOrgOr404(prisma, id, reply);
      if (!org) return;
      if (org.deletedAt) {
        return reply.status(422).send({ error: 'ALREADY_DELETED' });
      }
      if (body.confirmName !== org.name) {
        return reply.status(422).send({
          error: 'CONFIRM_MISMATCH',
          message: 'confirmName must exactly match the organization name',
        });
      }

      const updated = await requestDeletion(prisma, id);

      await writePlatformAudit(prisma, {
        actorStaffId: actor.staffId,
        actorRole: actor.role,
        action: 'tenant.delete',
        targetType: 'organization',
        targetId: id,
        organizationId: id,
        reason: body.reason,
        before: { name: org.name, isActive: org.isActive, planCode: org.planCode },
        after: { deletedAt: updated.deletedAt, purgeAfter: updated.purgeAfter, isActive: updated.isActive },
        ...auditCtx(request),
      });

      return { deleted: true, purgeAfter: updated.purgeAfter };
    },
  );

  // ══════════════════════════════════════════════════════
  // IMPERSONATION (plan §4 — full act-as, guarded)
  // ══════════════════════════════════════════════════════

  // ── POST /tenants/:id/impersonate — mint a 30-min tenant JWT ──
  // The PlatformAuditEvent is written BEFORE the token exists. The minted
  // token is a normal tenant JWT plus an `impersonation` claim; tenant
  // authenticate() enforces the claim expiry and every mutation the staff
  // member performs lands in the tenant's own AuditLog with
  // impersonatedByStaffId set.
  app.post(
    '/tenants/:id/impersonate',
    { preHandler: [requireStaff('tenants.impersonate'), requireReauth(), denyImpersonation] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      let body;
      try {
        body = ImpersonateSchema.parse(request.body);
      } catch (err: any) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
      }
      const actor = actorOf(request);

      const org = await loadOrgOr404(prisma, id, reply);
      if (!org) return;
      if (org.deletedAt) {
        return reply.status(422).send({ error: 'ORG_DELETED', message: 'Cannot impersonate into a deleted organization' });
      }

      const membership = await prisma.organizationMember.findFirst({
        where: { organizationId: id, userId: body.targetUserId },
        include: { user: true },
      });
      if (!membership) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Target user is not a member of this organization' });
      }
      const target = membership.user;
      if (!target.isActive) {
        return reply.status(422).send({ error: 'USER_INACTIVE' });
      }

      const expiresAt = new Date(Date.now() + IMPERSONATION_TTL_MINUTES * 60 * 1000);
      const ip = getClientIp(request);

      // 1. Audit BEFORE minting — a refused/aborted mint still leaves the
      //    attempt in the platform log.
      await writePlatformAudit(prisma, {
        actorStaffId: actor.staffId,
        actorRole: actor.role,
        action: 'tenant.impersonate_start',
        targetType: 'user',
        targetId: target.id,
        organizationId: id,
        reason: body.reason,
        after: { targetEmail: target.email, ticketId: body.ticketId ?? null, expiresAt },
        ...auditCtx(request),
      });

      // 2. Record the session.
      const session = await prisma.impersonationSession.create({
        data: {
          staffUserId: actor.staffId,
          organizationId: id,
          targetUserId: target.id,
          reason: body.reason,
          ticketId: body.ticketId ?? null,
          expiresAt,
          ip,
        },
      });

      // 3. Mint the tenant token — identical claim shape to a login token
      //    plus the impersonation block authenticate() reads.
      const token = jwt.sign(
        {
          userId: target.id,
          email: target.email,
          phone: target.phone,
          role: target.role,
          organizationId: id,
          impersonation: {
            staffId: actor.staffId,
            sessionId: session.id,
            expiresAt: expiresAt.toISOString(),
          },
        },
        JWT_SECRET,
        { expiresIn: `${IMPERSONATION_TTL_MINUTES}m` },
      );

      return {
        token,
        sessionId: session.id,
        expiresAt,
        targetUser: { id: target.id, email: target.email, name: target.name, role: target.role },
        banner: `Acting as ${target.email ?? target.name ?? target.id} — ends ${expiresAt.toISOString()}`,
      };
    },
  );

  // ── POST /impersonation/:sessionId/end — end a session early ──
  // Sets endedAt; the tenant-side token itself is NOT re-validated against
  // this flag per-request (claim expiry is authoritative — documented
  // limitation), so denylisted routes and the 30-min TTL bound exposure.
  app.post(
    '/impersonation/:sessionId/end',
    { preHandler: [requireStaff('tenants.impersonate')] },
    async (request, reply) => {
      const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(request.params);
      const actor = actorOf(request);

      const session = await prisma.impersonationSession.findUnique({ where: { id: sessionId } });
      if (!session) return reply.status(404).send({ error: 'NOT_FOUND' });
      if (session.endedAt) {
        return reply.status(422).send({ error: 'ALREADY_ENDED' });
      }

      const updated = await prisma.impersonationSession.update({
        where: { id: sessionId },
        data: { endedAt: new Date() },
      });

      await writePlatformAudit(prisma, {
        actorStaffId: actor.staffId,
        actorRole: actor.role,
        action: 'tenant.impersonate_end',
        targetType: 'user',
        targetId: session.targetUserId,
        organizationId: session.organizationId,
        reason: `Session ${sessionId} ended`,
        before: { endedAt: null },
        after: { endedAt: updated.endedAt },
        ...auditCtx(request),
      });

      return { sessionId, endedAt: updated.endedAt };
    },
  );

  // ── GET /impersonation — session list for the tenant page ──
  app.get('/impersonation', { preHandler: [requireStaff('tenants.read')] }, async (request) => {
    const q = ImpersonationListSchema.parse(request.query);

    const where: any = {};
    if (q.orgId) where.organizationId = q.orgId;
    if (q.active === 'true') {
      where.endedAt = null;
      where.expiresAt = { gt: new Date() };
    } else if (q.active === 'false') {
      where.OR = [{ endedAt: { not: null } }, { expiresAt: { lte: new Date() } }];
    }

    const [sessions, total] = await Promise.all([
      prisma.impersonationSession.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          staffUser: { select: { id: true, email: true, name: true, role: true } },
          targetUser: { select: { id: true, email: true, name: true } },
          organization: { select: { id: true, name: true } },
        },
      }),
      prisma.impersonationSession.count({ where }),
    ]);

    const now = Date.now();
    return {
      items: sessions.map((s: any) => ({
        ...s,
        active: !s.endedAt && s.expiresAt.getTime() > now,
      })),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize),
    };
  });

  // ── GET /audit-events — platform audit feed (audit.read) ──
  app.get('/audit-events', { preHandler: [requireStaff('audit.read')] }, async (request) => {
    const q = AuditEventsQuerySchema.parse(request.query);

    const where: any = {};
    if (q.action) where.action = { contains: q.action };
    if (q.actor) where.actorStaffId = q.actor;
    if (q.orgId) where.organizationId = q.orgId;
    if (q.from || q.to) {
      where.occurredAt = {};
      if (q.from) where.occurredAt.gte = new Date(q.from);
      if (q.to) where.occurredAt.lte = new Date(q.to);
    }

    const [events, total] = await Promise.all([
      prisma.platformAuditEvent.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { actor: { select: { id: true, email: true, name: true, role: true } } },
      }),
      prisma.platformAuditEvent.count({ where }),
    ]);

    return {
      items: events,
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize),
    };
  });
}
