import { describe, it, expect, beforeAll } from 'vitest';

const API_URL = 'http://localhost:3001';

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return data.accessToken as string;
}

async function api(path: string, token: string, opts: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

describe('Audit Log Cross-Tenant Isolation', () => {
  let ownerToken: string;
  let secondOrgToken: string;
  let secondOrgFlockId: string;
  let secondOrgId: string;

  // Unique suffix to avoid collisions with repeated test runs
  const suffix = `${Date.now()}`;

  beforeAll(async () => {
    // Login as the default org owner
    ownerToken = await login('owner@nkuku.local', 'change_me');

    // Register a second org via the signup endpoint
    const signupRes = await fetch(`${API_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `audit-test-${suffix}@nkuku.test`,
        password: 'Test123456!',
        name: 'Audit Test Owner',
        organizationName: `Audit Test Org ${suffix}`,
        country: 'ZM',
        consent: true,
      }),
    });
    const signupData = await signupRes.json();
    secondOrgToken = signupData.accessToken;

    // Get the second org's ID from the register response
    secondOrgId = signupData.user?.organizationId || signupData.organization?.id;

    // Create a flock in the second org so we can create a financial record
    const breeds = await api('/api/v1/breeds', secondOrgToken);
    const breedsList = Array.isArray(breeds.data) ? breeds.data : breeds.data?.data || [];
    const ross = breedsList.find((b: any) => b.name === 'Ross 308');
    const flockRes = await api('/api/v1/broiler-flocks', secondOrgToken, {
      method: 'POST',
      body: JSON.stringify({
        name: `Audit Isolation Flock ${suffix}`,
        breedId: ross.id,
        orderDate: '2026-07-01',
        initialCount: 500,
        targetWeight: 2.5,
        targetAge: 42,
        feedTransitionDay: 11,
        chicksCollected: true,
        collectionDate: '2026-07-05',
      }),
    });
    secondOrgFlockId = flockRes.data.id;

    // Create a financial record in the second org (this writes an audit log entry)
    await api('/api/v1/financial-records', secondOrgToken, {
      method: 'POST',
      body: JSON.stringify({
        flockId: secondOrgFlockId,
        recordDate: '2026-07-10',
        category: 'other',
        description: `Cross-tenant audit test ${suffix}`,
        amountZmw: 100,
        isIncome: false,
      }),
    });
  });

  it('second org can see its own audit log entries', async () => {
    const res = await api('/api/v1/financial-engine/audit-log', secondOrgToken);
    expect(res.status).toBe(200);
    expect(res.data.items).toBeDefined();
    expect(res.data.items.length).toBeGreaterThan(0);
    // Every entry should belong to the second org
    for (const entry of res.data.items) {
      expect(entry.organizationId).toBe(secondOrgId);
    }
  });

  it('default org cannot see second org audit entries', async () => {
    // Get default org's audit log
    const res = await api('/api/v1/financial-engine/audit-log', ownerToken);
    expect(res.status).toBe(200);
    expect(res.data.items).toBeDefined();

    // None of the entries should reference the second org's financial record description
    const crossTenantLeak = res.data.items.find(
      (e: any) =>
        e.organizationId === secondOrgId ||
        (e.newState && typeof e.newState === 'object' && e.newState.description === `Cross-tenant audit test ${suffix}`)
    );
    expect(crossTenantLeak).toBeUndefined();
  });

  it('all audit entries returned to default org belong to default org', async () => {
    const res = await api('/api/v1/financial-engine/audit-log', ownerToken);
    expect(res.status).toBe(200);

    // Get the default org ID from the user
    const meRes = await api('/api/v1/auth/me', ownerToken);
    const defaultOrgId = meRes.data?.user?.organizationId;

    for (const entry of res.data.items) {
      expect(entry.organizationId).toBe(defaultOrgId);
    }
  });
});
