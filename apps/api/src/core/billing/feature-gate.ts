// ── FEATURE GATING MIDDLEWARE ────────────────────────────
// Fastify preHandler hooks that enforce plan limits (flock count, user
// count, document count, feature flags) per the organization's current
// subscription tier.

import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { getEffectivePlanCode, getOrCreateSubscription } from './billing.service.js';
import { hasFeature, getPlan } from './plans.js';
import { hasActiveAddon } from './addons.js';

/**
 * Whether ads should be shown to this organization: Free tier only, and
 * only if it hasn't purchased the "remove_ads_addon". See
 * docs/ADVERTISING_PLAN.md.
 */
export async function shouldShowAds(prisma: PrismaClient, organizationId: string): Promise<boolean> {
  const planCode = await getEffectivePlanCode(prisma, organizationId);
  if (planCode !== 'free') return false;
  const adsRemoved = await hasActiveAddon(prisma, organizationId, 'remove_ads_addon');
  return !adsRemoved;
}

/**
 * Restrict a route to platform administrators (cross-organization admin
 * surfaces, e.g. ad campaign management). Not part of the org-scoped RBAC
 * system — checked via a dedicated `User.isPlatformAdmin` flag.
 */
export async function requirePlatformAdmin(request: FastifyRequest, reply: FastifyReply) {
  const prisma = (request as any).server?.prisma ?? (reply as any).server?.prisma;
  const userId = (request as any).authUser?.userId;
  if (!prisma || !userId) {
    return reply.status(403).send({ error: 'FORBIDDEN' });
  }
  const user = await (prisma as PrismaClient).user.findUnique({ where: { id: userId } });
  if (!user?.isPlatformAdmin) {
    return reply.status(403).send({ error: 'FORBIDDEN', message: 'Platform admin access required' });
  }
}

/**
 * Check if the organization's current plan includes a feature.
 * Returns 403 if the feature is not available on the current tier.
 */
export function requireFeature(feature: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const prisma = (request as any).server?.prisma ?? (reply as any).server?.prisma;
    const organizationId = (request as any).authUser?.organizationId;
    if (!prisma || !organizationId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'No organization context' });
    }

    const planCode = await getEffectivePlanCode(prisma, organizationId);
    if (!hasFeature(planCode, feature)) {
      const plan = getPlan(planCode);
      return reply.status(402).send({
        error: 'PLAN_LIMIT_REACHED',
        message: `This feature requires a higher plan. Your current plan (${plan?.name}) does not include "${feature}".`,
        feature,
        currentPlan: planCode,
      });
    }
  };
}

/**
 * Check if the organization can create a new flock (respects maxActiveFlocks limit).
 * Use as a preHandler on POST flock endpoints.
 */
export async function checkFlockLimit(request: FastifyRequest, reply: FastifyReply) {
  const prisma = (request as any).server?.prisma ?? (reply as any).server?.prisma;
  const organizationId = (request as any).authUser?.organizationId;
  if (!prisma || !organizationId) return;

  const planCode = await getEffectivePlanCode(prisma, organizationId);
  const plan = getPlan(planCode);
  if (!plan) return;

  const maxFlocks = plan.limits.maxActiveFlocks;
  if (maxFlocks === -1) return; // unlimited

  const activeCount = await (prisma as PrismaClient).broilerFlock.count({
    where: { organizationId, status: 'active' },
  });

  if (activeCount >= maxFlocks) {
    return reply.status(402).send({
      error: 'PLAN_LIMIT_REACHED',
      message: `Your plan (${plan.name}) allows up to ${maxFlocks} active flock(s). Upgrade to create more.`,
      limit: 'maxActiveFlocks',
      current: activeCount,
      max: maxFlocks,
      currentPlan: planCode,
    });
  }
}

/**
 * Check if the organization can add another user (respects maxUsers limit).
 * Use as a preHandler on invite creation endpoints.
 */
export async function checkUserLimit(request: FastifyRequest, reply: FastifyReply) {
  const prisma = (request as any).server?.prisma ?? (reply as any).server?.prisma;
  const organizationId = (request as any).authUser?.organizationId;
  if (!prisma || !organizationId) return;

  const planCode = await getEffectivePlanCode(prisma, organizationId);
  const plan = getPlan(planCode);
  if (!plan) return;

  const maxUsers = plan.limits.maxUsers;
  if (maxUsers === -1) return; // unlimited

  const memberCount = await (prisma as PrismaClient).organizationMember.count({
    where: { organizationId },
  });
  // Also count pending invites
  const inviteCount = await (prisma as PrismaClient).invite.count({
    where: { organizationId, acceptedAt: null },
  });

  const total = memberCount + inviteCount;
  if (total >= maxUsers) {
    return reply.status(402).send({
      error: 'PLAN_LIMIT_REACHED',
      message: `Your plan (${plan.name}) allows up to ${maxUsers} user(s). Upgrade to invite more.`,
      limit: 'maxUsers',
      current: total,
      max: maxUsers,
      currentPlan: planCode,
    });
  }
}

/**
 * Check if the organization can attach another document to a record
 * (respects maxDocumentsPerRecord limit).
 * Call manually (not as preHandler) — needs the record type + ID.
 */
export async function checkDocumentLimit(
  prisma: PrismaClient,
  organizationId: string,
  currentDocCount: number,
): Promise<{ allowed: boolean; reason?: string; currentPlan?: string }> {
  const planCode = await getEffectivePlanCode(prisma, organizationId);
  const plan = getPlan(planCode);
  if (!plan) return { allowed: false, reason: 'Unknown plan' };

  const max = plan.limits.maxDocumentsPerRecord;
  if (max === -1) return { allowed: true };
  if (max === 0) {
    return {
      allowed: false,
      reason: `Your plan (${plan.name}) does not include document attachments. Upgrade to attach documents.`,
      currentPlan: planCode,
    };
  }
  if (currentDocCount >= max) {
    return {
      allowed: false,
      reason: `Your plan (${plan.name}) allows up to ${max} document(s) per record. Upgrade to attach more.`,
      currentPlan: planCode,
    };
  }
  return { allowed: true };
}

/**
 * Get the current plan limits for an organization (for display in UI).
 */
export async function getPlanLimitsForOrg(prisma: PrismaClient, organizationId: string) {
  const planCode = await getEffectivePlanCode(prisma, organizationId);
  const plan = getPlan(planCode);
  const sub = await getOrCreateSubscription(prisma, organizationId);

  // Get current usage
  const [activeFlocks, members, pendingInvites] = await Promise.all([
    prisma.broilerFlock.count({ where: { organizationId, status: 'active' } }),
    prisma.organizationMember.count({ where: { organizationId } }),
    prisma.invite.count({ where: { organizationId, acceptedAt: null } }),
  ]);

  return {
    planCode,
    planName: plan?.name || planCode,
    subscriptionStatus: sub.status,
    limits: plan?.limits || {},
    usage: {
      activeFlocks,
      users: members + pendingInvites,
    },
  };
}
