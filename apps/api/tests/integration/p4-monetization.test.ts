// Integration tests — P4 MONETIZATION / PLATFORM ADMIN.
// Covers the DB-backed plan store, 14-day signup trial, the billing
// read-only lock (402 SUBSCRIPTION_REQUIRED), feature-flag precedence,
// announcement targeting + dismissal, the catalogue write lockdown, and
// the basic tier's hard limits.
//
// Requires the isolated test stack (docker-compose.test.yml); the
// vitest globalSetup guard enforces that.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_API_URL, TEST_DATABASE_URL } from '../helpers/env.js';
import { api, post, makeStaffWithToken, reauthStaff } from '../helpers/staff.js';
import {
  getPlanByCode,
  getPlans,
  invalidatePlanCache,
} from '../../src/core/billing/plan-store.js';
import {
  isEnabled,
  invalidateFeatureFlagCache,
} from '../../src/core/feature-flags/flag.service.js';

const prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
const TENANT_PASSWORD = 'P4TestPass123!';

function get(path: string, token?: string) {
  return api(path, {}, token);
}
function patch(path: string, body: any, token?: string) {
  return api(path, { method: 'PATCH', body: JSON.stringify(body) }, token);
}
function del(path: string, token?: string) {
  return api(path, { method: 'DELETE' }, token);
}
function put(path: string, body: any, token?: string) {
  return api(path, { method: 'PUT', body: JSON.stringify(body) }, token);
}

let seq = 0;
async function registerTenant(suffix: string) {
  const email = `p4-${suffix}-${Date.now()}-${seq++}@example.com`;
  const res = await fetch(`${TEST_API_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: TENANT_PASSWORD,
      name: `P4 ${suffix}`,
      organizationName: `P4 Farm ${suffix}`,
      country: 'ZM',
      currency: 'ZMW',
      consent: true,
    }),
  });
  const data = await res.json();
  return { ...data, email };
}

/** The org's newest plan-tier subscription row. */
async function planSub(orgId: string) {
  return prisma.subscription.findFirst({
    where: {
      organizationId: orgId,
      planCode: { in: ['trial', 'basic', 'grower', 'business', 'enterprise', 'free'] },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/** Put an org on paid 'basic' (subscribe → mock-pay the invoice). */
async function upgradeToBasic(token: string) {
  const sub = await post('/api/v1/billing/subscribe', { planCode: 'basic', billingCycle: 'monthly' }, token);
  expect(sub.status).toBe(200);
  const txRef = sub.data.checkout?.txRef;
  expect(txRef).toBeDefined();
  const pay = await get(`/api/v1/billing/dev/mock-pay?txRef=${txRef}`, token);
  expect(pay.status).toBe(200);
}

async function createFlock(token: string, breedId: string, name: string) {
  return post(
    '/api/v1/broiler-flocks',
    {
      name,
      breedId,
      startDate: new Date().toISOString().split('T')[0],
      initialCount: 50,
      orderDate: new Date().toISOString().split('T')[0],
    },
    token,
  );
}

describe('P4 — plans, trial, lock, flags, announcements, catalogue', () => {
  let superToken: string;
  let financeToken: string;
  let marketingToken: string;
  let editorToken: string;

  let orgId: string;
  let ownerToken: string;

  beforeAll(async () => {
    superToken = (await makeStaffWithToken(prisma, 'super_admin')).accessToken;
    financeToken = (await makeStaffWithToken(prisma, 'finance')).accessToken;
    marketingToken = (await makeStaffWithToken(prisma, 'marketing')).accessToken;
    editorToken = (await makeStaffWithToken(prisma, 'content_editor')).accessToken;

    const tenant = await registerTenant('main');
    ownerToken = tenant.accessToken;
    orgId = tenant.organization.id;
  });

  afterAll(async () => {
    // Restore anything tests mutated on shared catalogue rows.
    invalidatePlanCache();
    invalidateFeatureFlagCache();
    await prisma.$disconnect();
  });

  // ────────────────────────────────────────────────────────────
  // 1. Trial signup
  // ────────────────────────────────────────────────────────────
  describe('trial signup', () => {
    it('new org gets planCode=trial, status=trialing, ~14-day window', async () => {
      const sub = await planSub(orgId);
      expect(sub).not.toBeNull();
      expect(sub!.planCode).toBe('trial');
      expect(sub!.status).toBe('trialing');
      expect(sub!.trialEndsAt).not.toBeNull();
      const days = (sub!.trialEndsAt!.getTime() - sub!.createdAt.getTime()) / 86_400_000;
      expect(days).toBeGreaterThan(13);
      expect(days).toBeLessThan(15);

      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      expect(org?.planCode).toBe('trial');
    });

    it('GET /organizations/me/access reports trialing state', async () => {
      const res = await get('/api/v1/organizations/me/access', ownerToken);
      expect(res.status).toBe(200);
      expect(res.data.state).toBe('trialing');
      expect(res.data.planCode).toBe('trial');
      expect(res.data.planName).toBeTruthy();
      expect(res.data.daysLeftInTrial).toBeGreaterThanOrEqual(13);
      expect(res.data.showAds).toBe(false); // trial is ad-free
    });

    it('trial exposes business-level features (e.g. csv_pdf_export)', async () => {
      const res = await get('/api/v1/billing/subscription', ownerToken);
      expect(res.status).toBe(200);
      const features = res.data.limits?.features ?? [];
      expect(features).toContain('csv_pdf_export');
      expect(features).toContain('gaap_statements');
      expect(features).not.toContain('api_access'); // enterprise-only
    });
  });

  // ────────────────────────────────────────────────────────────
  // 2. Plan store — DB rows, staff edits, static fallback
  // ────────────────────────────────────────────────────────────
  describe('plan store (DB-backed + fallback)', () => {
    it('serves all five tiers from the plans table', async () => {
      const plans = await getPlans(prisma);
      const codes = plans.map((p) => p.code);
      for (const c of ['trial', 'basic', 'grower', 'business', 'enterprise']) {
        expect(codes).toContain(c);
      }
      const basic = await getPlanByCode(prisma, 'basic');
      expect(basic?.fromDb).toBe(true);
      expect(basic?.pricing.monthly.ZMW).toBe(150);
    });

    it('staff PATCH is visible through the store after invalidation', async () => {
      // billing.plans.write is a re-auth-gated permission.
      const fin = await reauthStaff(financeToken);
      const res = await patch(
        '/api/v1/platform/plans/basic',
        { description: 'P4 edited description' },
        fin,
      );
      expect(res.status).toBe(200);
      expect(res.data.plan.description).toBe('P4 edited description');

      invalidatePlanCache();
      const basic = await getPlanByCode(prisma, 'basic');
      expect(basic?.description).toBe('P4 edited description');

      // restore
      await patch(
        '/api/v1/platform/plans/basic',
        { description: 'For smallholders — core tracking + simple income/expense, 12 flocks, 1 user' },
        await reauthStaff(financeToken),
      );
      invalidatePlanCache();
    });

    it('falls back to the PLANS const when the DB row is absent', async () => {
      // 'enterprise' is the least-referenced tier — delete + restore in
      // this same test so no parallel file can observe the gap.
      const row = await prisma.plan.findUnique({ where: { code: 'enterprise' }, include: { prices: true } });
      expect(row).not.toBeNull();
      const priceRows = row!.prices.map((p) => ({
        billingCycle: p.billingCycle,
        currency: p.currency,
        amount: p.amount,
      }));

      await prisma.plan.delete({ where: { code: 'enterprise' } });
      invalidatePlanCache();
      const fallback = await getPlanByCode(prisma, 'enterprise');
      expect(fallback).not.toBeUndefined();
      expect(fallback!.fromDb).toBe(false);
      expect(fallback!.limits.features).toContain('api_access');

      // restore exactly as seeded
      const recreated = await prisma.plan.create({
        data: {
          code: row!.code,
          name: row!.name,
          description: row!.description,
          sortOrder: row!.sortOrder,
          isSelfServe: row!.isSelfServe,
          isActive: row!.isActive,
          isTrial: row!.isTrial,
          trialDays: row!.trialDays,
          limits: row!.limits as any,
          features: row!.features as any,
        },
      });
      await prisma.planPrice.createMany({
        data: priceRows.map((p) => ({ ...p, planId: recreated.id })),
      });
      invalidatePlanCache();
    });

    it('PUT /platform/plans/:code/prices replaces the matrix', async () => {
      const fin = await reauthStaff(financeToken);
      const res = await put(
        '/api/v1/platform/plans/grower/prices',
        { prices: [{ billingCycle: 'monthly', currency: 'ZMW', amount: 275 }] },
        fin,
      );
      expect(res.status).toBe(200);
      expect(res.data.plan.prices).toHaveLength(1);
      expect(Number(res.data.plan.prices[0].amount)).toBe(275);

      // restore the full grower matrix
      const { PLANS } = await import('../../src/core/billing/plans.js');
      const prices = (['monthly', 'cycle_3mo', 'annual'] as const).flatMap((cycle) =>
        (['ZMW', 'BWP', 'USD'] as const).map((currency) => ({
          billingCycle: cycle,
          currency,
          amount: PLANS.grower.pricing[cycle][currency],
        })),
      );
      await put('/api/v1/platform/plans/grower/prices', { prices }, await reauthStaff(financeToken));
      invalidatePlanCache();
    });

    it('non-finance staff cannot write plans', async () => {
      const res = await patch('/api/v1/platform/plans/basic', { name: 'Nope' }, await reauthStaff(marketingToken));
      expect(res.status).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 3. Billing read-only lock
  // ────────────────────────────────────────────────────────────
  describe('suspended-subscription read-only lock', () => {
    it('mutations 402 SUBSCRIPTION_REQUIRED, reads + billing stay open', async () => {
      const sub = await planSub(orgId);
      await prisma.subscription.update({ where: { id: sub!.id }, data: { status: 'suspended' } });
      try {
        // access state flips to locked
        const access = await get('/api/v1/organizations/me/access', ownerToken);
        expect(access.data.state).toBe('locked');

        // mutations blocked with the P4 code
        const blocked = await post('/api/v1/broiler-flocks', { name: 'x' }, ownerToken);
        expect(blocked.status).toBe(402);
        expect(blocked.data.code).toBe('SUBSCRIPTION_REQUIRED');

        // reads unaffected
        expect((await get('/api/v1/breeds', ownerToken)).status).toBe(200);
        expect((await get('/api/v1/organizations/me', ownerToken)).status).toBe(200);

        // billing surface stays reachable for resolving the balance
        expect((await get('/api/v1/billing/subscription', ownerToken)).status).toBe(200);
        expect((await get('/api/v1/billing/invoices', ownerToken)).status).toBe(200);
        const subscribe = await post(
          '/api/v1/billing/subscribe',
          { planCode: 'basic', billingCycle: 'monthly' },
          ownerToken,
        );
        expect(subscribe.status).not.toBe(402);
        expect(subscribe.data?.code).not.toBe('SUBSCRIPTION_REQUIRED');
      } finally {
        // The allowlisted /billing/subscribe call above legitimately moved
        // the org to 'basic' — restore the full trial row so later tests
        // see the trial plan again.
        await prisma.subscription.update({
          where: { id: sub!.id },
          data: { status: 'trialing', planCode: 'trial' },
        });
        await prisma.organization.update({ where: { id: orgId }, data: { planCode: 'trial' } });
      }
    });
  });

  // ────────────────────────────────────────────────────────────
  // 4. Feature flags — org > plan > default precedence
  // ────────────────────────────────────────────────────────────
  describe('feature flags', () => {
    const FLAG = 'p4_test.beta_widget';

    afterAll(async () => {
      await prisma.featureFlag.deleteMany({ where: { key: FLAG } }).catch(() => {});
      invalidateFeatureFlagCache();
    });

    it('CRUD: create/list/update/delete on the platform surface', async () => {
      const sup = await reauthStaff(superToken); // flags.write is re-auth-gated
      const created = await post(
        '/api/v1/platform/flags',
        { key: FLAG, description: 'P4 test flag', enabledByDefault: true },
        sup,
      );
      expect(created.status).toBe(201);
      expect(created.data.flag.enabledByDefault).toBe(true);

      const list = await get('/api/v1/platform/flags', superToken);
      expect(list.status).toBe(200);
      expect(list.data.items.some((f: any) => f.key === FLAG)).toBe(true);

      // finance lacks flags.write
      expect((await patch(`/api/v1/platform/flags/${FLAG}`, { enabledByDefault: false }, await reauthStaff(financeToken))).status).toBe(403);
    });

    it('precedence: org override > plan override > enabledByDefault', async () => {
      const sup = await reauthStaff(superToken);
      // default ON → trialing org sees it
      let res = await get('/api/v1/me/flags', ownerToken);
      expect(res.data.flags[FLAG]).toBe(true);

      // plan-level off for 'trial' → now off
      const off = await patch(`/api/v1/platform/flags/${FLAG}`, { planOverrides: { trial: false } }, sup);
      expect(off.status).toBe(200);
      res = await get('/api/v1/me/flags', ownerToken);
      expect(res.data.flags[FLAG]).toBe(false);

      // org-level on → org wins over plan
      const on = await patch(`/api/v1/platform/flags/${FLAG}`, { orgOverrides: { [orgId]: true } }, sup);
      expect(on.status).toBe(200);
      res = await get('/api/v1/me/flags', ownerToken);
      expect(res.data.flags[FLAG]).toBe(true);

      // same evaluation through the service layer
      expect(await isEnabled(prisma, FLAG, { orgId, planCode: 'trial' })).toBe(true);
      expect(await isEnabled(prisma, FLAG, { orgId: '00000000-0000-0000-0000-000000000000', planCode: 'trial' })).toBe(false);
      expect(await isEnabled(prisma, FLAG, { planCode: 'business' })).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 5. Announcements — audience targeting + dismissal
  // ────────────────────────────────────────────────────────────
  describe('announcements', () => {
    let allId: string;
    let plansId: string;
    let orgsId: string;
    const createdIds: string[] = [];

    afterAll(async () => {
      // Announcements persist between runs — clean up ours so stale rows
      // (e.g. a non-dismissible one) can't pollute later assertions.
      await prisma.announcement.deleteMany({ where: { id: { in: createdIds } } }).catch(() => {});
    });

    it('staff create announcements for each audience', async () => {
      const mk = async (body: any) => {
        const res = await post('/api/v1/platform/announcements', body, marketingToken);
        expect(res.status).toBe(201);
        createdIds.push(res.data.announcement.id);
        return res.data.announcement.id as string;
      };
      allId = await mk({ title: 'All-hands notice', body: 'for everyone', audience: 'all' });
      plansId = await mk({
        title: 'Business-only notice',
        body: 'for business orgs',
        audience: 'plans',
        planCodes: ['business'],
      });
      orgsId = await mk({
        title: 'This-org notice',
        body: 'for our org',
        audience: 'orgs',
        orgIds: [orgId],
      });
      await mk({
        title: 'Future notice',
        body: 'starts tomorrow',
        audience: 'all',
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      });
    });

    it('tenant /announcements/active filters audience + schedule + dismissal', async () => {
      const res = await get('/api/v1/announcements/active', ownerToken);
      expect(res.status).toBe(200);
      const ids = res.data.items.map((a: any) => a.id);
      expect(ids).toContain(allId);   // audience=all
      expect(ids).toContain(orgsId);  // orgId targeted
      expect(ids).not.toContain(plansId); // our plan is trial, not business
      // scheduled future announcement not yet active
      expect(res.data.items.every((a: any) => new Date(a.startsAt) <= new Date())).toBe(true);
      // the announcements WE created are dismissible
      const ours = res.data.items.filter((a: any) => createdIds.includes(a.id));
      expect(ours.every((a: any) => a.isDismissible === true)).toBe(true);

      // platform list includes scheduled announcements
      const admin = await get('/api/v1/platform/announcements', marketingToken);
      expect(admin.status).toBe(200);
      const adminIds = admin.data.items.map((a: any) => a.id);
      expect(adminIds).toContain(plansId);

      // dismiss → excluded from /active
      const dismissed = await post(`/api/v1/announcements/${allId}/dismiss`, {}, ownerToken);
      expect(dismissed.status).toBe(200);
      expect(dismissed.data.dismissed).toBe(true);
      const after = await get('/api/v1/announcements/active', ownerToken);
      expect(after.data.items.map((a: any) => a.id)).not.toContain(allId);
      expect(after.data.items.map((a: any) => a.id)).toContain(orgsId);
    });

    it('non-dismissible announcements reject dismissal (422)', async () => {
      const res = await post(
        '/api/v1/platform/announcements',
        { title: 'Terms update', body: 'must read', audience: 'all', isDismissible: false },
        marketingToken,
      );
      expect(res.status).toBe(201);
      createdIds.push(res.data.announcement.id);
      const out = await post(`/api/v1/announcements/${res.data.announcement.id}/dismiss`, {}, ownerToken);
      expect(out.status).toBe(422);
      expect(out.data.error).toBe('NOT_DISMISSIBLE');
    });

    it('tenant users cannot write announcements (403)', async () => {
      const res = await post('/api/v1/platform/announcements', { title: 'x', body: 'y' }, ownerToken);
      expect([401, 403]).toContain(res.status);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 6. Catalogue lockdown — tenant writes 403, staff writes 200
  // ────────────────────────────────────────────────────────────
  describe('catalogue write lockdown', () => {
    it('org token is 403 on global disease writes', async () => {
      const res = await post(
        '/api/v1/diseases',
        { name: 'P4 Test Disease', category: 'viral' },
        ownerToken,
      );
      expect(res.status).toBe(403);
    });

    it('staff can manage diseases via /platform/catalogue', async () => {
      const created = await post(
        '/api/v1/platform/catalogue/diseases',
        { name: `P4 Staff Disease ${Date.now()}`, category: 'bacterial' },
        editorToken,
      );
      expect(created.status).toBe(201);
      const id = created.data.item.id;

      const list = await get('/api/v1/platform/catalogue/diseases', editorToken);
      expect(list.data.items.some((d: any) => d.id === id)).toBe(true);

      const patched = await patch(`/api/v1/platform/catalogue/diseases/${id}`, { treatment: 'rest' }, editorToken);
      expect(patched.status).toBe(200);
      expect(patched.data.item.treatment).toBe('rest');

      const deleted = await del(`/api/v1/platform/catalogue/diseases/${id}`, editorToken);
      expect(deleted.status).toBe(200);
      expect(deleted.data.deleted).toBe(true);
    });

    it('staff JWT also works directly on tenant catalogue routes', async () => {
      const res = await post(
        '/api/v1/diseases',
        { name: `P4 Direct Disease ${Date.now()}`, category: 'parasitic' },
        editorToken,
      );
      expect([200, 201]).toContain(res.status);
    });

    it('tenant reads of the catalogue still work', async () => {
      expect((await get('/api/v1/diseases', ownerToken)).status).toBe(200);
      expect((await get('/api/v1/breeds', ownerToken)).status).toBe(200);
      expect((await get('/api/v1/supplier-templates', ownerToken)).status).toBe(200);
    });

    it('marketing staff lack catalogue.write (403)', async () => {
      const res = await post(
        '/api/v1/platform/catalogue/diseases',
        { name: 'Nope Disease', category: 'viral' },
        marketingToken,
      );
      expect(res.status).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 7. Basic-tier limits: 12 active flocks, 1 user
  // ────────────────────────────────────────────────────────────
  describe('basic tier limits', () => {
    let basicToken: string;
    let basicBreedId: string;

    beforeAll(async () => {
      const tenant = await registerTenant('basic-org');
      basicToken = tenant.accessToken;
      await upgradeToBasic(basicToken);
      const breeds = await get('/api/v1/breeds', basicToken);
      basicBreedId = breeds.data[0].id;
    });

    it('allows 12 active flocks, blocks the 13th', async () => {
      for (let i = 1; i <= 12; i++) {
        const res = await createFlock(basicToken, basicBreedId, `Basic Flock ${i}`);
        expect([200, 201]).toContain(res.status);
      }
      const blocked = await createFlock(basicToken, basicBreedId, 'Basic Flock 13');
      expect(blocked.status).toBe(402);
      expect(blocked.data.error).toBe('PLAN_LIMIT_REACHED');
      expect(blocked.data.limit).toBe('maxActiveFlocks');
    });

    it('allows 1 user, blocks the first invite', async () => {
      const res = await post(
        '/api/v1/organizations/invites',
        { email: `p4-basic-invite-${Date.now()}@example.com`, role: 'viewer' },
        basicToken,
      );
      expect(res.status).toBe(402);
      expect(res.data.limit).toBe('maxUsers');
    });
  });

  // ────────────────────────────────────────────────────────────
  // 8. priceOverride via tenant override endpoint
  // ────────────────────────────────────────────────────────────
  describe('subscription priceOverride', () => {
    it('staff can set and clear a flat price override', async () => {
      const fin = await reauthStaff(financeToken); // billing.override is re-auth-gated
      const set = await post(
        `/api/v1/platform/tenants/${orgId}/override`,
        { priceOverride: 99, reason: 'P4 custom deal' },
        fin,
      );
      expect(set.status).toBe(201);
      expect(set.data.priceOverride).toBe(99);

      const sub = await planSub(orgId);
      expect(Number(sub!.priceOverride)).toBe(99);

      const cleared = await post(
        `/api/v1/platform/tenants/${orgId}/override`,
        { priceOverride: null, reason: 'P4 deal ended' },
        await reauthStaff(financeToken),
      );
      expect(cleared.status).toBe(201);
      expect(cleared.data.priceOverride).toBeNull();
      const sub2 = await planSub(orgId);
      expect(sub2!.priceOverride).toBeNull();
    });
  });
});
