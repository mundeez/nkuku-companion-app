"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { login, loginWithOtp, sendOtp, verifyOtp } from "@/lib/api/client";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";
import { SocialSignupForm } from "@/components/auth/social-signup-form";
import { useBranding } from "@/components/branding-provider";

type Mode = "email" | "phone";

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const branding = useBranding();
  const [mode, setMode] = useState<Mode>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [maskedPhone, setMaskedPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");
  const [socialSignup, setSocialSignup] = useState<{
    tempToken: string;
    profile: { email?: string; name?: string; provider: string };
  } | null>(null);

  // Email + password login (with new-device OTP challenge)
  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const data: any = await login(email, password);
      if (data.requiresDeviceVerification) {
        // New device — switch to OTP verification
        setMaskedPhone(data.phone || "");
        setInfo(data.message || "New device detected. An OTP has been sent to your phone.");
        setMode("phone");
        setOtpSent(true);
        // We don't know the full phone — user must enter it for verification
        setOtp("");
        setLoading(false);
        return;
      }
      refreshUser();
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  // Phone OTP login: send OTP
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const data = await sendOtp(phone, "login");
      setOtpSent(true);
      setInfo(data.message || "OTP sent.");
    } catch (err: any) {
      setError(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  // Phone OTP login: verify OTP
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await loginWithOtp(phone, otp);
      refreshUser();
      router.push("/");
    } catch (err: any) {
      setError(err.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  }

  // New device verification (email login triggered OTP)
  async function handleNewDeviceVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await verifyOtp(phone, otp, "new_device");
      refreshUser();
      router.push("/");
    } catch (err: any) {
      setError(err.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.appName} className="w-full h-auto" />
            ) : (
              <img src="/logo.png" alt={branding.appName} className="w-full h-auto" />
            )}
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl">{branding.appName}</CardTitle>
            <CardDescription>
              {branding.tagline}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {socialSignup ? (
            <SocialSignupForm
              tempToken={socialSignup.tempToken}
              profile={socialSignup.profile}
              onCancel={() => setSocialSignup(null)}
            />
          ) : (
            <>
              {/* Mode toggle */}
              <div className="flex gap-2 mb-4">
                <Button
                  variant={mode === "email" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => { setMode("email"); setOtpSent(false); setError(""); setInfo(""); }}
                >
                  Email + Password
                </Button>
                <Button
                  variant={mode === "phone" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => { setMode("phone"); setError(""); setInfo(""); }}
                >
                  Phone + OTP
                </Button>
              </div>

              {/* Email + Password form */}
              {mode === "email" && !otpSent && (
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <PasswordInput
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  {info && <p className="text-sm text-blue-600">{info}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                  <div className="text-center">
                    <Link href="/forgot-password" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                </form>
              )}

              {/* Phone OTP form (login or new device) */}
              {mode === "phone" && !otpSent && (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  {info && <p className="text-sm text-blue-600">{info}</p>}
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="e.g. 260970000000 or 0970000000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter your phone number with country code (260 for Zambia)
                    </p>
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Sending..." : "Send OTP"}
                  </Button>
                </form>
              )}

              {mode === "phone" && otpSent && (
                <form onSubmit={maskedPhone ? handleNewDeviceVerify : handleVerifyOtp} className="space-y-4">
                  {info && <p className="text-sm text-blue-600">{info}</p>}
                  {!maskedPhone && (
                    <div className="space-y-2">
                      <Label htmlFor="phone-verify">Phone Number</Label>
                      <Input
                        id="phone-verify"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="otp">Verification Code</Label>
                    <Input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6-digit code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Verifying..." : "Verify & Sign In"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => { setOtpSent(false); setOtp(""); setError(""); }}
                  >
                    Back
                  </Button>
                </form>
              )}

              <SocialLoginButtons
                onSuccess={() => {
                  refreshUser();
                  router.push("/");
                  router.refresh();
                }}
                onNeedsSignup={(data) => setSocialSignup(data)}
                onError={(err) => setError(err)}
              />

              <p className="text-center text-sm text-muted-foreground mt-4">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
                  Create one
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
