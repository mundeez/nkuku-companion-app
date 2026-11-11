"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api/client";

/**
 * Shown when the org is platform-suspended (P2, super-admin console).
 * Every API call returns 423 ORG_SUSPENDED except GET /api/v1/billing/* —
 * so we link to billing info where the tenant can resolve the suspension.
 */
export default function SuspendedPage() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMessage(sessionStorage.getItem("nkuku_suspended_message") || "");
  }, []);

  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/v1/auth/logout`, { method: "POST", credentials: "include" });
    } catch {
      // best-effort
    }
    localStorage.removeItem("nkuku_user");
    window.location.href = "/login";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md rounded-lg border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-2xl">
          ⛔
        </div>
        <h1 className="mb-2 text-xl font-semibold">Account suspended</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {message || "This organization has been suspended. Please contact support."}
        </p>
        <div className="flex flex-col gap-2">
          <a
            href="mailto:support@deeztechnology.solutions"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Contact support
          </a>
          <button onClick={logout} className="text-sm text-muted-foreground underline">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
