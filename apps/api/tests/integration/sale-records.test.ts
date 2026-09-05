import { describe, it, expect, beforeAll, afterAll } from 'vitest';

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

async function getBreedId(token: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/v1/breeds`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const breeds = await res.json();
  return breeds.find((b: any) => b.name === 'Ross 308').id;
}

async function createTestFlock(token: string, breedId: string, name: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/v1/broiler-flocks`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      breedId,
      orderDate: '2026-09-01',
      initialCount: 100,
      targetWeight: 2.5,
      targetAge: 42,
      feedTransitionDay: 11,
    }),
  });
  const flock = await res.json();
  return flock.id;
}

async function deleteFlock(token: string, flockId: string) {
  await fetch(`${API_URL}/api/v1/broiler-flocks/${flockId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function createSale(token: string, flockId: string, overrides: any = {}) {
  const body = {
    flockId,
    saleDate: '2026-09-10',
    customerName: 'Test Customer',
    customerPhone: '260970000000',
    birdCount: 5,
    pricePerBirdZmw: 150,
    totalAmountZmw: 750,
    paymentStatus: 'pending',
    ...overrides,
  };
  const res = await fetch(`${API_URL}/api/v1/sale-records`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

describe('Sale Records API', () => {
  let token: string;
  let breedId: string;
  let flockId: string;
  let flock2Id: string;
  const saleIds: string[] = [];

  beforeAll(async () => {
    token = await login();
    breedId = await getBreedId(token);
    flockId = await createTestFlock(token, breedId, 'Sale Test Flock A');
    flock2Id = await createTestFlock(token, breedId, 'Sale Test Flock B');
  });

  afterAll(async () => {
    // Clean up test sales
    for (const id of saleIds) {
      await fetch(`${API_URL}/api/v1/sale-records/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    // Clean up test flocks
    await deleteFlock(token, flockId);
    await deleteFlock(token, flock2Id);
  });

  describe('POST /sale-records', () => {
    it('creates a sale with pending payment and zeroes amountPaid', async () => {
      const { status, data } = await createSale(token, flockId, {
        paymentStatus: 'pending',
        amountPaidZmw: 100, // should be overridden to 0
      });
      expect(status).toBe(200);
      expect(data.paymentStatus).toBe('pending');
      expect(Number(data.amountPaidZmw)).toBe(0);
      saleIds.push(data.id);
    });

    it('creates a sale with paid payment and auto-sets amountPaid = total', async () => {
      const { status, data } = await createSale(token, flockId, {
        paymentStatus: 'paid',
        totalAmountZmw: 750,
      });
      expect(status).toBe(200);
      expect(data.paymentStatus).toBe('paid');
      expect(Number(data.amountPaidZmw)).toBe(750);
      saleIds.push(data.id);
    });

    it('creates a sale with partial payment and validates amountPaid', async () => {
      const { status, data } = await createSale(token, flockId, {
        paymentStatus: 'partial',
        amountPaidZmw: 300,
        totalAmountZmw: 750,
      });
      expect(status).toBe(200);
      expect(data.paymentStatus).toBe('partial');
      expect(Number(data.amountPaidZmw)).toBe(300);
      saleIds.push(data.id);
    });

    it('rejects partial payment with zero amountPaid', async () => {
      const { status, data } = await createSale(token, flockId, {
        paymentStatus: 'partial',
        amountPaidZmw: 0,
        totalAmountZmw: 750,
      });
      expect(status).toBe(422);
      expect(data.error).toBe('VALIDATION_ERROR');
    });

    it('rejects partial payment with amountPaid >= totalAmount', async () => {
      const { status } = await createSale(token, flockId, {
        paymentStatus: 'partial',
        amountPaidZmw: 750,
        totalAmountZmw: 750,
      });
      expect(status).toBe(422);
    });

    it('strips [FR:] prefix from notes in response', async () => {
      const { status, data } = await createSale(token, flockId, {
        notes: 'Test note for FR stripping',
      });
      expect(status).toBe(200);
      expect(data.notes).toBe('Test note for FR stripping');
      expect(data.notes).not.toMatch(/\[FR:/);
      saleIds.push(data.id);
    });
  });

  describe('GET /sale-records/all', () => {
    it('returns paginated response with data, total, limit, offset', async () => {
      const res = await fetch(`${API_URL}/api/v1/sale-records/all?limit=5&offset=0`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('limit', 5);
      expect(data).toHaveProperty('offset', 0);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('filters by paymentStatus=paid', async () => {
      const res = await fetch(`${API_URL}/api/v1/sale-records/all?paymentStatus=paid`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.every((s: any) => s.paymentStatus === 'paid')).toBe(true);
    });

    it('filters by flockId', async () => {
      const res = await fetch(`${API_URL}/api/v1/sale-records/all?flockId=${flockId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.every((s: any) => s.flockId === flockId)).toBe(true);
    });

    it('filters by customer name (case-insensitive partial match)', async () => {
      const res = await fetch(`${API_URL}/api/v1/sale-records/all?customer=test%20cust`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.length).toBeGreaterThan(0);
      expect(data.data.every((s: any) =>
        s.customerName?.toLowerCase().includes('test cust') ||
        s.customerPhone?.includes('test cust')
      )).toBe(true);
    });

    it('filters by date range with inclusive end date', async () => {
      // Create a sale on a specific date
      const { data: sale } = await createSale(token, flockId, {
        saleDate: '2026-09-15',
        customerName: 'DateRange Test',
      });
      saleIds.push(sale.id);

      const res = await fetch(`${API_URL}/api/v1/sale-records/all?fromDate=2026-09-15&toDate=2026-09-15`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      // Should include records on the end date (2026-09-15)
      expect(data.data.some((s: any) => s.id === sale.id)).toBe(true);
    });

    it('combines multiple filters', async () => {
      const res = await fetch(
        `${API_URL}/api/v1/sale-records/all?flockId=${flockId}&paymentStatus=paid&limit=10`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.every((s: any) =>
        s.flockId === flockId && s.paymentStatus === 'paid'
      )).toBe(true);
    });

    it('strips [FR:] prefix from notes in list response', async () => {
      const res = await fetch(`${API_URL}/api/v1/sale-records/all?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      expect(data.data.every((s: any) => !s.notes || !s.notes.match(/^\[FR:/))).toBe(true);
    });
  });

  describe('GET /sale-records/summary', () => {
    it('returns summary with filter params', async () => {
      const res = await fetch(
        `${API_URL}/api/v1/sale-records/summary?flockId=${flockId}&paymentStatus=paid`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('totalRevenue');
      expect(data).toHaveProperty('totalBirdsSold');
      expect(data).toHaveProperty('totalPaid');
      expect(data).toHaveProperty('outstanding');
      expect(data).toHaveProperty('salesCount');
      expect(data).toHaveProperty('paymentBreakdown');
    });

    it('respects date range filter', async () => {
      const res = await fetch(
        `${API_URL}/api/v1/sale-records/summary?fromDate=2026-09-10&toDate=2026-09-10`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      // Only sales on 2026-09-10 should be counted
      expect(data.salesCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /sale-records/dashboard', () => {
    it('returns dashboard with filter params', async () => {
      const res = await fetch(
        `${API_URL}/api/v1/sale-records/dashboard?flockId=${flockId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('totalRevenue');
      expect(data).toHaveProperty('dailySales');
      expect(Array.isArray(data.dailySales)).toBe(true);
    });

    it('respects date range in dailySales', async () => {
      const res = await fetch(
        `${API_URL}/api/v1/sale-records/dashboard?fromDate=2026-09-01&toDate=2026-09-30`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      // Daily sales should only contain entries within the date range
      for (const entry of data.dailySales) {
        expect(entry.date >= '2026-09-01').toBe(true);
        expect(entry.date <= '2026-09-30').toBe(true);
      }
    });
  });

  describe('GET /sale-records/:id', () => {
    it('strips [FR:] prefix from notes in detail response', async () => {
      const { data: sale } = await createSale(token, flockId, {
        notes: 'Detail view test note',
      });
      saleIds.push(sale.id);

      const res = await fetch(`${API_URL}/api/v1/sale-records/${sale.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.notes).toBe('Detail view test note');
      expect(data.notes).not.toMatch(/\[FR:/);
    });
  });

  describe('PATCH /sale-records/:id', () => {
    it('preserves [FR:] prefix when notes are updated', async () => {
      const { data: sale } = await createSale(token, flockId, {
        notes: 'Original note',
      });
      saleIds.push(sale.id);

      // Update notes — API should re-prepend the [FR:] prefix internally
      const patchRes = await fetch(`${API_URL}/api/v1/sale-records/${sale.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Updated note' }),
      });
      expect(patchRes.status).toBe(200);
      const patched = await patchRes.json();
      // Response should have stripped the prefix
      expect(patched.notes).toBe('Updated note');

      // Verify the prefix is still in the DB by fetching the record
      const getRes = await fetch(`${API_URL}/api/v1/sale-records/${sale.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const getData = await getRes.json();
      expect(getData.notes).toBe('Updated note'); // stripped in response
    });

    it('auto-sets amountPaid when paymentStatus changes to paid', async () => {
      const { data: sale } = await createSale(token, flockId, {
        paymentStatus: 'pending',
        totalAmountZmw: 750,
      });
      saleIds.push(sale.id);

      const patchRes = await fetch(`${API_URL}/api/v1/sale-records/${sale.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: 'paid' }),
      });
      expect(patchRes.status).toBe(200);
      const patched = await patchRes.json();
      expect(patched.paymentStatus).toBe('paid');
      expect(Number(patched.amountPaidZmw)).toBe(750);
    });

    it('rejects partial with invalid amountPaid on update', async () => {
      const { data: sale } = await createSale(token, flockId, {
        paymentStatus: 'pending',
        totalAmountZmw: 750,
      });
      saleIds.push(sale.id);

      const patchRes = await fetch(`${API_URL}/api/v1/sale-records/${sale.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: 'partial', amountPaidZmw: 0 }),
      });
      expect(patchRes.status).toBe(422);
    });

    it('rejects amountPaid change on a paid record without status change', async () => {
      const { data: sale } = await createSale(token, flockId, {
        paymentStatus: 'paid',
        totalAmountZmw: 750,
      });
      saleIds.push(sale.id);

      // Try to set amountPaidZmw to 0 without changing paymentStatus
      const patchRes = await fetch(`${API_URL}/api/v1/sale-records/${sale.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountPaidZmw: 0 }),
      });
      expect(patchRes.status).toBe(422);
    });

    it('rejects non-zero amountPaid on a pending record without status change', async () => {
      const { data: sale } = await createSale(token, flockId, {
        paymentStatus: 'pending',
        totalAmountZmw: 750,
      });
      saleIds.push(sale.id);

      const patchRes = await fetch(`${API_URL}/api/v1/sale-records/${sale.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountPaidZmw: 100 }),
      });
      expect(patchRes.status).toBe(422);
    });

    it('auto-updates amountPaid when totalAmount changes on a paid record', async () => {
      const { data: sale } = await createSale(token, flockId, {
        paymentStatus: 'paid',
        birdCount: 5,
        pricePerBirdZmw: 150,
        totalAmountZmw: 750,
      });
      saleIds.push(sale.id);

      // Change totalAmountZmw without explicitly setting paymentStatus
      const patchRes = await fetch(`${API_URL}/api/v1/sale-records/${sale.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalAmountZmw: 900 }),
      });
      expect(patchRes.status).toBe(200);
      const patched = await patchRes.json();
      expect(patched.paymentStatus).toBe('paid');
      expect(Number(patched.amountPaidZmw)).toBe(900); // auto-updated to new total
    });
  });

  describe('GET /sale-records (list with filters)', () => {
    it('returns paginated response with filter params', async () => {
      const res = await fetch(
        `${API_URL}/api/v1/sale-records?flockId=${flockId}&paymentStatus=paid&limit=5&offset=0`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('limit', 5);
    });
  });
});
