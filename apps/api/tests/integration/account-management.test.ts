import { describe, it, expect, beforeAll } from 'vitest';
import _jwt from 'jsonwebtoken';

const API_URL = 'http://localhost:3001';

const _JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';

// Helper: register a new user and return auth tokens
async function registerUser(suffix: string) {
  const email = `account-test-${suffix}@example.com`;
  const res = await fetch(`${API_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'TestPass123!',
      name: `Test User ${suffix}`,
      organizationName: `Test Farm ${suffix}`,
      country: 'ZM',
      currency: 'ZMW',
      consent: true,
    }),
  });
  const data = await res.json();
  return { ...data, email };
}

async function authedRequest(path: string, options: any = {}, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  return { status: res.status, data: await res.json() };
}

describe('Account Management', () => {
  let token: string;
  let userId: string;
  let userEmail: string;
  let _phoneOnlyToken: string;
  let _phoneOnlyUserId: string;

  beforeAll(async () => {
    const reg = await registerUser(`acct-${Date.now()}`);
    token = reg.accessToken;
    userId = reg.user.id;
    userEmail = reg.email;
  });

  describe('GET /me', () => {
    it('returns current user profile with social accounts', async () => {
      const { status, data } = await authedRequest('/api/v1/account/me', {}, token);
      expect(status).toBe(200);
      expect(data.id).toBe(userId);
      expect(data.email).toBe(userEmail);
      expect(data.emailVerified).toBe(false); // not verified yet
      expect(data.socialAccounts).toEqual([]);
    });

    it('rejects unauthenticated requests', async () => {
      const { status } = await authedRequest('/api/v1/account/me');
      expect(status).toBe(401);
    });
  });

  describe('PATCH /me', () => {
    it('updates the user name', async () => {
      const { status, data } = await authedRequest(
        '/api/v1/account/me',
        { method: 'PATCH', body: JSON.stringify({ name: 'Updated Name' }) },
        token,
      );
      expect(status).toBe(200);
      expect(data.name).toBe('Updated Name');
    });
  });

  describe('POST /me/email/verify', () => {
    it('sends a verification email and returns dev token in dev mode', async () => {
      const { status, data } = await authedRequest(
        '/api/v1/account/me/email/verify',
        { method: 'POST', body: '{}' },
        token,
      );
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      // In dev mode (EMAIL_DISABLED=true), devToken is returned
      expect(data.devToken).toBeDefined();
    });

    it('verifies email with valid token', async () => {
      // Use a fresh user to avoid rate limit from previous test
      const freshReg = await registerUser(`verify-${Date.now()}`);
      const { data: sendResult } = await authedRequest(
        '/api/v1/account/me/email/verify',
        { method: 'POST', body: '{}' },
        freshReg.accessToken,
      );
      const devToken = sendResult.devToken;
      expect(devToken).toBeDefined();

      // Verify using the token via GET endpoint
      const res = await fetch(`${API_URL}/api/v1/account/me/email/verify?token=${devToken}`);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('verified');

      // Confirm email is now verified
      const { data: profile } = await authedRequest('/api/v1/account/me', {}, freshReg.accessToken);
      expect(profile.emailVerified).toBe(true);
    });

    it('rejects invalid verification token', async () => {
      const res = await fetch(`${API_URL}/api/v1/account/me/email/verify?token=invalid-token`);
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe('INVALID_OR_EXPIRED_TOKEN');
    });
  });

  describe('POST /me/password', () => {
    it('changes password with correct current password', async () => {
      const { status, data } = await authedRequest(
        '/api/v1/account/me/password',
        {
          method: 'POST',
          body: JSON.stringify({
            currentPassword: 'TestPass123!',
            newPassword: 'NewPass456!',
          }),
        },
        token,
      );
      expect(status).toBe(200);
      expect(data.success).toBe(true);

      // Verify can login with new password
      const loginRes = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, password: 'NewPass456!' }),
      });
      expect(loginRes.status).toBe(200);
      const loginData = await loginRes.json();
      expect(loginData.accessToken).toBeDefined();
    });

    it('rejects wrong current password', async () => {
      const { status, data } = await authedRequest(
        '/api/v1/account/me/password',
        {
          method: 'POST',
          body: JSON.stringify({
            currentPassword: 'wrong-password',
            newPassword: 'AnotherPass789!',
          }),
        },
        token,
      );
      expect(status).toBe(401);
      expect(data.error).toBe('INVALID_PASSWORD');
    });

    it('rejects short new password', async () => {
      const { status } = await authedRequest(
        '/api/v1/account/me/password',
        {
          method: 'POST',
          body: JSON.stringify({
            currentPassword: 'NewPass456!',
            newPassword: 'short',
          }),
        },
        token,
      );
      expect(status).toBe(400);
    });
  });

  describe('POST /password/reset', () => {
    it('sends reset email for existing user (dev mode returns devToken)', async () => {
      const { status, data } = await authedRequest(
        '/api/v1/account/password/reset',
        {
          method: 'POST',
          body: JSON.stringify({ email: userEmail }),
        },
      );
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.devToken).toBeDefined();
    });

    it('returns success even for non-existent email (no user enumeration)', async () => {
      const { status, data } = await authedRequest(
        '/api/v1/account/password/reset',
        {
          method: 'POST',
          body: JSON.stringify({ email: 'nonexistent@example.com' }),
        },
      );
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.devToken).toBeUndefined(); // no token for non-existent user
    });
  });

  describe('POST /password/reset/confirm', () => {
    it('resets password with valid token', async () => {
      // Use a fresh user to avoid rate limit
      const freshReg = await registerUser(`reset-${Date.now()}`);

      // Request reset
      const { data: resetData } = await authedRequest(
        '/api/v1/account/password/reset',
        {
          method: 'POST',
          body: JSON.stringify({ email: freshReg.email }),
        },
      );
      const resetToken = resetData.devToken;
      expect(resetToken).toBeDefined();

      // Confirm reset
      const { status, data } = await authedRequest(
        '/api/v1/account/password/reset/confirm',
        {
          method: 'POST',
          body: JSON.stringify({
            token: resetToken,
            newPassword: 'ResetPass123!',
          }),
        },
      );
      expect(status).toBe(200);
      expect(data.success).toBe(true);

      // Verify can login with new password
      const loginRes = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: freshReg.email, password: 'ResetPass123!' }),
      });
      expect(loginRes.status).toBe(200);
    });

    it('rejects invalid reset token', async () => {
      const { status, data } = await authedRequest(
        '/api/v1/account/password/reset/confirm',
        {
          method: 'POST',
          body: JSON.stringify({
            token: 'invalid-token',
            newPassword: 'SomePass123!',
          }),
        },
      );
      expect(status).toBe(400);
      expect(data.error).toBe('INVALID_OR_EXPIRED_TOKEN');
    });
  });

  describe('POST /me/phone + POST /me/phone/verify', () => {
    it('initiates phone linking and verifies OTP', async () => {
      const phone = `26097${Date.now().toString().slice(-6)}`;

      // Step 1: initiate
      const { status: s1, data: d1 } = await authedRequest(
        '/api/v1/account/me/phone',
        { method: 'POST', body: JSON.stringify({ phone }) },
        token,
      );
      expect(s1).toBe(200);
      expect(d1.success).toBe(true);
      expect(d1.maskedPhone).toBeDefined();

      // Get the OTP from the dev endpoint
      const devRes = await fetch(`${API_URL}/api/v1/auth/dev/last-otp?phone=${phone}`);
      const devData = await devRes.json();
      expect(devData.code).toBeDefined();

      // Step 2: verify
      const { status: s2, data: d2 } = await authedRequest(
        '/api/v1/account/me/phone/verify',
        { method: 'POST', body: JSON.stringify({ phone, otp: devData.code }) },
        token,
      );
      expect(s2).toBe(200);
      expect(d2.success).toBe(true);

      // Confirm phone is linked
      const { data: profile } = await authedRequest('/api/v1/account/me', {}, token);
      expect(profile.phone).toBeDefined();
      expect(profile.phoneVerified).toBe(true);
    });

    it('rejects phone already linked to another user', async () => {
      // Register another user first
      const other = await registerUser(`other-${Date.now()}`);

      // Link a phone to the other user
      const phone = `26096${Date.now().toString().slice(-6)}`;
      await authedRequest(
        '/api/v1/account/me/phone',
        { method: 'POST', body: JSON.stringify({ phone }) },
        other.accessToken,
      );
      const devRes = await fetch(`${API_URL}/api/v1/auth/dev/last-otp?phone=${phone}`);
      const devData = await devRes.json();
      await authedRequest(
        '/api/v1/account/me/phone/verify',
        { method: 'POST', body: JSON.stringify({ phone, otp: devData.code }) },
        other.accessToken,
      );

      // Now try to link the same phone to our original user
      const { status, data } = await authedRequest(
        '/api/v1/account/me/phone',
        { method: 'POST', body: JSON.stringify({ phone }) },
        token,
      );
      expect(status).toBe(409);
      expect(data.error).toBe('PHONE_ALREADY_REGISTERED');
    });
  });

  describe('DELETE /me/phone', () => {
    it('unlinks the phone number', async () => {
      const { status, data } = await authedRequest(
        '/api/v1/account/me/phone',
        { method: 'DELETE' },
        token,
      );
      expect(status).toBe(200);
      expect(data.success).toBe(true);

      const { data: profile } = await authedRequest('/api/v1/account/me', {}, token);
      expect(profile.phone).toBeNull();
      expect(profile.phoneVerified).toBe(false);
    });
  });

  describe('GET /me/social', () => {
    it('returns empty list when no social accounts linked', async () => {
      const { status, data } = await authedRequest('/api/v1/account/me/social', {}, token);
      expect(status).toBe(200);
      expect(data).toEqual([]);
    });
  });

  describe('DELETE /me/social/:provider', () => {
    it('returns 404 for unlinked provider', async () => {
      const { status, data } = await authedRequest(
        '/api/v1/account/me/social/google',
        { method: 'DELETE' },
        token,
      );
      expect(status).toBe(404);
      expect(data.error).toBe('NOT_FOUND');
    });

    it('rejects invalid provider name', async () => {
      const { status } = await authedRequest(
        '/api/v1/account/me/social/twitter',
        { method: 'DELETE' },
        token,
      );
      expect(status).toBe(400);
    });
  });
});
