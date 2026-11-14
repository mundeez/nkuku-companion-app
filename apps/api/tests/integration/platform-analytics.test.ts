// Integration tests — PLATFORM P5: growth & finance analytics.
//   • analytics endpoints are staff-gated (tenant tokens rejected)
//   • the platform_analytics cron materialises platform_daily_stats rows
//   • overview returns a daily series with MRR/funnel fields
//   • cohorts return signup-month retention with month-0 = 100%
//   • CSV export emits the rollup columns
import { describe, it, expect, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_API_URL, TEST_DATABASE_URL } from '../helpers/env.js';
import { api, post, makeStaffWithToken } from '../helpers/staff.js';

const prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
const TENANT_PASSWORD = 'TenantTestPass123!';

async function waitFor(fn: () => Promise<boolean>, timeoutMs = 30_000, stepMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return true;
    await new Promise((s) => setTimeout(s, stepMs));
  }
  return false;
}

function todayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

describe('Platform analytics (P5)', () => {
  let superToken: string;
  let tenantToken: string;

  beforeAll(async () => {
    const sup = await makeStaffWithToken(prisma, 'super_admin');
    superToken = sup.accessToken;

    // A real tenant → today's signup + trial sub for the rollup to count.
    const res = await fetch(`${TEST_API_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `p5-tenant-${Date.now()}@example.com`,
        password: TENANT_PASSWORD,
        name: 'P5 Tenant',
        organizationName: `P5 Farm ${Date.now()}`,
        country: 'ZM',
        currency: 'ZMW',
        consent: true,
      }),
    });
    tenantToken = (await res.json()).accessToken;

    // Trigger the rollup and wait for today's row to materialise.
    await post(`/api/v1/platform/ops/cron/platform_analytics/run`, {}, superToken);
    const ok = await waitFor(async () => {
      const row = await prisma.platformDailyStats.findUnique({ where: { statDate: todayUtc() } });
      return !!row;
    });
    expect(ok).toBe(true);
  }, 45_000);

  it('rejects tenant tokens on every analytics route', async () => {
    for (const path of [
      '/api/v1/platform/analytics/overview',
      '/api/v1/platform/analytics/cohorts',
      '/api/v1/platform/analytics/export.csv',
    ]) {
      const res = await api(path, {}, tenantToken);
      expect([401, 403]).toContain(res.status);
    }
  });

  it('the rollup row counts today\'s signup and trial sub', async () => {
    const row = await prisma.platformDailyStats.findUnique({ where: { statDate: todayUtc() } });
    expect(row).toBeTruthy();
    expect(row!.signups).toBeGreaterThanOrEqual(1);
    const funnel = row!.funnelJson as any;
    expect(funnel.trialing).toBeGreaterThanOrEqual(1);
    expect(row!.countriesJson).toHaveProperty('ZM');
  });

  it('GET /analytics/overview returns a daily series with MRR + funnel fields', async () => {
    const res = await api('/api/v1/platform/analytics/overview', {}, superToken);
    expect(res.status).toBe(200);
    const body = res.data;
    expect(Array.isArray(body.series)).toBe(true);
    expect(body.series.length).toBeGreaterThan(0);
    const latest = body.latest;
    expect(latest).toBeTruthy();
    expect(typeof latest.mrrTotal).toBe('number');
    expect(latest.funnel).toHaveProperty('trialing');
    expect(latest.countries).toHaveProperty('ZM');
  });

  it('GET /analytics/cohorts returns signup-month retention (month 0 = 100%)', async () => {
    const res = await api('/api/v1/platform/analytics/cohorts', {}, superToken);
    expect(res.status).toBe(200);
    const { cohorts } = res.data;
    expect(Array.isArray(cohorts)).toBe(true);
    expect(cohorts.length).toBeGreaterThan(0);
    const c = cohorts[cohorts.length - 1];
    expect(c.size).toBeGreaterThanOrEqual(1);
    expect(c.months['0']).toBe(100); // signup month always counts
  });

  it('GET /analytics/export.csv streams the rollup columns', async () => {
    const res = await fetch(`${TEST_API_URL}/api/v1/platform/analytics/export.csv`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const text = await res.text();
    expect(text.split('\n')[0]).toContain('mrr_total');
    expect(text.split('\n').length).toBeGreaterThan(1);
  });
});
