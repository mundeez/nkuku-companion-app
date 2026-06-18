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

describe('Broiler Management API', () => {
  let token: string;
  let breedId: string;
  let flockId: string;

  beforeAll(async () => {
    token = await login();
  });

  describe('Breeds', () => {
    it('lists breeds including Ross 308 and Cobb 500', async () => {
      const res = await fetch(`${API_URL}/api/v1/breeds`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBeGreaterThanOrEqual(2);
      expect(data.some((b: any) => b.name === 'Ross 308')).toBe(true);
      expect(data.some((b: any) => b.name === 'Cobb 500')).toBe(true);
      breedId = data.find((b: any) => b.name === 'Ross 308').id;
    });

    it('returns Ross 308 with performance targets', async () => {
      const res = await fetch(`${API_URL}/api/v1/breeds/${breedId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe('Ross 308');
      expect(data.performanceTargets.length).toBeGreaterThan(50);
    });
  });

  describe('Flocks', () => {
    it('creates a new flock', async () => {
      const res = await fetch(`${API_URL}/api/v1/broiler-flocks`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Flock Integration',
          breedId,
          startDate: '2026-06-01',
          initialCount: 500,
          targetWeight: 2.5,
          targetAge: 42,
          feedTransitionDay: 11,
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe('Test Flock Integration');
      expect(data.currentCount).toBe(500);
      expect(data.status).toBe('active');
      flockId = data.id;
    });

    it('lists flocks for the user', async () => {
      const res = await fetch(`${API_URL}/api/v1/broiler-flocks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBeGreaterThan(0);
      expect(data.some((f: any) => f.id === flockId)).toBe(true);
    });

    it('returns flock dashboard', async () => {
      const res = await fetch(`${API_URL}/api/v1/broiler-flocks/${flockId}/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.flock).toBeDefined();
      expect(data.ageDays).toBeGreaterThanOrEqual(0);
      expect(typeof data.mortalityRate).toBe('number');
    });

    it('updates a flock', async () => {
      const res = await fetch(`${API_URL}/api/v1/broiler-flocks/${flockId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetWeight: 3.0 }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.targetWeight).toBe('3');
    });
  });

  describe('Growth Records', () => {
    it('creates a growth record', async () => {
      const res = await fetch(`${API_URL}/api/v1/growth-records`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ flockId, recordDate: '2026-06-10', sampleSize: 50, avgWeight: 850 }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.avgWeight).toBe('850');
    });

    it('lists growth records', async () => {
      const res = await fetch(`${API_URL}/api/v1/growth-records?flockId=${flockId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('Feed Records', () => {
    it('creates a feed record', async () => {
      const res = await fetch(`${API_URL}/api/v1/feed-records`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ flockId, recordDate: '2026-06-10', feedType: 'starter', quantityKg: 25, costZmw: 375 }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.quantityKg).toBe('25');
      expect(data.costZmw).toBe('375');
    });

    it('returns feed summary', async () => {
      const res = await fetch(`${API_URL}/api/v1/feed-records/summary?flockId=${flockId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.totalFeedKg).toBeDefined();
      expect(data.totalCostZmw).toBeDefined();
    });
  });

  describe('Mortality Events', () => {
    it('creates a mortality event and decrements count', async () => {
      const before = await fetch(`${API_URL}/api/v1/broiler-flocks/${flockId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const beforeData = await before.json();
      const beforeCount = beforeData.currentCount;

      const res = await fetch(`${API_URL}/api/v1/mortality-events`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ flockId, eventDate: '2026-06-12', count: 5, cause: 'Heat stress', ageDays: 12 }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.count).toBe(5);

      const after = await fetch(`${API_URL}/api/v1/broiler-flocks/${flockId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const afterData = await after.json();
      expect(afterData.currentCount).toBe(beforeCount - 5);
    });

    it('returns mortality summary', async () => {
      const res = await fetch(`${API_URL}/api/v1/mortality-events/summary?flockId=${flockId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.totalDeaths).toBeGreaterThan(0);
      expect(data.mortalityRate).toBeDefined();
    });
  });

  describe('Financial Records', () => {
    it('creates expense and income records', async () => {
      const expense = await fetch(`${API_URL}/api/v1/financial-records`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ flockId, recordDate: '2026-06-01', category: 'chick_purchase', description: 'Day old chicks', amountZmw: 5000 }),
      });
      expect(expense.status).toBe(200);

      const income = await fetch(`${API_URL}/api/v1/financial-records`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ flockId, recordDate: '2026-06-15', category: 'sales', description: 'Partial sale', amountZmw: 8000, isIncome: true }),
      });
      expect(income.status).toBe(200);
    });

    it('returns financial summary with profit', async () => {
      const res = await fetch(`${API_URL}/api/v1/financial-records/summary?flockId=${flockId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.totalCost).toBeDefined();
      expect(data.totalRevenue).toBeDefined();
      expect(data.profit).toBeDefined();
    });
  });

  describe('Diseases', () => {
    it('lists diseases with categories', async () => {
      const res = await fetch(`${API_URL}/api/v1/diseases`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBeGreaterThanOrEqual(10);
      expect(data.some((d: any) => d.name === 'Newcastle Disease')).toBe(true);
    });

    it('returns disease categories', async () => {
      const res = await fetch(`${API_URL}/api/v1/diseases/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('Cleanup', () => {
    it('deletes the test flock', async () => {
      const res = await fetch(`${API_URL}/api/v1/broiler-flocks/${flockId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.deleted).toBe(true);
    });
  });
});
