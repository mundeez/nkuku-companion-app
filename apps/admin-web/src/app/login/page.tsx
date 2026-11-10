"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { staffLogin } from "@/lib/api/platform";
import { useAuth } from "@/components/auth-provider";
import {
  RecoveryCodesStep,
  TotpEnrollStep,
  TotpVerifyStep,
} from "@/components/totp-steps";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";

type Step = "credentials" | "enroll" | "verify" | "recovery";

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [step, setStep] = useState<Step>("credentials");
  const [ticket, setTicket] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await staffLogin(email, password);
      if ("requiresTotpEnrollment" in res && res.requiresTotpEnrollment) {
        setTicket(res.ticket);
        setStep("enroll");
      } else if ("requiresTotp" in res && res.requiresTotp) {
        setTicket(res.ticket);
        setStep("verify");
      } else if ("accessToken" in res) {
        // No-TOTP path (shouldn't happen for staff, but tolerate it).
        await refreshUser();
        router.replace("/");
      }
    } catch (err: any) {
      setError(
        err?.body?.error === "INVALID_CREDENTIALS"
          ? "Invalid email or password"
          : err?.message || "Sign-in failed"
      );
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    await refreshUser();
    router.replace("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Nkuku Platform Console</CardTitle>
          <CardDescription>
            {step === "credentials" && "Staff sign-in — restricted surface"}
            {step === "enroll" && "Set up two-factor authentication"}
            {step === "verify" && "Two-factor verification"}
            {step === "recovery" && "Recovery codes"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "credentials" && (
            <form onSubmit={submitCredentials} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          )}

          {step === "enroll" && (
            <TotpEnrollStep
              ticket={ticket}
              onDone={(res) => {
                if (res.recoveryCodes?.length) {
                  setRecoveryCodes(res.recoveryCodes);
                  setStep("recovery");
                } else {
                  finish();
                }
              }}
            />
          )}

          {step === "verify" && <TotpVerifyStep ticket={ticket} onDone={finish} />}

          {step === "recovery" && (
            <RecoveryCodesStep codes={recoveryCodes} onDone={finish} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
