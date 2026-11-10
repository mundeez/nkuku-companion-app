// Integration tests — PLATFORM TENANT OPS (P2, super-admin console).
// Covers /api/v1/platform/tenants* + /impersonation* + /audit-events:
//   • override → effective plan flip (TenantOverride wins over subscription)
//   • suspend → tenant API calls 423 ORG_SUSPENDED; reactivate restores
//   • support ops: change-owner, force-logout (tokensValidAfter)
//   • delete → CONFIRM_MISMATCH 422, then soft-delete with purgeAfter
//   • impersonation → 30-min tenant JWT works on tenant routes; denylisted
//     routes 403 IMPERSONATION_DENIED; session end
//   • platform audit-events listing
//   • permission denials: support cannot suspend, finance cannot delete
//
// Requires the isolated test stack (docker-compose.test.yml); the
// vitest globalSetup guard enforces that.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { TEST_API_URL, TEST_DATABASE_URL } from '../helpers/env.js';
import { api, post, makeStaffWithToken } from '../helpers/staff.js';

const prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
const TENANT_PASSWORD = 'TenantTestPass123!';

function get(path: string, token?: string) {
  return api(path, {}, token);
}

let seq = 0;
async function registerTenant(suffix: string) {
  const email = `p2-tenant-${suffix}-${Date.now()}-${seq++}@example.com`;
  const res = await fetch(`${TEST_API_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: TENANT_PASSWORD,
      name: `P2 Tenant ${suffix}`,
      organizationName: `P2 Farm ${suffix}`,
      country: 'ZM',
      currency: 'ZMW',
      consent: true,
    }),
  });
  const data = await res.json();
  return { ...data, email, orgName: `P2 Farm ${suffix}` };
}

/** Create a second member user directly (register always makes a new org). */
async function addMember(organizationId: string, role = 'manager') {
  const email = `p2-member-${Date.now()}-${seq++}@example.com`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(TENANT_PASSWORD, 10),
      name: 'P2 Member',
      role: role as any,
      isActive: true,
    },
  });
  await prisma.organizationMember.create({
    data: { organizationId, userId: user.id, role: role as any },
  });
  return user;
}

describe('Platform tenant ops (P2)', () => {
  let superToken: string;
  let supportToken: string;
  let financeToken: string;
  let auditorToken: string;

  let ownerToken: string;
  let orgId: string;
  let orgName: string;
  let ownerUserId: string;
  let managerUserId: string;
  let impTargetUserId: string;

  let orgBId: string;
  let orgBName: string;

  beforeAll(async () => {
    const sup = await makeStaffWithToken(prisma, 'super_admin');
    superToken = sup.accessToken;
    supportToken = (await makeStaffWithToken(prisma, 'support')).accessToken;
    financeToken = (await makeStaffWithToken(prisma, 'finance')).accessToken;
    auditorToken = (await makeStaffWithToken(prisma, 'auditor')).accessToken;

    const tenant = await registerTenant('main');
    ownerToken = tenant.accessToken;
    orgId = tenant.organization.id;
    orgName = tenant.orgName;
    ownerUserId = tenant.user?.id ?? tenant.userId;

    const mgr = await addMember(orgId, 'manager');
    managerUserId = mgr.id;

    // Separate impersonation target: members used in the revoke/reset tests
    // get tokensValidAfter stamps that can share a wall-clock second with a
    // freshly minted impersonation token (iat is second-granularity) — a
    // virgin member keeps this test deterministic.
    const imp = await addMember(orgId, 'viewer');
    impTargetUserId = imp.id;

    const tenantB = await registerTenant('delete-me');
    orgBId = tenantB.organization.id;
    orgBName = tenantB.orgName;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ── Tenant directory ──────────────────────────────────
  describe('GET /tenants', () => {
    it('lists tenants with suspension + override badges', async () => {
      const res = await get(`/api/v1/platform/tenants?search=${encodeURIComponent(orgName)}`, superToken);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.data.items)).toBe(true);
      const row = res.data.items.find((o: any) => o.id === orgId);
      expect(row).toBeDefined();
      expect(row.suspended).toBe(false);
      expect(row).toHaveProperty('override');
      expect(row).toHaveProperty('effectivePlanCode');
    });

    it('rejects a plain tenant token', async () => {
      const res = await get('/api/v1/platform/tenants', ownerToken);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /tenants/:id', () => {
    it('returns the org dossier', async () => {
      const res = await get(`/api/v1/platform/tenants/${orgId}`, superToken);
      expect(res.status).toBe(200);
      expect(res.data.organization.id).toBe(orgId);
      expect(res.data.members.length).toBe(3);
      expect(res.data.plan).toHaveProperty('limits');
      expect(res.data.suspension.suspended).toBe(false);
      expect(res.data).toHaveProperty('platformAuditEvents');
      expect(res.data).toHaveProperty('tenantAuditLog');
    });
  });

  // ── Override → effective plan flip ────────────────────
  describe('POST /tenants/:id/override', () => {
    it('comps the org to business — effectivePlanCode flips', async () => {
      const before = await get(`/api/v1/platform/tenants/${orgId}`, superToken);
      expect(before.data.organization.effectivePlanCode).toBe('free');

      const res = await post(
        `/api/v1/platform/tenants/${orgId}/override`,
        { planCode: 'business', reason: 'P2 test comp', compUntil: new Date(Date.now() + 86400_000).toISOString() },
        superToken,
      );
      expect(res.status).toBe(201);
      expect(res.data.effectivePlanCode).toBe('business');
      expect(res.data.override.planCode).toBe('business');

      const after = await get(`/api/v1/platform/tenants/${orgId}`, superToken);
      expect(after.data.organization.effectivePlanCode).toBe('business');
      expect(after.data.activeOverride?.reason).toBe('P2 test comp');
    });

    it('rejects without a reason', async () => {
      const res = await post(
        `/api/v1/platform/tenants/${orgId}/override`,
        { planCode: 'grower' },
        superToken,
      );
      expect(res.status).toBe(400);
    });
  });

  // ── Permission denials ────────────────────────────────
  describe('permission denials', () => {
    it('support cannot suspend (lacks tenants.suspend)', async () => {
      const res = await post(
        `/api/v1/platform/tenants/${orgId}/suspend`,
        { reason: 'support should not be able to' },
        supportToken,
      );
      expect(res.status).toBe(403);
    });

    it('finance cannot delete (lacks tenants.delete)', async () => {
      const res = await post(
        `/api/v1/platform/tenants/${orgId}/delete`,
        { confirmName: orgName, reason: 'finance should not be able to' },
        financeToken,
      );
      expect(res.status).toBe(403);
    });

    it('auditor cannot override (lacks billing.override)', async () => {
      const res = await post(
        `/api/v1/platform/tenants/${orgId}/override`,
        { planCode: 'grower', reason: 'auditor should not be able to' },
        auditorToken,
      );
      expect(res.status).toBe(403);
    });
  });

  // ── Suspend → 423 wall → reactivate ──────────────────
  describe('suspend / reactivate', () => {
    it('suspend blocks tenant API access with 423', async () => {
      const res = await post(
        `/api/v1/platform/tenants/${orgId}/suspend`,
        { reason: 'non-payment test', message: 'Pay up, buttercup' },
        financeToken, // finance holds tenants.suspend
      );
      expect(res.status).toBe(200);
      expect(res.data.suspendedAt).toBeDefined();

      // Any tenant request → 423 with the staff message.
      const blocked = await get('/api/v1/account/me', ownerToken);
      expect(blocked.status).toBe(423);
      expect(blocked.data.error).toBe('ORG_SUSPENDED');
      expect(blocked.data.message).toBe('Pay up, buttercup');
    });

    it('billing GETs stay reachable while suspended', async () => {
      const res = await get('/api/v1/billing/subscription', ownerToken);
      expect(res.status).toBe(200);
    });

    it('double-suspend → 422', async () => {
      const res = await post(
        `/api/v1/platform/tenants/${orgId}/suspend`,
        { reason: 'again' },
        financeToken,
      );
      expect(res.status).toBe(422);
    });

    it('reactivate restores tenant access', async () => {
      const res = await post(
        `/api/v1/platform/tenants/${orgId}/reactivate`,
        { reason: 'payment received' },
        financeToken,
      );
      expect(res.status).toBe(200);
      expect(res.data.suspendedAt).toBeNull();

      const me = await get('/api/v1/account/me', ownerToken);
      expect(me.status).toBe(200);
    });
  });

  // ── Support ops ───────────────────────────────────────
  describe('support ops', () => {
    it('change-owner promotes the member and demotes the old owner', async () => {
      const res = await post(
        `/api/v1/platform/tenants/${orgId}/change-owner`,
        { newOwnerUserId: managerUserId, reason: 'owner requested handover' },
        supportToken,
      );
      expect(res.status).toBe(200);
      expect(res.data.newOwnerUserId).toBe(managerUserId);

      const newOwner = await prisma.organizationMember.findFirst({
        where: { organizationId: orgId, userId: managerUserId },
      });
      expect(newOwner?.role).toBe('owner');
      const oldOwner = await prisma.organizationMember.findFirst({
        where: { organizationId: orgId, userId: ownerUserId },
      });
      expect(oldOwner?.role).toBe('manager');
    });

    it('change-owner rejects a non-member', async () => {
      const res = await post(
        `/api/v1/platform/tenants/${orgId}/change-owner`,
        { newOwnerUserId: '00000000-0000-0000-0000-000000000000', reason: 'nope' },
        supportToken,
      );
      expect(res.status).toBe(404);
    });

    it('force-logout kills live tenant access tokens', async () => {
      // Fresh login so the token is minted before the revocation stamp.
      const login = await post('/api/v1/auth/login', { email: (await prisma.user.findUnique({ where: { id: managerUserId } }))!.email, password: TENANT_PASSWORD });
      expect(login.status).toBe(200);
      const liveToken = login.data.accessToken;
      expect((await get('/api/v1/account/me', liveToken)).status).toBe(200);

      const res = await post(
        `/api/v1/platform/tenants/${orgId}/members/${managerUserId}/force-logout`,
        { reason: 'suspicious session' },
        supportToken,
      );
      expect(res.status).toBe(200);

      const after = await get('/api/v1/account/me', liveToken);
      expect(after.status).toBe(401);
      expect(after.data.error).toBe('TOKEN_REVOKED');
    });

    it('reset-password emails a link and revokes sessions', async () => {
      const res = await post(
        `/api/v1/platform/tenants/${orgId}/members/${managerUserId}/reset-password`,
        { reason: 'user locked out' },
        supportToken,
      );
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      // In the test stack email runs in dev mode → devUrl is returned.
      expect(res.data.devUrl || res.data.emailSent).toBeTruthy();
    });
  });

  // ── Impersonation ─────────────────────────────────────
  describe('impersonation', () => {
    let sessionId: string;
    let impToken: string;

    it('mints a working 30-min tenant token', async () => {
      const res = await post(
        `/api/v1/platform/tenants/${orgId}/impersonate`,
        { targetUserId: impTargetUserId, reason: 'P2 investigation', ticketId: 'T-1' },
        supportToken, // support holds tenants.impersonate
      );
      expect(res.status).toBe(200);
      expect(res.data.token).toBeDefined();
      expect(res.data.banner).toContain('Acting as');
      sessionId = res.data.sessionId;
      impToken = res.data.token;

      const me = await get('/api/v1/account/me', impToken);
      expect(me.status).toBe(200);
      expect(me.data.id).toBe(impTargetUserId);
    });

    it('denylisted routes reject the impersonation token (403)', async () => {
      const pw = await post('/api/v1/account/me/password', { currentPassword: 'x', newPassword: 'y' }, impToken);
      expect(pw.status).toBe(403);
      expect(pw.data.error).toBe('IMPERSONATION_DENIED');

      const cancel = await post('/api/v1/billing/cancel', {}, impToken);
      expect(cancel.status).toBe(403);
      expect(cancel.data.error).toBe('IMPERSONATION_DENIED');
    });

    it('lists the session under GET /impersonation', async () => {
      const res = await get(`/api/v1/platform/impersonation?orgId=${orgId}&active=true`, superToken);
      expect(res.status).toBe(200);
      const row = res.data.items.find((s: any) => s.id === sessionId);
      expect(row).toBeDefined();
      expect(row.targetUserId).toBe(impTargetUserId);
      expect(row.reason).toBe('P2 investigation');
      expect(row.active).toBe(true);
    });

    it('ending the session flips active → false; second end → 422', async () => {
      const res = await post(`/api/v1/platform/impersonation/${sessionId}/end`, {}, supportToken);
      expect(res.status).toBe(200);
      expect(res.data.endedAt).toBeDefined();

      const again = await post(`/api/v1/platform/impersonation/${sessionId}/end`, {}, supportToken);
      expect(again.status).toBe(422);
    });
  });

  // ── Platform audit feed ───────────────────────────────
  describe('GET /audit-events', () => {
    it('returns the events this suite generated', async () => {
      const res = await get(`/api/v1/platform/audit-events?orgId=${orgId}`, auditorToken);
      expect(res.status).toBe(200);
      const actions = res.data.items.map((e: any) => e.action);
      expect(actions).toContain('tenant.override');
      expect(actions).toContain('tenant.suspend');
      expect(actions).toContain('tenant.reactivate');
      expect(actions).toContain('tenant.change_owner');
      expect(actions).toContain('tenant.impersonate_start');
      expect(actions).toContain('tenant.impersonate_end');
    });

    it('support lacks audit.read → 403', async () => {
      const res = await get('/api/v1/platform/audit-events', supportToken);
      expect(res.status).toBe(403);
    });
  });

  // ── Deletion ──────────────────────────────────────────
  describe('POST /tenants/:id/delete', () => {
    it('mismatched confirmName → 422 CONFIRM_MISMATCH', async () => {
      const res = await post(
        `/api/v1/platform/tenants/${orgBId}/delete`,
        { confirmName: 'wrong name', reason: 'gdpr request' },
        superToken,
      );
      expect(res.status).toBe(422);
      expect(res.data.error).toBe('CONFIRM_MISMATCH');
    });

    it('exact name soft-deletes and sets purgeAfter', async () => {
      const res = await post(
        `/api/v1/platform/tenants/${orgBId}/delete`,
        { confirmName: orgBName, reason: 'gdpr request' },
        superToken,
      );
      expect(res.status).toBe(200);
      expect(res.data.deleted).toBe(true);
      expect(res.data.purgeAfter).toBeDefined();

      const org = await prisma.organization.findUnique({ where: { id: orgBId } });
      expect(org?.deletedAt).not.toBeNull();
      expect(org?.isActive).toBe(false);
    });
  });
});
