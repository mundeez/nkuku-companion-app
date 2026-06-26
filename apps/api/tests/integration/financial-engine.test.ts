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

describe('Financial Engine API', () => {
  let token: string;
  let flockId: string;

  beforeAll(async () => {
    token = await login();

    // Get an existing flock to use for financial records
    const flocksRes = await fetch(`${API_URL}/api/v1/broiler-flocks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const flocks = await flocksRes.json();
    if (flocks.length > 0) {
      flockId = flocks[0].id;
    } else {
      // Create a flock if none exists
      const breedsRes = await fetch(`${API_URL}/api/v1/breeds`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const breeds = await breedsRes.json();
      const breedId = breeds.find((b: any) => b.name === 'Ross 308')?.id ?? breeds[0].id;

      const createRes = await fetch(`${API_URL}/api/v1/broiler-flocks`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Financial Test Flock',
          breedId,
          startDate: '2026-01-01',
          initialCount: 100,
        }),
      });
      const flock = await createRes.json();
      flockId = flock.id;
    }

    // Seed some financial records
    await fetch(`${API_URL}/api/v1/financial-records`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ flockId, recordDate: '2026-01-10', category: 'feed', description: 'Feed purchase', amountZmw: 500 }),
    });
    await fetch(`${API_URL}/api/v1/financial-records`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ flockId, recordDate: '2026-01-20', category: 'sales', description: 'Bird sales', amountZmw: 2000, isIncome: true }),
    });
  });

  describe('Unified Summary', () => {
    it('returns summary with revenue, cost, and profit', async () => {
      const res = await fetch(`${API_URL}/api/v1/financial-engine/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(typeof data.totalRevenue).toBe('number');
      expect(typeof data.totalCost).toBe('number');
      expect(typeof data.netProfit).toBe('number');
      expect(Array.isArray(data.categoryBreakdown)).toBe(true);
      expect(Array.isArray(data.flockBreakdown)).toBe(true);
    });

    it('filters summary by date range', async () => {
      const res = await fetch(`${API_URL}/api/v1/financial-engine/summary?startDate=2026-01-01&endDate=2026-12-31`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.period.startDate).toBeDefined();
      expect(data.period.endDate).toBeDefined();
    });
  });

  describe('Income Statement', () => {
    it('returns income statement structure', async () => {
      const res = await fetch(`${API_URL}/api/v1/financial-engine/income-statement`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.revenue).toBeDefined();
      expect(data.cogs).toBeDefined();
      expect(typeof data.grossProfit).toBe('number');
      expect(typeof data.grossMargin).toBe('number');
      expect(data.operatingExpenses).toBeDefined();
      expect(typeof data.netProfit).toBe('number');
      expect(typeof data.netMargin).toBe('number');
    });
  });

  describe('Balance Sheet', () => {
    it('returns balance sheet structure', async () => {
      const res = await fetch(`${API_URL}/api/v1/financial-engine/balance-sheet`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.assets).toBeDefined();
      expect(data.liabilities).toBeDefined();
      expect(data.equity).toBeDefined();
      expect(typeof data.totalLiabilitiesAndEquity).toBe('number');
    });
  });

  describe('Cash Flow', () => {
    it('returns cash flow statement structure', async () => {
      const res = await fetch(`${API_URL}/api/v1/financial-engine/cash-flow`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.operating).toBeDefined();
      expect(data.investing).toBeDefined();
      expect(data.financing).toBeDefined();
      expect(typeof data.netChange).toBe('number');
      expect(typeof data.openingBalance).toBe('number');
      expect(typeof data.closingBalance).toBe('number');
    });
  });

  describe('Monthly Trend', () => {
    it('returns monthly trend for a year', async () => {
      const res = await fetch(`${API_URL}/api/v1/financial-engine/monthly-trend?year=2026`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(12);
      expect(data[0]).toHaveProperty('label');
      expect(data[0]).toHaveProperty('revenue');
      expect(data[0]).toHaveProperty('cost');
      expect(data[0]).toHaveProperty('profit');
    });
  });

  describe('Flock Profitability', () => {
    it('returns flock profitability ranking', async () => {
      const res = await fetch(`${API_URL}/api/v1/financial-engine/flock-profitability`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('flockId');
        expect(data[0]).toHaveProperty('flockName');
        expect(data[0]).toHaveProperty('net');
      }
    });
  });

  describe('CSV Export', () => {
    it('exports income statement as CSV', async () => {
      const res = await fetch(`${API_URL}/api/v1/financial-engine/export/income-statement?format=csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const contentType = res.headers.get('content-type');
      expect(contentType).toContain('text/csv');
      const text = await res.text();
      expect(text).toContain('Nkuku Companion');
    });

    it('exports balance sheet as CSV', async () => {
      const res = await fetch(`${API_URL}/api/v1/financial-engine/export/balance-sheet?format=csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const contentType = res.headers.get('content-type');
      expect(contentType).toContain('text/csv');
    });

    it('exports cash flow as CSV', async () => {
      const res = await fetch(`${API_URL}/api/v1/financial-engine/export/cash-flow?format=csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const contentType = res.headers.get('content-type');
      expect(contentType).toContain('text/csv');
    });
  });

  describe('Scheduled Reports', () => {
    it('creates and lists a scheduled report', async () => {
      const createRes = await fetch(`${API_URL}/api/v1/financial-engine/scheduled-reports`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Monthly Income Test',
          reportType: 'income_statement',
          frequency: 'monthly',
          scope: 'global',
          recipients: ['test@nkuku.local'],
          format: 'csv',
        }),
      });
      expect(createRes.status).toBe(200);
      const created = await createRes.json();
      expect(created.name).toBe('Monthly Income Test');

      const listRes = await fetch(`${API_URL}/api/v1/financial-engine/scheduled-reports`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(listRes.status).toBe(200);
      const list = await listRes.json();
      expect(Array.isArray(list)).toBe(true);
      expect(list.some((r: any) => r.id === created.id)).toBe(true);

      // Clean up
      await fetch(`${API_URL}/api/v1/financial-engine/scheduled-reports/${created.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    });
  });

  describe('Audit Log', () => {
    it('returns audit log with pagination', async () => {
      const res = await fetch(`${API_URL}/api/v1/financial-engine/audit-log`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.page).toBeDefined();
      expect(data.pagination.total).toBeDefined();
    });
  });
});
