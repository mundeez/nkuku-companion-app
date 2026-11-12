import { describe, it, expect, beforeAll } from 'vitest';

import { TEST_API_URL } from '../helpers/env.js';
const API_URL = TEST_API_URL;

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

async function getFlock(flockId: string, token: string) {
  const res = await api(`/api/v1/broiler-flocks/${flockId}`, token);
  return res.json();
}

describe('Chick additions (hatchery extras / purchased top-ups / corrections)', () => {
  let token: string;
  let flockId: string;

  beforeAll(async () => {
    token = await login();
    const breedsRes = await api('/api/v1/breeds', token);
    const breeds = await breedsRes.json();
    const breedId = breeds.find((b: any) => b.name === 'Ross 308').id;

    const flockRes = await api('/api/v1/broiler-flocks', token, {
      method: 'POST',
      body: JSON.stringify({
        name: `Chick Addition Test ${Date.now()}`,
        breedId,
        orderDate: '2026-11-01',
        initialCount: 100,
        chickPriceZmw: 17.5,
        chicksCollected: true,
        collectionDate: '2026-11-03',
      }),
    });
    const flock = await flockRes.json();
    flockId = flock.id;
    expect(flock.currentCount).toBe(100);
  });

  it('records free hatchery extras — counts up, no financial record', async () => {
    const res = await api(`/api/v1/broiler-flocks/${flockId}/chick-additions`, token, {
      method: 'POST',
      body: JSON.stringify({ count: 5, reason: 'hatchery_extra', additionDate: '2026-11-03', notes: 'hatchery bonus' }),
    });
    expect(res.status).toBe(200);
    const addition = await res.json();
    expect(addition.count).toBe(5);
    expect(addition.financialRecordId).toBeNull();

    const flock = await getFlock(flockId, token);
    expect(flock.initialCount).toBe(105);
    expect(flock.currentCount).toBe(105);
  });

  it('records purchased top-ups — counts up + chick_purchase finrec + journal', async () => {
    const res = await api(`/api/v1/broiler-flocks/${flockId}/chick-additions`, token, {
      method: 'POST',
      body: JSON.stringify({ count: 11, reason: 'purchase', additionDate: '2026-11-04', unitPriceZmw: 17.5 }),
    });
    expect(res.status).toBe(200);
    const addition = await res.json();
    expect(addition.financialRecordId).toBeTruthy();

    const flock = await getFlock(flockId, token);
    expect(flock.initialCount).toBe(116);
    expect(flock.currentCount).toBe(116);

    const finRes = await api(`/api/v1/financial-records?flockId=${flockId}`, token);
    const finrecs = await finRes.json();
    const chickFinrec = finrecs.find((r: any) => r.id === addition.financialRecordId);
    expect(chickFinrec).toBeDefined();
    expect(chickFinrec.category).toBe('chick_purchase');
    expect(Number(chickFinrec.amountZmw)).toBeCloseTo(192.5, 2);
    expect(chickFinrec.isIncome).toBe(false);

    // Journal auto-posted (Dr 1030 / Cr 1010) with sourceId = finrec id
    const jRes = await api(`/api/v1/journal?q=${encodeURIComponent('Additional chicks')}`, token);
    const journals = await jRes.json();
    const je = journals.find((j: any) => j.sourceId === addition.financialRecordId);
    expect(je).toBeDefined();
    const debit = je.lines.find((l: any) => Number(l.debitZmw) > 0);
    const credit = je.lines.find((l: any) => Number(l.creditZmw) > 0);
    expect(debit.account.code).toBe('1030');
    expect(credit.account.code).toBe('1010');
    expect(Number(debit.debitZmw)).toBeCloseTo(192.5, 2);
  });

  it('rejects purchased additions without a unit price', async () => {
    const res = await api(`/api/v1/broiler-flocks/${flockId}/chick-additions`, token, {
      method: 'POST',
      body: JSON.stringify({ count: 5, reason: 'purchase', additionDate: '2026-11-04' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('UNIT_PRICE_REQUIRED');
  });

  it('rejects negative counts for non-correction reasons', async () => {
    const res = await api(`/api/v1/broiler-flocks/${flockId}/chick-additions`, token, {
      method: 'POST',
      body: JSON.stringify({ count: -3, reason: 'hatchery_extra', additionDate: '2026-11-04' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_COUNT');
  });

  it('supports negative corrections — counts down, no cost', async () => {
    const res = await api(`/api/v1/broiler-flocks/${flockId}/chick-additions`, token, {
      method: 'POST',
      body: JSON.stringify({ count: -6, reason: 'correction', additionDate: '2026-11-05', notes: 'recount after grading' }),
    });
    expect(res.status).toBe(200);
    const flock = await getFlock(flockId, token);
    expect(flock.initialCount).toBe(110);
    expect(flock.currentCount).toBe(110);
  });

  it('rejects additions that would take counts below zero', async () => {
    const res = await api(`/api/v1/broiler-flocks/${flockId}/chick-additions`, token, {
      method: 'POST',
      body: JSON.stringify({ count: -999, reason: 'correction', additionDate: '2026-11-05' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('COUNT_UNDERFLOW');
  });

  it('lists additions for the flock', async () => {
    const res = await api(`/api/v1/broiler-flocks/${flockId}/chick-additions`, token);
    expect(res.status).toBe(200);
    const { items } = await res.json();
    expect(items.length).toBe(3);
    expect(items.map((i: any) => i.reason)).toEqual(['hatchery_extra', 'purchase', 'correction']);
  });

  it('PATCH ignores direct initialCount/currentCount writes (drift guard)', async () => {
    const res = await api(`/api/v1/broiler-flocks/${flockId}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ initialCount: 9999, currentCount: 9999 }),
    });
    expect(res.status).toBe(200);
    const flock = await getFlock(flockId, token);
    expect(flock.initialCount).toBe(110);
    expect(flock.currentCount).toBe(110);
  });

  it('deleting an addition reverses counts, removes finrec, reverses journal', async () => {
    // fresh purchase addition to delete cleanly
    const createRes = await api(`/api/v1/broiler-flocks/${flockId}/chick-additions`, token, {
      method: 'POST',
      body: JSON.stringify({ count: 10, reason: 'purchase', additionDate: '2026-11-06', unitPriceZmw: 20 }),
    });
    const addition = await createRes.json();
    let flock = await getFlock(flockId, token);
    expect(flock.initialCount).toBe(120);
    expect(flock.currentCount).toBe(120);

    const delRes = await api(`/api/v1/broiler-flocks/${flockId}/chick-additions/${addition.id}`, token, {
      method: 'DELETE',
    });
    expect(delRes.status).toBe(200);

    flock = await getFlock(flockId, token);
    expect(flock.initialCount).toBe(110);
    expect(flock.currentCount).toBe(110);

    // finrec gone
    const finRes = await api(`/api/v1/financial-records?flockId=${flockId}`, token);
    const finrecs = await finRes.json();
    expect(finrecs.find((r: any) => r.id === addition.financialRecordId)).toBeUndefined();

    // original journal reversed — find the original entry, then its reversal
    const jRes = await api(`/api/v1/journal?q=${encodeURIComponent('Additional chicks')}`, token);
    const journals = await jRes.json();
    const original = journals.find((j: any) => j.sourceId === addition.financialRecordId && !j.reversesId);
    expect(original).toBeDefined();
    const revRes = await api(`/api/v1/journal?q=${encodeURIComponent('REVERSAL of ' + original.entryNumber)}`, token);
    const reversals = await revRes.json();
    const reversal = reversals.find((j: any) => j.reversesId === original.id);
    expect(reversal).toBeDefined();
    // reversal flips the sides: Dr 1010 Cash back in / Cr 1030 Inventory out
    expect(reversal.lines.some((l: any) => Number(l.debitZmw) > 0 && l.account.code === '1010')).toBe(true);
    expect(reversal.lines.some((l: any) => Number(l.creditZmw) > 0 && l.account.code === '1030')).toBe(true);
  });

  it('returns 404 for additions on unknown flocks', async () => {
    const res = await api(`/api/v1/broiler-flocks/00000000-0000-0000-0000-000000000000/chick-additions`, token, {
      method: 'POST',
      body: JSON.stringify({ count: 1, reason: 'hatchery_extra', additionDate: '2026-11-05' }),
    });
    expect(res.status).toBe(404);
  });
});
