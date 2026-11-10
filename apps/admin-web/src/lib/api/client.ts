// ── Platform API client ────────────────────────────────
// Bearer-token client for /api/v1/platform/*. The API also sets httpOnly
// cookies (nkuku_staff_token / nkuku_staff_refresh) on its own domain —
// we mirror them as readable cookies on the admin host too, per spec,
// so either transport works depending on deployment topology.
//
// 401 → one silent /auth/refresh then retry once. If refresh fails the
// session is cleared and we bounce to /login.
// 403 REAUTH_REQUIRED → surfaced to the caller; the `withReauth` helper
// (components/reauth-modal.tsx) opens the modal and retries.

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://nkuku.zeendeefood.solutions";
export const TENANT_APP_URL =
  process.env.NEXT_PUBLIC_TENANT_APP_URL || "https://nkuku.zeendeefood.solutions";

export const PLATFORM_BASE = "/api/v1/platform";
export const ADMIN_BASE = "/api/v1/admin"; // legacy surface kept as fallback

const ACCESS_KEY = "nkuku_staff_access_token";
const REFRESH_KEY = "nkuku_staff_refresh_token";
const USER_KEY = "nkuku_staff_user";
const REAUTH_KEY = "nkuku_staff_reauth_at";
export const IMPERSONATION_KEY = "nkuku_impersonation";

// Cookie names must match the API (staff-auth.service.ts).
const ACCESS_COOKIE = "nkuku_staff_token";
const REFRESH_COOKIE = "nkuku_staff_refresh";
const IMPERSONATION_COOKIE = "nkuku_impersonating";

export class ApiRequestError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any) {
    super(body?.message || body?.error || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
  get code(): string {
    return this.body?.error || `HTTP ${this.status}`;
  }
}

// ── token storage ──────────────────────────────────────

function isBrowser() {
  return typeof window !== "undefined";
}

function setCookie(name: string, value: string, maxAgeSec: number) {
  if (!isBrowser()) return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax; max-age=${maxAgeSec}${secure}`;
}

function clearCookie(name: string) {
  if (!isBrowser()) return;
  document.cookie = `${name}=; path=/; SameSite=Lax; max-age=0`;
}

export function getAccessToken(): string | null {
  return isBrowser() ? localStorage.getItem(ACCESS_KEY) : null;
}

export function getRefreshToken(): string | null {
  return isBrowser() ? localStorage.getItem(REFRESH_KEY) : null;
}

export function getStoredUser(): any | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(USER_KEY);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getReauthAt(): number | null {
  if (!isBrowser()) return null;
  const v = Number(localStorage.getItem(REAUTH_KEY));
  return Number.isFinite(v) && v > 0 ? v : null;
}

export function setReauthAt(ts: number | null) {
  if (!isBrowser()) return;
  if (ts) localStorage.setItem(REAUTH_KEY, String(ts));
  else localStorage.removeItem(REAUTH_KEY);
}

export function setSession(accessToken: string, refreshToken: string | undefined, user?: any) {
  if (!isBrowser()) return;
  localStorage.setItem(ACCESS_KEY, accessToken);
  // 15-min access token per API; mirror cookie for the API-accepts-both spec.
  setCookie(ACCESS_COOKIE, accessToken, 15 * 60);
  if (refreshToken) {
    localStorage.setItem(REFRESH_KEY, refreshToken);
    setCookie(REFRESH_COOKIE, refreshToken, 30 * 24 * 60 * 60);
  }
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function setStoredUser(user: any) {
  if (isBrowser()) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  if (!isBrowser()) return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(REAUTH_KEY);
  localStorage.removeItem(IMPERSONATION_KEY);
  clearCookie(ACCESS_COOKIE);
  clearCookie(REFRESH_COOKIE);
  clearCookie(IMPERSONATION_COOKIE);
}

// ── impersonation marker (drives the topbar chip) ─────

export function setImpersonation(session: any) {
  if (!isBrowser()) return;
  localStorage.setItem(IMPERSONATION_KEY, JSON.stringify(session));
  setCookie(IMPERSONATION_COOKIE, "1", 60 * 60);
  window.dispatchEvent(new Event("nkuku:impersonation-changed"));
}

export function getImpersonation(): any | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(IMPERSONATION_KEY);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearImpersonation() {
  if (!isBrowser()) return;
  localStorage.removeItem(IMPERSONATION_KEY);
  clearCookie(IMPERSONATION_COOKIE);
  window.dispatchEvent(new Event("nkuku:impersonation-changed"));
}

// ── silent refresh (single-flight) ────────────────────

let refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const rt = getRefreshToken();
        const res = await fetch(`${API_URL}${PLATFORM_BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(rt ? { refreshToken: rt } : {}),
        });
        if (!res.ok) return false;
        const data = await res.json().catch(() => null);
        if (!data?.accessToken) return false;
        // Preserve reauthAt — the API carries it forward into the new token.
        setSession(data.accessToken, data.refreshToken);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

const AUTH_PAGES = ["/login", "/set-password"];

function bounceToLogin() {
  if (!isBrowser()) return;
  if (AUTH_PAGES.some((p) => window.location.pathname.startsWith(p))) return;
  clearSession();
  window.location.href = "/login";
}

// ── fetch wrapper ─────────────────────────────────────

// Pre-auth endpoints (login / totp exchange / bootstrap): a 401 there means
// bad credentials or an expired step ticket — never an expired access token,
// so we skip the refresh+retry dance for them.
const PRE_AUTH_RE = /\/auth\/(login|totp|bootstrap)\b/;

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
  _isRetry = false
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getAccessToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = /^https?:/.test(path) ? path : `${API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && !_isRetry && !PRE_AUTH_RE.test(path)) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      return apiFetch<T>(path, options, true);
    }
    const data = await res.json().catch(() => null);
    bounceToLogin();
    throw new ApiRequestError(res.status, data);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !PRE_AUTH_RE.test(path)) {
      bounceToLogin();
    }
    throw new ApiRequestError(res.status, data);
  }
  return data as T;
}
