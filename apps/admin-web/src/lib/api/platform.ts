// ── Platform API endpoint helpers ──────────────────────
// Typed wrappers over /api/v1/platform/* (with /api/v1/admin/* fallback
// for dashboard data while B-group routes land). Response normalisers
// tolerate the small field-name drift between the spec and the live
// A-group implementation (e.g. login returns `user`, spec said `staff`).

import {
  ADMIN_BASE,
  ApiRequestError,
  PLATFORM_BASE,
  apiFetch,
  clearSession,
  getReauthAt,
  getRefreshToken,
  setReauthAt,
  setSession,
  setStoredUser,
} from "./client";
import type {
  AnnouncementPayload,
  AuditEvent,
  CommsLogItem,
  FailedPayments,
  FeatureFlag,
  FeatureFlagPatch,
  ImpersonationResult,
  ImpersonationSession,
  Paged,
  PlanPatch,
  PlanPrice,
  PlatformAnnouncement,
  PlatformHealth,
  PlatformMetrics,
  PlatformPlan,
  StaffRole,
  StaffUser,
  TenantDetail,
  TenantListItem,
  TenantMember,
  TicketDetail,
  TicketListItem,
  TicketStatus,
} from "../types";

// ── normalisers ────────────────────────────────────────

function unwrapUser(data: any): any {
  return data?.user ?? data?.staff ?? data;
}

function normalizeMember(m: any): TenantMember {
  const u = m?.user ?? m ?? {};
  return {
    id: m?.id ?? u?.id ?? "",
    userId: m?.userId ?? u?.id ?? m?.id ?? "",
    email: u?.email ?? m?.email ?? "",
    name: u?.name ?? m?.name ?? null,
    role: m?.role ?? u?.role ?? "",
    isOwner: (m?.role ?? u?.role) === "owner",
    createdAt: u?.createdAt ?? m?.createdAt,
    lastLoginAt: u?.lastLoginAt ?? m?.lastLoginAt ?? null,
  };
}

function normalizeTenantDetail(raw: any): TenantDetail {
  const org = raw?.organization ?? raw ?? {};
  const members = (raw?.members ?? org?.members ?? []).map(normalizeMember);
  return {
    id: org.id,
    name: org.name,
    planCode: org.planCode ?? raw?.effectivePlanCode ?? "",
    country: org.country ?? null,
    currency: org.currency ?? "ZMW",
    createdAt: org.createdAt,
    suspendedAt: org.suspendedAt ?? raw?.suspendedAt ?? null,
    suspendedReason: org.suspendedReason ?? raw?.suspendedReason ?? null,
    suspendedMessage: org.suspendedMessage ?? raw?.suspendedMessage ?? null,
    override: raw?.override ?? org?.override ?? null,
    limits: raw?.limits ?? org?.limits ?? null,
    usage: raw?.usage ?? (org?._count ? { flocks: org._count.flocks ?? 0, users: org._count.members ?? 0 } : undefined),
    members,
    subscriptions: raw?.subscriptions ?? org?.subscriptions ?? [],
    invoices: raw?.invoices ?? org?.invoices ?? [],
    recentAudit: raw?.recentAudit ?? raw?.auditEvents ?? [],
    userCount: raw?.usage?.users ?? org?._count?.members,
    flockCount: raw?.usage?.flocks ?? org?._count?.flocks,
  };
}

// ── auth ───────────────────────────────────────────────

export type LoginResult =
  | { requiresTotpEnrollment: true; ticket: string }
  | { requiresTotp: true; ticket: string }
  | { accessToken: string; refreshToken: string; user: StaffUser };

export async function staffLogin(email: string, password: string): Promise<LoginResult> {
  const data = await apiFetch<any>(`${PLATFORM_BASE}/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (data?.accessToken) {
    const user = unwrapUser(data);
    setSession(data.accessToken, data.refreshToken, user);
    return { ...data, user };
  }
  return data;
}

export async function totpEnroll(ticket: string): Promise<{ secret: string; otpauthUrl: string; qrDataUrl?: string }> {
  return apiFetch(`${PLATFORM_BASE}/auth/totp/enroll`, {
    method: "POST",
    body: JSON.stringify({ ticket }),
  });
}

export async function totpConfirm(ticket: string, code: string): Promise<{ recoveryCodes?: string[]; user: StaffUser }> {
  const data = await apiFetch<any>(`${PLATFORM_BASE}/auth/totp/confirm`, {
    method: "POST",
    body: JSON.stringify({ ticket, code }),
  });
  const user = unwrapUser(data);
  setSession(data.accessToken, data.refreshToken, user);
  setReauthAt(Date.now()); // fresh password+TOTP login counts as re-auth
  return { ...data, user };
}

export async function totpVerify(ticket: string, code: string): Promise<{ user: StaffUser }> {
  const data = await apiFetch<any>(`${PLATFORM_BASE}/auth/totp/verify`, {
    method: "POST",
    body: JSON.stringify({ ticket, code }),
  });
  const user = unwrapUser(data);
  setSession(data.accessToken, data.refreshToken, user);
  setReauthAt(Date.now());
  return { ...data, user };
}

export async function bootstrapSetPassword(token: string, password: string): Promise<{ requiresTotpEnrollment?: boolean; ticket?: string }> {
  return apiFetch(`${PLATFORM_BASE}/auth/bootstrap`, {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export async function fetchMe(): Promise<{ user: StaffUser | null; reauthAt: number | null }> {
  const data = await apiFetch<any>(`${PLATFORM_BASE}/auth/me`);
  const user = unwrapUser(data);
  if (user) setStoredUser(user);
  if (typeof data?.reauthAt === "number") setReauthAt(data.reauthAt);
  return { user, reauthAt: data?.reauthAt ?? null };
}

/** Fresh re-auth — password OR TOTP code. Returns the new reauthAt (ms). */
export async function reauth(body: { password?: string; totp?: string }): Promise<number> {
  const data = await apiFetch<{ accessToken: string; reauthAt: number }>(
    `${PLATFORM_BASE}/auth/reauth`,
    { method: "POST", body: JSON.stringify(body) }
  );
  setSession(data.accessToken, undefined);
  setReauthAt(data.reauthAt ?? Date.now());
  return data.reauthAt ?? Date.now();
}

export function isReauthFresh(windowMs = 5 * 60 * 1000): boolean {
  const at = getReauthAt();
  return at !== null && Date.now() - at <= windowMs;
}

export async function staffLogout() {
  const rt = getRefreshToken();
  try {
    await apiFetch(`${PLATFORM_BASE}/auth/logout`, {
      method: "POST",
      body: JSON.stringify(rt ? { refreshToken: rt } : {}),
    });
  } catch {
    // best effort — local session is cleared regardless
  }
  clearSession();
}

// ── staff management (staff.manage) ────────────────────

export async function listStaff(): Promise<{ items: StaffUser[]; count: number }> {
  return apiFetch(`${PLATFORM_BASE}/staff`);
}

export async function inviteStaff(body: { email: string; name: string; role: StaffRole }) {
  return apiFetch<{ staff: StaffUser; emailSent: boolean; devInviteUrl?: string }>(
    `${PLATFORM_BASE}/staff/invite`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export async function disableStaff(id: string) {
  return apiFetch(`${PLATFORM_BASE}/staff/${id}/disable`, { method: "POST", body: "{}" });
}

export async function changeStaffRole(id: string, role: StaffRole) {
  return apiFetch(`${PLATFORM_BASE}/staff/${id}/role`, {
    method: "POST",
    body: JSON.stringify({ role }),
  });
}

export async function resetStaffTotp(id: string) {
  return apiFetch(`${PLATFORM_BASE}/staff/${id}/reset-totp`, { method: "POST", body: "{}" });
}

// ── tenants ────────────────────────────────────────────

export interface TenantListQuery {
  search?: string;
  plan?: string;
  status?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export async function listTenants(q: TenantListQuery): Promise<Paged<TenantListItem>> {
  const params = new URLSearchParams();
  if (q.search) params.set("search", q.search);
  if (q.plan) params.set("plan", q.plan);
  if (q.status) params.set("status", q.status);
  if (q.sortBy) {
    params.set("sortBy", q.sortBy);
    params.set("sortDir", q.sortDir ?? "desc");
  }
  params.set("page", String(q.page ?? 1));
  params.set("pageSize", String(q.pageSize ?? 20));
  return apiFetch(`${PLATFORM_BASE}/tenants?${params.toString()}`);
}

export async function getTenant(id: string): Promise<TenantDetail> {
  const raw = await apiFetch<any>(`${PLATFORM_BASE}/tenants/${id}`);
  return normalizeTenantDetail(raw);
}

export async function overrideTenant(id: string, body: {
  planCode?: string;
  limitsJson?: Record<string, any>;
  compUntil?: string;
  expiresAt?: string;
  reason: string;
}) {
  return apiFetch(`${PLATFORM_BASE}/tenants/${id}/override`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function suspendTenant(id: string, body: { reason: string; message?: string }) {
  return apiFetch(`${PLATFORM_BASE}/tenants/${id}/suspend`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function reactivateTenant(id: string, body: { reason?: string } = {}) {
  return apiFetch(`${PLATFORM_BASE}/tenants/${id}/reactivate`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function tenantMemberOp(
  id: string,
  userId: string,
  op: "reset-password" | "force-logout" | "resend-verification"
) {
  return apiFetch(`${PLATFORM_BASE}/tenants/${id}/members/${userId}/${op}`, {
    method: "POST",
    body: "{}",
  });
}

export async function changeTenantOwner(id: string, body: { newOwnerUserId: string; reason: string }) {
  return apiFetch(`${PLATFORM_BASE}/tenants/${id}/change-owner`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deleteTenant(id: string, body: { confirmName: string; reason: string }) {
  return apiFetch(`${PLATFORM_BASE}/tenants/${id}/delete`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function impersonateTenant(
  id: string,
  body: { targetUserId: string; reason: string; ticketId?: string }
): Promise<ImpersonationResult> {
  const data = await apiFetch<any>(`${PLATFORM_BASE}/tenants/${id}/impersonate`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return {
    token: data.token,
    expiresAt: data.expiresAt ?? data.session?.expiresAt,
    sessionId: data.sessionId ?? data.session?.id ?? data.impersonationSessionId,
    banner: data.banner,
  };
}

export async function endImpersonation(sessionId: string) {
  return apiFetch(`${PLATFORM_BASE}/impersonation/${sessionId}/end`, {
    method: "POST",
    body: "{}",
  });
}

export async function listImpersonations(params: { orgId?: string; active?: boolean }) {
  const qs = new URLSearchParams();
  if (params.orgId) qs.set("orgId", params.orgId);
  if (params.active !== undefined) qs.set("active", String(params.active));
  const data = await apiFetch<any>(`${PLATFORM_BASE}/impersonation?${qs.toString()}`);
  const items: ImpersonationSession[] = data?.items ?? data ?? [];
  return { items, total: data?.total ?? items.length };
}

// ── audit events ───────────────────────────────────────

export interface AuditQuery {
  action?: string;
  actor?: string;
  orgId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function listAuditEvents(q: AuditQuery): Promise<Paged<AuditEvent>> {
  const params = new URLSearchParams();
  if (q.action) params.set("action", q.action);
  if (q.actor) params.set("actor", q.actor);
  if (q.orgId) params.set("orgId", q.orgId);
  if (q.from) params.set("from", q.from);
  if (q.to) params.set("to", q.to);
  params.set("page", String(q.page ?? 1));
  params.set("pageSize", String(q.pageSize ?? 20));
  return apiFetch(`${PLATFORM_BASE}/audit-events?${params.toString()}`);
}

// ── dashboard (feature-detected: /platform → /admin) ───

async function withPlatformFallback<T>(platformPath: string, adminPath: string): Promise<T> {
  try {
    return await apiFetch<T>(`${PLATFORM_BASE}${platformPath}`);
  } catch (e) {
    if (e instanceof ApiRequestError && e.status === 404) {
      return apiFetch<T>(`${ADMIN_BASE}${adminPath}`);
    }
    throw e;
  }
}

export async function getMetrics(): Promise<PlatformMetrics> {
  return withPlatformFallback<PlatformMetrics>("/metrics", "/metrics");
}

export async function getFailedPayments(): Promise<FailedPayments> {
  return withPlatformFallback<FailedPayments>("/failed-payments", "/failed-payments");
}

// ── support tickets (support.tickets.*) ────────────────

export interface TicketListQuery {
  status?: string;
  /** "unassigned" sentinel or a staff id (resolve "me" client-side to user.id). */
  assigned?: string;
  orgId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listTickets(q: TicketListQuery): Promise<Paged<TicketListItem>> {
  const params = new URLSearchParams();
  if (q.status) params.set("status", q.status);
  if (q.assigned) params.set("assigned", q.assigned);
  if (q.orgId) params.set("orgId", q.orgId);
  if (q.search) params.set("search", q.search);
  params.set("page", String(q.page ?? 1));
  params.set("pageSize", String(q.pageSize ?? 20));
  const data = await apiFetch<any>(`${PLATFORM_BASE}/tickets?${params.toString()}`);
  // API calls the assignee relation `assignedStaff`; the contract says `assignee`.
  const items: TicketListItem[] = (data?.items ?? []).map((t: any) => ({
    ...t,
    assignee: t.assignee ?? t.assignedStaff ?? null,
  }));
  return { ...data, items };
}

export async function getTicket(id: string): Promise<TicketDetail> {
  const raw = await apiFetch<any>(`${PLATFORM_BASE}/tickets/${id}`);
  // Two possible layouts: contract nests organization/requester/assignee
  // inside `ticket`; the implementation returns them as siblings.
  const ticketRaw = raw?.ticket ?? raw ?? {};
  const org = ticketRaw.organization ?? raw?.organization ?? null;
  const ticket = {
    ...ticketRaw,
    organization: org
      ? {
          ...org,
          suspendedAt: org.suspendedAt ?? (org.suspended ? "suspended" : null),
        }
      : null,
    requester: ticketRaw.requester ?? raw?.requester ?? null,
    assignee:
      ticketRaw.assignee ?? ticketRaw.assignedStaff ?? raw?.assignee ?? raw?.assignedStaff ?? null,
  };
  return {
    ticket,
    messages: raw?.messages ?? ticketRaw.messages ?? [],
  };
}

export async function replyTicket(id: string, body: { body: string; internalNote?: boolean }) {
  return apiFetch(`${PLATFORM_BASE}/tickets/${id}/reply`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function assignTicket(id: string, staffId: string | null) {
  return apiFetch(`${PLATFORM_BASE}/tickets/${id}/assign`, {
    method: "POST",
    body: JSON.stringify({ staffId }),
  });
}

export async function setTicketStatus(id: string, status: TicketStatus) {
  return apiFetch(`${PLATFORM_BASE}/tickets/${id}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

// ── comms log (comms.log.read / comms.resend) ──────────

export interface CommsQuery {
  channel?: string;
  status?: string;
  orgId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

/** Date-input values ("YYYY-MM-DD") need a time component for the API's
 *  z.string().datetime() filters — expand to day bounds. */
function toIsoBound(date: string, end: "start" | "end"): string {
  if (date.includes("T")) return date;
  const suffix = end === "start" ? "T00:00:00.000" : "T23:59:59.999";
  return new Date(`${date}${suffix}`).toISOString();
}

export async function listComms(q: CommsQuery): Promise<Paged<CommsLogItem>> {
  const params = new URLSearchParams();
  if (q.channel) params.set("channel", q.channel);
  if (q.status) params.set("status", q.status);
  if (q.orgId) params.set("orgId", q.orgId);
  if (q.from) params.set("from", toIsoBound(q.from, "start"));
  if (q.to) params.set("to", toIsoBound(q.to, "end"));
  params.set("page", String(q.page ?? 1));
  params.set("pageSize", String(q.pageSize ?? 20));
  const data = await apiFetch<any>(`${PLATFORM_BASE}/comms?${params.toString()}`);
  // API embeds the org relation; the contract has a bare organizationId.
  const items: CommsLogItem[] = (data?.items ?? []).map((r: any) => ({
    ...r,
    organizationId: r.organizationId ?? r.organization?.id ?? null,
  }));
  return { ...data, items };
}

export async function resendComms(id: string): Promise<{ ok: boolean; message?: string }> {
  const data = await apiFetch<any>(`${PLATFORM_BASE}/comms/${id}/resend`, {
    method: "POST",
    body: "{}",
  });
  // Contract says {ok}; implementation returns {resent, message, resendOfId}.
  return { ok: data?.ok ?? data?.resent ?? true, message: data?.message };
}

// ── platform health & ops (platform.dashboard.read / system.ops) ──

export async function getPlatformHealth(): Promise<PlatformHealth> {
  const raw = await apiFetch<any>(`${PLATFORM_BASE}/health`);
  // Implementation returns {status, checkedAt, checks:{key:{status,...}}}
  // with cron freshness nested at checks.cron.jobs; the contract describes a
  // flatter {overall, checks[], cron[], system{}} payload. Normalise both.
  const checksMap: Record<string, any> = Array.isArray(raw?.checks)
    ? Object.fromEntries(raw.checks.map((c: any) => [c.name ?? "check", c]))
    : raw?.checks ?? {};

  const checks: PlatformHealth["checks"] = Object.entries(checksMap)
    .filter(([name]) => name !== "cron") // cron freshness has its own table
    .map(([name, c]: [string, any]) => ({
      name,
      status: c.status ?? c.rag ?? "amber",
      latencyMs: c.latencyMs ?? null,
      detail:
        c.detail ??
        c.dbSizePretty ??
        c.bucket ??
        (c.freePercent != null ? `${c.freePercent}% free` : null) ??
        (c.uptimeSec != null ? `up ${c.uptimeSec}s` : null) ??
        c.reply ??
        c.note ??
        null,
      error: c.error ?? null,
    }));

  const cronRaw = raw?.cron ?? checksMap?.cron?.jobs ?? [];
  const cron: PlatformHealth["cron"] = (Array.isArray(cronRaw) ? cronRaw : []).map((j: any) => ({
    name: j.name,
    schedule: j.schedule,
    lastRunAt: j.lastRunAt ?? null,
    lastFinishedAt: j.lastFinishedAt ?? null,
    lastStatus: j.lastStatus ?? null,
    ageMinutes: j.ageMinutes ?? (j.ageSec != null ? j.ageSec / 60 : null),
    ageSec: j.ageSec ?? null,
    expectedMinutes: j.expectedMinutes ?? null,
    stale: j.stale ?? (j.rag != null && j.rag !== "green"),
    rag: j.rag,
    detail: j.detail ?? null,
  }));

  const sys = raw?.system ?? {};
  const system: PlatformHealth["system"] = {
    uptimeSec: sys.uptimeSec ?? checksMap?.api?.uptimeSec,
    version: sys.version ?? checksMap?.api?.version,
    dbSizeBytes: sys.dbSizeBytes ?? checksMap?.db?.dbSizeBytes,
    diskFreePct: sys.diskFreePct ?? checksMap?.disk?.freePercent,
  };

  // Maintenance-mode state isn't in the health payload today — accept it as a
  // top-level object, a system field, or a check named "maintenance" if added.
  const maintCheck = checks.find((c) => c.name === "maintenance");
  const maintRaw = raw?.maintenance ?? sys.maintenance ?? sys.maintenanceMode ?? null;
  const maintenance =
    maintRaw && typeof maintRaw === "object"
      ? { enabled: !!maintRaw.enabled, message: maintRaw.message ?? maintRaw.detail ?? null }
      : maintRaw !== null && maintRaw !== undefined
        ? { enabled: !!maintRaw, message: null }
        : maintCheck
          ? { enabled: maintCheck.status !== "green", message: maintCheck.detail ?? null }
          : null;

  return {
    overall: raw?.overall ?? raw?.status ?? "amber",
    checkedAt: raw?.checkedAt ?? new Date().toISOString(),
    checks,
    cron,
    system,
    maintenance,
  };
}

export async function runCronJob(name: string): Promise<{ started: boolean }> {
  return apiFetch(`${PLATFORM_BASE}/ops/cron/${encodeURIComponent(name)}/run`, {
    method: "POST",
    body: "{}",
  });
}

export async function setMaintenanceMode(body: {
  enabled: boolean;
  message?: string;
}): Promise<{ enabled: boolean; message?: string | null }> {
  const data = await apiFetch<any>(`${PLATFORM_BASE}/ops/maintenance`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  // Contract says {enabled}; implementation returns {maintenance:{enabled,message,by,at}}.
  const m = data?.maintenance;
  return {
    enabled: m?.enabled ?? data?.enabled ?? body.enabled,
    message: m?.message ?? data?.message ?? null,
  };
}

// ── P4: plans & pricing (billing.read / billing.plans.write) ──

/** Plan/flag/announcement/catalogue lists may come back as a bare array
 *  or wrapped in {items:[]} — tolerate both while the P4 routes settle. */
function unwrapItems<T>(data: any): T[] {
  if (Array.isArray(data)) return data as T[];
  if (Array.isArray(data?.items)) return data.items as T[];
  return [];
}

function normalizePlan(raw: any): PlatformPlan {
  const limits = raw?.limits ?? {};
  return {
    code: raw?.code ?? "",
    name: raw?.name ?? raw?.code ?? "",
    description: raw?.description ?? null,
    sortOrder: raw?.sortOrder ?? raw?.sort_order ?? 0,
    isSelfServe: !!(raw?.isSelfServe ?? raw?.is_self_serve),
    isActive: raw?.isActive ?? raw?.is_active ?? true,
    isTrial: !!(raw?.isTrial ?? raw?.is_trial),
    trialDays: raw?.trialDays ?? raw?.trial_days ?? null,
    limits: {
      maxActiveFlocks: limits.maxActiveFlocks ?? limits.max_active_flocks ?? 0,
      maxUsers: limits.maxUsers ?? limits.max_users ?? 0,
      maxCyclesHistory: limits.maxCyclesHistory ?? limits.max_cycles_history ?? 0,
      maxDocumentsPerRecord:
        limits.maxDocumentsPerRecord ?? limits.max_documents_per_record ?? 0,
    },
    features: raw?.features ?? limits.features ?? [],
    prices: (raw?.prices ?? raw?.priceMatrix ?? []).map((p: any) => ({
      billingCycle: p.billingCycle ?? p.billing_cycle,
      currency: p.currency,
      amount: Number(p.amount ?? 0),
    })),
  };
}

export async function listPlans(): Promise<PlatformPlan[]> {
  const data = await apiFetch<any>(`${PLATFORM_BASE}/plans`);
  return unwrapItems<any>(data).map(normalizePlan);
}

export async function updatePlan(code: string, patch: PlanPatch): Promise<PlatformPlan> {
  const data = await apiFetch<any>(`${PLATFORM_BASE}/plans/${encodeURIComponent(code)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return normalizePlan(data?.plan ?? data);
}

export async function replacePlanPrices(code: string, prices: PlanPrice[]): Promise<PlatformPlan> {
  const data = await apiFetch<any>(`${PLATFORM_BASE}/plans/${encodeURIComponent(code)}/prices`, {
    method: "PUT",
    body: JSON.stringify({ prices }),
  });
  return normalizePlan(data?.plan ?? data);
}

// ── P4: feature flags (flags.write — super_admin) ───────

function normalizeFlag(raw: any): FeatureFlag {
  return {
    key: raw?.key ?? "",
    description: raw?.description ?? null,
    enabledByDefault: !!(raw?.enabledByDefault ?? raw?.enabled_by_default),
    planOverrides: raw?.planOverrides ?? raw?.plan_overrides ?? {},
    orgOverrides: raw?.orgOverrides ?? raw?.org_overrides ?? {},
  };
}

export async function listFlags(): Promise<FeatureFlag[]> {
  const data = await apiFetch<any>(`${PLATFORM_BASE}/flags`);
  return unwrapItems<any>(data).map(normalizeFlag);
}

export async function createFlag(body: {
  key: string;
  description?: string | null;
  enabledByDefault: boolean;
}): Promise<FeatureFlag> {
  const data = await apiFetch<any>(`${PLATFORM_BASE}/flags`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return normalizeFlag(data?.flag ?? data);
}

export async function updateFlag(key: string, patch: FeatureFlagPatch): Promise<FeatureFlag> {
  const data = await apiFetch<any>(`${PLATFORM_BASE}/flags/${encodeURIComponent(key)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return normalizeFlag(data?.flag ?? data);
}

export async function deleteFlag(key: string) {
  return apiFetch(`${PLATFORM_BASE}/flags/${encodeURIComponent(key)}`, { method: "DELETE" });
}

// ── P4: announcements (announcements.write — marketing) ─

function normalizeAnnouncement(raw: any): PlatformAnnouncement {
  return {
    id: raw?.id ?? "",
    title: raw?.title ?? "",
    body: raw?.body ?? "",
    severity: raw?.severity ?? "info",
    audience: raw?.audience ?? "all",
    planCodes: raw?.planCodes ?? raw?.plan_codes ?? null,
    orgIds: raw?.orgIds ?? raw?.org_ids ?? null,
    linkUrl: raw?.linkUrl ?? raw?.link_url ?? null,
    linkLabel: raw?.linkLabel ?? raw?.link_label ?? null,
    startsAt: raw?.startsAt ?? raw?.starts_at ?? null,
    endsAt: raw?.endsAt ?? raw?.ends_at ?? null,
    isDismissible: raw?.isDismissible ?? raw?.is_dismissible ?? true,
    createdAt: raw?.createdAt ?? raw?.created_at ?? null,
    dismissalCount: raw?.dismissalCount ?? raw?.dismissal_count ?? 0,
  };
}

export async function listAnnouncements(): Promise<PlatformAnnouncement[]> {
  const data = await apiFetch<any>(`${PLATFORM_BASE}/announcements`);
  return unwrapItems<any>(data).map(normalizeAnnouncement);
}

export async function createAnnouncement(body: AnnouncementPayload): Promise<PlatformAnnouncement> {
  const data = await apiFetch<any>(`${PLATFORM_BASE}/announcements`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return normalizeAnnouncement(data?.announcement ?? data);
}

export async function updateAnnouncement(
  id: string,
  patch: Partial<AnnouncementPayload>
): Promise<PlatformAnnouncement> {
  const data = await apiFetch<any>(`${PLATFORM_BASE}/announcements/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return normalizeAnnouncement(data?.announcement ?? data);
}

export async function deleteAnnouncement(id: string) {
  return apiFetch(`${PLATFORM_BASE}/announcements/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ── P4: catalogue (catalogue.write — content_editor) ────
// Global reference data managed by staff. The tenant-facing modules
// (diseases/breeds/vaccination-*/supplier-templates) define the field
// shapes; the platform surface mirrors them under /platform/catalogue/*.

export type CatalogueEntity =
  | "diseases"
  | "breeds"
  | "vaccination-schedules"
  | "performance-targets"
  | "supplier-category-templates";

export async function listCatalogue<T = any>(entity: CatalogueEntity): Promise<T[]> {
  const data = await apiFetch<any>(`${PLATFORM_BASE}/catalogue/${entity}`);
  return unwrapItems<T>(data);
}

export async function createCatalogueItem<T = any>(
  entity: CatalogueEntity,
  body: Record<string, any>
): Promise<T> {
  const data = await apiFetch<any>(`${PLATFORM_BASE}/catalogue/${entity}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return (data?.item ?? data) as T;
}

export async function updateCatalogueItem<T = any>(
  entity: CatalogueEntity,
  id: string,
  body: Record<string, any>
): Promise<T> {
  const data = await apiFetch<any>(
    `${PLATFORM_BASE}/catalogue/${entity}/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
  return (data?.item ?? data) as T;
}

export async function deleteCatalogueItem(entity: CatalogueEntity, id: string) {
  return apiFetch(`${PLATFORM_BASE}/catalogue/${entity}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
