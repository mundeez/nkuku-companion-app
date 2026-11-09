// ── PLATFORM STAFF PERMISSIONS ───────────────────────────
// Implements the permission matrix from PLAN-super-admin-console.md §3
// EXACTLY. Permissions are explicit strings checked by
// requirePermission('…'); roles are bundles. A staff member has exactly
// one role; super_admin holds '*' (all permissions, present and future).

import type { StaffRole } from '@prisma/client';

/**
 * Role → permission bundle. Keep in sync with the approved matrix:
 *
 * | Permission                     | super_admin | support | finance | content_editor | marketing | auditor |
 * |--------------------------------|:-:|:-:|:-:|:-:|:-:|:-:|
 * | platform.dashboard.read        | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
 * | tenants.read                   | ✓ | ✓ | ✓ | – | – | ✓ |
 * | tenants.impersonate            | ✓ | ✓ | – | – | – | – |
 * | tenants.support_ops            | ✓ | ✓ | – | – | – | – |
 * | tenants.suspend/reactivate     | ✓ | – | ✓ | – | – | – |
 * | tenants.delete                 | ✓ | – | – | – | – | – |
 * | billing.read                   | ✓ | ✓ | ✓ | – | – | ✓ |
 * | billing.override               | ✓ | – | ✓ | – | – | – |
 * | billing.plans.write            | ✓ | – | ✓ | – | – | – |
 * | support.tickets.read/write     | ✓ | ✓ | – | – | – | read |
 * | comms.log.read / comms.resend  | ✓ | ✓ | ✓ | – | ✓ | read |
 * | catalogue.write                | ✓ | – | – | ✓ | – | – |
 * | announcements.write            | ✓ | – | – | – | ✓ | – |
 * | ads.write                      | ✓ | – | – | – | ✓ | – |
 * | flags.write                    | ✓ | – | – | – | – | – |
 * | analytics.read                 | ✓ | – | ✓ | – | ✓ | ✓ |
 * | audit.read                     | ✓ | – | – | – | – | ✓ |
 * | staff.manage                   | ✓ | – | – | – | – | – |
 * | system.ops                     | ✓ | – | – | – | – | – |
 */
/**
 * The complete permission vocabulary (every string in the §3 matrix).
 * Used to resolve super_admin's '*' into the full list.
 */
export const ALL_PERMISSIONS: readonly string[] = [
  'platform.dashboard.read',
  'tenants.read',
  'tenants.impersonate',
  'tenants.support_ops',
  'tenants.suspend',
  'tenants.reactivate',
  'tenants.delete',
  'billing.read',
  'billing.override',
  'billing.plans.write',
  'support.tickets.read',
  'support.tickets.write',
  'comms.log.read',
  'comms.resend',
  'catalogue.write',
  'announcements.write',
  'ads.write',
  'flags.write',
  'analytics.read',
  'audit.read',
  'staff.manage',
  'system.ops',
];

export const ROLE_PERMISSIONS: Record<StaffRole, ReadonlySet<string>> = {
  super_admin: new Set(['*']),
  support: new Set([
    'platform.dashboard.read',
    'tenants.read',
    'tenants.impersonate',
    'tenants.support_ops',
    'billing.read',
    'support.tickets.read',
    'support.tickets.write',
    'comms.log.read',
    'comms.resend',
  ]),
  finance: new Set([
    'platform.dashboard.read',
    'tenants.read',
    'tenants.suspend',
    'tenants.reactivate',
    'billing.read',
    'billing.override',
    'billing.plans.write',
    'comms.log.read',
    'comms.resend',
    'analytics.read',
  ]),
  content_editor: new Set([
    'platform.dashboard.read',
    'catalogue.write',
  ]),
  marketing: new Set([
    'platform.dashboard.read',
    'comms.log.read',
    'comms.resend',
    'announcements.write',
    'ads.write',
    'analytics.read',
  ]),
  auditor: new Set([
    'platform.dashboard.read',
    'tenants.read',
    'billing.read',
    'support.tickets.read',
    'comms.log.read',
    'analytics.read',
    'audit.read',
  ]),
};

/**
 * Permissions that additionally require a fresh re-auth (password or
 * TOTP within the last 5 minutes) — plan §3 hard rules.
 */
export const REAUTH_REQUIRED_PERMISSIONS: ReadonlySet<string> = new Set([
  'tenants.impersonate',
  'tenants.support_ops',
  'tenants.suspend',
  'tenants.reactivate',
  'tenants.delete',
  'billing.override',
  'billing.plans.write',
  'flags.write',
  'staff.manage',
  'system.ops',
]);

/** Does this role grant the permission? super_admin ('*') grants all. */
export function hasPermission(role: StaffRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.has('*') || perms.has(permission);
}

/** All permissions granted to a role (resolves '*' for super_admin). */
export function permissionsForRole(role: StaffRole): string[] {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return [];
  if (perms.has('*')) return [...ALL_PERMISSIONS];
  return [...perms].sort();
}

/**
 * Fastify preHandler factory — requires request.staffUser (populated by
 * requireStaff) to hold every listed permission. 403 FORBIDDEN otherwise.
 * Chain after requireStaff (requireStaff itself accepts permission args
 * too; this wrapper exists for readability per plan §3).
 */
export function requirePermission(...permissions: string[]) {
  return async (request: any, reply: any) => {
    const staff = request.staffUser as { role?: StaffRole } | undefined;
    if (!staff?.role) {
      return reply.status(401).send({ error: 'MISSING_TOKEN' });
    }
    for (const perm of permissions) {
      if (!hasPermission(staff.role, perm)) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: `Permission '${perm}' required` });
      }
    }
  };
}
