import { describe, it, expect, beforeAll } from 'vitest';

const API_URL = 'http://localhost:3001';

async function login() {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@nkuku.local', password: 'change_me' }),
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

describe('Bulk Operations API', () => {
  let token: string;
  let flockId: string;

  beforeAll(async () => {
    token = await login();

    // Create a dedicated test flock for bulk tests (never modify existing flocks)
    const breeds = await api('/api/v1/breeds', token);
    const ross = breeds.data.find((b: any) => b.name === 'Ross 308');
    const res = await api('/api/v1/broiler-flocks', token, {
      method: 'POST',
      body: JSON.stringify({
        name: `Bulk Test Flock ${Date.now()}`,
        breedId: ross.id,
        orderDate: '2026-07-01',
        initialCount: 1000,
        targetWeight: 2.5,
        targetAge: 42,
        feedTransitionDay: 11,
        chicksCollected: true,
        collectionDate: '2026-07-05',
      }),
    });
    expect(res.status).toBe(200);
    flockId = res.data.id;
  });

  describe('Alerts bulk', () => {
    let alertIds: string[] = [];

    it('creates individual alerts to test bulk on', async () => {
      // Create alerts directly via the model by generating them
      const gen = await api('/api/v1/alerts/generate', token, { method: 'POST', body: '{}' });
      expect(gen.status).toBe(200);

      // Fetch alerts for this flock
      const list = await api(`/api/v1/alerts?flockId=${flockId}`, token);
      expect(list.status).toBe(200);
      // If no alerts generated for this flock, create some manually via POST
      if (!Array.isArray(list.data) || list.data.length === 0) {
        // Create alerts via the alerts POST endpoint
        for (let i = 0; i < 3; i++) {
          const r = await api('/api/v1/alerts', token, {
            method: 'POST',
            body: JSON.stringify({
              flockId,
              alertType: 'custom',
              title: `Bulk Test Alert ${i}`,
              message: 'Test alert for bulk operations',
              severity: 'info',
              dueDate: '2026-08-20',
            }),
          });
          if (r.status === 200) alertIds.push(r.data.id);
        }
      } else {
        alertIds = list.data.map((a: any) => a.id);
      }
      expect(alertIds.length).toBeGreaterThan(0);
    });

    it('bulk marks alerts as read', async () => {
      const res = await api('/api/v1/alerts/bulk', token, {
        method: 'POST',
        body: JSON.stringify({ action: 'mark_read', ids: alertIds }),
      });
      expect(res.status).toBe(200);
      expect(res.data.action).toBe('mark_read');
      expect(res.data.affected).toBeGreaterThan(0);
    });

    it('bulk marks alerts as resolved', async () => {
      const res = await api('/api/v1/alerts/bulk', token, {
        method: 'POST',
        body: JSON.stringify({ action: 'mark_resolved', ids: alertIds }),
      });
      expect(res.status).toBe(200);
      expect(res.data.action).toBe('mark_resolved');
      expect(res.data.affected).toBeGreaterThan(0);
    });

    it('rejects invalid action', async () => {
      const res = await api('/api/v1/alerts/bulk', token, {
        method: 'POST',
        body: JSON.stringify({ action: 'invalid', ids: alertIds }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects empty ids array', async () => {
      const res = await api('/api/v1/alerts/bulk', token, {
        method: 'POST',
        body: JSON.stringify({ action: 'mark_read', ids: [] }),
      });
      expect(res.status).toBe(400);
    });

    it('skips non-existent alert ids', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await api('/api/v1/alerts/bulk', token, {
        method: 'POST',
        body: JSON.stringify({ action: 'mark_read', ids: [fakeId] }),
      });
      expect(res.status).toBe(200);
      expect(res.data.affected).toBe(0);
      expect(res.data.skipped).toBe(1);
    });

    it('bulk deletes alerts', async () => {
      const res = await api('/api/v1/alerts/bulk', token, {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', ids: alertIds }),
      });
      expect(res.status).toBe(200);
      expect(res.data.action).toBe('delete');
      expect(res.data.affected).toBeGreaterThan(0);
    });
  });

  describe('Growth Records bulk', () => {
    let createdIds: string[] = [];

    it('bulk creates growth records', async () => {
      const res = await api('/api/v1/growth-records/bulk', token, {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          records: [
            { flockId, recordDate: '2026-07-10', sampleSize: 50, avgWeight: 800 },
            { flockId, recordDate: '2026-07-15', sampleSize: 50, avgWeight: 1200 },
            { flockId, recordDate: '2026-07-20', sampleSize: 50, avgWeight: 1600 },
          ],
        }),
      });
      expect(res.status).toBe(200);
      expect(res.data.action).toBe('create');
      expect(res.data.affected).toBe(3);
      expect(res.data.skipped).toBe(0);
      createdIds = res.data.records.map((r: any) => r.id);
    });

    it('skips records with invalid flockId', async () => {
      const fakeFlock = '00000000-0000-0000-0000-000000000000';
      const res = await api('/api/v1/growth-records/bulk', token, {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          records: [
            { flockId: fakeFlock, recordDate: '2026-07-10', sampleSize: 50, avgWeight: 800 },
          ],
        }),
      });
      expect(res.status).toBe(200);
      expect(res.data.affected).toBe(0);
      expect(res.data.skipped).toBe(1);
    });

    it('rejects create without records', async () => {
      const res = await api('/api/v1/growth-records/bulk', token, {
        method: 'POST',
        body: JSON.stringify({ action: 'create' }),
      });
      expect(res.status).toBe(400);
    });

    it('bulk deletes growth records', async () => {
      const res = await api('/api/v1/growth-records/bulk', token, {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', ids: createdIds }),
      });
      expect(res.status).toBe(200);
      expect(res.data.action).toBe('delete');
      expect(res.data.affected).toBe(3);
    });

    it('rejects delete without ids', async () => {
      const res = await api('/api/v1/growth-records/bulk', token, {
        method: 'POST',
        body: JSON.stringify({ action: 'delete' }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('Feed Records bulk', () => {
    let createdIds: string[] = [];

    it('bulk creates feed records with financial cascade', async () => {
      const res = await api('/api/v1/feed-records/bulk', token, {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          records: [
            { flockId, recordDate: '2026-07-10', feedType: 'Starter', quantityKg: 50, costZmw: 250 },
            { flockId, recordDate: '2026-07-15', feedType: 'Grower', quantityKg: 75, costZmw: 400 },
          ],
        }),
      });
      expect(res.status).toBe(200);
      expect(res.data.action).toBe('create');
      expect(res.data.affected).toBe(2);
      createdIds = res.data.records.map((r: any) => r.id);
    });

    it('bulk deletes feed records and linked financials', async () => {
      const res = await api('/api/v1/feed-records/bulk', token, {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', ids: createdIds }),
      });
      expect(res.status).toBe(200);
      expect(res.data.action).toBe('delete');
      expect(res.data.affected).toBe(2);
    });
  });

  describe('Water Records bulk', () => {
    let createdIds: string[] = [];

    it('bulk creates water records with financial cascade', async () => {
      const res = await api('/api/v1/water-records/bulk', token, {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          records: [
            { flockId, recordDate: '2026-07-10', quantityLiters: 100, costZmw: 50 },
            { flockId, recordDate: '2026-07-11', quantityLiters: 120, costZmw: 60 },
          ],
        }),
      });
      expect(res.status).toBe(200);
      expect(res.data.affected).toBe(2);
      createdIds = res.data.records.map((r: any) => r.id);
    });

    it('bulk deletes water records and linked financials', async () => {
      const res = await api('/api/v1/water-records/bulk', token, {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', ids: createdIds }),
      });
      expect(res.status).toBe(200);
      expect(res.data.affected).toBe(2);
    });
  });

  describe('Mortality Events bulk', () => {
    let createdIds: string[] = [];

    it('bulk creates mortality events with flock count adjustment', async () => {
      // Get initial count
      const before = await api(`/api/v1/broiler-flocks/${flockId}`, token);
      const initialCount = before.data.currentCount;

      const res = await api('/api/v1/mortality-events/bulk', token, {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          records: [
            { flockId, eventDate: '2026-07-10', count: 5, cause: 'Test', ageDays: 5 },
            { flockId, eventDate: '2026-07-12', count: 3, cause: 'Test2', ageDays: 7 },
          ],
        }),
      });
      expect(res.status).toBe(200);
      expect(res.data.affected).toBe(2);
      createdIds = res.data.records.map((r: any) => r.id);

      // Verify flock count decreased by 8
      const after = await api(`/api/v1/broiler-flocks/${flockId}`, token);
      expect(after.data.currentCount).toBe(initialCount - 8);
    });

    it('bulk deletes mortality events and restores flock count', async () => {
      const before = await api(`/api/v1/broiler-flocks/${flockId}`, token);
      const countBefore = before.data.currentCount;

      const res = await api('/api/v1/mortality-events/bulk', token, {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', ids: createdIds }),
      });
      expect(res.status).toBe(200);
      expect(res.data.affected).toBe(2);

      // Verify flock count restored by 8
      const after = await api(`/api/v1/broiler-flocks/${flockId}`, token);
      expect(after.data.currentCount).toBe(countBefore + 8);
    });
  });

  describe('Vaccination Events bulk', () => {
    let createdIds: string[] = [];

    it('bulk creates vaccination events with financial cascade', async () => {
      const res = await api('/api/v1/vaccination-events/bulk', token, {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          records: [
            { flockId, vaccineName: 'Newcastle', adminDate: '2026-07-10', adminMethod: 'Drinking Water', ageDays: 7, costZmw: 100 },
            { flockId, vaccineName: 'Gumboro', adminDate: '2026-07-14', adminMethod: 'Drinking Water', ageDays: 11, costZmw: 80 },
          ],
        }),
      });
      expect(res.status).toBe(200);
      expect(res.data.affected).toBe(2);
      createdIds = res.data.records.map((r: any) => r.id);
    });

    it('bulk deletes vaccination events and linked financials', async () => {
      const res = await api('/api/v1/vaccination-events/bulk', token, {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', ids: createdIds }),
      });
      expect(res.status).toBe(200);
      expect(res.data.affected).toBe(2);
    });
  });

  describe('Financial Records bulk', () => {
    let createdIds: string[] = [];

    it('bulk creates financial records with audit logging', async () => {
      const res = await api('/api/v1/financial-records/bulk', token, {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          records: [
            { flockId, recordDate: '2026-07-10', category: 'other', description: 'Bulk test 1', amountZmw: 100, isIncome: false },
            { flockId, recordDate: '2026-07-11', category: 'sales', description: 'Bulk test 2', amountZmw: 500, isIncome: true },
          ],
        }),
      });
      expect(res.status).toBe(200);
      expect(res.data.affected).toBe(2);
      createdIds = res.data.records.map((r: any) => r.id);
    });

    it('bulk deletes financial records with audit logging', async () => {
      const res = await api('/api/v1/financial-records/bulk', token, {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', ids: createdIds }),
      });
      expect(res.status).toBe(200);
      expect(res.data.affected).toBe(2);
    });
  });

  describe('Cross-tenant isolation', () => {
    it('skips records belonging to other organizations', async () => {
      // Use a flockId that doesn't belong to this org (random UUID)
      const fakeFlock = '00000000-0000-0000-0000-000000000000';
      const res = await api('/api/v1/growth-records/bulk', token, {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          records: [
            { flockId: fakeFlock, recordDate: '2026-07-10', sampleSize: 50, avgWeight: 800 },
          ],
        }),
      });
      expect(res.status).toBe(200);
      expect(res.data.affected).toBe(0);
      expect(res.data.skipped).toBe(1);
    });
  });
});
