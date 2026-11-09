// P1 — Staff identity & security foundation (super admin console).
// Covers: login → forced TOTP enrol → confirm → re-auth flow, the §3
// permission matrix (sampled), last-super-admin guard, self-disable,
// single-use recovery codes, audience separation (tenant ↔ platform
// tokens rejected cross-boundary), and the IP allowlist matcher.
//
// Requires the isolated test stack (docker-compose.test.yml); the
// vitest globalSetup guard enforces that.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { TEST_API_URL, TEST_DATABASE_URL } from '../helpers/env.js';
import {
  hasPermission,
  ROLE_PERMISSIONS,
  permissionsForRole,
} from '../../src/core/staff-auth/permissions.js';
import { ipMatchesCidr, ipInAllowlist } from '../../src/core/staff-auth/ip-allowlist.js';

const API_URL = TEST_API_URL;
const prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });

const STAFF_PASSWORD = 'StaffTestPass123!';

async function api(path: string, options: any = {}, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  return { status: res.status, data: await res.json().catch(() => null) };
}

function post(path: string, body: any, token?: string) {
  return api(path, { method: 'POST', body: JSON.stringify(body) }, token);
}

let seq = 0;
function staffEmail(role: string) {
  return `staff-test-${role}-${Date.now()}-${seq++}@example.com`;
}

/** Create a StaffUser row directly (password only — no TOTP). */
async function createStaff(role: string) {
  const email = staffEmail(role);
  const staff = await prisma.staffUser.create({
    data: {
      email,
      name: `Test ${role}`,
      passwordHash: await bcrypt.hash(STAFF_PASSWORD, 10),
      role: role as any,
    },
  });
  return { staff, email };
}

/** Full login → TOTP enrol → confirm. Returns access token + recovery codes. */
async function onboardStaff(email: string) {
  const login = await post('/api/v1/platform/auth/login', {
    email,
    password: STAFF_PASSWORD,
  });
  expect(login.status).toBe(200);
  expect(login.data.requiresTotpEnrollment).toBe(true);
  const ticket = login.data.ticket;

  const enroll = await api('/api/v1/platform/auth/totp/enroll', {
    method: 'POST',
    body: JSON.stringify({}),
  }, ticket);
  expect(enroll.status).toBe(200);
  expect(enroll.data.secret).toBeDefined();
  expect(enroll.data.otpauthUrl).toContain('otpauth://');

  const code = authenticator.generate(enroll.data.secret);
  const confirm = await post('/api/v1/platform/auth/totp/confirm', {
    ticket,
    code,
  });
  expect(confirm.status).toBe(200);
  expect(confirm.data.accessToken).toBeDefined();
  expect(confirm.data.refreshToken).toBeDefined();
  expect(Array.isArray(confirm.data.recoveryCodes)).toBe(true);
  expect(confirm.data.recoveryCodes.length).toBe(10);
  return {
    accessToken: confirm.data.accessToken as string,
    refreshToken: confirm.data.refreshToken as string,
    recoveryCodes: confirm.data.recoveryCodes as string[],
  };
}

describe('Platform staff auth (P1)', () => {
  let superEmail: string;
  let superId: string;
  let superToken: string;
  let superRecoveryCodes: string[];
  let supportId: string;
  let supportToken: string;
  let auditorToken: string;

  beforeAll(async () => {
    const s = await createStaff('super_admin');
    superEmail = s.email;
    superId = s.staff.id;
    const sup = await createStaff('support');
    supportId = sup.staff.id;
    const aud = await createStaff('auditor');

    const onboarded = await onboardStaff(superEmail);
    superToken = onboarded.accessToken;
    superRecoveryCodes = onboarded.recoveryCodes;
    supportToken = (await onboardStaff(sup.email)).accessToken;
    auditorToken = (await onboardStaff(aud.email)).accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ── Login + forced TOTP enrolment ─────────────────────

  describe('login & TOTP enrolment', () => {
    it('rejects bad credentials', async () => {
      const res = await post('/api/v1/platform/auth/login', {
        email: superEmail,
        password: 'wrong-password',
      });
      expect(res.status).toBe(401);
      expect(res.data.error).toBe('INVALID_CREDENTIALS');
    });

    it('enrolled staff get a TOTP challenge (requiresTotp)', async () => {
      const res = await post('/api/v1/platform/auth/login', {
        email: superEmail,
        password: STAFF_PASSWORD,
      });
      expect(res.status).toBe(200);
      expect(res.data.requiresTotp).toBe(true);
      expect(res.data.ticket).toBeDefined();
    });

    it('rejects enrolment of an already-enrolled staff member', async () => {
      // super_admin already enrolled in beforeAll — a fresh login returns a
      // totp_verify ticket, and an enroll attempt with it is rejected by
      // purpose; the enrol endpoint also guards totpEnabledAt.
      const login = await post('/api/v1/platform/auth/login', {
        email: superEmail,
        password: STAFF_PASSWORD,
      });
      const enroll = await api('/api/v1/platform/auth/totp/enroll', {
        method: 'POST',
        body: JSON.stringify({}),
      }, login.data.ticket);
      expect(enroll.status).toBe(401); // ticket purpose is totp_verify
    });

    it('GET /auth/me returns the staff profile + permissions', async () => {
      const res = await api('/api/v1/platform/auth/me', {}, superToken);
      expect(res.status).toBe(200);
      expect(res.data.user.email).toBe(superEmail);
      expect(res.data.user.role).toBe('super_admin');
      expect(res.data.user.totpEnrolled).toBe(true);
      expect(res.data.user.permissions).toContain('staff.manage');
      expect(res.data.reauthAt).toBeDefined();
    });
  });

  // ── Permission matrix ────────────────────────────────

  describe('permission matrix (plan §3)', () => {
    it('maps the approved role bundles', () => {
      // super_admin wildcard
      expect(hasPermission('super_admin', 'anything.at.all')).toBe(true);
      // support: field support, no billing writes, no staff.manage
      expect(hasPermission('support', 'tenants.impersonate')).toBe(true);
      expect(hasPermission('support', 'tenants.support_ops')).toBe(true);
      expect(hasPermission('support', 'billing.override')).toBe(false);
      expect(hasPermission('support', 'staff.manage')).toBe(false);
      expect(hasPermission('support', 'tenants.suspend')).toBe(false);
      // finance: billing writes + suspend, no impersonation
      expect(hasPermission('finance', 'billing.override')).toBe(true);
      expect(hasPermission('finance', 'billing.plans.write')).toBe(true);
      expect(hasPermission('finance', 'tenants.suspend')).toBe(true);
      expect(hasPermission('finance', 'tenants.impersonate')).toBe(false);
      // content_editor: catalogue only
      expect(hasPermission('content_editor', 'catalogue.write')).toBe(true);
      expect(hasPermission('content_editor', 'tenants.read')).toBe(false);
      // marketing: comms/ads/announcements/analytics
      expect(hasPermission('marketing', 'announcements.write')).toBe(true);
      expect(hasPermission('marketing', 'ads.write')).toBe(true);
      expect(hasPermission('marketing', 'analytics.read')).toBe(true);
      expect(hasPermission('marketing', 'tenants.read')).toBe(false);
      // auditor: read-only — reads yes, every write no
      expect(hasPermission('auditor', 'audit.read')).toBe(true);
      expect(hasPermission('auditor', 'tenants.read')).toBe(true);
      expect(hasPermission('auditor', 'billing.read')).toBe(true);
      for (const perm of [
        'tenants.impersonate', 'tenants.suspend', 'billing.override',
        'catalogue.write', 'announcements.write', 'ads.write', 'flags.write',
        'staff.manage', 'system.ops', 'support.tickets.write', 'comms.resend',
      ]) {
        expect(hasPermission('auditor', perm), `auditor must not have ${perm}`).toBe(false);
      }
    });

    it('every role reads the dashboard', () => {
      for (const role of Object.keys(ROLE_PERMISSIONS) as any[]) {
        expect(hasPermission(role, 'platform.dashboard.read')).toBe(true);
      }
      expect(permissionsForRole('super_admin')).toContain('staff.manage');
    });
  });

  // ── Permission enforcement over HTTP ─────────────────

  describe('permission enforcement', () => {
    it('support cannot staff.manage (invite → 403)', async () => {
      const res = await post('/api/v1/platform/staff/invite', {
        email: staffEmail('invited'),
        name: 'Nope',
        role: 'support',
      }, supportToken);
      expect(res.status).toBe(403);
      expect(res.data.error).toBe('FORBIDDEN');
    });

    it('auditor is read-only (invite → 403, /auth/me → 200)', async () => {
      const res = await post('/api/v1/platform/staff/invite', {
        email: staffEmail('invited'),
        name: 'Nope',
        role: 'support',
      }, auditorToken);
      expect(res.status).toBe(403);
      const me = await api('/api/v1/platform/auth/me', {}, auditorToken);
      expect(me.status).toBe(200);
      expect(me.data.user.role).toBe('auditor');
    });
  });

  // ── Re-auth requirement ──────────────────────────────

  describe('re-auth (dangerous actions)', () => {
    it('staff.manage mutations without a fresh re-auth → 403 REAUTH_REQUIRED', async () => {
      // A token minted by /auth/refresh with no prior reauthAt claim has
      // no re-auth proof — dangerous actions must refuse it.
      const login = await post('/api/v1/platform/auth/login', {
        email: superEmail,
        password: STAFF_PASSWORD,
      });
      const verify = await post('/api/v1/platform/auth/totp/verify', {
        ticket: login.data.ticket,
        code: superRecoveryCodes[0],
      });
      expect(verify.status).toBe(200);
      // Refresh WITHOUT sending the old access token → the new access
      // token carries no reauthAt claim.
      const refresh = await post('/api/v1/platform/auth/refresh', {
        refreshToken: verify.data.refreshToken,
      });
      expect(refresh.status).toBe(200);
      const res = await post('/api/v1/platform/staff/invite', {
        email: staffEmail('noreauth'),
        name: 'No Reauth',
        role: 'support',
      }, refresh.data.accessToken);
      expect(res.status).toBe(403);
      expect(res.data.error).toBe('REAUTH_REQUIRED');
    });

    it('password re-auth mints a token that passes requireReauth', async () => {
      const reauth = await post('/api/v1/platform/auth/reauth', {
        password: STAFF_PASSWORD,
      }, superToken);
      expect(reauth.status).toBe(200);
      expect(reauth.data.accessToken).toBeDefined();
      expect(typeof reauth.data.reauthAt).toBe('number');
      superToken = reauth.data.accessToken; // keep freshest token

      const res = await post('/api/v1/platform/staff/invite', {
        email: staffEmail('afterreauth'),
        name: 'After Reauth',
        role: 'support',
      }, superToken);
      expect(res.status).toBe(201);
    });

    it('rejects re-auth with wrong password', async () => {
      const res = await post('/api/v1/platform/auth/reauth', {
        password: 'nope-wrong',
      }, superToken);
      expect(res.status).toBe(401);
      expect(res.data.error).toBe('REAUTH_FAILED');
    });
  });

  // ── Staff management ─────────────────────────────────

  describe('staff management', () => {
    it('lists staff for staff.manage holders', async () => {
      const res = await api('/api/v1/platform/staff', {}, superToken);
      expect(res.status).toBe(200);
      expect(res.data.items.length).toBeGreaterThanOrEqual(3);
      expect(res.data.items.some((s: any) => s.email === superEmail)).toBe(true);
    });

    it('invites a new staff member and audits it', async () => {
      const invitedEmail = staffEmail('invited');
      const res = await post('/api/v1/platform/staff/invite', {
        email: invitedEmail,
        name: 'Invited Support',
        role: 'support',
      }, superToken);
      expect(res.status).toBe(201);
      expect(res.data.staff.email).toBe(invitedEmail);
      expect(res.data.staff.totpEnrolled).toBe(false);
      // EMAIL_DISABLED → devInviteUrl carries the bootstrap link
      expect(res.data.devInviteUrl).toContain('token=');

      const audit = await prisma.platformAuditEvent.findFirst({
        where: { actorStaffId: superId, action: 'staff.invite' },
      });
      expect(audit).toBeTruthy();
      expect(audit?.targetType).toBe('staff_user');
    });

    it('invited staff can bootstrap a password via the one-time token', async () => {
      const invitedEmail = staffEmail('boot');
      const invite = await post('/api/v1/platform/staff/invite', {
        email: invitedEmail,
        name: 'Boot Strap',
        role: 'auditor',
      }, superToken);
      expect(invite.status).toBe(201);
      const token = new URL(invite.data.devInviteUrl).searchParams.get('token')!;
      const boot = await post('/api/v1/platform/auth/bootstrap', {
        token,
        password: 'BootPass123!',
      });
      expect(boot.status).toBe(200);
      expect(boot.data.requiresTotpEnrollment).toBe(true);
      // second bootstrap with the same token is refused (password already set)
      const again = await post('/api/v1/platform/auth/bootstrap', {
        token,
        password: 'BootPass123!',
      });
      expect(again.status).toBe(400);
      expect(again.data.error).toBe('BOOTSTRAP_ALREADY_COMPLETED');
    });

    it('refuses self-disable (422 SELF_DISABLE)', async () => {
      const res = await post(`/api/v1/platform/staff/${superId}/disable`, {}, superToken);
      expect(res.status).toBe(422);
      expect(res.data.error).toBe('SELF_DISABLE');
    });

    it('refuses demoting/disabling the last active super_admin', async () => {
      // Make the test super_admin the ONLY active super_admin.
      await prisma.staffUser.updateMany({
        where: { role: 'super_admin', id: { not: superId } },
        data: { isActive: false },
      });
      const res = await post(`/api/v1/platform/staff/${superId}/role`, {
        role: 'support',
      }, superToken);
      expect(res.status).toBe(422);
      expect(res.data.error).toBe('LAST_SUPER_ADMIN');
    });

    it('disables another staff member and kills their session', async () => {
      const res = await post(`/api/v1/platform/staff/${supportId}/disable`, {}, superToken);
      expect(res.status).toBe(200);
      expect(res.data.staff.isActive).toBe(false);
      // disabled staff token now fails
      const me = await api('/api/v1/platform/auth/me', {}, supportToken);
      expect(me.status).toBe(401);
      const audit = await prisma.platformAuditEvent.findFirst({
        where: { actorStaffId: superId, action: 'staff.disable', targetId: supportId },
      });
      expect(audit).toBeTruthy();
    });
  });

  // ── Recovery codes (single-use) ──────────────────────

  describe('recovery codes', () => {
    it('accepts a recovery code once and only once', async () => {
      // superRecoveryCodes[0] was already consumed in the re-auth describe —
      // use [1] here.
      const code = superRecoveryCodes[1];
      const login1 = await post('/api/v1/platform/auth/login', {
        email: superEmail,
        password: STAFF_PASSWORD,
      });
      const ok = await post('/api/v1/platform/auth/totp/verify', {
        ticket: login1.data.ticket,
        code,
      });
      expect(ok.status).toBe(200);
      expect(ok.data.accessToken).toBeDefined();

      const login2 = await post('/api/v1/platform/auth/login', {
        email: superEmail,
        password: STAFF_PASSWORD,
      });
      const dup = await post('/api/v1/platform/auth/totp/verify', {
        ticket: login2.data.ticket,
        code,
      });
      expect(dup.status).toBe(401);
      expect(dup.data.error).toBe('INVALID_TOTP_CODE');
    });
  });

  // ── Audience separation ──────────────────────────────

  describe('token audience separation', () => {
    let tenantToken: string;
    let tenantOrgId: string | undefined;

    it('tenant JWT is rejected on /platform routes', async () => {
      const reg = await post('/api/v1/auth/register', {
        email: `staff-tenant-${Date.now()}@example.com`,
        password: 'TestPass123!',
        name: 'Tenant User',
        organizationName: `Staff Tenant Org ${Date.now()}`,
        country: 'ZM',
        currency: 'ZMW',
        consent: true,
      });
      expect(reg.status).toBe(201);
      tenantToken = reg.data.accessToken;
      tenantOrgId = reg.data.organization?.id;

      const res = await api('/api/v1/platform/auth/me', {}, tenantToken);
      expect(res.status).toBe(401);
      expect(res.data.error).toBe('INVALID_TOKEN');
    });

    it('staff JWT is rejected on tenant routes', async () => {
      const res = await api('/api/v1/auth/me', {}, superToken);
      expect(res.status).toBe(401);
    });

    afterAll(async () => {
      if (tenantOrgId) {
        await prisma.organization.deleteMany({ where: { id: tenantOrgId } });
      }
    });
  });

  // ── Refresh + logout ─────────────────────────────────

  describe('sessions', () => {
    it('rotates the refresh token and rejects reuse of the old one', async () => {
      const login = await post('/api/v1/platform/auth/login', {
        email: superEmail,
        password: STAFF_PASSWORD,
      });
      const verify = await post('/api/v1/platform/auth/totp/verify', {
        ticket: login.data.ticket,
        code: superRecoveryCodes[2],
      });
      expect(verify.status).toBe(200);
      const refresh = await post('/api/v1/platform/auth/refresh', {
        refreshToken: verify.data.refreshToken,
      });
      expect(refresh.status).toBe(200);
      expect(refresh.data.accessToken).toBeDefined();
      const reuse = await post('/api/v1/platform/auth/refresh', {
        refreshToken: verify.data.refreshToken,
      });
      expect(reuse.status).toBe(401);
    });
  });

  // ── IP allowlist matcher (unit-level; hook behaviour is
  //    env-gated and exercised in deployment) ────────────

  describe('IP allowlist matcher', () => {
    it('matches exact IPs and CIDR ranges', () => {
      expect(ipMatchesCidr('10.0.0.5', '10.0.0.5')).toBe(true);
      expect(ipMatchesCidr('10.0.0.5', '10.0.0.0/24')).toBe(true);
      expect(ipMatchesCidr('10.0.1.5', '10.0.0.0/24')).toBe(false);
      expect(ipMatchesCidr('192.168.1.10', '0.0.0.0/0')).toBe(true);
      expect(ipMatchesCidr('::ffff:10.0.0.5', '10.0.0.0/24')).toBe(true);
      expect(ipMatchesCidr('::1', '::1')).toBe(true);
      expect(ipInAllowlist('10.0.0.9', ['10.0.0.0/24', '192.168.0.1'])).toBe(true);
      expect(ipInAllowlist('172.16.0.1', ['10.0.0.0/24'])).toBe(false);
    });
  });
});
