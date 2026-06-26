const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export type ApiError = { error: string; message?: string };

function getToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("nkuku_access_token");
  }
  return null;
}

function handleAuthError(errorCode: string) {
  if (
    typeof window !== "undefined" &&
    (errorCode === "INVALID_TOKEN" || errorCode === "MISSING_TOKEN")
  ) {
    localStorage.removeItem("nkuku_access_token");
    localStorage.removeItem("nkuku_refresh_token");
    localStorage.removeItem("nkuku_user");
    window.location.href = "/login";
  }
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const url = API_URL ? `${API_URL}${path}` : path;
  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const errorCode = data?.error || `HTTP ${res.status}`;
    handleAuthError(errorCode);
    throw new Error(errorCode);
  }
  return data as T;
}

export async function login(email: string, password: string) {
  const data = await apiFetch<{ accessToken: string; refreshToken: string; user: any }>(
    "/api/v1/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }
  );
  if (typeof window !== "undefined") {
    localStorage.setItem("nkuku_access_token", data.accessToken);
    localStorage.setItem("nkuku_refresh_token", data.refreshToken);
    localStorage.setItem("nkuku_user", JSON.stringify(data.user));
  }
  return data;
}

export function logout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("nkuku_access_token");
    localStorage.removeItem("nkuku_refresh_token");
    localStorage.removeItem("nkuku_user");
  }
}

export function getUser() {
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem("nkuku_user");
    return raw ? JSON.parse(raw) : null;
  }
  return null;
}
