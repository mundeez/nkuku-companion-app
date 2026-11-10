"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { bootstrapSetPassword } from "@/lib/api/platform";
import { useAuth } from "@/components/auth-provider";
import {
  RecoveryCodesStep,
  TotpEnrollStep,
} from "@/components/totp-steps";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";

type Step = "password" | "enroll" | "recovery";

function SetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { refreshUser } = useAuth();
  const token = params.get("token") ?? "";

  const [step, setStep] = useState<Step>("password");
  const [ticket, setTicket] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const res = await bootstrapSetPassword(token, password);
      if (res.requiresTotpEnrollment && res.ticket) {
        setTicket(res.ticket);
        setStep("enroll");
      } else {
        await refreshUser();
        router.replace("/login");
      }
    } catch (err: any) {
      setError(
        err?.body?.error === "INVALID_OR_EXPIRED_TOKEN"
          ? "This invite link is invalid or has expired — ask a super_admin to re-invite you."
          : err?.body?.error === "BOOTSTRAP_ALREADY_COMPLETED"
            ? "This invite was already used — sign in instead."
            : err?.message || "Could not set password"
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
          <CardTitle>Welcome to Nkuku Platform</CardTitle>
          <CardDescription>
            {step === "password" && "Set your staff account password"}
            {step === "enroll" && "Set up two-factor authentication"}
            {step === "recovery" && "Recovery codes"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!token && step === "password" ? (
            <p className="text-sm text-destructive">
              Missing invite token. Open the full link from your invite email.
            </p>
          ) : step === "password" ? (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="pw">New password</Label>
                <PasswordInput
                  id="pw"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pw2">Confirm password</Label>
                <PasswordInput
                  id="pw2"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Saving…" : "Set password & continue"}
              </Button>
            </form>
          ) : step === "enroll" ? (
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
          ) : (
            <RecoveryCodesStep codes={recoveryCodes} onDone={finish} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordInner />
    </Suspense>
  );
}
