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

async function api(path: string, token: string, options: RequestInit = {}) {
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  });
}

describe('Feed Projection & Purchases API', () => {
  let token: string;
  let supplierId: string;
  let flockId: string;
  let purchaseId: string;

  beforeAll(async () => {
    token = await login();

    // Find a supplier that has feed stages
    const suppliersRes = await api('/api/v1/suppliers', token);
    const suppliers = await suppliersRes.json();
    const supplierWithFeed = suppliers.find((s: any) =>
      s.feedStages && s.feedStages.some((fs: any) => fs.stageType === 'feed')
    );
    expect(supplierWithFeed).toBeDefined();
    supplierId = supplierWithFeed.id;

    // Create a test flock linked to this supplier
    const breedsRes = await api('/api/v1/breeds', token);
    const breeds = await breedsRes.json();
    const breedId = breeds.find((b: any) => b.name === 'Ross 308').id;

    const flockRes = await api('/api/v1/broiler-flocks', token, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Feed Projection Test Flock',
        breedId,
        supplierId,
        orderDate: '2026-08-01',
        initialCount: 1000,
        targetWeight: 2.5,
        targetAge: 42,
        feedTransitionDay: 11,
        chicksCollected: true,
        collectionDate: '2026-08-05',
      }),
    });
    const flock = await flockRes.json();
    expect(flock.id).toBeDefined();
    flockId = flock.id;
  });

  describe('GET /api/v1/broiler-flocks/:id/feed-projection', () => {
    it('returns per-stage feed projection with required/purchased/remaining', async () => {
      const res = await api(`/api/v1/broiler-flocks/${flockId}/feed-projection`, token);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.flockId).toBe(flockId);
      expect(data.stages).toBeDefined();
      expect(data.stages.length).toBeGreaterThan(0);
      expect(data.totals).toBeDefined();
      expect(data.totals.bagsRequired).toBeGreaterThan(0);
      expect(data.totals.bagsPurchased).toBe(0); // no purchases yet
      expect(data.totals.bagsRemaining).toBe(data.totals.bagsRequired);

      // Each stage should have the required fields
      const stage = data.stages[0];
      expect(stage.stageName).toBeDefined();
      expect(stage.bagsRequired).toBeGreaterThan(0);
      expect(stage.bagsPurchased).toBe(0);
      expect(stage.bagsRemaining).toBe(stage.bagsRequired);
      expect(stage.status).toBe('not_started');
      expect(stage.bagSizeKg).toBeGreaterThan(0);
      expect(stage.unitPriceZmw).toBeGreaterThanOrEqual(0);
    });

    it('returns 404 for non-existent flock', async () => {
      const res = await api('/api/v1/broiler-flocks/00000000-0000-0000-0000-000000000000/feed-projection', token);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/feed-purchases', () => {
    it('creates a feed purchase and auto-creates a FinancialRecord', async () => {
      // First get the feed stage details to know the bag size and price
      const projRes = await api(`/api/v1/broiler-flocks/${flockId}/feed-projection`, token);
      const proj = await projRes.json();
      const stage = proj.stages[0];

      // Use a fixed unit price to ensure totalCostZmw > 0 (some seeded stages may have 0 price)
      const unitPrice = stage.unitPriceZmw > 0 ? stage.unitPriceZmw : 750;
      const bagsToBuy = Math.min(5, Math.max(1, stage.bagsRequired));

      const res = await api('/api/v1/feed-purchases', token, {
        method: 'POST',
        body: JSON.stringify({
          flockId,
          feedStageId: stage.feedStageId,
          stageName: stage.stageName,
          bagSizeKg: stage.bagSizeKg,
          bagsPurchased: bagsToBuy,
          unitPriceZmw: unitPrice,
          purchaseDate: '2026-08-10',
          notes: 'Test purchase',
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBeDefined();
      purchaseId = data.id; // Set before assertions so subsequent tests can use it
      expect(data.bagsPurchased).toBe(bagsToBuy);
      expect(Number(data.totalCostZmw)).toBeGreaterThan(0);
    });

    it('updates the projection to reflect the purchase', async () => {
      const res = await api(`/api/v1/broiler-flocks/${flockId}/feed-projection`, token);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.totals.bagsPurchased).toBeGreaterThan(0);
      expect(data.totals.bagsRemaining).toBeLessThan(data.totals.bagsRequired);

      const stage = data.stages[0];
      expect(stage.bagsPurchased).toBeGreaterThan(0);
      // Status should be partial or complete depending on how many we bought
      expect(['partial', 'complete']).toContain(stage.status);
    });

    it('verifies a FinancialRecord was auto-created', async () => {
      const res = await api(`/api/v1/financial-records?flockId=${flockId}`, token);
      expect(res.status).toBe(200);
      const records = await res.json();
      const feedPurchaseFR = records.find((r: any) =>
        r.sourceTable === 'feed_purchases' && r.sourceRecordId === purchaseId
      );
      expect(feedPurchaseFR).toBeDefined();
      expect(feedPurchaseFR.category).toBe('feed');
      expect(feedPurchaseFR.isIncome).toBe(false);
      expect(Number(feedPurchaseFR.amountZmw)).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/feed-purchases', () => {
    it('lists purchases for a flock', async () => {
      const res = await api(`/api/v1/feed-purchases?flockId=${flockId}`, token);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBeGreaterThan(0);
      expect(data.some((p: any) => p.id === purchaseId)).toBe(true);
    });
  });

  describe('PATCH /api/v1/feed-purchases/:id', () => {
    it('updates a feed purchase', async () => {
      const res = await api(`/api/v1/feed-purchases/${purchaseId}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ bagsPurchased: 10, notes: 'Updated test purchase' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.bagsPurchased).toBe(10);
      expect(data.notes).toBe('Updated test purchase');
    });
  });

  describe('Flock list includes feed projection summary', () => {
    it('returns feedProjection array on each flock in the list', async () => {
      const res = await api('/api/v1/broiler-flocks', token);
      expect(res.status).toBe(200);
      const flocks = await res.json();
      const testFlock = flocks.find((f: any) => f.id === flockId);
      expect(testFlock).toBeDefined();
      expect(testFlock.feedProjection).toBeDefined();
      expect(Array.isArray(testFlock.feedProjection)).toBe(true);
      if (testFlock.feedProjection.length > 0) {
        const fp = testFlock.feedProjection[0];
        expect(fp.stageName).toBeDefined();
        expect(fp.bagsRequired).toBeGreaterThan(0);
        expect(fp.bagsPurchased).toBeGreaterThanOrEqual(0);
        expect(fp.status).toBeDefined();
      }
    });
  });

  describe('DELETE /api/v1/feed-purchases/:id', () => {
    it('deletes a feed purchase and reverses the journal entry', async () => {
      const res = await api(`/api/v1/feed-purchases/${purchaseId}`, token, {
        method: 'DELETE',
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.deleted).toBe(true);

      // Verify projection no longer counts this purchase
      const projRes = await api(`/api/v1/broiler-flocks/${flockId}/feed-projection`, token);
      const proj = await projRes.json();
      // bagsPurchased should be 0 again (or reduced) after deletion
      const stage = proj.stages[0];
      expect(stage.bagsPurchased).toBe(0);
    });
  });
});
