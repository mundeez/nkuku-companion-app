import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const API_URL = 'http://localhost:3001';
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function registerUser(suffix: string, country = 'ZM', currency = 'ZMW') {
  const email = `admin-ops-test-${suffix}@example.com`;
  const res = await fetch(`${API_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'TestPass123!',
      name: `Admin Ops Test ${suffix}`,
      organizationName: `Admin Ops Test Farm ${suffix}`,
      country,
      currency,
      consent: true,
    }),
  });
  const data = await res.json();
  return { ...data, email };
}

async function authedRequest(path: string, options: any = {}, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  return { status: res.status, data: await res.json().catch(() => null) };
}

describe('Admin Ops (Phase 6)', () => {
  let adminToken: string;
  let adminEmail: string;
  let adminOrgId: string;
  let regularToken: string;
  let regularOrgId: string;

  beforeAll(async () => {
    // Register a platform admin
    const admin = await registerUser(`admin-${Date.now()}`);
    adminToken = admin.accessToken;
    adminEmail = admin.email;
    adminOrgId = admin.organization.id;

    // Promote to platform admin
    await prisma.user.update({
      where: { email: adminEmail },
      data: { isPlatformAdmin: true },
    });

    // Register a regular (non-admin) user
    const regular = await registerUser(`regular-${Date.now()}`);
    regularToken = regular.accessToken;
    regularOrgId = regular.organization.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (adminOrgId) {
      await prisma.organization.deleteMany({ where: { id: adminOrgId } });
    }
    if (regularOrgId) {
      await prisma.organization.deleteMany({ where: { id: regularOrgId } });
    }
    await prisma.$disconnect();
  });

  // ── Branding (public) ───────────────────────

  describe('GET /api/v1/admin/branding (public)', () => {
    it('returns branding config without authentication', async () => {
      const res = await authedRequest('/api/v1/admin/branding');
      expect(res.status).toBe(200);
      expect(res.data.appName).toBeDefined();
      expect(res.data.tagline).toBeDefined();
      expect(res.data.primaryColor).toBeDefined();
      expect(res.data.isWhiteLabel).toBeDefined();
    });

    it('returns default Nkuku branding when no env overrides set', async () => {
      const res = await authedRequest('/api/v1/admin/branding');
      expect(res.status).toBe(200);
      expect(res.data.appName).toBe('Nkuku Companion');
      expect(res.data.isWhiteLabel).toBe(false);
    });
  });

  // ── License status ──────────────────────────

  describe('GET /api/v1/admin/license', () => {
    it('returns 401 without authentication', async () => {
      const res = await authedRequest('/api/v1/admin/license');
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-platform-admin users', async () => {
      const res = await authedRequest('/api/v1/admin/license', {}, regularToken);
      expect(res.status).toBe(403);
    });

    it('returns license status for platform admin', async () => {
      const res = await authedRequest('/api/v1/admin/license', {}, adminToken);
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('licenseValid');
      expect(res.data).toHaveProperty('licensedTo');
      expect(res.data).toHaveProperty('dbRegistered');
    });
  });

  // ── Dashboard metrics ───────────────────────

  describe('GET /api/v1/admin/metrics', () => {
    it('returns 401 without authentication', async () => {
      const res = await authedRequest('/api/v1/admin/metrics');
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-platform-admin users', async () => {
      const res = await authedRequest('/api/v1/admin/metrics', {}, regularToken);
      expect(res.status).toBe(403);
    });

    it('returns dashboard metrics for platform admin', async () => {
      const res = await authedRequest('/api/v1/admin/metrics', {}, adminToken);
      expect(res.status).toBe(200);
      expect(res.data.totals).toBeDefined();
      expect(res.data.totals.organizations).toBeGreaterThan(0);
      expect(res.data.totals.users).toBeGreaterThan(0);
      expect(res.data.totals.activeSubscriptions).toBeDefined();
      expect(res.data.totals.activeFlocks).toBeDefined();
      expect(Array.isArray(res.data.revenueByCurrency)).toBe(true);
      expect(Array.isArray(res.data.planDistribution)).toBe(true);
      expect(Array.isArray(res.data.recentOrganizations)).toBe(true);
    });

    it('includes the admin org in recent organizations', async () => {
      const res = await authedRequest('/api/v1/admin/metrics', {}, adminToken);
      expect(res.status).toBe(200);
      const orgIds = res.data.recentOrganizations.map((o: any) => o.id);
      expect(orgIds).toContain(adminOrgId);
    });
  });

  // ── Organizations list ──────────────────────

  describe('GET /api/v1/admin/organizations', () => {
    it('returns 401 without authentication', async () => {
      const res = await authedRequest('/api/v1/admin/organizations');
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-platform-admin users', async () => {
      const res = await authedRequest('/api/v1/admin/organizations', {}, regularToken);
      expect(res.status).toBe(403);
    });

    it('returns paginated organization list for platform admin', async () => {
      const res = await authedRequest('/api/v1/admin/organizations?page=1&pageSize=10', {}, adminToken);
      expect(res.status).toBe(200);
      expect(res.data.items).toBeDefined();
      expect(res.data.total).toBeGreaterThan(0);
      expect(res.data.page).toBe(1);
      expect(res.data.pageSize).toBe(10);
      expect(res.data.totalPages).toBeGreaterThan(0);
    });

    it('supports search by organization name', async () => {
      const res = await authedRequest(
        `/api/v1/admin/organizations?search=${encodeURIComponent('Admin Ops Test Farm')}`,
        {},
        adminToken,
      );
      expect(res.status).toBe(200);
      expect(res.data.items.length).toBeGreaterThan(0);
      expect(res.data.items[0].name).toContain('Admin Ops Test Farm');
    });

    it('includes subscription info in org items', async () => {
      const res = await authedRequest('/api/v1/admin/organizations?page=1&pageSize=5', {}, adminToken);
      expect(res.status).toBe(200);
      // Each item should have a subscription field (may be null for free tier)
      if (res.data.items.length > 0) {
        expect(res.data.items[0]).toHaveProperty('subscription');
        expect(res.data.items[0]).toHaveProperty('userCount');
        expect(res.data.items[0]).toHaveProperty('flockCount');
      }
    });
  });

  // ── Organization detail ─────────────────────

  describe('GET /api/v1/admin/organizations/:id', () => {
    it('returns 401 without authentication', async () => {
      const res = await authedRequest(`/api/v1/admin/organizations/${adminOrgId}`);
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-platform-admin users', async () => {
      const res = await authedRequest(`/api/v1/admin/organizations/${adminOrgId}`, {}, regularToken);
      expect(res.status).toBe(403);
    });

    it('returns org detail for platform admin', async () => {
      const res = await authedRequest(`/api/v1/admin/organizations/${adminOrgId}`, {}, adminToken);
      expect(res.status).toBe(200);
      expect(res.data.id).toBe(adminOrgId);
      expect(res.data.name).toContain('Admin Ops Test Farm');
      expect(res.data._count).toBeDefined();
      expect(res.data._count.members).toBeGreaterThan(0);
    });

    it('returns error for non-existent org', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await authedRequest(`/api/v1/admin/organizations/${fakeId}`, {}, adminToken);
      expect(res.status).toBe(200);
      expect(res.data.error).toBe('NOT_FOUND');
    });
  });

  // ── Failed payments ─────────────────────────

  describe('GET /api/v1/admin/failed-payments', () => {
    it('returns 401 without authentication', async () => {
      const res = await authedRequest('/api/v1/admin/failed-payments');
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-platform-admin users', async () => {
      const res = await authedRequest('/api/v1/admin/failed-payments', {}, regularToken);
      expect(res.status).toBe(403);
    });

    it('returns failed payments list for platform admin', async () => {
      const res = await authedRequest('/api/v1/admin/failed-payments', {}, adminToken);
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('items');
      expect(res.data).toHaveProperty('count');
      expect(Array.isArray(res.data.items)).toBe(true);
    });
  });

  // ── Audit logs ──────────────────────────────

  describe('GET /api/v1/admin/audit-logs', () => {
    it('returns 401 without authentication', async () => {
      const res = await authedRequest('/api/v1/admin/audit-logs');
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-platform-admin users', async () => {
      const res = await authedRequest('/api/v1/admin/audit-logs', {}, regularToken);
      expect(res.status).toBe(403);
    });

    it('returns paginated audit logs for platform admin', async () => {
      const res = await authedRequest('/api/v1/admin/audit-logs?page=1&pageSize=10', {}, adminToken);
      expect(res.status).toBe(200);
      expect(res.data.items).toBeDefined();
      expect(res.data.total).toBeDefined();
      expect(res.data.page).toBe(1);
      expect(res.data.pageSize).toBe(10);
    });

    it('supports filtering by organizationId', async () => {
      const res = await authedRequest(
        `/api/v1/admin/audit-logs?organizationId=${adminOrgId}&page=1&pageSize=10`,
        {},
        adminToken,
      );
      expect(res.status).toBe(200);
      // All returned logs should belong to the specified org
      for (const log of res.data.items) {
        expect(log.organizationId).toBe(adminOrgId);
      }
    });
  });
});
