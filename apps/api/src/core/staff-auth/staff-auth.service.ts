// ── PLATFORM STAFF AUTH SERVICE ──────────────────────────
// Staff identity is completely separate from tenant auth:
//   - separate model (StaffUser, not User)
//   - separate JWT audience ('platform') + separate signing secret
//     (PLATFORM_JWT_SECRET, falling back to JWT_SECRET + '-platform')
//   - mandatory TOTP 2FA (enrolment forced on first login)
//   - re-auth claim (`reauthAt`) for dangerous permissions (≤ 5 min)
//   - opaque refresh tokens stored hashed in staff_sessions (30 d)
//
// Password hashing uses bcryptjs — the same library as tenant auth.
// TOTP uses otplib (RFC 6238, 30 s step, ±1 window tolerance).

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authenticator } from 'otplib';
import { hasPermission } from './permissions.js';
import type { StaffRole } from '@prisma/client';

// Tolerate one 30 s step of clock drift between server and authenticator.
authenticator.options = { window: 1 };

// ── Secrets ──────────────────────────────────────────────
// PLATFORM_JWT_SECRET should be set in production. When unset we derive a
// stable fallback from JWT_SECRET so dev/test environments work without
// extra configuration — documented in .env.example.
const PLATFORM_JWT_SECRET =
  process.env.PLATFORM_JWT_SECRET || `${process.env.JWT_SECRET}-platform`;

export const STAFF_ACCESS_COOKIE = 'nkuku_staff_token';
export const STAFF_REFRESH_COOKIE = 'nkuku_staff_refresh';
export const STAFF_ACCESS_TTL = '15m';
export const STAFF_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const REAUTH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
export const TOTP_ENROLL_TICKET_TTL = '10m';
export const TOTP_VERIFY_TICKET_TTL = '5m';
export const BOOTSTRAP_TICKET_TTL = '7d';

// ── Claims ───────────────────────────────────────────────
const StaffRoleSchema = z.enum([
  'super_admin',
  'support',
  'finance',
  'content_editor',
  'marketing',
  'auditor',
]);

export const StaffTokenClaimsSchema = z.object({
  staffId: z.string().uuid(),
  email: z.string(),
  role: StaffRoleSchema,
  // Epoch ms of the last successful re-auth (password or TOTP). Absent
  // when the token was minted from a normal login/refresh.
  reauthAt: z.number().optional(),
});

export type StaffTokenClaims = z.infer<typeof StaffTokenClaimsSchema>;

const TicketSchema = z.object({
  staffId: z.string().uuid(),
  purpose: z.enum(['totp_verify', 'totp_enroll', 'staff_bootstrap']),
  jti: z.string(),
});

export type StaffTicket = z.infer<typeof TicketSchema>;

// ── Passwords ────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

// ── Staff access tokens (aud: 'platform') ────────────────
export function signStaffAccessToken(
  staff: { id: string; email: string; role: StaffRole },
  reauthAt?: number,
): string {
  const claims: StaffTokenClaims = {
    staffId: staff.id,
    email: staff.email,
    role: staff.role,
    ...(reauthAt !== undefined ? { reauthAt } : {}),
  };
  return jwt.sign(claims, PLATFORM_JWT_SECRET, {
    expiresIn: STAFF_ACCESS_TTL,
    audience: 'platform',
  });
}

/** Verify a staff access token. Returns claims or null. */
export function verifyStaffAccessToken(token: string): StaffTokenClaims | null {
  try {
    const decoded = jwt.verify(token, PLATFORM_JWT_SECRET, { audience: 'platform' });
    return StaffTokenClaimsSchema.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Try to interpret a raw token as a staff access token. Used by
 * authenticate() (tenant middleware) so it can let platform tokens fall
 * through to the deprecated isPlatformAdmin gate, and by the IP
 * allowlist escape hatch.
 */
export function tryDecodeStaffToken(token: string | null | undefined): StaffTokenClaims | null {
  if (!token) return null;
  return verifyStaffAccessToken(token);
}

// ── One-time tickets (aud: 'platform-ticket') ────────────
// Short-lived tokens that authorise a single step of the auth flow
// (TOTP verify / TOTP enrol / staff bootstrap). They can never be used
// as access tokens because the audience differs.
export function signStaffTicket(
  staffId: string,
  purpose: StaffTicket['purpose'],
  expiresIn: jwt.SignOptions['expiresIn'],
): string {
  return jwt.sign(
    { staffId, purpose, jti: crypto.randomUUID() },
    PLATFORM_JWT_SECRET,
    { expiresIn, audience: 'platform-ticket' },
  );
}

export function verifyStaffTicket(
  token: string | null | undefined,
  purpose: StaffTicket['purpose'],
): StaffTicket | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, PLATFORM_JWT_SECRET, { audience: 'platform-ticket' });
    const ticket = TicketSchema.parse(decoded);
    return ticket.purpose === purpose ? ticket : null;
  } catch {
    return null;
  }
}

// ── TOTP secret encryption (AES-256-GCM at rest) ─────────
const TOTP_ENC_KEY = crypto
  .createHash('sha256')
  .update(`${PLATFORM_JWT_SECRET}|staff-totp-enc`)
  .digest();

export function encryptTotpSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', TOTP_ENC_KEY, iv);
  const ct = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decryptTotpSecret(enc: string): string | null {
  try {
    const raw = Buffer.from(enc, 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ct = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', TOTP_ENC_KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function totpKeyuri(email: string, secret: string): string {
  return authenticator.keyuri(email, 'Nkuku Platform', secret);
}

export function verifyTotpCode(secret: string, code: string): boolean {
  try {
    return authenticator.check(code, secret);
  } catch {
    return false;
  }
}

// ── Recovery codes ───────────────────────────────────────
// 10 single-use codes, SHA-256 hashed at rest. Plaintext is returned to
// the staff member exactly once (on enrolment confirm / TOTP reset).
const RECOVERY_CODE_COUNT = 10;

export function hashRecoveryCode(code: string): string {
  const normalized = code.replace(/-/g, '').trim().toUpperCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function generateRecoveryCodes(): { plain: string[]; hashes: string[] } {
  const plain: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const formatted = `${code.slice(0, 4)}-${code.slice(4)}`;
    plain.push(formatted);
    hashes.push(hashRecoveryCode(formatted));
  }
  return { plain, hashes };
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

// ── Sessions ─────────────────────────────────────────────
export async function createStaffSession(
  prisma: any,
  staffUserId: string,
  meta: { deviceLabel?: string; ip?: string; userAgent?: string },
) {
  const refreshToken = generateRefreshToken();
  const session = await prisma.staffSession.create({
    data: {
      staffUserId,
      refreshTokenHash: hashRefreshToken(refreshToken),
      deviceLabel: meta.deviceLabel?.slice(0, 200) ?? null,
      ip: meta.ip?.slice(0, 45) ?? null,
      userAgent: meta.userAgent?.slice(0, 500) ?? null,
      expiresAt: new Date(Date.now() + STAFF_REFRESH_TTL_MS),
    },
  });
  return { refreshToken, session };
}

/**
 * Rotate a refresh session: validates the presented token, issues a new
 * refresh token and extends expiry. Returns null when invalid/revoked.
 */
export async function rotateStaffSession(prisma: any, refreshToken: string) {
  const session = await prisma.staffSession.findUnique({
    where: { refreshTokenHash: hashRefreshToken(refreshToken) },
    include: { staffUser: true },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (!session.staffUser?.isActive) return null;

  const newToken = generateRefreshToken();
  await prisma.staffSession.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: hashRefreshToken(newToken),
      expiresAt: new Date(Date.now() + STAFF_REFRESH_TTL_MS),
    },
  });
  return { refreshToken: newToken, staffUser: session.staffUser };
}

export async function revokeStaffSession(prisma: any, refreshToken: string) {
  await prisma.staffSession.updateMany({
    where: { refreshTokenHash: hashRefreshToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllStaffSessions(prisma: any, staffUserId: string) {
  await prisma.staffSession.updateMany({
    where: { staffUserId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ── Cookie helpers ───────────────────────────────────────
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export function setStaffCookies(reply: any, accessToken: string, refreshToken: string) {
  reply.setCookie(STAFF_ACCESS_COOKIE, accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 15 * 60,
  });
  reply.setCookie(STAFF_REFRESH_COOKIE, refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 30 * 24 * 60 * 60,
  });
}

export function clearStaffCookies(reply: any) {
  reply.clearCookie(STAFF_ACCESS_COOKIE, { path: '/' });
  reply.clearCookie(STAFF_REFRESH_COOKIE, { path: '/' });
}

// ── Request metadata ─────────────────────────────────────
export function getClientIp(request: any): string {
  // nginx sets X-Forwarded-For; the app does not globally trust proxies
  // (tenant rate limiting already keys on request.ip), so for the staff
  // surface we prefer the first forwarded hop when present.
  const fwd = request.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return request.ip || '';
}

export function getDeviceLabel(request: any): string {
  const ua = request.headers?.['user-agent'] || 'Unknown';
  if (ua.includes('Android')) return 'Android device';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS device';
  if (ua.includes('Windows')) return 'Chrome on Windows';
  if (ua.includes('Mac')) return 'Safari on Mac';
  if (ua.includes('Linux')) return 'Browser on Linux';
  return ua.slice(0, 200);
}

// ── preHandler middleware ────────────────────────────────
/**
 * Verify a staff access token (Bearer header or nkuku_staff_token
 * cookie), load the StaffUser, and enforce isActive + optional
 * permission strings. Populates request.staffUser.
 *
 * 401 MISSING_TOKEN / INVALID_TOKEN / ACCOUNT_DISABLED
 * 403 FORBIDDEN (authenticated but lacks a required permission)
 */
export function requireStaff(...permissions: string[]) {
  return async (request: any, reply: any) => {
    const auth = request.headers.authorization;
    let token: string | null = null;
    if (auth && auth.startsWith('Bearer ')) {
      token = auth.slice(7);
    } else if (request.cookies?.[STAFF_ACCESS_COOKIE]) {
      token = request.cookies[STAFF_ACCESS_COOKIE];
    }

    if (!token) {
      return reply.status(401).send({ error: 'MISSING_TOKEN' });
    }

    const claims = verifyStaffAccessToken(token);
    if (!claims) {
      return reply.status(401).send({ error: 'INVALID_TOKEN' });
    }

    const prisma = request.server?.prisma ?? reply.server?.prisma;
    if (prisma) {
      const staff = await prisma.staffUser.findUnique({ where: { id: claims.staffId } });
      if (!staff || !staff.isActive) {
        return reply.status(401).send({ error: 'ACCOUNT_DISABLED' });
      }
      claims.role = staff.role; // role changes apply immediately
    }

    request.staffUser = claims;

    for (const perm of permissions) {
      if (!hasPermission(claims.role, perm)) {
        return reply
          .status(403)
          .send({ error: 'FORBIDDEN', message: `Permission '${perm}' required` });
      }
    }
  };
}

/**
 * requireStaff variant for routes that live on the TENANT surface (e.g.
 * the global-catalogue write routes under /api/v1/diseases, /api/v1/breeds,
 * /api/v1/supplier-templates — P4 lockdown). Same verification and
 * permission checks as requireStaff, but a well-formed NON-staff token
 * (a tenant JWT) gets 403 FORBIDDEN instead of 401 INVALID_TOKEN — the
 * caller IS authenticated, just the wrong audience for a staff-only route.
 * Missing/empty credentials still 401 via requireStaff.
 */
export function requireStaffApi(...permissions: string[]) {
  const inner = requireStaff(...permissions);
  return async (request: any, reply: any) => {
    const auth = request.headers?.authorization;
    const token =
      (auth && auth.startsWith('Bearer ') ? auth.slice(7) : null) ??
      request.cookies?.[STAFF_ACCESS_COOKIE] ??
      null;
    if (token && !verifyStaffAccessToken(token)) {
      return reply.status(403).send({
        error: 'FORBIDDEN',
        message: 'Platform staff access required',
      });
    }
    return inner(request, reply);
  };
}

/**
 * Require a fresh re-auth (password or TOTP within REAUTH_WINDOW_MS).
 * Chain AFTER requireStaff. Enforces plan §3: dangerous permissions
 * demand reauthAt ≤ 5 minutes old.
 */
export function requireReauth() {
  return async (request: any, reply: any) => {
    const staff = request.staffUser as StaffTokenClaims | undefined;
    if (!staff) {
      return reply.status(401).send({ error: 'MISSING_TOKEN' });
    }
    const fresh = staff.reauthAt !== undefined && Date.now() - staff.reauthAt <= REAUTH_WINDOW_MS;
    if (!fresh) {
      return reply.status(403).send({
        error: 'REAUTH_REQUIRED',
        message: 'This action requires re-authentication within the last 5 minutes',
      });
    }
  };
}
