/**
 * Redis-backed sliding-window rate limiters.
 *
 * Falls open (allows the request) if Redis is unavailable, so the API
 * remains functional even if Redis is down.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';

const WINDOW_SECONDS = 60; // 1-minute sliding window
const BULK_LIMIT = Number.parseInt(process.env.BULK_RATE_LIMIT || '10', 10);
const AUTH_LIMIT = Number.parseInt(process.env.AUTH_RATE_LIMIT || '10', 10);

async function checkLimit(
  redis: any,
  key: string,
  limit: number,
  reply: FastifyReply,
  label: string,
): Promise<boolean> {
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }
    if (count > limit) {
      const ttl = await redis.ttl(key);
      reply.status(429).send({
        error: 'RATE_LIMIT_EXCEEDED',
        message: `Too many ${label} attempts. Try again in ${ttl} seconds.`,
        retryAfter: ttl,
      });
      return false;
    }
  } catch {
    // Redis error — fail open
  }
  return true;
}

/** Per-user rate limit for bulk endpoints. */
export async function bulkRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (Number.isNaN(BULK_LIMIT) || BULK_LIMIT <= 0) return;

  const redis = (request.server as any).redis;
  if (!redis) return;

  const authUser = (request as any).authUser;
  if (!authUser?.userId) return;

  await checkLimit(redis, `bulk_rl:${authUser.userId}`, BULK_LIMIT, reply, 'bulk');
}

/** Per-IP rate limit for auth endpoints (login, OTP send/verify, register). */
export async function authRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (Number.isNaN(AUTH_LIMIT) || AUTH_LIMIT <= 0) return;

  const redis = (request.server as any).redis;
  if (!redis) return;

  const ip = request.ip;
  if (!ip) return;

  await checkLimit(redis, `auth_rl:${ip}`, AUTH_LIMIT, reply, 'authentication');
}
