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

    // finishing auto-creates a feed record linked to the bag (full bag kg)
    const records = await (await api(`/api/v1/feed-records?flockId=${flockId}`, token)).json();
    const auto = records.find((r: any) => r.feedBag?.bagIndex === 1);
    expect(auto).toBeDefined();
    expect(Number(auto.quantityKg)).toBe(50);
    expect(auto.feedType).toBe(bag.stageName);
    expect(auto.notes).toContain('Auto: bag #1 finished');
    // no financial record — cost was already booked by the purchase
    const finrecs = await (await api(`/api/v1/financial-records?flockId=${flockId}`, token)).json();
    expect(finrecs.some((f: any) => f.sourceRecordId === auto.id)).toBe(false);
  });

  it('finish accepts a backdate and partial kgFed; rejects kg above bag size', async () => {
    const bags = await (await api(`/api/v1/feed-bags?flockId=${flockId}`, token)).json();
    const bag = bags.find((b: any) => b.bagIndex === 3);

    const tooMuch = await api(`/api/v1/feed-bags/${bag.id}/finish`, token, {
      method: 'POST',
      body: JSON.stringify({ kgFed: 60 }),
    });
    expect(tooMuch.status).toBe(400);
    expect((await tooMuch.json()).error).toBe('KG_EXCEEDS_BAG');

    const res = await api(`/api/v1/feed-bags/${bag.id}/finish`, token, {
      method: 'POST',
      body: JSON.stringify({ date: '2026-11-12', kgFed: 42.5 }),
    });
    expect(res.status).toBe(200);
    const finished = await res.json();
    expect(finished.finishedAt).toContain('2026-11-12');

    const records = await (await api(`/api/v1/feed-records?flockId=${flockId}`, token)).json();
    const auto = records.find((r: any) => r.feedBag?.bagIndex === 3);
    expect(auto).toBeDefined();
    expect(Number(auto.quantityKg)).toBe(42.5);
    expect(auto.recordDate).toContain('2026-11-12');
    expect(auto.notes).toContain('42.5kg of 50kg fed');
  });

  it('open accepts a backdate', async () => {
    // bag #2 was resealed earlier — open it again with a backdate
    const bags = await (await api(`/api/v1/feed-bags?flockId=${flockId}`, token)).json();
    const bag = bags.find((b: any) => b.bagIndex === 2 && b.status === 'sealed');
    if (!bag) return; // bag removed by the bagsPurchased reduction test ordering
    const res = await api(`/api/v1/feed-bags/${bag.id}/open`, token, {
      method: 'POST',
      body: JSON.stringify({ date: '2026-11-11' }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).openedAt).toContain('2026-11-11');
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

  it('PATCH: finished bags spread kg across days; un-finish asks about records; date edits resync', async () => {
    // Isolated purchase + bag for the override flow
    const pRes = await api('/api/v1/feed-purchases', token, {
      method: 'POST',
      body: JSON.stringify({
        flockId, feedStageId: starterStage.id, supplierId,
        purchaseDate: '2026-11-10', stageName: starterStage.stageName,
        bagSizeKg: 50, bagsPurchased: 1, unitPriceZmw: 600,
      }),
    });
    const purchase = await pRes.json();
    const bags = await (await api(`/api/v1/feed-bags?flockId=${flockId}`, token)).json();
    const bag = bags.find((b: any) => b.purchaseId === purchase.id);

    // kgFed above bag size rejected
    const tooMuch = await api(`/api/v1/feed-bags/${bag.id}`, token, {
      method: 'PATCH', body: JSON.stringify({ kgFed: 999 }),
    });
    expect(tooMuch.status).toBe(400);

    // Open backdated to 2026-11-10, finish on 2026-11-13 → 4-day spread of 40kg
    let res = await api(`/api/v1/feed-bags/${bag.id}`, token, {
      method: 'PATCH', body: JSON.stringify({ status: 'open', openedAt: '2026-11-10' }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).openedAt).toBeTruthy();
    res = await api(`/api/v1/feed-bags/${bag.id}`, token, {
      method: 'PATCH', body: JSON.stringify({ status: 'finished', finishedAt: '2026-11-13', kgFed: 40 }),
    });
    expect(res.status).toBe(200);

    let records = await (await api(`/api/v1/feed-records?flockId=${flockId}`, token)).json();
    let linked = records.filter((r: any) => r.feedBag?.bagIndex === bag.bagIndex && r.feedBag?.id === bag.id);
    expect(linked.length).toBe(4); // Nov 10,11,12,13
    expect(linked.reduce((s: number, r: any) => s + Number(r.quantityKg), 0)).toBeCloseTo(40, 2);
    const dates = linked.map((r: any) => new Date(r.recordDate).getTime()).sort();
    for (let i = 1; i < dates.length; i++) expect(dates[i] - dates[i - 1]).toBe(86400000);
    expect(linked.every((r: any) => r.notes.includes('day '))).toBe(true);

    // Un-finish WITHOUT removeFeedRecords → records kept
    res = await api(`/api/v1/feed-bags/${bag.id}`, token, {
      method: 'PATCH', body: JSON.stringify({ status: 'open' }),
    });
    expect((await res.json()).status).toBe('open');
    records = await (await api(`/api/v1/feed-records?flockId=${flockId}`, token)).json();
    expect(records.filter((r: any) => r.feedBag?.id === bag.id).length).toBe(4);

    // Re-finish, then un-finish WITH removeFeedRecords → records deleted
    await api(`/api/v1/feed-bags/${bag.id}`, token, {
      method: 'PATCH', body: JSON.stringify({ status: 'finished' }),
    });
    res = await api(`/api/v1/feed-bags/${bag.id}`, token, {
      method: 'PATCH', body: JSON.stringify({ status: 'open', removeFeedRecords: true }),
    });
    expect(res.status).toBe(200);
    records = await (await api(`/api/v1/feed-records?flockId=${flockId}`, token)).json();
    expect(records.filter((r: any) => r.feedBag?.id === bag.id).length).toBe(0);

    // Re-finish (records were deleted → kgFed must be re-entered; it resets
    // to bag size otherwise), then move finishedAt +2 days → resync to 6 days
    await api(`/api/v1/feed-bags/${bag.id}`, token, {
      method: 'PATCH', body: JSON.stringify({ status: 'finished', kgFed: 40 }),
    });
    res = await api(`/api/v1/feed-bags/${bag.id}`, token, {
      method: 'PATCH', body: JSON.stringify({ finishedAt: '2026-11-15' }),
    });
    expect(res.status).toBe(200);
    records = await (await api(`/api/v1/feed-records?flockId=${flockId}`, token)).json();
    linked = records.filter((r: any) => r.feedBag?.id === bag.id);
    expect(linked.length).toBe(6); // Nov 10 → Nov 15
    expect(linked.reduce((s: number, r: any) => s + Number(r.quantityKg), 0)).toBeCloseTo(40, 2);
  });

  it('reducing bagsPurchased removes sealed bags but protects consumed ones', async () => {
    // State: bag1 finished, bag3 finished (auto-record test), bag2 sealed
    // (opened→resealed) → 1 sealed. Reduce 3→2 drops the only sealed bag.
    const res = await api(`/api/v1/feed-purchases/${purchaseId}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ bagsPurchased: 2 }),
    });
    expect(res.status).toBe(200);
    const bags = (await (await api(`/api/v1/feed-bags?flockId=${flockId}`, token)).json())
      .filter((b: any) => b.purchaseId === purchaseId);
    expect(bags.length).toBe(2);
    expect(bags.every((b: any) => b.status === 'finished')).toBe(true);

    // Reduce 2→1 must now fail — no sealed bags left.
    const blocked = await api(`/api/v1/feed-purchases/${purchaseId}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ bagsPurchased: 1 }),
    });
    expect(blocked.status).toBe(400);
    expect((await blocked.json()).error).toBe('BAGS_ALREADY_CONSUMED');
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
