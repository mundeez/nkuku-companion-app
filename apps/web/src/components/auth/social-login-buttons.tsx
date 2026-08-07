"use client";

import { useEffect, useState } from "react";
import {
  getSocialProviders,
  getSocialAuthUrl,
  socialLogin,
  type SocialProvider,
} from "@/lib/api/client";

const PROVIDER_META: Record<
  SocialProvider,
  { label: string; icon: string; color: string }
> = {
  google: {
    label: "Google",
    icon: "G",
    color: "#4285F4",
  },
  facebook: {
    label: "Facebook",
    icon: "f",
    color: "#1877F2",
  },
  apple: {
    label: "Apple",
    icon: "",
    color: "#000000",
  },
  microsoft: {
    label: "Microsoft",
    icon: "M",
    color: "#0078D4",
  },
};

interface SocialLoginButtonsProps {
  /** Called when social login succeeds (user already has an org) */
  onSuccess?: () => void;
  /** Called when social login needs signup completion (no org yet) */
  onNeedsSignup?: (data: {
    tempToken: string;
    profile: { email?: string; name?: string; provider: string };
  }) => void;
  /** Called on error */
  onError?: (error: string) => void;
}

export function SocialLoginButtons({
  onSuccess,
  onNeedsSignup,
  onError,
}: SocialLoginButtonsProps) {
  const [providers, setProviders] = useState<
    { provider: SocialProvider; configured: boolean }[]
  >([]);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    getSocialProviders()
      .then((data) => setProviders(data.providers.filter((p) => p.configured)))
      .catch(() => {});
  }, []);

  // Check for OAuth callback in URL (when returning from provider redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const provider = params.get("provider") as SocialProvider;
    if (code && state && provider) {
      handleCallback(provider, code, state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCallback(
    provider: SocialProvider,
    code: string,
    state: string,
  ) {
    setLoading(provider);
    try {
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      const { socialCallback } = await import("@/lib/api/client");
      const data = await socialCallback(provider, code, state, redirectUri);
      if (data.needsSignup && data.tempToken) {
        onNeedsSignup?.({
          tempToken: data.tempToken,
          profile: data.profile!,
        });
      } else {
        onSuccess?.();
      }
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    } catch (err: any) {
      onError?.(err.message);
      window.history.replaceState({}, "", window.location.pathname);
    } finally {
      setLoading(null);
    }
  }

  async function handleProviderClick(provider: SocialProvider) {
    setLoading(provider);
    try {
      const redirectUri = `${window.location.origin}${window.location.pathname}?provider=${provider}`;
      const { url } = await getSocialAuthUrl(provider, redirectUri);
      window.location.href = url;
    } catch (err: any) {
      onError?.(err.message);
      setLoading(null);
    }
  }

  if (providers.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            or continue with
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {providers.map(({ provider, configured }) => {
          if (!configured) return null;
          const meta = PROVIDER_META[provider];
          return (
            <button
              key={provider}
              type="button"
              disabled={loading !== null}
              onClick={() => handleProviderClick(provider)}
              className="flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              {loading === provider ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <span
                  className="flex h-5 w-5 items-center justify-center rounded text-xs font-bold text-white"
                  style={{ backgroundColor: meta.color }}
                >
                  {meta.icon || ""}
                </span>
              )}
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
