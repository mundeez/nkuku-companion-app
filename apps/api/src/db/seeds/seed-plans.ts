// ── SEED: PLANS + PRICES + FREE→BASIC BACKFILL (P4) ──────
// Idempotent. Run from db/seeds/main.ts on every `prisma db seed`.
//
//   1. Upserts the five plan rows + their PlanPrice matrix from the PLANS
//      const (core/billing/plans.ts — the seed/TS authority). Staff edits
//      made through /api/v1/platform/plans are NOT clobbered: prices are
//      only (re)written when the row is missing, and plan rows are only
//      created — never updated — once they exist.
//   2. Backfills the retired 'free' tier:
//        organizations.plan_code  'free' → 'basic'
//        subscriptions.plan_code  'free' → 'basic', priceOverride = 0
//      (priceOverride=0 = "free forever" — the recurring-invoice cron
//      extends the period without generating a bill). Invoice plan_code
//      rows are historical and deliberately untouched.
//   3. 'Nkuku Demo Farm': keeps priceOverride=0 and gets a TenantOverride
//      to 'business' so the demo env exercises the Business feature set
//      while never being invoiced.

import type { PrismaClient } from '@prisma/client';
import { PLANS, type PlanCode } from '../../core/billing/plans.js';

const CYCLES = ['monthly', 'cycle_3mo', 'annual'] as const;
const CURRENCIES = ['ZMW', 'BWP', 'USD'] as const;

export async function seedPlans(prisma: PrismaClient) {
  console.log('[SEED] Plans + prices (P4)…');

  // ── 1. Plan + PlanPrice rows ────────────────────────────
  for (const plan of Object.values(PLANS)) {
    const { features, ...limits } = plan.limits;
    const row = await prisma.plan.upsert({
      where: { code: plan.code },
      update: {}, // staff edits win — reseeding never clobbers
      create: {
        code: plan.code,
        name: plan.name,
        description: plan.description,
        sortOrder: plan.sortOrder,
        isSelfServe: plan.isSelfServe,
        isActive: true,
        isTrial: plan.isTrial,
        trialDays: plan.trialDays,
        limits,
        features,
      },
    });

    for (const cycle of CYCLES) {
      for (const currency of CURRENCIES) {
        const amount = plan.pricing[cycle][currency];
        await prisma.planPrice.upsert({
          where: {
            planId_billingCycle_currency: {
              planId: row.id,
              billingCycle: cycle,
              currency,
            },
          },
          update: {}, // see note above — prices are staff-editable
          create: {
            planId: row.id,
            billingCycle: cycle,
            currency,
            amount,
          },
        });
      }
    }
    console.log(`[SEED]   plan ${plan.code} (${plan.name})`);
  }

  // ── 2. 'free' → 'basic' backfill ────────────────────────
  const orgsBackfilled = await prisma.organization.updateMany({
    where: { planCode: 'free' },
    data: { planCode: 'basic' },
  });
  if (orgsBackfilled.count) {
    console.log(`[SEED]   backfilled ${orgsBackfilled.count} org(s) free→basic`);
  }

  // Converted legacy-free subscriptions get priceOverride=0 ("free
  // forever") in the same write — only rows still marked 'free', so the
  // upsert is a no-op on reseed.
  const subsBackfilled = await prisma.subscription.updateMany({
    where: { planCode: 'free' },
    data: { planCode: 'basic', priceOverride: 0 },
  });
  if (subsBackfilled.count) {
    console.log(
      `[SEED]   converted ${subsBackfilled.count} subscription(s) free→basic @ priceOverride=0`,
    );
  }

  // ── 3. 'Nkuku Demo Farm': comp to Business, never billed ─
  const demoOrg = await prisma.organization.findFirst({
    where: { name: 'Nkuku Demo Farm' },
  });
  if (demoOrg) {
    const demoSub = await prisma.subscription.findFirst({
      where: {
        organizationId: demoOrg.id,
        status: { in: ['trialing', 'active', 'past_due', 'suspended'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (demoSub && Number(demoSub.priceOverride ?? -1) !== 0) {
      await prisma.subscription.update({
        where: { id: demoSub.id },
        data: { priceOverride: 0 },
      });
    }

    const now = new Date();
    const activeOverride = await prisma.tenantOverride.findFirst({
      where: {
        organizationId: demoOrg.id,
        AND: [
          { OR: [{ compUntil: null }, { compUntil: { gt: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    if (activeOverride?.planCode === 'business') {
      // already comp'd — nothing to do
    } else if (activeOverride) {
      await prisma.tenantOverride.update({
        where: { id: activeOverride.id },
        data: { planCode: 'business' },
      });
      console.log('[SEED]   Nkuku Demo Farm override → business (updated)');
    } else {
      await prisma.tenantOverride.create({
        data: {
          organizationId: demoOrg.id,
          planCode: 'business' satisfies PlanCode,
          reason: 'P4 seed: demo farm is comped to Business, free forever (priceOverride=0)',
          createdByStaffId: null,
        },
      });
      console.log('[SEED]   Nkuku Demo Farm override → business (created)');
    }
  }

  console.log('[SEED] Plans seed complete');
}
