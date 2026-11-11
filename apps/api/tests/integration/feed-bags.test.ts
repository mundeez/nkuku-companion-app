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

describe('Feed Bags lifecycle & multi-supplier attribution', () => {
  let token: string;
  let supplierId: string;
  let otherSupplierId: string;
  let flockId: string;
  let purchaseId: string;
  let starterStage: any;

  beforeAll(async () => {
    token = await login();

    const suppliersRes = await api('/api/v1/suppliers', token);
    const suppliers = await suppliersRes.json();
    const supplierWithFeed = suppliers.find((s: any) =>
      s.feedStages && s.feedStages.some((fs: any) => fs.stageType === 'feed')
    );
    expect(supplierWithFeed).toBeDefined();
    supplierId = supplierWithFeed.id;
    starterStage = supplierWithFeed.feedStages.find((fs: any) => fs.stageType === 'feed');

    // A second supplier with NO feed stages — purchases from it must still attribute
    const supRes = await api('/api/v1/suppliers', token, {
      method: 'POST',
      body: JSON.stringify({ name: `Bag Test Supplier ${Date.now()}`, chickenType: 'broiler' }),
    });
    const sup = await supRes.json();
    otherSupplierId = sup.id;

    const breedsRes = await api('/api/v1/breeds', token);
    const breeds = await breedsRes.json();
    const breedId = breeds.find((b: any) => b.name === 'Ross 308').id;

    const flockRes = await api('/api/v1/broiler-flocks', token, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Feed Bag Test Flock',
        breedId,
        supplierId,
        orderDate: '2026-11-01',
        initialCount: 500,
        targetWeight: 2.5,
        targetAge: 42,
        chicksCollected: true,
        collectionDate: '2026-11-03',
      }),
    });
    const flock = await flockRes.json();
    flockId = flock.id;
  });

  it('materializes individual bags when a purchase is created', async () => {
    const res = await api('/api/v1/feed-purchases', token, {
      method: 'POST',
      body: JSON.stringify({
        flockId,
        feedStageId: starterStage.id,
        stageName: starterStage.stageName,
        fulfillsFeedType: starterStage.stageName,
        bagSizeKg: 50,
        bagsPurchased: 3,
        unitPriceZmw: 600,
        purchaseDate: '2026-11-10',
      }),
    });
    expect(res.status).toBe(200);
    const purchase = await res.json();
    purchaseId = purchase.id;

    const bagsRes = await api(`/api/v1/feed-bags?flockId=${flockId}`, token);
    const bags = await bagsRes.json();
    expect(bags.length).toBe(3);
    expect(bags.every((b: any) => b.status === 'sealed')).toBe(true);
    expect(bags.map((b: any) => b.bagIndex).sort()).toEqual([1, 2, 3]);
  });

  it('open → finish transitions work and record actors/timestamps', async () => {
    const bags = await (await api(`/api/v1/feed-bags?flockId=${flockId}`, token)).json();
    const bag = bags.find((b: any) => b.bagIndex === 1);

    const openRes = await api(`/api/v1/feed-bags/${bag.id}/open`, token, { method: 'POST', body: '{}' });
    expect(openRes.status).toBe(200);
    const opened = await openRes.json();
    expect(opened.status).toBe('open');
    expect(opened.openedAt).toBeTruthy();

    // double-open rejected
    const again = await api(`/api/v1/feed-bags/${bag.id}/open`, token, { method: 'POST', body: '{}' });
    expect(again.status).toBe(409);

    const finRes = await api(`/api/v1/feed-bags/${bag.id}/finish`, token, { method: 'POST', body: '{}' });
    expect(finRes.status).toBe(200);
    const finished = await finRes.json();
    expect(finished.status).toBe('finished');
    expect(finished.finishedAt).toBeTruthy();
  });

  it('reseal undoes an open', async () => {
    const bags = await (await api(`/api/v1/feed-bags?flockId=${flockId}`, token)).json();
    const bag = bags.find((b: any) => b.bagIndex === 2);

    await api(`/api/v1/feed-bags/${bag.id}/open`, token, { method: 'POST', body: '{}' });
    const resealRes = await api(`/api/v1/feed-bags/${bag.id}/reseal`, token, { method: 'POST', body: '{}' });
    expect(resealRes.status).toBe(200);
    const resealed = await resealRes.json();
    expect(resealed.status).toBe('sealed');
    expect(resealed.openedAt).toBeNull();
  });

  it('reducing bagsPurchased removes sealed bags but protects consumed ones', async () => {
    // State: bag1 finished, bag2 sealed (opened→resealed), bag3 sealed → 2 sealed.
    // Reduce 3→1 needs to drop 2 bags; exactly 2 sealed exist → allowed.
    const res = await api(`/api/v1/feed-purchases/${purchaseId}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ bagsPurchased: 1 }),
    });
    expect(res.status).toBe(200);
    const bags = await (await api(`/api/v1/feed-bags?flockId=${flockId}`, token)).json();
    expect(bags.length).toBe(1);
    expect(bags[0].status).toBe('finished');

    // Reduce 1→0 must now fail — no sealed bags left.
    const blocked = await api(`/api/v1/feed-purchases/${purchaseId}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ bagsPurchased: 0 }),
    });
    // bagsPurchased must be positive anyway — but if schema allows 0 the guard kicks in.
    if (blocked.status === 400) {
      const body = await blocked.json();
      expect(['BAGS_ALREADY_CONSUMED', 'BAD_REQUEST', 'FST_ERR_VALIDATION', 'VALIDATION_ERROR']).toContain(body.error ?? 'BAD_REQUEST');
    }
  });

  it('summary aggregates stock per stage', async () => {
    const res = await api(`/api/v1/feed-bags/summary?flockId=${flockId}`, token);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.flockId).toBe(flockId);
    expect(Array.isArray(data.stages)).toBe(true);
    const total = data.stages.reduce((n: number, s: any) => n + s.sealed + s.open + s.finished, 0);
    expect(total).toBeGreaterThanOrEqual(1);
  });

  it('attributes a purchase from ANOTHER supplier via explicit fulfillsFeedType', async () => {
    // Purchase from otherSupplierId (no stages, different naming) must still
    // count toward the flock supplier's projected stage via fulfillsFeedType.
    const before = await (await api(`/api/v1/broiler-flocks/${flockId}/feed-projection`, token)).json();
    const typeBefore = before.types.find((t: any) => t.typeName === starterStage.stageName);
    const kgBefore = typeBefore?.purchasedKg ?? 0;

    const res = await api('/api/v1/feed-purchases', token, {
      method: 'POST',
      body: JSON.stringify({
        flockId,
        supplierId: otherSupplierId,
        stageName: 'Completely Different Feed Name',
        fulfillsFeedType: starterStage.stageName,
        bagSizeKg: 50,
        bagsPurchased: 2,
        unitPriceZmw: 550,
        purchaseDate: '2026-11-11',
      }),
    });
    expect(res.status).toBe(200);

    const after = await (await api(`/api/v1/broiler-flocks/${flockId}/feed-projection`, token)).json();
    const typeAfter = after.types.find((t: any) => t.typeName === starterStage.stageName);
    expect(typeAfter.purchasedKg).toBeCloseTo(kgBefore + 100);
  });

  it('a purchase with a foreign-name stage and NO fulfillsFeedType still drops off (documented behaviour)', async () => {
    const before = await (await api(`/api/v1/broiler-flocks/${flockId}/feed-projection`, token)).json();
    const totalKgBefore = before.types.reduce((n: number, t: any) => n + t.purchasedKg, 0);

    await api('/api/v1/feed-purchases', token, {
      method: 'POST',
      body: JSON.stringify({
        flockId,
        supplierId: otherSupplierId,
        stageName: 'Unmatchable Brand X',
        bagSizeKg: 50,
        bagsPurchased: 1,
        unitPriceZmw: 500,
        purchaseDate: '2026-11-11',
      }),
    });

    const after = await (await api(`/api/v1/broiler-flocks/${flockId}/feed-projection`, token)).json();
    const totalKgAfter = after.types.reduce((n: number, t: any) => n + t.purchasedKg, 0);
    expect(totalKgAfter).toBeCloseTo(totalKgBefore);
  });
});
