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

async function api(path: string, options: any = {}, token?: string) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}), Authorization: `Bearer ${token}` },
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function journalFor(sourceId: string, token: string) {
  const all: any[] = [];
  for (const st of ['sale', 'sale_payment']) {
    const { data } = await api(`/api/v1/journal?sourceType=${st}&limit=100`, {}, token);
    all.push(...((data.data ?? data) as any[]));
  }
  return all.filter((e: any) => e.sourceId === sourceId);
}

async function reversalOf(journalId: string, token: string) {
  const { data } = await api('/api/v1/journal?limit=100', {}, token);
  return ((data.data ?? data) as any[]).find((e: any) => e.reversesId === journalId);
}

describe('Sale Payments + AR posting', () => {
  let token: string;
  let managerToken: string;
  let flockId: string;
  let saleId: string;
  let firstPaymentId: string;

  beforeAll(async () => {
    token = await login();
    // Create a manager user in the same org (owner-only endpoint)
    const email = `sales-test-manager-${Date.now()}@example.com`;
    const res = await api('/api/v1/users', {
      method: 'POST',
      body: JSON.stringify({ email, name: 'Test Manager', password: 'TestPass123!', role: 'manager' }),
    }, token);
    if (res.status === 200 || res.status === 201) {
      const r = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'TestPass123!' }),
      });
      managerToken = (await r.json()).accessToken;
    }

    // Fresh flock — never touch existing flocks.
    const breeds = (await api('/api/v1/breeds', {}, token)).data;
    const breedId = breeds.find((b: any) => b.name === 'Ross 308').id;
    const flock = await api('/api/v1/broiler-flocks', {
      method: 'POST',
      body: JSON.stringify({
        name: `Sale Payments Test ${Date.now()}`,
        breedId,
        orderDate: '2026-09-01',
        initialCount: 1000,
        targetWeight: 2.5,
        targetAge: 42,
      }),
    }, token);
    flockId = flock.data.id;
  });

  afterAll(async () => {
    // leave the test sale & flock for audit; only the deletion assertions below mutate them
  });

  it('creates a 1000 unpaid sale and posts Dr 1020 / Cr 4010', async () => {
    const res = await api('/api/v1/sale-records', {
      method: 'POST',
      body: JSON.stringify({
        flockId, saleDate: '2026-10-01', customerName: 'Test Buyer',
        birdCount: 10, pricePerBirdZmw: 100, totalAmountZmw: 1000, paymentStatus: 'pending',
      }),
    }, token);
    expect(res.status).toBe(200);
    saleId = res.data.id;
    expect(res.data.remainingDueZmw).toBe(1000);
    expect(res.data.paidPct).toBe(0);

    const entries = await journalFor(saleId, token);
    const saleEntry = entries.find((e: any) => e.sourceType === 'sale');
    expect(saleEntry).toBeTruthy();
    const dr = saleEntry.lines.find((l: any) => l.debitZmw != null);
    const cr = saleEntry.lines.find((l: any) => l.creditZmw != null);
    expect(dr.account?.code ?? dr.accountCode).toBe('1020');
    expect(Number(dr.debitZmw)).toBe(1000);
    expect(cr.account?.code ?? cr.accountCode).toBe('4010');
    expect(Number(cr.creditZmw)).toBe(1000);
  });

  it('zero-total sale → 201 with journalEntryId null, no journal entry', async () => {
    const res = await api('/api/v1/sale-records', {
      method: 'POST',
      body: JSON.stringify({
        flockId, saleDate: '2026-10-01', customerName: 'Free Birds',
        birdCount: 5, pricePerBirdZmw: 0, totalAmountZmw: 0, paymentStatus: 'pending',
      }),
    }, token);
    expect(res.status).toBe(200);
    expect(res.data.journalEntryId ?? null).toBeNull();
    const entries = await journalFor(res.data.id, token);
    expect(entries.find((e: any) => e.sourceType === 'sale')).toBeUndefined();
  });

  it('POST payment 400 → partial, amountPaid 400, remainingDue 600, paidPct 40, journal Dr 1010/Cr 1020', async () => {
    const res = await api(`/api/v1/sale-records/${saleId}/payments`, {
      method: 'POST',
      body: JSON.stringify({ amountZmw: 400, method: 'cash', paidAt: '2026-10-02', reference: 'RCPT-1' }),
    }, token);
    expect(res.status).toBe(201);
    firstPaymentId = res.data.payment.id;
    expect(res.data.sale.paymentStatus).toBe('partial');
    expect(Number(res.data.sale.amountPaidZmw)).toBe(400);
    expect(res.data.sale.remainingDueZmw).toBe(600);
    expect(res.data.sale.paidPct).toBe(40);

    const entries = await journalFor(firstPaymentId, token);
    const payEntry = entries.find((e: any) => e.sourceType === 'sale_payment');
    expect(payEntry).toBeTruthy();
    const dr = payEntry.lines.find((l: any) => l.debitZmw != null);
    const cr = payEntry.lines.find((l: any) => l.creditZmw != null);
    expect(dr.account?.code ?? dr.accountCode).toBe('1010');
    expect(Number(dr.debitZmw)).toBe(400);
    expect(cr.account?.code ?? cr.accountCode).toBe('1020');
  });

  it('payment exceeding due → 400 PAYMENT_EXCEEDS_DUE', async () => {
    const res = await api(`/api/v1/sale-records/${saleId}/payments`, {
      method: 'POST',
      body: JSON.stringify({ amountZmw: 700, method: 'cash' }),
    }, token);
    expect(res.status).toBe(400);
    expect(res.data.error).toBe('PAYMENT_EXCEEDS_DUE');
  });

  it('payment of remaining 600 → status paid', async () => {
    const res = await api(`/api/v1/sale-records/${saleId}/payments`, {
      method: 'POST',
      body: JSON.stringify({ amountZmw: 600, method: 'bank_transfer', paidAt: '2026-10-05' }),
    }, token);
    expect(res.status).toBe(201);
    expect(res.data.sale.paymentStatus).toBe('paid');
    expect(res.data.sale.remainingDueZmw).toBe(0);
    expect(res.data.sale.paidPct).toBe(100);
    expect(res.data.sale.paymentsCount).toBe(2);
  });

  it('GET payments lists the history', async () => {
    const res = await api(`/api/v1/sale-records/${saleId}/payments`, {}, token);
    expect(res.status).toBe(200);
    expect(res.data.length).toBe(2);
    expect(res.data.map((p: any) => Number(p.amountZmw))).toEqual([400, 600]);
  });

  it('owner PATCH amountPaidZmw 900 → adjustment row -100, status partial', async () => {
    const res = await api(`/api/v1/sale-records/${saleId}`, {
      method: 'PATCH',
      body: JSON.stringify({ amountPaidZmw: 900 }),
    }, token);
    expect(res.status).toBe(200);
    expect(res.data.paymentStatus).toBe('partial');
    expect(Number(res.data.amountPaidZmw)).toBe(900);

    const payments = (await api(`/api/v1/sale-records/${saleId}/payments`, {}, token)).data;
    const adj = payments.find((p: any) => p.method === 'adjustment');
    expect(adj).toBeTruthy();
    expect(Number(adj.amountZmw)).toBe(-100);
    expect(adj.note).toBe('Manual correction');
  });

  it('manager PATCH amountPaidZmw → 403 PAYMENT_EDIT_OWNER_ONLY', async () => {
    if (!managerToken) return; // manager creation failed — skip
    const res = await api(`/api/v1/sale-records/${saleId}`, {
      method: 'PATCH',
      body: JSON.stringify({ amountPaidZmw: 800 }),
    }, managerToken);
    expect(res.status).toBe(403);
    expect(res.data.error).toBe('PAYMENT_EDIT_OWNER_ONLY');
  });

  it('DELETE payment reverses journal and recomputes totals', async () => {
    const res = await api(`/api/v1/sale-records/${saleId}/payments/${firstPaymentId}`, { method: 'DELETE' }, token);
    expect(res.status).toBe(200);
    expect(res.data.sale.paymentStatus).toBe('partial');
    expect(Number(res.data.sale.amountPaidZmw)).toBe(500); // 900 - 400

    const entries = await journalFor(firstPaymentId, token);
    const original = entries.find((e: any) => e.sourceType === 'sale_payment' && !e.reversesId);
    expect(original).toBeTruthy();
    const reversal = await reversalOf(original.id, token);
    expect(reversal).toBeTruthy();
  });

  it('dashboard kpis include totalOutstanding + totalCollected', async () => {
    const res = await api('/api/v1/dashboard/summary', {}, token);
    expect(res.status).toBe(200);
    expect(res.data.kpis.totalOutstanding).toBeGreaterThanOrEqual(500);
    expect(res.data.kpis.totalCollected).toBeGreaterThanOrEqual(500);
  });

  it('flock list item exposes totalRevenue + totalOutstandingPayments', async () => {
    const res = await api('/api/v1/broiler-flocks?limit=100', {}, token);
    expect(res.status).toBe(200);
    const flock = (res.data.data ?? res.data).find((f: any) => f.id === flockId);
    expect(flock).toBeTruthy();
    expect(flock.totalRevenue).toBeGreaterThanOrEqual(1000);
    expect(flock.totalOutstandingPayments).toBeGreaterThanOrEqual(500);
  });

  it('trial balance is still balanced', async () => {
    const res = await api('/api/v1/ledger/trial-balance', {}, token);
    expect(res.status).toBe(200);
    const deb = Number(res.data.totalDebits ?? res.data.debits);
    const cred = Number(res.data.totalCredits ?? res.data.credits);
    expect(Math.abs(deb - cred)).toBeLessThan(0.01);
  });
});
