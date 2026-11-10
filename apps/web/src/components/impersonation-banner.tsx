"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api/client";

type ImpersonationInfo = {
  sessionId: string;
  staffId: string;
  expiresAt: string;
  actingAs: string;
};

function readInfo(): ImpersonationInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("nkuku_impersonation");
    return raw ? (JSON.parse(raw) as ImpersonationInfo) : null;
  } catch {
    return null;
  }
}

function formatRemaining(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Persistent "viewing as" banner shown while a staff impersonation session
 * is active (P2, super-admin console). Ends the session by clearing the
 * impersonation cookie server-side, then returns the staff member to login.
 */
export function ImpersonationBanner() {
  const [info, setInfo] = useState<ImpersonationInfo | null>(null);
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const i = readInfo();
    if (!i) return;
    setInfo(i);
    const tick = () => {
      const left = new Date(i.expiresAt).getTime() - Date.now();
      setRemaining(formatRemaining(left));
      if (left <= 0) {
        localStorage.removeItem("nkuku_impersonation");
        window.location.href = "/login";
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  if (!info) return null;

  const endSession = async () => {
    try {
      await fetch(`${API_URL}/api/v1/auth/impersonation-session/end`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Cookie clearing is best-effort — the token is short-lived anyway.
    }
    localStorage.removeItem("nkuku_impersonation");
    localStorage.removeItem("nkuku_user");
    window.location.href = "/login";
  };

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-amber-500 px-4 py-1.5 text-sm font-medium text-amber-950">
      <span>
        Viewing as <strong>{info.actingAs}</strong> — support session ends in {remaining}
      </span>
      <button
        onClick={endSession}
        className="rounded bg-amber-950/90 px-2 py-0.5 text-xs font-semibold text-amber-50 hover:bg-amber-950"
      >
        End session
      </button>
    </div>
  );
}
