import { describe, it, expect } from 'vitest';

describe('Health check', () => {
  it('returns OK', async () => {
    const res = await fetch('http://localhost:3001/health');
    const json = await res.json();
    expect(json.status).toBe('ok');
  });
});

