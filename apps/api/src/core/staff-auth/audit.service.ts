// ── PLATFORM AUDIT SERVICE ───────────────────────────────
// Writes append-only rows to platform_audit_events. Audit must never
// break a request: failures are logged, never thrown.

import type { PrismaClient, StaffRole } from '@prisma/client';

export interface PlatformAuditInput {
  actorStaffId: string;
  actorRole: StaffRole;
  /** e.g. 'staff.invite', 'staff.disable', 'security.allowlist_bypass' */
  action: string;
  /** e.g. 'staff_user', 'organization', 'security' */
  targetType: string;
  targetId?: string | null;
  organizationId?: string | null;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/**
 * Append a platform audit event. Never throws — an audit failure is
 * logged to stderr and the request continues (a dropped audit row is
 * preferable to a broken admin action, and the failure itself is
 * observable in logs).
 */
export async function writePlatformAudit(
  prisma: PrismaClient,
  event: PlatformAuditInput,
): Promise<void> {
  try {
    await prisma.platformAuditEvent.create({
      data: {
        actorStaffId: event.actorStaffId,
        actorRole: event.actorRole,
        action: event.action.slice(0, 80),
        targetType: event.targetType.slice(0, 50),
        targetId: event.targetId?.slice(0, 80) ?? null,
        organizationId: event.organizationId ?? null,
        reason: event.reason ?? null,
        before: (event.before ?? undefined) as any,
        after: (event.after ?? undefined) as any,
        ip: event.ip?.slice(0, 45) ?? null,
        userAgent: event.userAgent?.slice(0, 500) ?? null,
        requestId: event.requestId?.slice(0, 80) ?? null,
      },
    });
  } catch (err: any) {
    console.error(`[PlatformAudit] Failed to write event '${event.action}': ${err?.message}`);
  }
}
