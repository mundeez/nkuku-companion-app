"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { StaffUser } from "@/lib/types";
import { hasPerm as checkPerm } from "@/lib/rbac";
import { getAccessToken, getStoredUser } from "@/lib/api/client";
import { fetchMe, staffLogout } from "@/lib/api/platform";

interface AuthContextType {
  user: StaffUser | null;
  isLoading: boolean;
  hasPermission: (perm: string) => boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  hasPermission: () => false,
  logout: async () => {},
  refreshUser: async () => {},
});

const PUBLIC_PATHS = ["/login", "/set-password"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshUser = useCallback(async () => {
    // Fast path: cached user for first paint; then verify against /auth/me.
    const cached = getStoredUser();
    if (cached) setUser(cached);
    if (!getAccessToken()) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const { user: me } = await fetchMe();
      setUser(me);
    } catch {
      // Transient failure: keep the cached user (if any) so a flaky network
      // doesn't kick staff out. A real 401 already cleared storage via
      // apiFetch → getStoredUser() returns null and we drop to login.
      if (!getStoredUser()) setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (isLoading) return;
    const isPublic = PUBLIC_PATHS.some((p) => pathname?.startsWith(p));
    if (!user && !isPublic) {
      // Real 401s already cleared the session inside apiFetch; here we just
      // redirect so a transient /auth/me failure doesn't wipe valid tokens.
      router.replace("/login");
    } else if (user && pathname?.startsWith("/login")) {
      router.replace("/");
    }
  }, [user, isLoading, pathname, router]);

  const hasPermission = useCallback(
    (perm: string) => checkPerm(user, perm),
    [user]
  );

  const logout = useCallback(async () => {
    await staffLogout();
    setUser(null);
    window.location.href = "/login";
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, hasPermission, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
