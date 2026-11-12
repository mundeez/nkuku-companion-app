// ── PLATFORM PLANS ADMIN (/api/v1/platform/plans) ────────
// P4: staff-side management of the subscription catalogue — the `plans`
// and `plan_prices` tables that plan-store.ts serves to billing at runtime.
//
//   GET   /plans                 billing.read         — list plans + price matrix
//   PATCH /plans/:code           billing.plans.write  — edit metadata/limits/features
//   PUT   /plans/:code/prices    billing.plans.write  — replace the price matrix
//
// Every write calls invalidatePlanCache() so plan-store picks the change
// up immediately (its own cache is ~60 s). Writes are platform-audited.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireStaff, getClientIp } from '../../core/staff-auth/staff-auth.service.js';
import { writePlatformAudit } from '../../core/staff-auth/audit.service.js';
import { invalidatePlanCache } from '../../core/billing/plan-store.js';

const PlanPatchSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(255).optional(),
  sortOrder: z.number().int().optional(),
  isSelfServe: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isTrial: z.boolean().optional(),
  trialDays: z.number().int().min(1).max(365).nullable().optional(),
  limits: z
    .object({
      maxActiveFlocks: z.number().int().min(-1).optional(),
      maxUsers: z.number().int().min(-1).optional(),
      maxCyclesHistory: z.number().int().min(-1).optional(),
      maxDocumentsPerRecord: z.number().int().min(-1).optional(),
    })
    .partial()
    .optional(),
  features: z.array(z.string().min(1).max(60)).optional(),
});

const PricesSchema = z.object({
  prices: z.array(
    z.object({
      billingCycle: z.enum(['monthly', 'cycle_3mo', 'annual']),
      currency: z.string().length(3),
      amount: z.number().min(0),
    }),
  ),
});

function auditCtx(request: any) {
  return {
    ip: getClientIp(request),
    userAgent: request.headers?.['user-agent'] ?? null,
    requestId: (request as any).id ?? null,
  };
}

/** Serialize a Prisma Plan (+prices) row for the console. */
function publicPlan(row: any) {
  const limits = (row.limits ?? {}) as Record<string, any>;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    sortOrder: row.sortOrder,
    isSelfServe: row.isSelfServe,
    isActive: row.isActive,
    isTrial: row.isTrial,
    trialDays: row.trialDays,
    limits: {
      maxActiveFlocks: limits.maxActiveFlocks ?? 0,
      maxUsers: limits.maxUsers ?? 0,
      maxCyclesHistory: limits.maxCyclesHistory ?? 0,
      maxDocumentsPerRecord: limits.maxDocumentsPerRecord ?? 0,
    },
    features: Array.isArray(row.features) ? row.features : [],
    prices: (row.prices ?? []).map((p: any) => ({
      billingCycle: p.billingCycle,
      currency: p.currency,
      amount: Number(p.amount),
    })),
    updatedAt: row.updatedAt,
  };
}

export async function buildPlatformPlansModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // ── GET /plans — list every plan row with its price matrix ──
  app.get('/plans', { preHandler: [requireStaff('billing.read')] }, async () => {
    const rows = await prisma.plan.findMany({
      include: { prices: true },
      orderBy: { sortOrder: 'asc' },
    });
    return { items: rows.map(publicPlan), count: rows.length };
  });

  // ── PATCH /plans/:code — edit metadata, limits, features ──
  app.patch('/plans/:code', { preHandler: [requireStaff('billing.plans.write')] }, async (request, reply) => {
    const { code } = z.object({ code: z.string().min(1).max(30) }).parse(request.params);
    let body;
    try {
      body = PlanPatchSchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
    }

    const existing = await prisma.plan.findUnique({ where: { code }, include: { prices: true } });
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND', message: `Unknown plan '${code}'` });

    const data: any = {};
    for (const key of ['name', 'description', 'sortOrder', 'isSelfServe', 'isActive', 'isTrial', 'trialDays'] as const) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    if (body.limits) {
      // Merge partial limits over the stored JSON object.
      data.limits = { ...(existing.limits as object), ...body.limits };
    }
    if (body.features) data.features = body.features;

    const updated = await prisma.plan.update({ where: { code }, data, include: { prices: true } });
    invalidatePlanCache();

    const actor = (request as any).staffUser;
    await writePlatformAudit(prisma, {
      actorStaffId: actor.staffId,
      actorRole: actor.role,
      action: 'plan.update',
      targetType: 'plan',
      targetId: code,
      before: publicPlan(existing),
      after: publicPlan(updated),
      ...auditCtx(request),
    });

    return { plan: publicPlan(updated) };
  });

  // ── PUT /plans/:code/prices — replace the whole price matrix ──
  app.put('/plans/:code/prices', { preHandler: [requireStaff('billing.plans.write')] }, async (request, reply) => {
    const { code } = z.object({ code: z.string().min(1).max(30) }).parse(request.params);
    let body;
    try {
      body = PricesSchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
    }

    const existing = await prisma.plan.findUnique({ where: { code }, include: { prices: true } });
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND', message: `Unknown plan '${code}'` });

    const updated = await prisma.$transaction(async (tx: any) => {
      await tx.planPrice.deleteMany({ where: { planId: existing.id } });
      if (body.prices.length) {
        await tx.planPrice.createMany({
          data: body.prices.map((p) => ({
            planId: existing.id,
            billingCycle: p.billingCycle,
            currency: p.currency.toUpperCase(),
            amount: p.amount,
          })),
        });
      }
      return tx.plan.findUnique({ where: { code }, include: { prices: true } });
    });
    invalidatePlanCache();

    const actor = (request as any).staffUser;
    await writePlatformAudit(prisma, {
      actorStaffId: actor.staffId,
      actorRole: actor.role,
      action: 'plan.prices_replace',
      targetType: 'plan',
      targetId: code,
      before: { prices: publicPlan(existing).prices },
      after: { prices: publicPlan(updated).prices },
      ...auditCtx(request),
    });

    return { plan: publicPlan(updated) };
  });
}
