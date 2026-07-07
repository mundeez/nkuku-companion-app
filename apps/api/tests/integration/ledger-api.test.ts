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

describe('Ledger & Trial Balance API', () => {
  let token: string;

  beforeAll(async () => {
    token = await login();
  });

  // ── Accounts Module ──────────────────────────────────

  describe('GET /api/v1/accounts', () => {
    it('returns the chart of accounts', async () => {
      const res = await fetch(`${API_URL}/api/v1/accounts`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const accounts = await res.json();
      expect(Array.isArray(accounts)).toBe(true);
      expect(accounts.length).toBeGreaterThanOrEqual(37);
      // Verify structure
      expect(accounts[0]).toHaveProperty('code');
      expect(accounts[0]).toHaveProperty('name');
      expect(accounts[0]).toHaveProperty('accountType');
      expect(accounts[0]).toHaveProperty('normalBalance');
    });
  });

  describe('GET /api/v1/accounts/:code', () => {
    it('returns a single account with recent lines', async () => {
      const res = await fetch(`${API_URL}/api/v1/accounts/1010`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const account = await res.json();
      expect(account.code).toBe('1010');
      expect(account).toHaveProperty('recentLines');
    });

    it('returns 404 for non-existent account', async () => {
      const res = await fetch(`${API_URL}/api/v1/accounts/9999`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/accounts (create custom account)', () => {
    it('creates a new custom account', async () => {
      // Use a random code to avoid conflicts with previous test runs
      const testCode = `99${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      const res = await fetch(`${API_URL}/api/v1/accounts`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          code: testCode,
          name: 'Test Suspense Account',
          accountType: 'expense',
          normalBalance: 'debit',
          description: 'Temporary test account',
        }),
      });
      expect(res.status).toBe(201);
      const account = await res.json();
      expect(account.code).toBe(testCode);
      expect(account.isSystem).toBe(false);
    });

    it('rejects duplicate code', async () => {
      const res = await fetch(`${API_URL}/api/v1/accounts`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          code: '1010',
          name: 'Duplicate Cash',
          accountType: 'asset',
          normalBalance: 'debit',
        }),
      });
      expect(res.status).toBe(409);
    });
  });

  describe('DELETE /api/v1/accounts/:code (deactivate)', () => {
    it('deactivates a custom account with no journal lines', async () => {
      // First create a fresh account to deactivate
      const delCode = `98${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      await fetch(`${API_URL}/api/v1/accounts`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          code: delCode,
          name: 'Account To Delete',
          accountType: 'expense',
          normalBalance: 'debit',
        }),
      });

      const res = await fetch(`${API_URL}/api/v1/accounts/${delCode}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.deactivated).toBe(true);
    });

    it('cannot delete a system account', async () => {
      const res = await fetch(`${API_URL}/api/v1/accounts/1010`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      expect(res.status).toBe(400);
    });
  });

  // ── Ledger Module: Trial Balance ─────────────────────

  describe('GET /api/v1/ledger/trial-balance', () => {
    it('returns a balanced trial balance', async () => {
      const res = await fetch(`${API_URL}/api/v1/ledger/trial-balance`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const tb = await res.json();
      expect(tb).toHaveProperty('asOfDate');
      expect(tb).toHaveProperty('lines');
      expect(tb).toHaveProperty('totalDebits');
      expect(tb).toHaveProperty('totalCredits');
      expect(tb).toHaveProperty('isBalanced');
      expect(tb.isBalanced).toBe(true);
      expect(parseFloat(tb.totalDebits)).toBeGreaterThan(0);
      expect(parseFloat(tb.totalCredits)).toBeGreaterThan(0);
      expect(tb.totalDebits).toBe(tb.totalCredits);
    });

    it('accepts an asOf date parameter', async () => {
      const res = await fetch(`${API_URL}/api/v1/ledger/trial-balance?asOf=2026-12-31`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const tb = await res.json();
      expect(tb.asOfDate).toBe('2026-12-31');
    });
  });

  describe('GET /api/v1/ledger/export/trial-balance (CSV)', () => {
    it('downloads trial balance as CSV', async () => {
      const res = await fetch(`${API_URL}/api/v1/ledger/export/trial-balance`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('Account Code');
      expect(text).toContain('Debit Balance');
      expect(text).toContain('Credit Balance');
    });
  });

  // ── Journal Module ───────────────────────────────────

  describe('GET /api/v1/journal', () => {
    it('lists journal entries', async () => {
      const res = await fetch(`${API_URL}/api/v1/journal`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const entries = await res.json();
      expect(Array.isArray(entries)).toBe(true);
      // Migration entries should exist from Milestone B
      if (entries.length > 0) {
        expect(entries[0]).toHaveProperty('entryNumber');
        expect(entries[0]).toHaveProperty('lines');
      }
    });

    it('filters by sourceType', async () => {
      const res = await fetch(`${API_URL}/api/v1/journal?sourceType=migration`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const entries = await res.json();
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.every((e: any) => e.sourceType === 'migration')).toBe(true);
    });
  });

  describe('POST /api/v1/journal (manual entry)', () => {
    it('posts a balanced manual journal entry', async () => {
      const res = await fetch(`${API_URL}/api/v1/journal`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          entryDate: '2026-07-07',
          description: 'Test manual entry — cash to feed',
          lines: [
            { accountCode: '5020', debitZmw: 100, description: 'Feed purchase' },
            { accountCode: '1010', creditZmw: 100, description: 'Cash payment' },
          ],
        }),
      });
      expect(res.status).toBe(201);
      const entry = await res.json();
      expect(entry.entryNumber).toMatch(/^JE-/);
      expect(entry.lines).toHaveLength(2);
      expect(entry.sourceType).toBe('manual');
    });

    it('rejects an unbalanced entry', async () => {
      const res = await fetch(`${API_URL}/api/v1/journal`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          entryDate: '2026-07-07',
          description: 'Unbalanced test',
          lines: [
            { accountCode: '5020', debitZmw: 100 },
            { accountCode: '1010', creditZmw: 50 },
          ],
        }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/journal/:id/reverse (reversal)', () => {
    it('creates a reversing entry with swapped debits/credits', async () => {
      // First, post an entry to reverse
      const postRes = await fetch(`${API_URL}/api/v1/journal`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          entryDate: '2026-07-07',
          description: 'Entry to be reversed',
          lines: [
            { accountCode: '5020', debitZmw: 200, description: 'Test expense' },
            { accountCode: '1010', creditZmw: 200, description: 'Test cash' },
          ],
        }),
      });
      const original = await postRes.json();

      // Now reverse it
      const revRes = await fetch(`${API_URL}/api/v1/journal/${original.id}/reverse`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ reason: 'Test reversal' }),
      });
      expect(revRes.status).toBe(201);
      const reversal = await revRes.json();
      expect(reversal.isReversing).toBe(true);
      expect(reversal.reversesId).toBe(original.id);
      // Lines should be swapped: original debited 5020, reversal should credit 5020
      const line5020 = reversal.lines.find((l: any) => l.account.code === '5020');
      expect(parseFloat(line5020.creditZmw)).toBe(200);
      expect(line5020.debitZmw).toBeNull();
    });

    it('returns 404 for non-existent entry', async () => {
      const res = await fetch(`${API_URL}/api/v1/journal/00000000-0000-0000-0000-000000000000/reverse`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(404);
    });
  });

  // ── Ledger Module: Account Ledger ────────────────────

  describe('GET /api/v1/ledger/account/:code', () => {
    it('returns the general ledger for an account', async () => {
      const res = await fetch(`${API_URL}/api/v1/ledger/account/1010?fromDate=2026-01-01&toDate=2026-12-31`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const ledger = await res.json();
      expect(ledger.account.code).toBe('1010');
      expect(ledger).toHaveProperty('openingBalance');
      expect(ledger).toHaveProperty('closingBalance');
      expect(ledger).toHaveProperty('entries');
      expect(ledger).toHaveProperty('totalDebits');
      expect(ledger).toHaveProperty('totalCredits');
    });

    it('returns 404 for non-existent account', async () => {
      const res = await fetch(`${API_URL}/api/v1/ledger/account/ZZZZ?fromDate=2026-01-01&toDate=2026-12-31`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(404);
    });
  });

  // ── Trial balance stays balanced after manual entries ─

  describe('Trial balance integrity after manual entries', () => {
    it('remains balanced after all manual posting and reversals', async () => {
      const res = await fetch(`${API_URL}/api/v1/ledger/trial-balance`, {
        headers: authHeaders(token),
      });
      const tb = await res.json();
      expect(tb.isBalanced).toBe(true);
    });
  });
});
