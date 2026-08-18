export const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export type ApiError = { error: string; message?: string };

export class ApiRequestError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any) {
    super(body?.error || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

function notifyIfPlanLimit(status: number, body: any) {
  if (typeof window !== "undefined" && status === 402 && body?.error === "PLAN_LIMIT_REACHED") {
    window.dispatchEvent(new CustomEvent("nkuku:plan-limit", { detail: body }));
  }
}

// Tokens are now stored in HttpOnly cookies set by the API.
// We only keep the user object (email/role) in localStorage for UI state.
function getUserFromStorage() {
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem("nkuku_user");
    return raw ? JSON.parse(raw) : null;
  }
  return null;
}

function setUserInStorage(user: any) {
  if (typeof window !== "undefined") {
    localStorage.setItem("nkuku_user", JSON.stringify(user));
  }
}

function clearUserFromStorage() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("nkuku_user");
  }
}

function handleAuthError(errorCode: string) {
  if (
    typeof window !== "undefined" &&
    (errorCode === "INVALID_TOKEN" || errorCode === "MISSING_TOKEN")
  ) {
    clearUserFromStorage();
    window.location.href = "/login";
  }
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const url = API_URL ? `${API_URL}${path}` : path;
  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // send HttpOnly cookies
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const errorCode = data?.error || `HTTP ${res.status}`;
    handleAuthError(errorCode);
    notifyIfPlanLimit(res.status, data);
    throw new ApiRequestError(res.status, data);
  }
  return data as T;
}

export async function apiUpload(
  path: string,
  formData: FormData,
): Promise<any> {
  const headers: Record<string, string> = {};
  // Do NOT set Content-Type — browser sets it with boundary automatically
  const url = API_URL ? `${API_URL}${path}` : path;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
    credentials: "include", // send HttpOnly cookies
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const errorCode = data?.error || `HTTP ${res.status}`;
    handleAuthError(errorCode);
    notifyIfPlanLimit(res.status, data);
    throw new ApiRequestError(res.status, data);
  }
  return data;
}

export async function login(email: string, password: string) {
  const data = await apiFetch<{ accessToken: string; refreshToken: string; user: any; requiresDeviceVerification?: boolean; phone?: string; message?: string }>(
    "/api/v1/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }
  );
  // New device detected — requires OTP verification
  if (data.requiresDeviceVerification) {
    return data;
  }
  // Tokens are set as HttpOnly cookies by the API; just store user for UI.
  setUserInStorage(data.user);
  return data;
}

/**
 * Login with phone + OTP (passwordless).
 * The OTP must have been sent via sendOtp() first.
 */
export async function loginWithOtp(phone: string, otp: string) {
  const data = await apiFetch<{ accessToken: string; refreshToken: string; user: any }>(
    "/api/v1/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ phone, otp }),
    }
  );
  setUserInStorage(data.user);
  return data;
}

/**
 * Send an OTP code to a phone number.
 * @param phone Phone number (E.164 or local format)
 * @param purpose "signup" | "login" | "new_device"
 */
export async function sendOtp(phone: string, purpose: "signup" | "login" | "new_device") {
  return apiFetch<{ success: boolean; message: string }>(
    "/api/v1/auth/send-otp",
    {
      method: "POST",
      body: JSON.stringify({ phone, purpose }),
    }
  );
}

/**
 * Verify an OTP code. For signup, creates the account. For login/new_device,
 * logs the user in.
 */
export async function verifyOtp(
  phone: string,
  otp: string,
  purpose: "signup" | "login" | "new_device",
  signupData?: {
    email?: string;
    password?: string;
    name: string;
    organizationName: string;
    country: string;
    currency?: string;
    consent: true;
  },
) {
  const data = await apiFetch<{ accessToken: string; refreshToken: string; user: any; organization?: any }>(
    "/api/v1/auth/verify-otp",
    {
      method: "POST",
      body: JSON.stringify({ phone, otp, purpose, signupData }),
    }
  );
  if (data.user) {
    setUserInStorage(data.user);
  }
  return data;
}

export async function register(body: {
  email?: string;
  phone?: string;
  password?: string;
  name: string;
  organizationName: string;
  country: string;
  currency?: string;
  consent: true;
}) {
  const data = await apiFetch<{
    accessToken: string;
    refreshToken: string;
    user: any;
    organization: any;
  }>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
  setUserInStorage(data.user);
  return data;
}

export async function acceptInvite(body: {
  token: string;
  password?: string;
  name?: string;
  consent: true;
}) {
  const data = await apiFetch<{
    accessToken: string;
    refreshToken: string;
    user: any;
  }>("/api/v1/auth/accept-invite", {
    method: "POST",
    body: JSON.stringify(body),
  });
  setUserInStorage(data.user);
  return data;
}

export async function logout() {
  try {
    await apiFetch("/api/v1/auth/logout", { method: "POST" });
  } catch {
    // Ignore errors — clear local state regardless
  }
  clearUserFromStorage();
}

export function getUser() {
  return getUserFromStorage();
}

// ── Social Auth ──

export type SocialProvider = "google" | "facebook" | "apple" | "microsoft";

// ── Account Management ──

export async function getProfile() {
  return apiFetch<{
    id: string;
    email: string | null;
    phone: string | null;
    name: string | null;
    role: string;
    phoneVerified: boolean;
    emailVerified: boolean;
    socialAccounts: { provider: string; providerEmail: string | null; providerName: string | null }[];
  }>("/api/v1/account/me");
}

export async function updateProfile(name: string) {
  return apiFetch<{ id: string; name: string; email: string; phone: string | null; role: string }>(
    "/api/v1/account/me",
    { method: "PATCH", body: JSON.stringify({ name }) },
  );
}

export async function linkPhone(phone: string) {
  return apiFetch<{ success: boolean; message: string; maskedPhone: string }>(
    "/api/v1/account/me/phone",
    { method: "POST", body: JSON.stringify({ phone }) },
  );
}

export async function verifyPhone(phone: string, otp: string) {
  return apiFetch<{ success: boolean; message: string }>(
    "/api/v1/account/me/phone/verify",
    { method: "POST", body: JSON.stringify({ phone, otp }) },
  );
}

export async function unlinkPhone() {
  return apiFetch<{ success: boolean; message: string }>(
    "/api/v1/account/me/phone",
    { method: "DELETE" },
  );
}

export async function sendEmailVerification() {
  return apiFetch<{ success: boolean; message: string; devToken?: string; devUrl?: string }>(
    "/api/v1/account/me/email/verify",
    { method: "POST", body: "{}" },
  );
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return apiFetch<{ success: boolean; message: string }>(
    "/api/v1/account/me/password",
    { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) },
  );
}

export async function requestPasswordReset(email: string) {
  return apiFetch<{ success: boolean; message: string; devToken?: string; devUrl?: string }>(
    "/api/v1/account/password/reset",
    { method: "POST", body: JSON.stringify({ email }) },
  );
}

export async function confirmPasswordReset(token: string, newPassword: string) {
  return apiFetch<{ success: boolean; message: string }>(
    "/api/v1/account/password/reset/confirm",
    { method: "POST", body: JSON.stringify({ token, newPassword }) },
  );
}

export async function unlinkSocialProvider(provider: SocialProvider) {
  return apiFetch<{ success: boolean; message: string }>(
    `/api/v1/account/me/social/${provider}`,
    { method: "DELETE" },
  );
}

export async function getSocialProviders() {
  return apiFetch<{
    providers: { provider: SocialProvider; configured: boolean }[];
  }>("/api/v1/auth/social/config");
}

/**
 * Get the OAuth authorization URL for a provider (web redirect flow).
 * The caller should redirect the browser to the returned URL.
 */
export async function getSocialAuthUrl(
  provider: SocialProvider,
  redirectUri: string,
) {
  return apiFetch<{ url: string; state: string }>(
    `/api/v1/auth/social/auth-url?provider=${provider}&redirectUri=${encodeURIComponent(redirectUri)}`,
  );
}

/**
 * Handle the OAuth callback — exchange the code for tokens and log in.
 * If the user doesn't exist, returns needsSignup: true with a tempToken.
 */
export async function socialCallback(
  provider: SocialProvider,
  code: string,
  state: string,
  redirectUri: string,
) {
  const data = await apiFetch<{
    accessToken?: string;
    refreshToken?: string;
    user?: any;
    organization?: any;
    needsSignup?: boolean;
    tempToken?: string;
    profile?: { email?: string; name?: string; provider: string };
  }>("/api/v1/auth/social/callback", {
    method: "POST",
    body: JSON.stringify({ provider, code, state, redirectUri }),
  });
  if (data.user) {
    setUserInStorage(data.user);
  }
  return data;
}

/**
 * Complete signup for a social user who doesn't have an organization yet.
 * Uses the tempToken from socialCallback or socialLogin.
 */
export async function socialCompleteSignup(body: {
  tempToken: string;
  organizationName: string;
  country: string;
  currency?: string;
  consent: true;
}) {
  const data = await apiFetch<{
    accessToken: string;
    refreshToken: string;
    user: any;
    organization: any;
  }>("/api/v1/auth/social/complete-signup", {
    method: "POST",
    body: JSON.stringify(body),
  });
  setUserInStorage(data.user);
  return data;
}

/**
 * Social login with an ID token (used by mobile SDKs, can also be used on web
 * with Google Identity Services).
 */
export async function socialLogin(
  provider: SocialProvider,
  token: string,
) {
  const data = await apiFetch<{
    accessToken?: string;
    refreshToken?: string;
    user?: any;
    organization?: any;
    needsSignup?: boolean;
    tempToken?: string;
    profile?: { email?: string; name?: string; provider: string };
  }>("/api/v1/auth/social/login", {
    method: "POST",
    body: JSON.stringify({ provider, token }),
  });
  if (data.user) {
    setUserInStorage(data.user);
  }
  return data;
}

// ── Billing ──

export async function getBillingPlans() {
  return apiFetch<{
    plans: {
      code: string;
      name: string;
      description: string;
      pricing: {
        monthly: Record<string, number>;
        cycle_3mo: Record<string, number>;
        annual: Record<string, number>;
      };
      limits: {
        maxActiveFlocks: number;
        maxUsers: number;
        maxCyclesHistory: number;
        maxDocumentsPerRecord: number;
        features: string[];
      };
      isSelfServe: boolean;
    }[];
  }>("/api/v1/billing/plans");
}

export async function getSubscription() {
  return apiFetch<{
    planCode: string;
    planName: string;
    billingCycle: string;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
    canceledAt: string | null;
    limits: any;
    usage: { activeFlocks: number; users: number };
  }>("/api/v1/billing/subscription");
}

export async function subscribeToPlan(planCode: string, billingCycle: string = "monthly") {
  return apiFetch<{
    subscription: any;
    invoice: any;
    checkout: { success: boolean; paymentLink?: string; txRef: string; message?: string } | null;
  }>("/api/v1/billing/subscribe", {
    method: "POST",
    body: JSON.stringify({ planCode, billingCycle }),
  });
}

export async function cancelSubscriptionApi() {
  return apiFetch<{ success: boolean; message: string }>("/api/v1/billing/cancel", {
    method: "POST",
    body: "{}",
  });
}

export async function getInvoices() {
  return apiFetch<any[]>("/api/v1/billing/invoices");
}

export async function getAddons() {
  return apiFetch<{ addons: { code: string; name: string; description: string; pricing: { monthly: Record<string, number> }; eligiblePlans: string[] }[] }>(
    "/api/v1/billing/addons"
  );
}

export async function subscribeToAddon(code: string) {
  return apiFetch<{ checkout: { success: boolean; paymentLink?: string } | null }>(
    `/api/v1/billing/addons/${code}/subscribe`,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export async function cancelAddonApi(code: string) {
  return apiFetch<{ success: boolean }>(`/api/v1/billing/addons/${code}/cancel`, {
    method: "POST",
    body: "{}",
  });
}

export type AdPage = "dashboard" | "projections" | "document_search" | "flock_detail";
export type AdPlacement = "banner" | "native";

export interface AdServeResponse {
  source: "none" | "house" | "network";
  campaign?: {
    id: string;
    advertiserName: string;
    creativeImageUrl: string;
    targetUrl: string;
    altText: string;
    placement: AdPlacement;
  };
}

export async function getAdServe(page: AdPage, placement: AdPlacement) {
  return apiFetch<AdServeResponse>(`/api/v1/ads/serve?page=${page}&placement=${placement}`);
}

export async function recordAdImpression(campaignId: string, page: AdPage) {
  return apiFetch<void>(`/api/v1/ads/${campaignId}/impression?page=${page}`, { method: "POST", body: "{}" });
}

export function adClickUrl(campaignId: string, page: AdPage) {
  return `${API_URL}/api/v1/ads/${campaignId}/click?page=${page}`;
}

export async function verifyPayment(txRef: string) {
  return apiFetch<{ success: boolean; message: string }>("/api/v1/billing/verify-payment", {
    method: "POST",
    body: JSON.stringify({ txRef }),
  });
}

// ── Ad campaign admin (platform-admin only) ──
export async function getAdCampaigns(status?: string) {
  return apiFetch<any[]>(`/api/v1/ad-campaigns${status ? `?status=${status}` : ""}`);
}

export async function getAdCampaign(id: string) {
  return apiFetch<any>(`/api/v1/ad-campaigns/${id}`);
}

export async function getAdCampaignStats(id: string) {
  return apiFetch<any>(`/api/v1/ad-campaigns/${id}/stats`);
}

export async function createAdCampaign(data: any) {
  return apiFetch<any>("/api/v1/ad-campaigns", { method: "POST", body: JSON.stringify(data) });
}

export async function updateAdCampaign(id: string, data: any) {
  return apiFetch<any>(`/api/v1/ad-campaigns/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deleteAdCampaign(id: string) {
  return apiFetch<void>(`/api/v1/ad-campaigns/${id}`, { method: "DELETE" });
}
