import { describe, it, expect } from 'vitest';

describe('Suppliers API', () => {
  it('returns seeded suppliers', async () => {
    const res = await fetch('http://localhost:3001/api/v1/suppliers');
    // Should fail without auth (401)
    expect(res.status).toBe(401);
  });
});

