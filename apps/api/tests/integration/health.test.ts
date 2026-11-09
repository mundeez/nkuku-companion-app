import { describe, it, expect } from 'vitest';
import { TEST_API_URL } from '../helpers/env.js';

describe('Health check', () => {
  it('returns OK', async () => {
    const res = await fetch(`${TEST_API_URL}/health`);
    const json = await res.json();
    expect(json.status).toBe('ok');
  });
});

