import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Version string recorded alongside consent acceptance so future ToS/privacy
// policy changes can be tracked against which version a user agreed to.
export const CONSENT_VERSION = process.env.CONSENT_VERSION || 'v1-2026-08';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(100),
  organizationName: z.string().min(1).max(150),
  country: z.string().length(2), // ISO 3166-1 alpha-2, e.g. "ZM"
  currency: z.string().length(3).default('ZMW'),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the privacy policy and terms to create an account' }),
  }),
});

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
  email: z.string(),
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

export async function buildAuthModule(app: FastifyInstance) {
  // POST /api/v1/auth/register — self-serve signup: creates a new
  // Organization and its owner User in one transaction.
  app.post('/register', async (request, reply) => {
    const body = RegisterSchema.parse(request.body);
    const prisma = (app as any).prisma;

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return reply.status(409).send({ error: 'EMAIL_ALREADY_REGISTERED' });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
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
          email: body.email,
          passwordHash,
          name: body.name,
          role: 'owner',
          consentAcceptedAt: now,
          consentVersion: CONSENT_VERSION,
        },
      });
      await tx.organizationMember.create({
        data: { organizationId: organization.id, userId: user.id, role: 'owner' },
      });
      return { user, organization };
    });

    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
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
      user: { id: user.id, email: user.email, name: user.name, role: user.role, organizationId: organization.id },
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

    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
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
      user: { id: user.id, email: user.email, name: user.name, role: invite.role, organizationId: invite.organizationId },
    });
  });

  // POST /api/v1/auth/login
  app.post('/login', async (request, reply) => {
    const body = LoginSchema.parse(request.body);
    const prisma = (app as any).prisma;

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

    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
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
      user: { id: user.id, email: user.email, name: user.name, role: user.role, organizationId },
    };
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
      const payload: TokenPayload = { userId: user.id, email: user.email, role: user.role, organizationId };
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

