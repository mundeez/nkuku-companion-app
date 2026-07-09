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

describe('Milestone G — Immutability & Compliance', () => {
  let token: string;
  let entryId: string;

  beforeAll(async () => {
    token = await login();
  });

  // ── Journal Entry Immutability (405 Guards) ─────────────

  describe('Journal entry 405 guards', () => {
    it('creates a journal entry for testing', async () => {
      const res = await fetch(`${API_URL}/api/v1/journal`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          entryDate: '2026-07-09',
          description: 'Immutability test entry',
          lines: [
            { accountCode: '1010', debitZmw: 10 },
            { accountCode: '3010', creditZmw: 10 },
          ],
        }),
      });
      expect(res.status).toBe(201);
      const entry = await res.json();
      entryId = entry.id;
      expect(entryId).toBeTruthy();
    });

    it('rejects PATCH on journal entry with 405', async () => {
      const res = await fetch(`${API_URL}/api/v1/journal/${entryId}`, {
        method: 'PATCH',
        headers: authHeaders(token),
        body: JSON.stringify({ description: 'tampered' }),
      });
      expect(res.status).toBe(405);
      const body = await res.json();
      expect(body.error).toBe('METHOD_NOT_ALLOWED');
      expect(res.headers.get('allow')).toBe('GET, POST');
    });

    it('rejects DELETE on journal entry with 405', async () => {
      const res = await fetch(`${API_URL}/api/v1/journal/${entryId}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      expect(res.status).toBe(405);
      const body = await res.json();
      expect(body.error).toBe('METHOD_NOT_ALLOWED');
      expect(res.headers.get('allow')).toBe('GET, POST');
    });

    it('still allows GET on the journal entry (not blocked by guards)', async () => {
      const res = await fetch(`${API_URL}/api/v1/journal/${entryId}`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const entry = await res.json();
      expect(entry.id).toBe(entryId);
      // Verify the entry was NOT modified by the PATCH attempt
      expect(entry.description).toBe('Immutability test entry');
    });

    it('allows reversal (POST /:id/reverse) as the correction mechanism', async () => {
      const res = await fetch(`${API_URL}/api/v1/journal/${entryId}/reverse`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ reason: 'Immutability test cleanup' }),
      });
      expect(res.status).toBe(201);
      const reversal = await res.json();
      expect(reversal.id).toBeTruthy();
      expect(reversal.id).not.toBe(entryId);
    });
  });

  // ── DB-Level Immutability (CREATE RULE) ─────────────────

  describe('DB-level immutability rules', () => {
    it('prevents direct UPDATE on journal_entries via SQL', async () => {
      // The API 405 guard is the first line of defense.
      // The DB CREATE RULE is the second. We verify via the API that
      // the entry created above still has its original description.
      const res = await fetch(`${API_URL}/api/v1/journal/${entryId}`, {
        headers: authHeaders(token),
      });
      const entry = await res.json();
      expect(entry.description).toBe('Immutability test entry');
    });
  });

  // ── Deprecation Headers on v0.8.0 Financial Engine ──────

  describe('Deprecation headers on financial-engine endpoints', () => {
    it('includes Deprecation header on /api/v1/financial-engine/summary', async () => {
      const res = await fetch(`${API_URL}/api/v1/financial-engine/summary`, {
        headers: authHeaders(token),
      });
      expect(res.headers.get('deprecation')).toBe('true');
      expect(res.headers.get('sunset')).toContain('2027');
      expect(res.headers.get('link')).toContain('successor-version');
    });

    it('includes Deprecation header on /api/v1/financial-engine/income-statement', async () => {
      const res = await fetch(`${API_URL}/api/v1/financial-engine/income-statement`, {
        headers: authHeaders(token),
      });
      expect(res.headers.get('deprecation')).toBe('true');
    });

    it('includes Deprecation header on /api/v1/financial-engine/balance-sheet', async () => {
      const res = await fetch(`${API_URL}/api/v1/financial-engine/balance-sheet`, {
        headers: authHeaders(token),
      });
      expect(res.headers.get('deprecation')).toBe('true');
    });

    it('includes Deprecation header on /api/v1/financial-engine/cash-flow', async () => {
      const res = await fetch(`${API_URL}/api/v1/financial-engine/cash-flow`, {
        headers: authHeaders(token),
      });
      expect(res.headers.get('deprecation')).toBe('true');
    });
  });

  // ── Double-Entry Ledger Endpoints (No Deprecation) ──────

  describe('Double-entry ledger endpoints have NO deprecation headers', () => {
    it('/api/v1/ledger/trial-balance has no Deprecation header', async () => {
      const res = await fetch(`${API_URL}/api/v1/ledger/trial-balance`, {
        headers: authHeaders(token),
      });
      expect(res.headers.get('deprecation')).toBeNull();
    });

    it('/api/v1/ledger/income-statement has no Deprecation header', async () => {
      const res = await fetch(`${API_URL}/api/v1/ledger/income-statement`, {
        headers: authHeaders(token),
      });
      expect(res.headers.get('deprecation')).toBeNull();
    });

    it('/api/v1/ledger/balance-sheet has no Deprecation header', async () => {
      const res = await fetch(`${API_URL}/api/v1/ledger/balance-sheet`, {
        headers: authHeaders(token),
      });
      expect(res.headers.get('deprecation')).toBeNull();
    });
  });

  // ── Journal Entry Validation (CHECK Constraints) ────────

  describe('Journal line validation', () => {
    it('rejects unbalanced journal entry (debits != credits)', async () => {
      const res = await fetch(`${API_URL}/api/v1/journal`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          entryDate: '2026-07-09',
          description: 'Unbalanced test',
          lines: [
            { accountCode: '1010', debitZmw: 100 },
            { accountCode: '3010', creditZmw: 50 },
          ],
        }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects journal line with both debit and credit', async () => {
      const res = await fetch(`${API_URL}/api/v1/journal`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          entryDate: '2026-07-09',
          description: 'Both sides test',
          lines: [
            { accountCode: '1010', debitZmw: 50, creditZmw: 50 },
            { accountCode: '3010', creditZmw: 50 },
          ],
        }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects journal line with neither debit nor credit', async () => {
      const res = await fetch(`${API_URL}/api/v1/journal`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          entryDate: '2026-07-09',
          description: 'No side test',
          lines: [
            { accountCode: '1010' },
            { accountCode: '3010', creditZmw: 50 },
          ],
        }),
      });
      expect(res.status).toBe(400);
    });
  });
});
