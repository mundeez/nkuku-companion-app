// Integration tests — PLATFORM P3: support inbox, comms log, health & ops.
// Covers:
//   • tenant ticket create → staff sees it → staff reply → 'ticket_reply'
//     email logged in comms_log → user reply → status transitions → close
//   • internalNote rows hidden from tenant callers
//   • org scoping (requester vs owner; cross-org 404)
//   • comms resend writes a resendOf-linked row; sms channel 422s
//   • GET /platform/health RAG shape (deps may be red in the test env —
//     assert shape, not values)
//   • POST /ops/cron/:name/run executes a real job (CronRun row lands)
//   • maintenance flag 503s tenant routes but leaves /api/v1/auth/* alive
//   • permission denials: auditor can't reply, support can't maintenance
//
// Requires the isolated test stack (docker-compose.test.yml); the
// vitest globalSetup guard enforces that.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_API_URL, TEST_DATABASE_URL } from '../helpers/env.js';
import { api, post, makeStaffWithToken, reauthStaff } from '../helpers/staff.js';

const prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
const TENANT_PASSWORD = 'TenantTestPass123!';

function get(path: string, token?: string) {
  return api(path, {}, token);
}

let seq = 0;
async function registerTenant(suffix: string) {
  const email = `p3-tenant-${suffix}-${Date.now()}-${seq++}@example.com`;
  const res = await fetch(`${TEST_API_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: TENANT_PASSWORD,
      name: `P3 Tenant ${suffix}`,
      organizationName: `P3 Farm ${suffix}`,
      country: 'ZM',
      currency: 'ZMW',
      consent: true,
    }),
  });
  const data = await res.json();
  return { ...data, email, orgName: `P3 Farm ${suffix}` };
}

/** Register a second member by creating a User row + login token. */
async function addMemberAndLogin(organizationId: string) {
  const email = `p3-member-${Date.now()}-${seq++}@example.com`;
  const bcrypt = (await import('bcryptjs')).default;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(TENANT_PASSWORD, 10),
      name: 'P3 Member',
      role: 'manager',
      isActive: true,
    },
  });
  await prisma.organizationMember.create({
    data: { organizationId, userId: user.id, role: 'manager' },
  });
  const login = await post('/api/v1/auth/login', { email, password: TENANT_PASSWORD });
  return { user, accessToken: login.data.accessToken as string };
}

/** Poll a DB predicate until true or timeout (for async cron writes). */
async function waitFor(fn: () => Promise<boolean>, timeoutMs = 20_000, stepMs = 500): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return true;
    await new Promise((s) => setTimeout(s, stepMs));
  }
  return false;
}

describe('Platform support / comms / health (P3)', () => {
  let superToken: string;
  let supportToken: string;
  let supportRefreshToken: string;
  let auditorToken: string;
  let supportStaffId: string;

  let ownerToken: string;
  let ownerEmail: string;
  let orgId: string;
  let memberToken: string;
  let memberUserId: string;

  let orgBToken: string;

  let ticketId: string;
  let memberTicketId: string;
  let replyCommsId: string;

  beforeAll(async () => {
    const sup = await makeStaffWithToken(prisma, 'super_admin');
    superToken = sup.accessToken;
    const support = await makeStaffWithToken(prisma, 'support');
    supportToken = support.accessToken;
    supportRefreshToken = support.refreshToken;
    supportStaffId = support.staff.id;
    auditorToken = (await makeStaffWithToken(prisma, 'auditor')).accessToken;

    const tenant = await registerTenant('main');
    ownerToken = tenant.accessToken;
    ownerEmail = tenant.email;
    orgId = tenant.organization.id;

    const member = await addMemberAndLogin(orgId);
    memberToken = member.accessToken;
    memberUserId = member.user.id;

    const tenantB = await registerTenant('other');
    orgBToken = tenantB.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ── Tenant ticket lifecycle ───────────────────────────
  describe('tenant ticket lifecycle', () => {
    it('creates a ticket with the first message + client meta', async () => {
      const res = await fetch(`${TEST_API_URL}/api/v1/support/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
          'x-app-version': '1.2.3-test',
          'x-device-info': 'Vitest device',
        },
        body: JSON.stringify({
          subject: 'Feed totals look wrong',
          body: 'The daily feed total for flock A is double what we recorded.',
          category: 'bug',
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      ticketId = data.ticket.id;
      expect(data.ticket.status).toBe('open');
      expect(data.ticket.category).toBe('bug');
      expect(data.ticket.messages).toHaveLength(1);
      expect(data.ticket.messages[0].authorType).toBe('user');
      expect(data.ticket.meta.appVersion).toBe('1.2.3-test');
      expect(data.ticket.meta.deviceInfo).toBe('Vitest device');
    });

    it('rejects a too-short subject', async () => {
      const res = await post('/api/v1/support/tickets', { subject: 'ab', body: 'too short' }, ownerToken);
      expect(res.status).toBe(400);
    });

    it('lists the requester ticket with messageCount', async () => {
      const res = await get('/api/v1/support/tickets', ownerToken);
      expect(res.status).toBe(200);
      const row = res.data.items.find((t: any) => t.id === ticketId);
      expect(row).toBeDefined();
      expect(row.status).toBe('open');
      expect(row.messageCount).toBe(1);
      expect(row.lastMessageAt).toBeDefined();
    });

    it('second member files a ticket; owner sees all org tickets, member sees own only', async () => {
      const res = await post(
        '/api/v1/support/tickets',
        { subject: 'Member ticket about water', body: 'Water records are missing for day 4.' },
        memberToken,
      );
      expect(res.status).toBe(201);
      memberTicketId = res.data.ticket.id;

      const ownerList = await get('/api/v1/support/tickets', ownerToken);
      const ownerIds = ownerList.data.items.map((t: any) => t.id);
      expect(ownerIds).toContain(ticketId);
      expect(ownerIds).toContain(memberTicketId);

      const memberList = await get('/api/v1/support/tickets', memberToken);
      const memberIds = memberList.data.items.map((t: any) => t.id);
      expect(memberIds).toContain(memberTicketId);
      expect(memberIds).not.toContain(ticketId);
    });

    it('non-owner member cannot open the owner ticket (404)', async () => {
      const res = await get(`/api/v1/support/tickets/${ticketId}`, memberToken);
      expect(res.status).toBe(404);
    });

    it('other-org user gets 404 on the ticket', async () => {
      const res = await get(`/api/v1/support/tickets/${ticketId}`, orgBToken);
      expect(res.status).toBe(404);
    });
  });

  // ── Staff inbox + reply → comms row ───────────────────
  describe('staff inbox', () => {
    it('GET /platform/tickets lists tickets with org + requester + unread heuristic', async () => {
      const res = await get(`/api/v1/platform/tickets?orgId=${orgId}`, supportToken);
      expect(res.status).toBe(200);
      const row = res.data.items.find((t: any) => t.id === ticketId);
      expect(row).toBeDefined();
      expect(row.organization.id).toBe(orgId);
      expect(row.requester.email).toBe(ownerEmail);
      expect(row.awaitingStaffReply).toBe(true);
      expect(row.messageCount).toBe(1);
    });

    it('GET /platform/tickets/:id returns thread + org summary', async () => {
      const res = await get(`/api/v1/platform/tickets/${ticketId}`, supportToken);
      expect(res.status).toBe(200);
      expect(res.data.ticket.id).toBe(ticketId);
      expect(res.data.organization.name).toContain('P3 Farm');
      expect(res.data.organization.planCode).toBe('free');
      expect(res.data.organization.suspended).toBe(false);
      expect(res.data.requester.email).toBe(ownerEmail);
      expect(res.data.messages).toHaveLength(1);
      expect(res.data.messages[0].authorType).toBe('user');
    });

    it('staff reply → waiting_on_user + ticket_reply email logged in comms_log', async () => {
      const res = await post(
        `/api/v1/platform/tickets/${ticketId}/reply`,
        { body: 'Thanks for the report — we are looking into the feed totals now.' },
        supportToken,
      );
      expect(res.status).toBe(201);
      expect(res.data.statusChanged).toBe('waiting_on_user');
      expect(res.data.emailSent).toBe(true);

      // deliver() should have written the comms row (EMAIL_DISABLED → 'sent').
      const row = await prisma.commsLog.findFirst({
        where: { template: 'ticket_reply', toAddr: ownerEmail },
        orderBy: { createdAt: 'desc' },
      });
      expect(row).toBeDefined();
      replyCommsId = row!.id;
      expect(row!.channel).toBe('email');
      expect(row!.status).toBe('sent');
      expect(row!.organizationId).toBe(orgId);
      expect(row!.sentByStaffId).toBe(supportStaffId);
      expect(row!.body).toContain('looking into the feed totals');
    });

    it('tenant thread shows the staff reply; internal note stays hidden', async () => {
      // Staff adds an internal note first.
      const note = await post(
        `/api/v1/platform/tickets/${ticketId}/reply`,
        { body: 'Internal: suspect double-count bug in feed-aggregation.', internalNote: true },
        supportToken,
      );
      expect(note.status).toBe(201);

      const res = await get(`/api/v1/support/tickets/${ticketId}`, ownerToken);
      expect(res.status).toBe(200);
      const bodies = res.data.messages.map((m: any) => m.body);
      expect(bodies).toContain('Thanks for the report — we are looking into the feed totals now.');
      expect(bodies.some((b: string) => b.includes('suspect double-count'))).toBe(false);
      expect(res.data.ticket.status).toBe('waiting_on_user');

      // Staff view includes the note.
      const staffView = await get(`/api/v1/platform/tickets/${ticketId}`, supportToken);
      const staffBodies = staffView.data.messages.map((m: any) => m.body);
      expect(staffBodies.some((b: string) => b.includes('suspect double-count'))).toBe(true);
      const noteRow = staffView.data.messages.find((m: any) => m.internalNote);
      expect(noteRow).toBeDefined();
    });

    it('user reply reopens waiting_on_user → open and bumps lastMessageAt', async () => {
      const before = (await prisma.supportTicket.findUnique({ where: { id: ticketId } }))!.lastMessageAt;
      const res = await post(
        `/api/v1/support/tickets/${ticketId}/reply`,
        { body: 'Any update? This is blocking our daily records.' },
        ownerToken,
      );
      expect(res.status).toBe(201);

      const after = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
      expect(after!.status).toBe('open');
      expect(after!.lastMessageAt.getTime()).toBeGreaterThan(before.getTime());
    });

    it('assign + status transitions are audited', async () => {
      const assign = await post(
        `/api/v1/platform/tickets/${ticketId}/assign`,
        { staffId: supportStaffId },
        supportToken,
      );
      expect(assign.status).toBe(200);
      expect(assign.data.assignedStaffId).toBe(supportStaffId);

      const resolve = await post(
        `/api/v1/platform/tickets/${ticketId}/status`,
        { status: 'resolved' },
        supportToken,
      );
      expect(resolve.status).toBe(200);
      expect(resolve.data.resolvedAt).toBeDefined();

      const events = await prisma.platformAuditEvent.findMany({
        where: { targetId: ticketId, action: { in: ['ticket.assign', 'ticket.status'] } },
      });
      const actions = events.map((e) => e.action);
      expect(actions).toContain('ticket.assign');
      expect(actions).toContain('ticket.status');
    });

    it('assign to a nonexistent staff user → 422', async () => {
      const res = await post(
        `/api/v1/platform/tickets/${ticketId}/assign`,
        { staffId: '00000000-0000-0000-0000-000000000000' },
        supportToken,
      );
      expect(res.status).toBe(422);
    });

    it('requester closes the ticket; double close → 422', async () => {
      const res = await post(`/api/v1/support/tickets/${ticketId}/close`, {}, ownerToken);
      expect(res.status).toBe(200);
      expect(res.data.ticket.status).toBe('closed');

      const again = await post(`/api/v1/support/tickets/${ticketId}/close`, {}, ownerToken);
      expect(again.status).toBe(422);
    });
  });

  // ── Comms log viewer + resend ─────────────────────────
  describe('comms log', () => {
    it('GET /platform/comms lists rows with filters', async () => {
      const res = await get(`/api/v1/platform/comms?channel=email&orgId=${orgId}`, supportToken);
      expect(res.status).toBe(200);
      const row = res.data.items.find((r: any) => r.id === replyCommsId);
      expect(row).toBeDefined();
      expect(row.channel).toBe('email');
      expect(row.template).toBe('ticket_reply');
      expect(row.organization?.id).toBe(orgId);
      expect(row.hasBody).toBe(true);
    });

    it('resend writes a new row linked via resendOfId (comms.resend + reauth)', async () => {
      const token = await reauthStaff(supportToken);
      const res = await post(`/api/v1/platform/comms/${replyCommsId}/resend`, {}, token);
      expect(res.status).toBe(200);
      expect(res.data.resent).toBe(true);
      expect(res.data.resendOfId).toBe(replyCommsId);

      const resendRow = await prisma.commsLog.findFirst({
        where: { resendOfId: replyCommsId },
        orderBy: { createdAt: 'desc' },
      });
      expect(resendRow).toBeDefined();
      expect(resendRow!.toAddr).toBe(ownerEmail);
      expect(resendRow!.channel).toBe('email');
      expect(resendRow!.sentByStaffId).toBe(supportStaffId);

      const audited = await prisma.platformAuditEvent.findFirst({
        where: { action: 'comms.resend', targetId: replyCommsId },
      });
      expect(audited).toBeDefined();
    });

    it('resend requires fresh re-auth + comms.resend permission', async () => {
      // auditor has comms.log.read but lacks comms.resend → 403 FORBIDDEN.
      const denied = await post(`/api/v1/platform/comms/${replyCommsId}/resend`, {}, auditorToken);
      expect(denied.status).toBe(403);

      // A token WITHOUT reauthAt → 403 REAUTH_REQUIRED. Refresh without
      // presenting the old access token mints exactly that shape.
      const refreshed = await post('/api/v1/platform/auth/refresh', { refreshToken: supportRefreshToken });
      expect(refreshed.status).toBe(200);
      const stale = await post(`/api/v1/platform/comms/${replyCommsId}/resend`, {}, refreshed.data.accessToken);
      expect(stale.status).toBe(403);
      expect(stale.data.error).toBe('REAUTH_REQUIRED');
    });

    it('resend on a non-email channel → 422 UNSUPPORTED_CHANNEL', async () => {
      const smsRow = await prisma.commsLog.create({
        data: { channel: 'sms', toAddr: '260970000000', status: 'sent', body: 'test sms' },
      });
      const token = await reauthStaff(supportToken);
      const res = await post(`/api/v1/platform/comms/${smsRow.id}/resend`, {}, token);
      expect(res.status).toBe(422);
      expect(res.data.error).toBe('UNSUPPORTED_CHANNEL');
    });
  });

  // ── Permission denials ────────────────────────────────
  describe('permission denials', () => {
    it('auditor CAN read the inbox (support.tickets.read)', async () => {
      const res = await get('/api/v1/platform/tickets', auditorToken);
      expect(res.status).toBe(200);
    });

    it('auditor cannot reply (lacks support.tickets.write)', async () => {
      const res = await post(
        `/api/v1/platform/tickets/${ticketId}/reply`,
        { body: 'auditor should not be able to' },
        auditorToken,
      );
      expect(res.status).toBe(403);
    });

    it('support cannot toggle maintenance (lacks system.ops)', async () => {
      const res = await post('/api/v1/platform/ops/maintenance', { enabled: true }, supportToken);
      expect(res.status).toBe(403);
    });

    it('support cannot trigger cron (lacks system.ops)', async () => {
      const res = await post('/api/v1/platform/ops/cron/billing_daily/run', {}, supportToken);
      expect(res.status).toBe(403);
    });

    it('plain tenant token cannot reach platform routes', async () => {
      const res = await get('/api/v1/platform/tickets', ownerToken);
      expect(res.status).toBe(401);
    });
  });

  // ── Health + ops ──────────────────────────────────────
  describe('health & ops', () => {
    it('GET /platform/health returns the RAG board shape', async () => {
      const res = await get('/api/v1/platform/health', supportToken);
      expect(res.status).toBe(200);
      expect(['green', 'amber', 'red']).toContain(res.data.status);
      expect(res.data.checkedAt).toBeDefined();

      const checks = res.data.checks;
      for (const key of ['db', 'redis', 'minio', 'clamav', 'disk', 'api', 'cron']) {
        expect(checks[key], `missing check ${key}`).toBeDefined();
        expect(['green', 'amber', 'red']).toContain(checks[key].status);
      }
      expect(checks.api.version).toBeDefined();
      expect(checks.api.uptimeSec).toBeGreaterThanOrEqual(0);
      expect(checks.db.dbSizeBytes).toBeGreaterThan(0);
      expect(checks.disk.freePercent).toBeGreaterThan(0);

      // Cron freshness rows for every registered job.
      const jobNames = checks.cron.jobs.map((j: any) => j.name);
      expect(jobNames).toEqual(
        expect.arrayContaining(['scheduled_reports', 'daily_recalc', 'billing_daily', 'tenant_purge']),
      );
    });

    it('POST /ops/cron/:name/run executes the job and records a CronRun', async () => {
      const token = await reauthStaff(superToken);
      const res = await post('/api/v1/platform/ops/cron/billing_daily/run', {}, token);
      expect(res.status).toBe(202);
      expect(res.data.started).toBe(true);

      const sawRun = await waitFor(async () => {
        const row = await prisma.cronRun.findFirst({
          where: { name: 'billing_daily' },
          orderBy: { startedAt: 'desc' },
        });
        return row?.status === 'success' || row?.status === 'failed';
      });
      expect(sawRun).toBe(true);

      const audited = await prisma.platformAuditEvent.findFirst({
        where: { action: 'system.cron_run', targetId: 'billing_daily' },
      });
      expect(audited).toBeDefined();
    });

    it('POST /ops/cron/unknown/run → 404', async () => {
      const token = await reauthStaff(superToken);
      const res = await post('/api/v1/platform/ops/cron/no_such_job/run', {}, token);
      expect(res.status).toBe(404);
      expect(res.data.error).toBe('UNKNOWN_JOB');
    });
  });

  // ── Maintenance mode ──────────────────────────────────
  describe('maintenance mode', () => {
    it('enabled flag 503s tenant routes but leaves /auth/* alive; disable restores', async () => {
      const token = await reauthStaff(superToken);

      const on = await post(
        '/api/v1/platform/ops/maintenance',
        { enabled: true, message: 'Scheduled upgrade — back at 14:00 UTC' },
        token,
      );
      expect(on.status).toBe(200);
      expect(on.data.maintenance.enabled).toBe(true);

      // Tenant-authenticated route → 503 with the staff message.
      const blocked = await get('/api/v1/account/me', ownerToken);
      expect(blocked.status).toBe(503);
      expect(blocked.data.error).toBe('MAINTENANCE_MODE');
      expect(blocked.data.message).toContain('Scheduled upgrade');

      // /api/v1/auth/* stays alive even though authenticate() runs there.
      const me = await get('/api/v1/auth/me', ownerToken);
      expect(me.status).toBe(200);

      // Platform surface unaffected (different middleware).
      const health = await get('/api/v1/platform/health', supportToken);
      expect(health.status).toBe(200);

      const audited = await prisma.platformAuditEvent.findFirst({
        where: { action: 'system.maintenance', targetId: 'maintenance_mode' },
      });
      expect(audited).toBeDefined();

      // Disable → tenant access restored immediately (cache invalidated).
      const off = await post('/api/v1/platform/ops/maintenance', { enabled: false }, token);
      expect(off.status).toBe(200);

      const restored = await get('/api/v1/account/me', ownerToken);
      expect(restored.status).toBe(200);
    });
  });

  // ── Tenant dossier ticket counts ──────────────────────
  describe('GET /tenants/:id support ticket counts', () => {
    it('returns real open/total counts', async () => {
      const res = await get(`/api/v1/platform/tenants/${orgId}`, superToken);
      expect(res.status).toBe(200);
      // Two tickets filed: one closed, one still open (member's).
      expect(res.data.supportTickets.total).toBe(2);
      expect(res.data.supportTickets.open).toBe(1);
    });
  });
});
