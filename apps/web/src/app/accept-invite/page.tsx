"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { acceptInvite } from "@/lib/api/client";
import { Suspense } from "react";

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const token = searchParams.get("token") || "";

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsAccountInfo, setNeedsAccountInfo] = useState(true);

  // The API tells us whether name/password are required by returning
  // NAME_AND_PASSWORD_REQUIRED_FOR_NEW_ACCOUNT. We default to showing the
  // fields (worst case) and hide them only if the user already has an
  // account — which we can't know until they submit. So we always show
  // them but mark them optional in the UI, and let the API validate.
  useEffect(() => {
    if (!token) setError("No invite token found in the link. Please ask your organization owner for a new invite link.");
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setError("You must accept the privacy policy and terms to join");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await acceptInvite({
        token,
        password: password || undefined,
        name: name || undefined,
        consent: true,
      });
      refreshUser();
      router.push("/");
    } catch (err: any) {
      const code = err.message || "Failed to accept invite";
      const friendly: Record<string, string> = {
        INVALID_OR_EXPIRED_INVITE: "This invite link is invalid or has expired. Please ask your organization owner to send a new invite.",
        NAME_AND_PASSWORD_REQUIRED_FOR_NEW_ACCOUNT: "This email doesn't have an account yet. Please enter your name and a password to create one.",
      };
      setError(friendly[code] || code);
      if (code === "NAME_AND_PASSWORD_REQUIRED_FOR_NEW_ACCOUNT") {
        setNeedsAccountInfo(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <img src="/logo.png" alt="Nkuku Companion" className="w-full h-auto" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl">Accept your invitation</CardTitle>
            <CardDescription>
              You&apos;ve been invited to join an organization on Nkuku Companion
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {token ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your name {needsAccountInfo && <span className="text-muted-foreground">(required for new accounts)</span>}</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Farmer"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password {needsAccountInfo && <span className="text-muted-foreground">(required for new accounts)</span>}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  placeholder="At least 8 characters"
                />
                <p className="text-xs text-muted-foreground">
                  If you already have an account with this email, just accept — no password needed.
                </p>
              </div>
              <label className="flex items-start gap-3 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-input"
                />
                <span>
                  I accept the privacy policy and terms of service. My data will be
                  processed in accordance with the Zambia Data Protection Act (No. 3 of 2021).
                </span>
              </label>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading || !token}>
                {loading ? "Joining..." : "Join organization"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button onClick={() => router.push("/login")} variant="outline" className="w-full">
                Go to sign in
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <AcceptInviteContent />
    </Suspense>
  );
}
