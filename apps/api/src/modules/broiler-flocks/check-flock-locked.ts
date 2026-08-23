import { getOrganizationId } from '../../core/tenancy/scope.js';

/**
 * preHandler that blocks mutations on completed flocks for non-owner users.
 *
 * Owner role bypasses the lock (actions are captured by existing AuditLog).
 * Sales PATCH (payment updates) is intentionally NOT gated by this middleware.
 *
 * Extracts flockId from request.body.flockId, request.params.id, or
 * request.body.id (in that order).
 *
 * Use this for POST endpoints where flockId is in the request body.
 * For DELETE endpoints (where params.id is the record ID, not the flock ID),
 * use the `assertFlockNotCompleted` helper inside the handler after loading
 * the record with its flock relation.
 */
export function checkFlockNotLocked(prisma: any) {
  return async (request: any, reply: any) => {
    const authUser = request.authUser;
    if (!authUser) return; // authenticate preHandler handles 401

    // Owner bypasses the lock entirely
    if (authUser.role === 'owner') return;

    // Extract flockId from common locations
    const flockId = request.body?.flockId
      ?? request.params?.id
      ?? request.body?.id;

    if (!flockId) return; // No flock context — let the route handler deal with it

    const organizationId = getOrganizationId(request);
    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, organizationId },
      select: { status: true },
    });

    if (!flock) return; // Let the route handler return 404

    if (flock.status === 'completed') {
      return reply.status(403).send({
        error: 'FLOCK_COMPLETED',
        message: 'This flock is completed. Only the owner can modify records.',
      });
    }
  };
}

/**
 * Inline helper for DELETE endpoints where the record (not the flock) is
 * identified by params.id. Call this after loading the record with its flock
 * relation to check if the parent flock is completed.
 *
 * Returns true if the request was rejected (reply already sent).
 * Returns false if the request should proceed.
 */
export function assertFlockNotCompleted(
  reply: any,
  flockStatus: string,
  userRole: string,
): boolean {
  if (flockStatus !== 'completed') return false;
  if (userRole === 'owner') return false; // Owner bypasses
  reply.status(403).send({
    error: 'FLOCK_COMPLETED',
    message: 'This flock is completed. Only the owner can modify records.',
  });
  return true;
}
