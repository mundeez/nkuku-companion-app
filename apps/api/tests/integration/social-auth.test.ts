import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';

const API_URL = 'http://localhost:3001';

// These tests focus on the parts of the social auth flow that don't require
// real OAuth provider credentials:
// 1. The social config endpoint (which providers are configured)
// 2. The complete-signup flow (using a manually crafted temp token)
// 3. Validation errors
//
// The actual OAuth token verification (Google, Facebook, Apple, Microsoft)
// requires real provider credentials and is tested manually / in staging.

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';

async function socialLogin(body: any) {
  const res = await fetch(`${API_URL}/api/v1/auth/social/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function socialCompleteSignup(body: any) {
  const res = await fetch(`${API_URL}/api/v1/auth/social/complete-signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function socialCallback(body: any) {
  const res = await fetch(`${API_URL}/api/v1/auth/social/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

describe('Social Authentication', () => {
  describe('GET /social/config', () => {
    it('returns all four providers with configured status', async () => {
      const res = await fetch(`${API_URL}/api/v1/auth/social/config`);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.providers).toHaveLength(4);
      const providerNames = data.providers.map((p: any) => p.provider);
      expect(providerNames).toContain('google');
      expect(providerNames).toContain('facebook');
      expect(providerNames).toContain('apple');
      expect(providerNames).toContain('microsoft');
      // Each provider should have a configured boolean
      data.providers.forEach((p: any) => {
        expect(typeof p.configured).toBe('boolean');
      });
    });
  });

  describe('POST /social/login', () => {
    it('rejects missing token and code', async () => {
      const { status, data } = await socialLogin({
        provider: 'google',
      });
      expect(status).toBe(400);
      expect(data.error).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid provider', async () => {
      const { status, data } = await socialLogin({
        provider: 'twitter',
        token: 'fake-token',
      });
      expect(status).toBe(400);
      expect(data.error).toBe('VALIDATION_ERROR');
    });

    it('rejects unconfigured provider with token verification error', async () => {
      // No OAuth credentials are configured in the test env, so token
      // verification will fail. This tests that the error is handled gracefully.
      const { status, data } = await socialLogin({
        provider: 'google',
        token: 'fake-id-token',
      });
      expect(status).toBe(401);
      expect(data.error).toBe('TOKEN_VERIFICATION_FAILED');
    });
  });

  describe('POST /social/callback', () => {
    it('rejects missing code', async () => {
      const { status, data } = await socialCallback({
        provider: 'google',
        state: 'some-state',
        redirectUri: 'http://localhost:30000/login',
      });
      expect(status).toBe(400);
      expect(data.error).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid redirect URI', async () => {
      const { status, data } = await socialCallback({
        provider: 'google',
        code: 'some-code',
        state: 'some-state',
        redirectUri: 'not-a-url',
      });
      expect(status).toBe(400);
      expect(data.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /social/complete-signup', () => {
    it('rejects invalid temp token', async () => {
      const { status, data } = await socialCompleteSignup({
        tempToken: 'invalid-token',
        organizationName: 'Test Farm',
        country: 'ZM',
        currency: 'ZMW',
        consent: true,
      });
      expect(status).toBe(401);
      expect(data.error).toBe('INVALID_OR_EXPIRED_TEMP_TOKEN');
    });

    it('rejects missing consent', async () => {
      // Create a valid temp token
      const tempToken = jwt.sign(
        {
          socialProvider: 'google',
          providerUserId: 'test-google-id-' + Date.now(),
          email: `test-${Date.now()}@example.com`,
          name: 'Test User',
          action: 'complete_signup',
        },
        JWT_SECRET,
        { expiresIn: '30m' },
      );
      const { status, data } = await socialCompleteSignup({
        tempToken,
        organizationName: 'Test Farm',
        country: 'ZM',
        currency: 'ZMW',
        consent: false as any,
      });
      expect(status).toBe(400);
      expect(data.error).toBe('VALIDATION_ERROR');
    });

    it('creates account and org with valid temp token', async () => {
      const uniqueId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const tempToken = jwt.sign(
        {
          socialProvider: 'google',
          providerUserId: `google-${uniqueId}`,
          email: `${uniqueId}@example.com`,
          name: 'Social Test User',
          action: 'complete_signup',
        },
        JWT_SECRET,
        { expiresIn: '30m' },
      );
      const { status, data } = await socialCompleteSignup({
        tempToken,
        organizationName: `Test Farm ${uniqueId}`,
        country: 'ZM',
        currency: 'ZMW',
        consent: true,
      });
      expect(status).toBe(201);
      expect(data.accessToken).toBeDefined();
      expect(data.refreshToken).toBeDefined();
      expect(data.user.email).toBe(`${uniqueId}@example.com`);
      expect(data.user.name).toBe('Social Test User');
      expect(data.user.role).toBe('owner');
      expect(data.organization).toBeDefined();
      expect(data.organization.name).toBe(`Test Farm ${uniqueId}`);
    });

    it('logs in existing social user (idempotent complete-signup)', async () => {
      // First signup
      const uniqueId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const tempToken = jwt.sign(
        {
          socialProvider: 'google',
          providerUserId: `google-${uniqueId}`,
          email: `${uniqueId}@example.com`,
          name: 'Social Test User 2',
          action: 'complete_signup',
        },
        JWT_SECRET,
        { expiresIn: '30m' },
      );
      const { status: s1 } = await socialCompleteSignup({
        tempToken,
        organizationName: `Test Farm ${uniqueId}`,
        country: 'ZM',
        currency: 'ZMW',
        consent: true,
      });
      expect(s1).toBe(201);

      // Second call with same temp token should log in (not create duplicate)
      const { status: s2, data: d2 } = await socialCompleteSignup({
        tempToken,
        organizationName: `Test Farm ${uniqueId}`,
        country: 'ZM',
        currency: 'ZMW',
        consent: true,
      });
      expect(s2).toBe(200);
      expect(d2.accessToken).toBeDefined();
      expect(d2.user.email).toBe(`${uniqueId}@example.com`);
    });
  });
});
