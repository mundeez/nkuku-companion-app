import { describe, it, expect } from 'vitest';

const API_URL = 'http://localhost:3001';

/**
 * Retrieve the most recent OTP code for a phone number via the dev-only
 * endpoint. This endpoint is only available when SMS_DISABLED=true.
 */
async function getLatestOtp(phone: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/v1/auth/dev/last-otp?phone=${phone}`);
  if (!res.ok) {
    throw new Error(`Failed to get OTP for ${phone}: ${res.status}`);
  }
  const data = await res.json();
  if (!data.code) {
    throw new Error(`No OTP code in response for ${phone}`);
  }
  return data.code;
}

async function sendOtp(phone: string, purpose: string) {
  const res = await fetch(`${API_URL}/api/v1/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, purpose }),
  });
  return { status: res.status, data: await res.json() };
}

async function verifyOtp(phone: string, otp: string, purpose: string, signupData?: any) {
  const res = await fetch(`${API_URL}/api/v1/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp, purpose, signupData }),
  });
  return { status: res.status, data: await res.json() };
}

async function login(body: any) {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

describe('OTP Authentication', () => {
  // Use unique phone numbers per test run to avoid collisions
  const testPhone = `26097${Date.now().toString().slice(-6)}`;
  const testPhone2 = `26097${(Date.now() + 1).toString().slice(-6)}`;

  describe('send-otp', () => {
    it('sends OTP for signup purpose', async () => {
      const { status, data } = await sendOtp(testPhone, 'signup');
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('OTP sent');
    });

    it('rejects duplicate phone signup', async () => {
      // First, create an account with testPhone2
      const { status: s1 } = await sendOtp(testPhone2, 'signup');
      expect(s1).toBe(200);
      const otp = await getLatestOtp(testPhone2);
      const { status: s2 } = await verifyOtp(testPhone2, otp, 'signup', {
        name: 'OTP Test User',
        organizationName: 'OTP Test Farm',
        country: 'ZM',
        consent: true,
      });
      expect(s2).toBe(201);

      // Now try to send signup OTP for the same phone — should get 409
      const { status, data } = await sendOtp(testPhone2, 'signup');
      expect(status).toBe(409);
      expect(data.error).toBe('PHONE_ALREADY_REGISTERED');
    });

    it('returns generic message for unregistered phone (login)', async () => {
      const fakePhone = '260999999999';
      const { status, data } = await sendOtp(fakePhone, 'login');
      expect(status).toBe(200);
      // Should not reveal whether the phone is registered
      expect(data.message).toContain('If this phone is registered');
    });

    it('rate-limits OTP requests (60s per phone+purpose)', async () => {
      const ratePhone = `26097${(Date.now() + 2).toString().slice(-6)}`;
      const { status: s1 } = await sendOtp(ratePhone, 'signup');
      expect(s1).toBe(200);
      // Immediate second request should be rate-limited
      const { status: s2, data } = await sendOtp(ratePhone, 'signup');
      expect(s2).toBe(429);
      expect(data.error).toBe('OTP_RATE_LIMITED');
    });
  });

  describe('verify-otp (signup)', () => {
    it('creates account and logs in user on successful verification', async () => {
      const phone = `26097${(Date.now() + 3).toString().slice(-6)}`;
      await sendOtp(phone, 'signup');
      const otp = await getLatestOtp(phone);
      const { status, data } = await verifyOtp(phone, otp, 'signup', {
        name: 'Verify Test User',
        organizationName: 'Verify Test Farm',
        country: 'ZM',
        consent: true,
      });
      expect(status).toBe(201);
      expect(data.accessToken).toBeDefined();
      expect(data.refreshToken).toBeDefined();
      expect(data.user.phone).toBe(phone);
      expect(data.user.email).toBeNull();
      expect(data.user.phoneVerified).toBe(true);
      expect(data.user.role).toBe('owner');
      expect(data.organization).toBeDefined();
    });

    it('rejects invalid OTP', async () => {
      const phone = `26097${(Date.now() + 4).toString().slice(-6)}`;
      await sendOtp(phone, 'signup');
      const { status, data } = await verifyOtp(phone, '000000', 'signup', {
        name: 'Invalid OTP User',
        organizationName: 'Invalid OTP Farm',
        country: 'ZM',
        consent: true,
      });
      expect(status).toBe(401);
      expect(data.error).toBe('INVALID_OR_EXPIRED_OTP');
    });

    it('rejects expired OTP (already used code)', async () => {
      const phone = `26097${(Date.now() + 5).toString().slice(-6)}`;
      await sendOtp(phone, 'signup');
      const otp = await getLatestOtp(phone);
      // First verification succeeds
      const { status: s1 } = await verifyOtp(phone, otp, 'signup', {
        name: 'Reuse Test User',
        organizationName: 'Reuse Test Farm',
        country: 'ZM',
        consent: true,
      });
      expect(s1).toBe(201);
      // Second use of the same code should fail
      const { status: s2, data } = await verifyOtp(phone, otp, 'signup', {
        name: 'Reuse Test User 2',
        organizationName: 'Reuse Test Farm 2',
        country: 'ZM',
        consent: true,
      });
      expect(s2).toBe(401);
      expect(data.error).toBe('INVALID_OR_EXPIRED_OTP');
    });
  });

  describe('login with OTP', () => {
    it('logs in existing user with phone + OTP', async () => {
      // Use the account created in the duplicate phone test (testPhone2)
      await sendOtp(testPhone2, 'login');
      const otp = await getLatestOtp(testPhone2);
      const { status, data } = await login({ phone: testPhone2, otp });
      expect(status).toBe(200);
      expect(data.accessToken).toBeDefined();
      expect(data.user.phone).toBe(testPhone2);
    });

    it('rejects login with invalid OTP', async () => {
      const { status, data } = await login({ phone: testPhone2, otp: '111111' });
      expect(status).toBe(401);
      expect(data.error).toBe('INVALID_OR_EXPIRED_OTP');
    });
  });

  describe('login validation', () => {
    it('rejects login without email+password or phone+otp', async () => {
      const { status, data } = await login({});
      expect(status).toBe(400);
      expect(data.error).toBe('VALIDATION_ERROR');
    });
  });
});
