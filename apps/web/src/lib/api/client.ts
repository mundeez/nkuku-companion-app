export const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export type ApiError = { error: string; message?: string };

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
    throw new Error(errorCode);
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
    throw new Error(errorCode);
  }
  return data;
}

export async function login(email: string, password: string) {
  const data = await apiFetch<{ accessToken: string; refreshToken: string; user: any }>(
    "/api/v1/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }
  );
  // Tokens are set as HttpOnly cookies by the API; just store user for UI.
  setUserInStorage(data.user);
  return data;
}

export async function register(body: {
  email: string;
  password: string;
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
