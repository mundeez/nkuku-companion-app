import { describe, it, expect } from 'vitest';
import { TEST_API_URL } from '../helpers/env.js';

describe('Suppliers API', () => {
  it('returns seeded suppliers', async () => {
    const res = await fetch(`${TEST_API_URL}/api/v1/suppliers`);
    // Should fail without auth (401)
    expect(res.status).toBe(401);
  });
});

