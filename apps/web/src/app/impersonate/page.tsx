"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_URL } from "@/lib/api/client";

/**
 * Staff impersonation handoff (P2, super-admin console).
 * The admin console opens /impersonate?token=<jwt> here; we exchange the
 * Bearer token for the app's HttpOnly cookie via POST /auth/impersonation-session,
 * stash the session markers for the banner, then enter the app.
 */
export default function ImpersonatePage() {
  return (
    <Suspense>
      <ImpersonateInner />
    </Suspense>
  );
}

function ImpersonateInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = params.get("token");
    if (!token) {
      setError("Missing impersonation token.");
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/auth/impersonation-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setError(data?.message || data?.error || "Impersonation session could not be started.");
          return;
        }
        localStorage.setItem("nkuku_user", JSON.stringify(data.user));
        localStorage.setItem(
          "nkuku_impersonation",
          JSON.stringify({
            sessionId: data.impersonation.sessionId,
            staffId: data.impersonation.staffId,
            expiresAt: data.expiresAt,
            actingAs: data.user?.email || data.user?.name || "tenant user",
          }),
        );
        window.location.href = "/";
      } catch {
        setError("Network error starting the impersonation session.");
      }
    })();
  }, [params, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm rounded-lg border bg-background p-6 text-center shadow-sm">
        {error ? (
          <>
            <h1 className="mb-2 text-lg font-semibold text-destructive">Impersonation failed</h1>
            <p className="mb-4 text-sm text-muted-foreground">{error}</p>
            <a href="/login" className="text-sm font-medium text-primary underline">
              Back to login
            </a>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Starting support session…</p>
          </>
        )}
      </div>
    </div>
  );
}
