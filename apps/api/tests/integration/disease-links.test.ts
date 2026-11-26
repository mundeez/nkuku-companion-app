// Integration tests — Phase F: disease↔flock integration.
// Covers diseaseId on mortality/vaccination events, the
// /broiler-flocks/:id/disease-insights endpoint, disease_risk alert
// generation with cooldown, and platform-catalogue disease links on
// vaccination schedule items.
//
// Requires the isolated test stack (docker-compose.test.yml); the vitest
// globalSetup guard enforces that. All flocks are created fresh for these
// tests — existing seeded flocks are never touched.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_API_URL, TEST_DATABASE_URL } from '../helpers/env.js';
import { api, post, makeStaffWithToken } from '../helpers/staff.js';

const prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}
function today() {
  return new Date().toISOString().split('T')[0];
}

async function login() {
  const res = await fetch(`${TEST_API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@nkuku.local', password: 'change_me' }),
  });
  return (await res.json()).accessToken as string;
}

const get = (path: string, token?: string) => api(path, {}, token);
const patch = (path: string, body: any, token?: string) =>
  api(path, { method: 'PATCH', body: JSON.stringify(body) }, token);

describe('Phase F — disease↔flock links', () => {
  let token: string;
  let staffToken: string;
  let breedId: string;
  let gumboroId: string;
  let gumboroName: string;
  let flockId: string;          // ~21 days old, active
  let youngFlockId: string;     // no startDate (chicks not collected)
  let mortalityEventId: string;

  beforeAll(async () => {
    token = await login();
    staffToken = (await makeStaffWithToken(prisma, 'content_editor')).accessToken;

    const breeds = await (await get('/api/v1/breeds', token)).data;
    breedId = breeds.find((b: any) => b.name === 'Ross 308').id;

    const diseases = await (await get('/api/v1/diseases?search=Gumboro', token)).data;
    const gumboro = diseases.find((d: any) => d.name.includes('Bursal'));
    expect(gumboro).toBeDefined();
    gumboroId = gumboro.id;
    gumboroName = gumboro.name;

    // Flock aged ~21 days (collectionDate → startDate)
    const flock = await post('/api/v1/broiler-flocks', {
      name: `Disease Links Flock ${Date.now()}`,
      breedId,
      orderDate: daysAgo(25),
      initialCount: 200,
      chicksCollected: true,
      collectionDate: daysAgo(21),
    }, token);
    expect(flock.status).toBe(200);
    flockId = flock.data.id;

    // Flock without startDate
    const young = await post('/api/v1/broiler-flocks', {
      name: `Disease Links Uncollected ${Date.now()}`,
      breedId,
      orderDate: daysAgo(3),
      initialCount: 100,
      chicksCollected: false,
    }, token);
    expect(young.status).toBe(200);
    youngFlockId = young.data.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('mortality events — diseaseId', () => {
    it('POST with valid diseaseId returns disease summary', async () => {
      const res = await post('/api/v1/mortality-events', {
        flockId,
        eventDate: today(),
        count: 3,
        cause: 'gumboro outbreak in 3 week olds',
        diseaseId: gumboroId,
      }, token);
      expect(res.status).toBe(200);
      expect(res.data.disease).toBeDefined();
      expect(res.data.disease.id).toBe(gumboroId);
      expect(res.data.disease.name).toBe(gumboroName);
      mortalityEventId = res.data.id;
    });

    it('POST with malformed diseaseId → 400', async () => {
      const res = await post('/api/v1/mortality-events', {
        flockId,
        eventDate: today(),
        count: 1,
        diseaseId: 'not-a-uuid',
      }, token);
      expect(res.status).toBe(400);
    });

    it('POST with nonexistent diseaseId → 400 DISEASE_NOT_FOUND', async () => {
      const res = await post('/api/v1/mortality-events', {
        flockId,
        eventDate: today(),
        count: 1,
        diseaseId: '00000000-0000-0000-0000-000000000000',
      }, token);
      expect(res.status).toBe(400);
      expect(res.data.error).toBe('DISEASE_NOT_FOUND');
    });

    it('PATCH diseaseId:null clears the link', async () => {
      const res = await patch(`/api/v1/mortality-events/${mortalityEventId}`, { diseaseId: null }, token);
      expect(res.status).toBe(200);
      expect(res.data.diseaseId).toBeNull();
      expect(res.data.disease).toBeNull();
    });

    it('PATCH re-links a valid diseaseId', async () => {
      const res = await patch(`/api/v1/mortality-events/${mortalityEventId}`, { diseaseId: gumboroId }, token);
      expect(res.status).toBe(200);
      expect(res.data.disease?.id).toBe(gumboroId);
    });

    it('GET list includes disease summary', async () => {
      const res = await get(`/api/v1/mortality-events?flockId=${flockId}`, token);
      expect(res.status).toBe(200);
      const ev = res.data.find((e: any) => e.id === mortalityEventId);
      expect(ev.disease?.name).toBe(gumboroName);
    });

    it('/bulk passes diseaseId through', async () => {
      const res = await post('/api/v1/mortality-events/bulk', {
        action: 'create',
        records: [{
          flockId,
          eventDate: today(),
          count: 1,
          cause: 'secondary infection',
          diseaseId: gumboroId,
        }],
      }, token);
      expect(res.status).toBe(200);
      expect(res.data.records[0].disease?.id).toBe(gumboroId);
    });
  });

  describe('vaccination events — diseaseId', () => {
    it('POST with diseaseId returns disease summary; PATCH null clears', async () => {
      const res = await post('/api/v1/vaccination-events', {
        flockId,
        vaccineName: 'Test Gumboro Vaccine',
        adminDate: today(),
        adminMethod: 'Drinking Water',
        ageDays: 14,
        diseaseId: gumboroId,
      }, token);
      expect(res.status).toBe(200);
      expect(res.data.disease?.id).toBe(gumboroId);

      const patched = await patch(`/api/v1/vaccination-events/${res.data.id}`, { diseaseId: null }, token);
      expect(patched.status).toBe(200);
      expect(patched.data.disease).toBeNull();
    });
  });

  describe('GET /broiler-flocks/:id/disease-insights', () => {
    it('matches mortality causes and age-window watchlist', async () => {
      // null-cause event must not produce a match entry
      const nullCause = await post('/api/v1/mortality-events', {
        flockId,
        eventDate: today(),
        count: 1,
      }, token);
      const nullCauseId = nullCause.data.id;

      const res = await get(`/api/v1/broiler-flocks/${flockId}/disease-insights`, token);
      expect(res.status).toBe(200);
      // The null-cause event must not appear; the gumboro-cause event must.
      const matchIds = res.data.matches.map((m: any) => m.mortalityEventId);
      expect(matchIds).toContain(mortalityEventId);
      expect(matchIds).not.toContain(nullCauseId);
      const gumboroMatch = res.data.matches.find((m: any) => m.mortalityEventId === mortalityEventId);
      const suggestion = gumboroMatch.suggestions.find((s: any) => s.disease.name === gumboroName);
      expect(suggestion).toBeDefined();
      expect(suggestion.score).toBeGreaterThanOrEqual(3);

      // flock is ~21d old; Gumboro window 14–28 → on watchlist
      const watch = res.data.watchlist.find((w: any) => w.disease.name === gumboroName);
      expect(watch).toBeDefined();
      expect(watch.reason).toContain('21');
    });

    it('flock without startDate → empty watchlist', async () => {
      const res = await get(`/api/v1/broiler-flocks/${youngFlockId}/disease-insights`, token);
      expect(res.status).toBe(200);
      expect(res.data.watchlist).toEqual([]);
    });

    it('unknown flock → 404', async () => {
      const res = await get('/api/v1/broiler-flocks/00000000-0000-0000-0000-000000000000/disease-insights', token);
      expect(res.status).toBe(404);
    });
  });

  describe('alerts/generate — disease_risk', () => {
    const countRiskAlerts = async () =>
      prisma.alert.count({
        where: { flockId, alertType: 'disease_risk', diseaseId: gumboroId },
      });

    it('creates a disease_risk alert once, then cooldown suppresses dupes', async () => {
      const before = await countRiskAlerts();

      const gen1 = await post('/api/v1/alerts/generate', {}, token);
      expect(gen1.status).toBe(200);
      const created = gen1.data.alerts.filter((a: any) => a.alertType === 'disease_risk' && a.diseaseId === gumboroId && a.flockId === flockId);
      expect(created.length).toBe(1);
      expect(created[0].severity).toBe('warning');
      expect(created[0].title).toContain(gumboroName);
      expect(await countRiskAlerts()).toBe(before + 1);

      // Immediate second run → no duplicate
      await post('/api/v1/alerts/generate', {}, token);
      expect(await countRiskAlerts()).toBe(before + 1);

      // Resolve + rerun within 14d cooldown → still no duplicate
      const alertId = created[0].id;
      const resolved = await patch(`/api/v1/alerts/${alertId}`, { isResolved: true }, token);
      expect(resolved.status).toBe(200);
      await post('/api/v1/alerts/generate', {}, token);
      expect(await countRiskAlerts()).toBe(before + 1);
    }, 30000); // /generate scans every active flock in the org — slow on accumulated test DBs
  });

  describe('platform catalogue + schedule disease links', () => {
    it('PATCH vaccination-schedules item diseaseId round-trips', async () => {
      const list = await get('/api/v1/platform/catalogue/vaccination-schedules', staffToken);
      expect(list.status).toBe(200);
      const schedule = list.data.items.find((s: any) => s.items.length > 0);
      expect(schedule).toBeDefined();

      const items = schedule.items.map((it: any, idx: number) => ({
        vaccineName: it.vaccineName,
        vaccineType: it.vaccineType,
        ageDays: it.ageDays,
        adminMethod: it.adminMethod,
        sortOrder: it.sortOrder ?? idx,
        notes: it.notes ?? null,
        diseaseId: idx === 0 ? gumboroId : (it.diseaseId ?? null),
      }));

      const patched = await patch(
        `/api/v1/platform/catalogue/vaccination-schedules/${schedule.id}`,
        { items },
        staffToken,
      );
      expect(patched.status).toBe(200);
      const item0 = patched.data.item.items.find((i: any) => i.sortOrder === items[0].sortOrder)
        ?? patched.data.item.items[0];
      expect(item0.diseaseId).toBe(gumboroId);
    });

    it('GET /vaccination-events/schedule includes item disease name', async () => {
      const res = await get(`/api/v1/vaccination-events/schedule?flockId=${flockId}`, token);
      expect(res.status).toBe(200);
      expect(res.data.schedule).not.toBeNull();
      const withDisease = res.data.schedule.items.filter((i: any) => i.disease);
      expect(withDisease.length).toBeGreaterThan(0);
      expect(withDisease[0].disease.name).toBeTruthy();
    });
  });
});
