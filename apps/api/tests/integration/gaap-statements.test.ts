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

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

describe('GAAP Financial Statements API', () => {
  let token: string;

  beforeAll(async () => {
    token = await login();
  });

  // ── Income Statement ─────────────────────────────────

  describe('GET /api/v1/ledger/income-statement', () => {
    it('returns a complete income statement', async () => {
      const res = await fetch(`${API_URL}/api/v1/ledger/income-statement?fromDate=2026-01-01&toDate=2026-12-31`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const stmt = await res.json();
      expect(stmt).toHaveProperty('periodFrom');
      expect(stmt).toHaveProperty('periodTo');
      expect(stmt).toHaveProperty('revenue');
      expect(stmt).toHaveProperty('totalRevenue');
      expect(stmt).toHaveProperty('costOfGoodsSold');
      expect(stmt).toHaveProperty('totalCogs');
      expect(stmt).toHaveProperty('grossProfit');
      expect(stmt).toHaveProperty('operatingExpenses');
      expect(stmt).toHaveProperty('totalOperatingExpenses');
      expect(stmt).toHaveProperty('operatingProfit');
      expect(stmt).toHaveProperty('netProfit');
    });

    it('revenue matches sum of 4xxx account balances', async () => {
      const res = await fetch(`${API_URL}/api/v1/ledger/income-statement?fromDate=2026-01-01&toDate=2026-12-31`, {
        headers: authHeaders(token),
      });
      const stmt = await res.json();
      // Revenue lines should come from 4xxx accounts
      stmt.revenue.forEach((line: any) => {
        expect(line.accountCode.startsWith('4')).toBe(true);
      });
      // totalRevenue should equal sum of line net balances
      const sumRevenue = stmt.revenue.reduce(
        (sum: number, l: any) => sum + parseFloat(l.netBalance),
        0,
      );
      expect(Math.abs(sumRevenue - parseFloat(stmt.totalRevenue))).toBeLessThan(0.01);
    });

    it('gross profit = totalRevenue - totalCogs', async () => {
      const res = await fetch(`${API_URL}/api/v1/ledger/income-statement?fromDate=2026-01-01&toDate=2026-12-31`, {
        headers: authHeaders(token),
      });
      const stmt = await res.json();
      const expectedGross = parseFloat(stmt.totalRevenue) - parseFloat(stmt.totalCogs);
      expect(Math.abs(parseFloat(stmt.grossProfit) - expectedGross)).toBeLessThan(0.01);
    });

    it('net profit = grossProfit - totalOperatingExpenses', async () => {
      const res = await fetch(`${API_URL}/api/v1/ledger/income-statement?fromDate=2026-01-01&toDate=2026-12-31`, {
        headers: authHeaders(token),
      });
      const stmt = await res.json();
      const expectedNet = parseFloat(stmt.grossProfit) - parseFloat(stmt.totalOperatingExpenses);
      expect(Math.abs(parseFloat(stmt.netProfit) - expectedNet)).toBeLessThan(0.01);
    });

    it('supports CSV export', async () => {
      const res = await fetch(`${API_URL}/api/v1/ledger/income-statement?fromDate=2026-01-01&toDate=2026-12-31&format=csv`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('Income Statement');
      expect(text).toContain('REVENUE');
      expect(text).toContain('Total Revenue');
    });
  });

  // ── Balance Sheet ────────────────────────────────────

  describe('GET /api/v1/ledger/balance-sheet', () => {
    it('returns a complete balance sheet', async () => {
      const res = await fetch(`${API_URL}/api/v1/ledger/balance-sheet?asOf=2026-12-31`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const stmt = await res.json();
      expect(stmt).toHaveProperty('asOfDate');
      expect(stmt).toHaveProperty('assets');
      expect(stmt).toHaveProperty('totalAssets');
      expect(stmt).toHaveProperty('liabilities');
      expect(stmt).toHaveProperty('totalLiabilities');
      expect(stmt).toHaveProperty('equity');
      expect(stmt).toHaveProperty('totalEquity');
      expect(stmt).toHaveProperty('totalLiabilitiesAndEquity');
      expect(stmt).toHaveProperty('isBalanced');
    });

    it('satisfies the balance sheet equation: Assets = Liabilities + Equity', async () => {
      const res = await fetch(`${API_URL}/api/v1/ledger/balance-sheet?asOf=2026-12-31`, {
        headers: authHeaders(token),
      });
      const stmt = await res.json();
      const assets = parseFloat(stmt.totalAssets);
      const liab = parseFloat(stmt.totalLiabilities);
      const equity = parseFloat(stmt.totalEquity);
      const le = parseFloat(stmt.totalLiabilitiesAndEquity);
      expect(Math.abs(assets - le)).toBeLessThan(0.01);
      expect(Math.abs(le - (liab + equity))).toBeLessThan(0.01);
    });

    it('assets are from 1xxx accounts', async () => {
      const res = await fetch(`${API_URL}/api/v1/ledger/balance-sheet?asOf=2026-12-31`, {
        headers: authHeaders(token),
      });
      const stmt = await res.json();
      stmt.assets.forEach((line: any) => {
        expect(line.accountCode.startsWith('1')).toBe(true);
      });
    });

    it('supports CSV export', async () => {
      const res = await fetch(`${API_URL}/api/v1/ledger/balance-sheet?asOf=2026-12-31&format=csv`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('Balance Sheet');
      expect(text).toContain('ASSETS');
      expect(text).toContain('Total Assets');
    });
  });

  // ── Cash Flow Statement ──────────────────────────────

  describe('GET /api/v1/ledger/cash-flow', () => {
    it('returns a complete cash flow statement', async () => {
      const res = await fetch(`${API_URL}/api/v1/ledger/cash-flow?fromDate=2026-01-01&toDate=2026-12-31`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const stmt = await res.json();
      expect(stmt).toHaveProperty('periodFrom');
      expect(stmt).toHaveProperty('periodTo');
      expect(stmt).toHaveProperty('operatingActivities');
      expect(stmt).toHaveProperty('netOperatingCashFlow');
      expect(stmt).toHaveProperty('investingActivities');
      expect(stmt).toHaveProperty('netInvestingCashFlow');
      expect(stmt).toHaveProperty('financingActivities');
      expect(stmt).toHaveProperty('netFinancingCashFlow');
      expect(stmt).toHaveProperty('netCashFlow');
    });

    it('starts with net income in operating activities', async () => {
      const res = await fetch(`${API_URL}/api/v1/ledger/cash-flow?fromDate=2026-01-01&toDate=2026-12-31`, {
        headers: authHeaders(token),
      });
      const stmt = await res.json();
      expect(stmt.operatingActivities[0].label).toBe('Net Income');
    });
  });

  // ── Year-End Close ───────────────────────────────────

  describe('POST /api/v1/ledger/year-end-close', () => {
    it('posts closing entries and returns summary', async () => {
      const res = await fetch(`${API_URL}/api/v1/ledger/year-end-close`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ year: 2026 }),
      });
      expect(res.status).toBe(201);
      const result = await res.json();
      expect(result).toHaveProperty('closingDate');
      expect(result).toHaveProperty('revenueClosed');
      expect(result).toHaveProperty('expenseClosed');
      expect(result).toHaveProperty('netIncome');
      expect(result).toHaveProperty('journalEntryId');
      expect(result.closingDate).toBe('2026-12-31');
    });

    it('zeroes out all revenue and expense accounts after close', async () => {
      // After year-end close, the trial balance should show zero balances
      // for all 4xxx, 5xxx, 6xxx accounts (as of 2026-12-31)
      const tbRes = await fetch(`${API_URL}/api/v1/ledger/trial-balance?asOf=2026-12-31`, {
        headers: authHeaders(token),
      });
      const tb = await tbRes.json();
      const incomeStmtAccounts = tb.lines.filter(
        (l: any) => l.accountCode.startsWith('4') || l.accountCode.startsWith('5') || l.accountCode.startsWith('6'),
      );
      // All income statement accounts should have zero balance after close
      incomeStmtAccounts.forEach((l: any) => {
        expect(parseFloat(l.debitBalance)).toBe(0);
        expect(parseFloat(l.creditBalance)).toBe(0);
      });
    });

    it('is idempotent (second run has nothing to close)', async () => {
      const res = await fetch(`${API_URL}/api/v1/ledger/year-end-close`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ year: 2026 }),
      });
      expect(res.status).toBe(201);
      const result = await res.json();
      // Revenue and expense closed should be 0 (already closed)
      expect(parseFloat(result.revenueClosed)).toBe(0);
      expect(parseFloat(result.expenseClosed)).toBe(0);
    });
  });
});
