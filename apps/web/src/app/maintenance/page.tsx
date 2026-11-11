"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api/client";

/**
 * Shown when the org is in maintenance mode (P3, platform staff console).
 * Every non-auth API call returns 503 MAINTENANCE_MODE, so the only escape
 * is retrying once staff lift the maintenance flag, or signing out.
 */
export default function MaintenancePage() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMessage(sessionStorage.getItem("nkuku_maintenance_message") || "");
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
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">
          🔧
        </div>
        <h1 className="mb-2 text-xl font-semibold">Under maintenance</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {message || "We're performing scheduled maintenance. Please try again shortly."}
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              window.location.href = "/";
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <button onClick={logout} className="text-sm text-muted-foreground underline">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
