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

// ── P3: support tickets ────────────────────────────────

export type TicketStatus =
  | "open"
  | "in_progress"
  | "waiting_on_user"
  | "resolved"
  | "closed";

export interface StaffRef {
  id: string;
  email: string;
  name: string | null;
}

export interface TicketListItem {
  id: string;
  subject: string;
  category: string;
  status: TicketStatus;
  priority: string;
  createdAt: string;
  lastMessageAt: string | null;
  organization: { id: string; name: string } | null;
  requester: { id: string; email: string; name: string | null } | null;
  assignee: StaffRef | null;
  messageCount: number;
  /** API heuristic: open/in-progress or re-pinged after resolved. */
  awaitingStaffReply?: boolean;
  resolvedAt?: string | null;
}

export interface TicketMessage {
  id: string;
  authorType: "user" | "staff";
  authorUserId?: string | null;
  authorStaffId?: string | null;
  body: string;
  internalNote: boolean;
  createdAt: string;
  author: { email: string; name: string | null } | null;
}

export interface TicketDetail {
  ticket: {
    id: string;
    subject: string;
    category: string;
    status: TicketStatus;
    priority: string;
    meta?: Record<string, any> | null;
    organization: {
      id: string;
      name: string;
      planCode: string;
      suspendedAt?: string | null;
      /** API may send a boolean instead of a timestamp. */
      suspended?: boolean;
      isDemo?: boolean;
    } | null;
    requester: {
      id: string;
      email: string;
      name: string | null;
      role?: string;
    } | null;
    assignee: StaffRef | null;
    createdAt: string;
    lastMessageAt: string | null;
    resolvedAt?: string | null;
  };
  messages: TicketMessage[];
}

// ── P3: comms log ──────────────────────────────────────

export interface CommsLogItem {
  id: string;
  channel: "email" | "sms" | "push" | string;
  toAddr: string;
  subject: string | null;
  template: string | null;
  status: string;
  error: string | null;
  createdAt: string;
  resendOfId: string | null;
  organizationId: string | null;
  /** API sends the org relation — we surface its name over the raw id. */
  organization?: { id: string; name: string } | null;
  providerRef?: string | null;
  sentByStaff?: { id: string; email: string; name: string | null } | null;
  /** Resend needs a stored body — absent bodies are rejected server-side. */
  hasBody?: boolean;
}

// ── P3: platform health ────────────────────────────────

export type RagStatus = "green" | "amber" | "red";

export interface HealthCheck {
  name: string;
  status: RagStatus;
  latencyMs?: number | null;
  detail?: string | null;
  error?: string | null;
}

export interface CronJobStatus {
  name: string;
  lastRunAt: string | null;
  lastStatus: string | null;
  ageMinutes: number | null;
  expectedMinutes: number | null;
  stale: boolean;
  /** Extra fields the API reports per job. */
  schedule?: string;
  rag?: RagStatus;
  detail?: string | null;
  lastFinishedAt?: string | null;
  ageSec?: number | null;
}

export interface PlatformHealth {
  overall: RagStatus;
  checkedAt: string;
  checks: HealthCheck[];
  cron: CronJobStatus[];
  system: {
    uptimeSec?: number;
    version?: string;
    dbSizeBytes?: number;
    diskFreePct?: number;
  };
  /** Maintenance-mode state when the API surfaces it (shape not yet frozen —
   *  normalised in lib/api/platform.ts from health payload). */
  maintenance?: { enabled: boolean; message?: string | null } | null;
}
