// ── Staff role/permission vocabulary ───────────────────
// Mirrors apps/api/src/core/staff-auth/permissions.ts (PLAN §3 matrix).

import type { StaffRole } from "./types";

export const STAFF_ROLES: StaffRole[] = [
  "super_admin",
  "support",
  "finance",
  "content_editor",
  "marketing",
  "auditor",
];

export const ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: "Super Admin",
  support: "Support",
  finance: "Finance",
  content_editor: "Content Editor",
  marketing: "Marketing",
  auditor: "Auditor",
};

/** Human-readable capability summary per role (shown in the invite dialog). */
export const ROLE_SUMMARIES: Record<StaffRole, string> = {
  super_admin:
    "Full access: all permissions including staff management, tenant delete, impersonation, plan overrides and system ops.",
  support:
    "Read tenants/billing, impersonate users, support ops (password reset, force logout, resend verification, change owner), tickets and comms.",
  finance:
    "Read tenants/billing/analytics, suspend & reactivate tenants, plan overrides/comp and plan pricing writes.",
  content_editor:
    "Dashboard access plus catalogue writes (breeds, performance targets, vaccination templates, diseases, feed stages).",
  marketing:
    "Dashboard access plus announcements, ad campaigns, comms log and growth analytics.",
  auditor:
    "Read-only: dashboard, tenants, billing, tickets, comms log, analytics and platform audit events.",
};

export function hasPerm(user: { permissions?: string[]; role?: string } | null | undefined, perm: string): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  const perms = user.permissions;
  if (!perms) return false;
  return perms.includes("*") || perms.includes(perm);
}

export function hasAnyPerm(user: { permissions?: string[]; role?: string } | null | undefined, perms: string[]): boolean {
  return perms.some((p) => hasPerm(user, p));
}
