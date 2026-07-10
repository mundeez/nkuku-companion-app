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

describe('Lighting & Temperature Schedules', () => {
  let token: string;
  let breedId: string;
  let flockId: string;

  beforeAll(async () => {
    token = await login();

    const breeds = await fetch(`${API_URL}/api/v1/breeds`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    breedId = breeds.find((b: any) => b.name === 'Ross 308').id;

    const flock = await fetch(`${API_URL}/api/v1/broiler-flocks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Env Test Flock',
        breedId,
        startDate: '2026-06-01',
        initialCount: 500,
        housingType: 'whole_house',
      }),
    }).then((r) => r.json());
    flockId = flock.id;
  });

  it('lists seeded lighting and temperature schedules', async () => {
    const res = await fetch(`${API_URL}/api/v1/lighting-temperature-schedules`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(4);
    expect(data.some((s: any) => s.name === 'Ross 308 Whole House')).toBe(true);
    expect(data.some((s: any) => s.name === 'Generic Broiler Spot Brooding')).toBe(true);
  });

  it('returns current schedule item for a flock', async () => {
    const res = await fetch(`${API_URL}/api/v1/lighting-temperature-schedules/current?flockId=${flockId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.schedule).not.toBeNull();
    expect(data.item).not.toBeNull();
    expect(data.item.ageDays).toBeGreaterThanOrEqual(0);
    expect(data.item.lightHours).toBeDefined();
    expect(data.item.targetTempC).toBeDefined();
  });

  it('includes lighting/temperature data in flock summary', async () => {
    const res = await fetch(`${API_URL}/api/v1/broiler-flocks/${flockId}/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    const day0 = data.days.find((d: any) => d.day === 0);
    expect(day0).toBeDefined();
    expect(day0.lightingTemperature).not.toBeNull();
    expect(day0.lightingTemperature.lightHours).toBe('23');
    expect(day0.lightingTemperature.targetTempC).toBe('30');
  });
});
