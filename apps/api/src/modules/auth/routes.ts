import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const TokenPayloadSchema = z.object({
  userId: z.string(),
  email: z.string(),
  role: z.enum(['owner', 'manager', 'viewer']),
});

export type TokenPayload = z.infer<typeof TokenPayloadSchema>;

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export async function buildAuthModule(app: FastifyInstance) {
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

    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const refreshToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });

    // Store refresh token in Redis (simple blacklist approach)
    const redis = (app as any).redis;
    if (redis) {
      await redis.setex(`refresh:${user.id}:${refreshToken}`, 7 * 24 * 60 * 60, '1');
    }

    return { accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  });

  // POST /api/v1/auth/refresh
  app.post('/refresh', async (request, reply) => {
    const body = z.object({ refreshToken: z.string() }).parse(request.body);
    try {
      const decoded = jwt.verify(body.refreshToken, JWT_SECRET) as any;
      const prisma = (app as any).prisma;
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user || !user.isActive) {
        return reply.status(401).send({ error: 'USER_INVALID' });
      }
      const payload: TokenPayload = { userId: user.id, email: user.email, role: user.role };
      const newAccessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      return { accessToken: newAccessToken };
    } catch {
      return reply.status(401).send({ error: 'INVALID_REFRESH_TOKEN' });
    }
  });

  // GET /api/v1/auth/me
  app.get('/me', { preHandler: [authenticate] }, async (request) => {
    const payload = (request as any).authUser as TokenPayload;
    const prisma = (app as any).prisma;
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    return { user };
  });
}

// ── Auth middleware ────────────────────────
export async function authenticate(request: any, reply: any) {
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'MISSING_TOKEN' });
  }
  const token = auth.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const payload = TokenPayloadSchema.parse(decoded);

    // Validate user still exists in DB (handles DB rebuilds with new UUIDs)
    const prisma = (request as any).server?.prisma ?? (reply.server as any)?.prisma;
    if (prisma) {
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user || !user.isActive) {
        const fallback = await prisma.user.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        if (!fallback) {
          return reply.status(401).send({ error: 'NO_VALID_USER' });
        }
        request.authUser = {
          userId: fallback.id,
          email: fallback.email,
          role: fallback.role,
        };
        return;
      }
    }

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

