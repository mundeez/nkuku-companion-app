import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import {
  createAndSendOtp,
  verifyOtp,
  wasOtpRecentlySent,
  normalizePhone,
  maskPhone,
} from '../../core/security/otp.service.js';

const LoginSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(1).optional(),
  // OTP login: phone + otp (no password needed)
  phone: z.string().optional(),
  otp: z.string().length(6).optional(),
}).refine(
  (data) => (data.email && data.password) || (data.phone && data.otp),
  { message: 'Provide either email+password or phone+otp' },
);

// Version string recorded alongside consent acceptance so future ToS/privacy
// policy changes can be tracked against which version a user agreed to.
export const CONSENT_VERSION = process.env.CONSENT_VERSION || 'v1-2026-08';

// Registration can use email, phone, or both. At least one is required.
// Password is required when email is provided (email+password login).
// Phone-only users authenticate via OTP (no password).
const RegisterSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(8).max(20).optional(),
  password: z.string().min(8).max(100).optional(),
  name: z.string().min(1).max(100),
  organizationName: z.string().min(1).max(150),
  country: z.string().length(2), // ISO 3166-1 alpha-2, e.g. "ZM"
  currency: z.string().length(3).default('ZMW'),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the privacy policy and terms to create an account' }),
  }),
}).refine(
  (data) => data.email || data.phone,
  { message: 'At least one of email or phone is required' },
).refine(
  (data) => !data.email || data.password,
  { message: 'Password is required when registering with email' },
);

// Two-step phone signup: step 1 sends OTP, step 2 verifies OTP and creates account.
const SendOtpSchema = z.object({
  phone: z.string().min(8).max(20),
  purpose: z.enum(['signup', 'login', 'new_device']),
}).refine(
  (data) => ['signup', 'login', 'new_device'].includes(data.purpose),
  { message: 'Invalid purpose' },
);

const VerifyOtpSchema = z.object({
  phone: z.string().min(8).max(20),
  otp: z.string().length(6),
  purpose: z.enum(['signup', 'login', 'new_device']),
  // For signup completion: the registration details that were held pending OTP.
  signupData: z.object({
    email: z.string().email().optional(),
    password: z.string().min(8).max(100).optional(),
    name: z.string().min(1).max(100),
    organizationName: z.string().min(1).max(150),
    country: z.string().length(2),
    currency: z.string().length(3).default('ZMW'),
    consent: z.literal(true),
  }).optional(),
}).refine(
  (data) => data.purpose !== 'signup' || data.signupData,
  { message: 'signupData is required when purpose is signup' },
);

const AcceptInviteSchema = z.object({
  token: z.string().min(1),
  // Only required if the invited email doesn't already have an account.
  password: z.string().min(8).max(100).optional(),
  name: z.string().min(1).max(100).optional(),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the privacy policy and terms to join' }),
  }),
});

const TokenPayloadSchema = z.object({
  userId: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  role: z.enum(['owner', 'manager', 'flock_minder', 'sales_person', 'viewer']),
  organizationId: z.string(),
});

export type TokenPayload = z.infer<typeof TokenPayloadSchema>;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required — refusing to start without it');
}
// After the runtime check above, JWT_SECRET is guaranteed non-null.
// The `!` assertion tells TypeScript what the runtime check already ensures.
const SECRET: string = JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Cookie options for HttpOnly auth tokens (web clients).
// Mobile clients use the Bearer token from the JSON body instead.
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

// Helper: set auth cookies on the reply (for web clients).
function setAuthCookies(reply: any, accessToken: string, refreshToken: string) {
  reply.setCookie('nkuku_access_token', accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 15 * 60, // 15 minutes
  });
  reply.setCookie('nkuku_refresh_token', refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

// Helper: clear auth cookies (for logout).
function clearAuthCookies(reply: any) {
  reply.clearCookie('nkuku_access_token', { path: '/' });
  reply.clearCookie('nkuku_refresh_token', { path: '/' });
}

// A user's "primary" organization is their earliest membership. Multi-org
// membership (switching between organizations) is a Phase 2 concern; for
// now every user belongs to exactly one organization.
async function getPrimaryOrganizationId(prisma: any, userId: string): Promise<string | null> {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: 'asc' },
  });
  return membership?.organizationId ?? null;
}

/**
 * Generate a device fingerprint from the request.
 * Web: hash of user-agent + IP (first 8 chars of SHA-256).
 * Mobile: from X-Device-Id header (set by the mobile app).
 */
function getDeviceFingerprint(request: any): string {
  const deviceId = request.headers['x-device-id'];
  if (deviceId) return crypto.createHash('sha256').update(deviceId).digest('hex').slice(0, 64);

  const ua = request.headers['user-agent'] || '';
  const ip = request.ip || '';
  return crypto.createHash('sha256').update(`${ua}:${ip}`).digest('hex').slice(0, 64);
}

function getDeviceLabel(request: any): string {
  const ua = request.headers['user-agent'] || 'Unknown';
  // Simplified label extraction
  if (ua.includes('Android')) return 'Android device';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS device';
  if (ua.includes('Windows')) return 'Chrome on Windows';
  if (ua.includes('Mac')) return 'Safari on Mac';
  if (ua.includes('Linux')) return 'Browser on Linux';
  return ua.slice(0, 200);
}

/**
 * Check if the device is recognized for the user. If not, create a record
 * (after OTP verification). Returns true if the device is known.
 */
async function isDeviceRecognized(prisma: any, userId: string, fingerprint: string): Promise<boolean> {
  const device = await prisma.userDevice.findUnique({
    where: { userId_deviceFingerprint: { userId, deviceFingerprint: fingerprint } },
  });
  if (device) {
    // Update lastSeenAt
    await prisma.userDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });
    return true;
  }
  return false;
}

/**
 * Register a recognized device for a user.
 */
async function registerDevice(prisma: any, userId: string, fingerprint: string, label: string): Promise<void> {
  await prisma.userDevice.upsert({
    where: { userId_deviceFingerprint: { userId, deviceFingerprint: fingerprint } },
    create: { userId, deviceFingerprint: fingerprint, deviceLabel: label },
    update: { lastSeenAt: new Date(), deviceLabel: label },
  });
}

export async function buildAuthModule(app: FastifyInstance) {
  // POST /api/v1/auth/send-otp — send an OTP code to a phone number.
  // Used for: signup (verify phone before creating account), login
  // (passwordless OTP login), and new_device (re-verify on unrecognized device).
  app.post('/send-otp', async (request, reply) => {
    let body;
    try {
      body = SendOtpSchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
    }
    const prisma = (app as any).prisma;

    let phone: string;
    try {
      phone = normalizePhone(body.phone);
    } catch {
      return reply.status(400).send({ error: 'INVALID_PHONE' });
    }

    // For signup: check phone isn't already registered BEFORE rate limiting.
    // A duplicate phone should always return 409, even if an OTP was recently sent.
    if (body.purpose === 'signup') {
      const existing = await prisma.user.findUnique({ where: { phone } });
      if (existing) {
        return reply.status(409).send({ error: 'PHONE_ALREADY_REGISTERED' });
      }
    }

    // Rate limit: 1 OTP per 60s per phone+purpose
    const recentlySent = await wasOtpRecentlySent(prisma, phone, body.purpose, 60);
    if (recentlySent) {
      return reply.status(429).send({ error: 'OTP_RATE_LIMITED', message: 'Please wait 60 seconds before requesting a new code.' });
    }

    // For login/new_device: verify the phone belongs to an active user
    if (body.purpose === 'login' || body.purpose === 'new_device') {
      const user = await prisma.user.findUnique({ where: { phone } });
      if (!user || !user.isActive) {
        // Don't reveal whether the phone is registered — return success
        return reply.status(200).send({ success: true, message: 'If this phone is registered, an OTP has been sent.' });
      }
      const redis = (app as any).redis;
      const result = await createAndSendOtp(prisma, phone, body.purpose, user.id, redis);
      if (!result.success) {
        return reply.status(500).send({ error: 'SMS_SEND_FAILED', message: result.message });
      }
      return reply.status(200).send({ success: true, message: 'If this phone is registered, an OTP has been sent.' });
    }

    // For signup: phone uniqueness already checked above. Send the OTP.
    if (body.purpose === 'signup') {
      const redis = (app as any).redis;
      const result = await createAndSendOtp(prisma, phone, 'signup', undefined, redis);
      if (!result.success) {
        return reply.status(500).send({ error: 'SMS_SEND_FAILED', message: result.message });
      }
      return reply.status(200).send({ success: true, message: `OTP sent to ${maskPhone(phone)}` });
    }

    return reply.status(400).send({ error: 'INVALID_PURPOSE' });
  });

  // POST /api/v1/auth/verify-otp — verify an OTP code.
  // For signup: verifies the phone and creates the account (if signupData provided).
  // For login: verifies the OTP and logs the user in (returns tokens).
  // For new_device: verifies the OTP and registers the device.
  app.post('/verify-otp', async (request, reply) => {
    let body;
    try {
      body = VerifyOtpSchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
    }
    const prisma = (app as any).prisma;

    let phone: string;
    try {
      phone = normalizePhone(body.phone);
    } catch {
      return reply.status(400).send({ error: 'INVALID_PHONE' });
    }

    const valid = await verifyOtp(prisma, phone, body.otp, body.purpose);
    if (!valid) {
      return reply.status(401).send({ error: 'INVALID_OR_EXPIRED_OTP' });
    }

    if (body.purpose === 'signup') {
      // Create the account now that the phone is verified
      const data = body.signupData!;
      const now = new Date();

      // Check email uniqueness if email provided
      if (data.email) {
        const existingEmail = await prisma.user.findUnique({ where: { email: data.email } });
        if (existingEmail) {
          return reply.status(409).send({ error: 'EMAIL_ALREADY_REGISTERED' });
        }
      }

      // Check phone uniqueness (race condition safety)
      const existingPhone = await prisma.user.findUnique({ where: { phone } });
      if (existingPhone) {
        return reply.status(409).send({ error: 'PHONE_ALREADY_REGISTERED' });
      }

      const passwordHash = data.password
        ? await bcrypt.hash(data.password, 10)
        : ''; // empty hash for phone-only OTP users

      const { user, organization } = await prisma.$transaction(async (tx: any) => {
        const organization = await tx.organization.create({
          data: {
            name: data.organizationName,
            country: data.country.toUpperCase(),
            currency: data.currency.toUpperCase(),
            planCode: 'free',
          },
        });
        const user = await tx.user.create({
          data: {
            email: data.email || null,
            phone,
            passwordHash,
            name: data.name,
            role: 'owner',
            phoneVerifiedAt: now,
            consentAcceptedAt: now,
            consentVersion: CONSENT_VERSION,
          },
        });
        await tx.organizationMember.create({
          data: { organizationId: organization.id, userId: user.id, role: 'owner' },
        });
        return { user, organization };
      });

      // Register the device
      const fingerprint = getDeviceFingerprint(request);
      const label = getDeviceLabel(request);
      await registerDevice(prisma, user.id, fingerprint, label);

      const payload: TokenPayload = {
        userId: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        organizationId: organization.id,
      };
      const accessToken = jwt.sign(payload, SECRET, { expiresIn: JWT_EXPIRES_IN as any });
      const refreshToken = jwt.sign({ userId: user.id }, SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN as any });

      const redis = (app as any).redis;
      if (redis) {
        await redis.setex(`refresh:${user.id}:${refreshToken}`, 7 * 24 * 60 * 60, '1');
      }

      setAuthCookies(reply, accessToken, refreshToken);

      return reply.status(201).send({
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, phone: user.phone, name: user.name, role: user.role, organizationId: organization.id, phoneVerified: true },
        organization: { id: organization.id, name: organization.name, country: organization.country, currency: organization.currency },
      });
    }

    if (body.purpose === 'login' || body.purpose === 'new_device') {
      const user = await prisma.user.findUnique({ where: { phone } });
      if (!user || !user.isActive) {
        return reply.status(401).send({ error: 'INVALID_OR_EXPIRED_OTP' });
      }

      const organizationId = await getPrimaryOrganizationId(prisma, user.id);
      if (!organizationId) {
        return reply.status(403).send({ error: 'NO_ORGANIZATION' });
      }

      // Register/refresh the device
      const fingerprint = getDeviceFingerprint(request);
      const label = getDeviceLabel(request);
      await registerDevice(prisma, user.id, fingerprint, label);

      const payload: TokenPayload = {
        userId: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        organizationId,
      };
      const accessToken = jwt.sign(payload, SECRET, { expiresIn: JWT_EXPIRES_IN as any });
      const refreshToken = jwt.sign({ userId: user.id }, SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN as any });

      const redis = (app as any).redis;
      if (redis) {
        await redis.setex(`refresh:${user.id}:${refreshToken}`, 7 * 24 * 60 * 60, '1');
      }

      setAuthCookies(reply, accessToken, refreshToken);

      return reply.status(200).send({
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, phone: user.phone, name: user.name, role: user.role, organizationId, phoneVerified: !!user.phoneVerifiedAt },
      });
    }

    return reply.status(400).send({ error: 'INVALID_PURPOSE' });
  });

  // POST /api/v1/auth/register — self-serve signup with email (no OTP needed).
  // Phone-only signup goes through send-otp → verify-otp flow instead.
  app.post('/register', async (request, reply) => {
    let body;
    try {
      body = RegisterSchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
    }
    const prisma = (app as any).prisma;

    // If email is provided, check uniqueness
    if (body.email) {
      const existing = await prisma.user.findUnique({ where: { email: body.email } });
      if (existing) {
        return reply.status(409).send({ error: 'EMAIL_ALREADY_REGISTERED' });
      }
    }

    // If phone is provided, normalize and check uniqueness
    let phone: string | null = null;
    if (body.phone) {
      try {
        phone = normalizePhone(body.phone);
      } catch {
        return reply.status(400).send({ error: 'INVALID_PHONE' });
      }
      const existingPhone = await prisma.user.findUnique({ where: { phone } });
      if (existingPhone) {
        return reply.status(409).send({ error: 'PHONE_ALREADY_REGISTERED' });
      }
    }

    const passwordHash = body.password ? await bcrypt.hash(body.password, 10) : '';
    const now = new Date();

    const { user, organization } = await prisma.$transaction(async (tx: any) => {
      const organization = await tx.organization.create({
        data: {
          name: body.organizationName,
          country: body.country.toUpperCase(),
          currency: body.currency.toUpperCase(),
          planCode: 'free',
        },
      });
      const user = await tx.user.create({
        data: {
          email: body.email || null,
          phone,
          passwordHash,
          name: body.name,
          role: 'owner',
          // Phone is not verified yet when registering via email —
          // if phone was provided, the user can verify it later.
          phoneVerifiedAt: null,
          consentAcceptedAt: now,
          consentVersion: CONSENT_VERSION,
        },
      });
      await tx.organizationMember.create({
        data: { organizationId: organization.id, userId: user.id, role: 'owner' },
      });
      return { user, organization };
    });

    // Register the device
    const fingerprint = getDeviceFingerprint(request);
    const label = getDeviceLabel(request);
    await registerDevice(prisma, user.id, fingerprint, label);

    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      organizationId: organization.id,
    };
    const accessToken = jwt.sign(payload, SECRET, { expiresIn: JWT_EXPIRES_IN as any });
    const refreshToken = jwt.sign({ userId: user.id }, SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN as any });

    const redis = (app as any).redis;
    if (redis) {
      await redis.setex(`refresh:${user.id}:${refreshToken}`, 7 * 24 * 60 * 60, '1');
    }

    setAuthCookies(reply, accessToken, refreshToken);

    return reply.status(201).send({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, phone: user.phone, name: user.name, role: user.role, organizationId: organization.id, phoneVerified: false },
      organization: { id: organization.id, name: organization.name, country: organization.country, currency: organization.currency },
    });
  });

  // POST /api/v1/auth/accept-invite — join an existing organization via an
  // invite token. Works whether or not the invited email already has an
  // account (new users are created here; existing ones are just enrolled).
  app.post('/accept-invite', async (request, reply) => {
    const body = AcceptInviteSchema.parse(request.body);
    const prisma = (app as any).prisma;

    const invite = await prisma.invite.findUnique({ where: { token: body.token } });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      return reply.status(400).send({ error: 'INVALID_OR_EXPIRED_INVITE' });
    }

    const now = new Date();

    // Wrap the entire accept flow in a transaction to prevent race
    // conditions on concurrent requests with the same token.
    const user = await prisma.$transaction(async (tx: any) => {
      // Re-lock the invite inside the transaction to prevent double-accept
      const locked = await tx.invite.findUnique({ where: { token: body.token } });
      if (!locked || locked.acceptedAt || locked.expiresAt < now) {
        throw new Error('INVALID_OR_EXPIRED_INVITE');
      }

      let u = await tx.user.findUnique({ where: { email: invite.email } });

      if (!u) {
        if (!body.password || !body.name) {
          throw new Error('NAME_AND_PASSWORD_REQUIRED_FOR_NEW_ACCOUNT');
        }
        const passwordHash = await bcrypt.hash(body.password, 10);
        u = await tx.user.create({
          data: {
            email: invite.email,
            passwordHash,
            name: body.name,
            role: invite.role,
            consentAcceptedAt: now,
            consentVersion: CONSENT_VERSION,
          },
        });
      } else if (!u.consentAcceptedAt) {
        await tx.user.update({
          where: { id: u.id },
          data: { consentAcceptedAt: now, consentVersion: CONSENT_VERSION },
        });
      }

      const existingMembership = await tx.organizationMember.findFirst({
        where: { organizationId: invite.organizationId, userId: u.id },
      });
      if (!existingMembership) {
        await tx.organizationMember.create({
          data: { organizationId: invite.organizationId, userId: u.id, role: invite.role },
        });
      }

      await tx.invite.update({ where: { id: invite.id }, data: { acceptedAt: now } });

      return u;
    }).catch((err: any) => {
      if (err.message === 'INVALID_OR_EXPIRED_INVITE') {
        return reply.status(400).send({ error: 'INVALID_OR_EXPIRED_INVITE' });
      }
      if (err.message === 'NAME_AND_PASSWORD_REQUIRED_FOR_NEW_ACCOUNT') {
        return reply.status(400).send({ error: 'NAME_AND_PASSWORD_REQUIRED_FOR_NEW_ACCOUNT' });
      }
      throw err;
    });

    if (user && 'send' in user) return; // reply was already sent via .catch

    // Register the device
    const fingerprint = getDeviceFingerprint(request);
    const label = getDeviceLabel(request);
    await registerDevice(prisma, user.id, fingerprint, label);

    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      phone: user.phone,
      role: invite.role,
      organizationId: invite.organizationId,
    };
    const accessToken = jwt.sign(payload, SECRET, { expiresIn: JWT_EXPIRES_IN as any });
    const refreshToken = jwt.sign({ userId: user.id }, SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN as any });

    const redis = (app as any).redis;
    if (redis) {
      await redis.setex(`refresh:${user.id}:${refreshToken}`, 7 * 24 * 60 * 60, '1');
    }

    setAuthCookies(reply, accessToken, refreshToken);

    return reply.status(201).send({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, phone: user.phone, name: user.name, role: invite.role, organizationId: invite.organizationId },
    });
  });

  // POST /api/v1/auth/login — supports email+password or phone+OTP.
  // For phone+OTP: the OTP must have been sent via /send-otp first.
  app.post('/login', async (request, reply) => {
    let body;
    try {
      body = LoginSchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
    }
    const prisma = (app as any).prisma;

    // ── Phone + OTP login ──
    if (body.phone && body.otp) {
      let phone: string;
      try {
        phone = normalizePhone(body.phone);
      } catch {
        return reply.status(400).send({ error: 'INVALID_PHONE' });
      }

      const valid = await verifyOtp(prisma, phone, body.otp, 'login');
      if (!valid) {
        return reply.status(401).send({ error: 'INVALID_OR_EXPIRED_OTP' });
      }

      const user = await prisma.user.findUnique({ where: { phone } });
      if (!user || !user.isActive) {
        return reply.status(401).send({ error: 'INVALID_CREDENTIALS' });
      }

      const organizationId = await getPrimaryOrganizationId(prisma, user.id);
      if (!organizationId) {
        return reply.status(403).send({ error: 'NO_ORGANIZATION' });
      }

      // Register/refresh device
      const fingerprint = getDeviceFingerprint(request);
      const label = getDeviceLabel(request);
      await registerDevice(prisma, user.id, fingerprint, label);

      const payload: TokenPayload = {
        userId: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        organizationId,
      };
      const accessToken = jwt.sign(payload, SECRET, { expiresIn: JWT_EXPIRES_IN as any });
      const refreshToken = jwt.sign({ userId: user.id }, SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN as any });

      const redis = (app as any).redis;
      if (redis) {
        await redis.setex(`refresh:${user.id}:${refreshToken}`, 7 * 24 * 60 * 60, '1');
      }

      setAuthCookies(reply, accessToken, refreshToken);

      return {
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, phone: user.phone, name: user.name, role: user.role, organizationId, phoneVerified: !!user.phoneVerifiedAt },
      };
    }

    // ── Email + password login ──
    if (body.email && body.password) {
      const user = await prisma.user.findUnique({ where: { email: body.email } });
      if (!user || !user.isActive) {
        return reply.status(401).send({ error: 'INVALID_CREDENTIALS' });
      }

      const valid = await bcrypt.compare(body.password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ error: 'INVALID_CREDENTIALS' });
      }

      const organizationId = await getPrimaryOrganizationId(prisma, user.id);
      if (!organizationId) {
        return reply.status(403).send({ error: 'NO_ORGANIZATION' });
      }

      // Check device — if unrecognized and user has a verified phone,
      // require OTP verification before issuing tokens.
      const fingerprint = getDeviceFingerprint(request);
      const deviceKnown = await isDeviceRecognized(prisma, user.id, fingerprint);

      if (!deviceKnown && user.phone && user.phoneVerifiedAt) {
        // New device + verified phone → require OTP
        // Send OTP and return a challenge response (no tokens issued)
        const recentlySent = await wasOtpRecentlySent(prisma, user.phone, 'new_device', 60);
        if (!recentlySent) {
          await createAndSendOtp(prisma, user.phone, 'new_device', user.id, (app as any).redis);
        }
        return reply.status(200).send({
          requiresDeviceVerification: true,
          phone: maskPhone(user.phone),
          message: 'New device detected. An OTP has been sent to your phone.',
        });
      }

      // Device is known, or user has no verified phone — proceed with login
      if (deviceKnown) {
        // Update lastSeenAt
        await registerDevice(prisma, user.id, fingerprint, getDeviceLabel(request));
      } else {
        // No verified phone — register the device without OTP
        await registerDevice(prisma, user.id, fingerprint, getDeviceLabel(request));
      }

      const payload: TokenPayload = {
        userId: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        organizationId,
      };

      const accessToken = jwt.sign(payload, SECRET, { expiresIn: JWT_EXPIRES_IN as any });
      const refreshToken = jwt.sign({ userId: user.id }, SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN as any });

      // Store refresh token in Redis (simple blacklist approach)
      const redis = (app as any).redis;
      if (redis) {
        await redis.setex(`refresh:${user.id}:${refreshToken}`, 7 * 24 * 60 * 60, '1');
      }

      setAuthCookies(reply, accessToken, refreshToken);

      return {
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, phone: user.phone, name: user.name, role: user.role, organizationId, phoneVerified: !!user.phoneVerifiedAt },
      };
    }

    return reply.status(400).send({ error: 'INVALID_REQUEST' });
  });

  // POST /api/v1/auth/refresh
  app.post('/refresh', async (request, reply) => {
    // Accept refresh token from body (mobile) or cookie (web)
    const bodyToken = (request.body as any)?.refreshToken;
    const cookieToken = (request as any).cookies?.nkuku_refresh_token;
    const refreshTokenValue = bodyToken || cookieToken;
    if (!refreshTokenValue) {
      return reply.status(400).send({ error: 'MISSING_REFRESH_TOKEN' });
    }
    try {
      const decoded = jwt.verify(refreshTokenValue, SECRET) as any;
      const prisma = (app as any).prisma;
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user || !user.isActive) {
        return reply.status(401).send({ error: 'USER_INVALID' });
      }
      const organizationId = await getPrimaryOrganizationId(prisma, user.id);
      if (!organizationId) {
        return reply.status(403).send({ error: 'NO_ORGANIZATION' });
      }
      const payload: TokenPayload = { userId: user.id, email: user.email, phone: user.phone, role: user.role, organizationId };
      const newAccessToken = jwt.sign(payload, SECRET, { expiresIn: JWT_EXPIRES_IN as any });
      // Rotate the access token cookie for web clients
      reply.setCookie('nkuku_access_token', newAccessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 15 * 60,
      });
      return { accessToken: newAccessToken };
    } catch {
      return reply.status(401).send({ error: 'INVALID_REFRESH_TOKEN' });
    }
  });

  // POST /api/v1/auth/logout — clears HttpOnly cookies (web clients)
  app.post('/logout', async (request, reply) => {
    clearAuthCookies(reply);
    return { success: true };
  });

  // GET /api/v1/auth/me
  app.get('/me', { preHandler: [authenticate] }, async (request) => {
    const payload = (request as any).authUser as TokenPayload;
    const prisma = (app as any).prisma;
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    return { user: user ? { ...user, organizationId: payload.organizationId } : null };
  });

  // GET /api/v1/auth/dev/last-otp — DEV ONLY: returns the last OTP code
  // for a phone number. Only available when SMS_DISABLED=true (dev mode).
  // This endpoint is NOT registered in production.
  if (process.env.SMS_DISABLED === 'true') {
    app.get('/dev/last-otp', async (request: any, reply: any) => {
      const phone = request.query?.phone;
      if (!phone) {
        return reply.status(400).send({ error: 'phone query param required' });
      }
      const prisma = (app as any).prisma;
      // Find the most recent OTP for this phone
      const otpRecord = await prisma.otpCode.findFirst({
        where: { phone, usedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (!otpRecord) {
        return reply.status(404).send({ error: 'No OTP found' });
      }
      // We can't return the code since it's hashed. Instead, we need to
      // return it from the SMS log. In dev mode, the SMS service logs it.
      // Alternative: store the code in Redis temporarily for dev testing.
      // For simplicity, we'll use a Redis key set by the OTP service.
      const redis = (app as any).redis;
      if (redis) {
        const code = await redis.get(`dev:otp:${phone}:${otpRecord.id}`);
        if (code) {
          return { phone, code };
        }
      }
      return reply.status(404).send({ error: 'OTP code not available (check server logs)' });
    });
  }
}

// ── Auth middleware ────────────────────────
export async function authenticate(request: any, reply: any) {
  // Check Bearer header first (mobile clients), then fall back to cookie (web)
  const auth = request.headers.authorization;
  let token: string | null = null;
  if (auth && auth.startsWith('Bearer ')) {
    token = auth.slice(7);
  } else if (request.cookies?.nkuku_access_token) {
    token = request.cookies.nkuku_access_token;
  }

  if (!token) {
    return reply.status(401).send({ error: 'MISSING_TOKEN' });
  }
  try {
    const decoded = jwt.verify(token, SECRET) as any;
    const payload = TokenPayloadSchema.parse(decoded);

    // Validate user still exists and is active in DB
    const prisma = (request as any).server?.prisma ?? (reply.server as any)?.prisma;
    if (prisma) {
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user || !user.isActive) {
        return reply.status(401).send({ error: 'INVALID_TOKEN' });
      }
    }

    // NOTE: organizationId is trusted from the JWT (re-derived fresh at
    // login/refresh time) rather than re-queried on every request, to avoid
    // an extra DB round trip per call. Access tokens are short-lived
    // (JWT_EXPIRES_IN, default 15m), so a user moved between organizations
    // picks up the change on their next login/refresh.
    request.authUser = payload;
  } catch {
    return reply.status(401).send({ error: 'INVALID_TOKEN' });
  }
}

export function requireRole(...roles: string[]) {
  return async (request: any, reply: any) => {
    const user = request.authUser as TokenPayload;
    if (!roles.includes(user.role)) {
      return reply.status(403).send({ error: 'FORBIDDEN' });
    }
  };
}
