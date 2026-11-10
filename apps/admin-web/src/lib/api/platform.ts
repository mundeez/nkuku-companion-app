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
  AuditEvent,
  FailedPayments,
  ImpersonationResult,
  ImpersonationSession,
  Paged,
  PlatformMetrics,
  StaffRole,
  StaffUser,
  TenantDetail,
  TenantListItem,
  TenantMember,
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
