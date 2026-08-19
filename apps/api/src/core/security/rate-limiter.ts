/**
 * Redis-backed sliding-window rate limiter for bulk endpoints.
 *
 * Limits per-user request counts within a time window. Falls open
 * (allows the request) if Redis is unavailable, so the API remains
 * functional even if Redis is down.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';

const WINDOW_SECONDS = 60; // 1-minute sliding window
const BULK_LIMIT = Number.parseInt(process.env.BULK_RATE_LIMIT || '10', 10);

export async function bulkRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (Number.isNaN(BULK_LIMIT) || BULK_LIMIT <= 0) return; // disabled when 0 or invalid

  const redis = (request.server as any).redis;
  if (!redis) return; // fail open if Redis is unavailable

  const authUser = (request as any).authUser;
  if (!authUser?.userId) return;

  const key = `bulk_rl:${authUser.userId}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }
    if (count > BULK_LIMIT) {
      const ttl = await redis.ttl(key);
      return reply.status(429).send({
        error: 'RATE_LIMIT_EXCEEDED',
        message: `Too many bulk requests. Try again in ${ttl} seconds.`,
        retryAfter: ttl,
      });
    }
  } catch {
    // Redis error — fail open
  }
}
