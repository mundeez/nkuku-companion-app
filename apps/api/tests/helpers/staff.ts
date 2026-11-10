// ── Shared platform-staff test helpers ───────────────────
// Bootstrap utilities for tests that exercise the /api/v1/platform staff
// surface (P1 staff-auth, P2 tenant ops). Reused by staff-auth.test.ts and
// platform-tenants.test.ts — keep the flows here in sync with the real
// endpoints.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { TEST_API_URL } from './env.js';

export const STAFF_PASSWORD = 'StaffTestPass123!';

let seq = 0;

export function staffEmail(role: string) {
  return `staff-test-${role}-${Date.now()}-${seq++}@example.com`;
}

export async function api(path: string, options: any = {}, token?: string, baseUrl = TEST_API_URL) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });
  return { status: res.status, data: await res.json().catch(() => null) };
}

export function post(path: string, body: any, token?: string, baseUrl = TEST_API_URL) {
  return api(path, { method: 'POST', body: JSON.stringify(body) }, token, baseUrl);
}

/** Create a StaffUser row directly (password only — no TOTP yet). */
export async function createStaff(prisma: PrismaClient, role: string) {
  const email = staffEmail(role);
  const staff = await prisma.staffUser.create({
    data: {
      email,
      name: `Test ${role}`,
      passwordHash: await bcrypt.hash(STAFF_PASSWORD, 10),
      role: role as any,
    },
  });
  return { staff, email };
}

/**
 * Full login → forced TOTP enrol → confirm round-trip against the live
 * test API. Returns the minted access/refresh tokens + recovery codes.
 * The returned access token carries a fresh reauthAt (a password+TOTP
 * login counts as re-auth, per requireReauth semantics).
 */
export async function onboardStaff(email: string, baseUrl = TEST_API_URL) {
  const login = await post('/api/v1/platform/auth/login', {
    email,
    password: STAFF_PASSWORD,
  }, undefined, baseUrl);
  if (login.status !== 200 || !login.data.requiresTotpEnrollment) {
    throw new Error(`staff login failed for ${email}: ${JSON.stringify(login.data)}`);
  }
  const ticket = login.data.ticket;

  const enroll = await api('/api/v1/platform/auth/totp/enroll', {
    method: 'POST',
    body: JSON.stringify({}),
  }, ticket, baseUrl);
  if (enroll.status !== 200) {
    throw new Error(`totp enroll failed for ${email}: ${JSON.stringify(enroll.data)}`);
  }

  const code = authenticator.generate(enroll.data.secret);
  const confirm = await post('/api/v1/platform/auth/totp/confirm', {
    ticket,
    code,
  }, undefined, baseUrl);
  if (confirm.status !== 200) {
    throw new Error(`totp confirm failed for ${email}: ${JSON.stringify(confirm.data)}`);
  }
  return {
    accessToken: confirm.data.accessToken as string,
    refreshToken: confirm.data.refreshToken as string,
    recoveryCodes: confirm.data.recoveryCodes as string[],
  };
}

/** Convenience: create a staff row and fully onboard it. */
export async function makeStaffWithToken(prisma: PrismaClient, role: string, baseUrl = TEST_API_URL) {
  const { staff, email } = await createStaff(prisma, role);
  const tokens = await onboardStaff(email, baseUrl);
  return { staff, email, ...tokens };
}
