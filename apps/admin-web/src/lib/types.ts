// ── Platform API types ─────────────────────────────────
// Shapes for /api/v1/platform/*. A-group (auth + staff) is live;
// B-group (tenants/impersonation/audit list) is coded to the spec in
// PLAN-super-admin-console.md §4/§6-P2 — fields are read defensively
// (see lib/api/platform.ts normalisers) so minor backend deviations
// degrade gracefully instead of crashing pages.

export type StaffRole =
  | "super_admin"
  | "support"
  | "finance"
  | "content_editor"
  | "marketing"
  | "auditor";

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
  totpEnrolled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  permissions?: string[];
  totpEnabledAt?: string | null;
}

export interface StaffSession {
  accessToken: string;
  refreshToken?: string;
  user: StaffUser;
  reauthAt?: number | null;
}

export interface TenantSubscription {
  id?: string;
  status: string;
  planCode: string;
  billingCycle?: string;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
  canceledAt?: string | null;
}

export interface TenantOverride {
  planCode?: string | null;
  limitsJson?: Record<string, any> | null;
  compUntil?: string | null;
  expiresAt?: string | null;
  reason?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
}

export interface TenantListItem {
  id: string;
  name: string;
  planCode: string;
  country: string | null;
  currency: string;
  createdAt: string;
  userCount: number;
  flockCount: number;
  subscription: TenantSubscription | null;
  override?: TenantOverride | null;
  suspendedAt?: string | null;
}

export interface TenantMember {
  id: string;          // membership id
  userId: string;      // user id (target for member ops / impersonation)
  email: string;
  name?: string | null;
  role: string;        // tenant role (owner/manager/viewer/…)
  isOwner?: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
}

export interface TenantInvoice {
  id: string;
  status: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  createdAt: string;
  paidAt?: string | null;
  dueDate?: string | null;
}

export interface TenantUsage {
  flocks: number;
  users: number;
  [key: string]: number;
}

export interface TenantDetail {
  id: string;
  name: string;
  planCode: string;
  country: string | null;
  currency: string;
  createdAt: string;
  suspendedAt?: string | null;
  suspendedReason?: string | null;
  suspendedMessage?: string | null;
  override?: TenantOverride | null;
  limits?: Record<string, any> | null;
  usage?: TenantUsage;
  members: TenantMember[];
  subscriptions: TenantSubscription[];
  invoices: TenantInvoice[];
  recentAudit?: AuditEvent[];
  userCount?: number;
  flockCount?: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuditEvent {
  id: string;
  action: string;
  actorStaffId?: string | null;
  actorRole?: string | null;
  actorEmail?: string | null;
  // The API includes the staff user relation — a nested object, not a string
  actor?: { id: string; email: string | null; name: string | null; role: string } | null;
  targetType?: string | null;
  targetId?: string | null;
  organizationId?: string | null;
  organizationName?: string | null;
  reason?: string | null;
  before?: any;
  after?: any;
  ip?: string | null;
  userAgent?: string | null;
  impersonationSessionId?: string | null;
  occurredAt: string;
}

export interface ImpersonationSession {
  id: string;
  staffId?: string;
  organizationId: string;
  organizationName?: string | null;
  targetUserId: string;
  targetEmail?: string | null;
  reason?: string | null;
  ticketId?: string | null;
  startedAt: string;
  endedAt?: string | null;
  expiresAt?: string | null;
  ip?: string | null;
}

export interface ImpersonationResult {
  token: string;
  expiresAt?: string;
  sessionId?: string;
  banner?: string;
}

export interface PlatformMetrics {
  totals: {
    organizations: number;
    users: number;
    activeFlocks: number;
    activeSubscriptions: number;
    pastDueSubscriptions: number;
    suspendedSubscriptions: number;
    cancelledSubscriptions: number;
  };
  revenueByCurrency: { currency: string; amount: number }[];
  planDistribution: { plan: string; count: number }[];
  recentOrganizations: {
    id: string;
    name: string;
    planCode: string;
    country: string;
    createdAt: string;
    userCount: number;
    flockCount: number;
  }[];
}

export interface FailedPayments {
  items: {
    subscriptionId: string;
    status: string;
    planCode: string;
    organization: { id: string; name: string; planCode: string; country: string };
    currentPeriodEnd: string;
    invoices: { id: string; amountDue: number; currency: string; status: string }[];
  }[];
  count: number;
}
