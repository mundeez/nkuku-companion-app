"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { register, sendOtp, verifyOtp } from "@/lib/api/client";

const COUNTRIES = [
  { code: "ZM", name: "Zambia" },
  { code: "BW", name: "Botswana" },
  { code: "ZW", name: "Zimbabwe" },
  { code: "NA", name: "Namibia" },
  { code: "ZA", name: "South Africa" },
  { code: "MW", name: "Malawi" },
  { code: "MZ", name: "Mozambique" },
  { code: "TZ", name: "Tanzania" },
  { code: "KE", name: "Kenya" },
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "UG", name: "Uganda" },
];

const CURRENCIES = [
  { code: "ZMW", name: "Zambian Kwacha (ZMW)" },
  { code: "BWP", name: "Botswana Pula (BWP)" },
  { code: "USD", name: "US Dollar (USD)" },
  { code: "ZAR", name: "South African Rand (ZAR)" },
  { code: "ZWL", name: "Zimbabwe Gold (ZiG)" },
];

type SignupMode = "email" | "phone";

export default function SignupPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [mode, setMode] = useState<SignupMode>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [country, setCountry] = useState("ZM");
  const [currency, setCurrency] = useState("ZMW");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  // Email signup (no OTP needed — password-based auth)
  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setError("You must accept the privacy policy and terms to create an account");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await register({
        email,
        password,
        name,
        organizationName,
        country,
        currency,
        consent: true,
      });
      refreshUser();
      router.push("/");
    } catch (err: any) {
      const code = err.message || "Signup failed";
      const friendly: Record<string, string> = {
        EMAIL_ALREADY_REGISTERED: "An account with this email already exists. Try signing in instead.",
      };
      setError(friendly[code] || code);
    } finally {
      setLoading(false);
    }
  }

  // Phone signup step 1: send OTP
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setError("You must accept the privacy policy and terms to create an account");
      return;
    }
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const data = await sendOtp(phone, "signup");
      setOtpSent(true);
      setInfo(data.message || "OTP sent to your phone.");
    } catch (err: any) {
      const code = err.message || "Failed to send OTP";
      const friendly: Record<string, string> = {
        PHONE_ALREADY_REGISTERED: "An account with this phone number already exists. Try signing in instead.",
        OTP_RATE_LIMITED: "Please wait 60 seconds before requesting a new code.",
      };
      setError(friendly[code] || code);
    } finally {
      setLoading(false);
    }
  }

  // Phone signup step 2: verify OTP and create account
  async function handleVerifyAndSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await verifyOtp(phone, otp, "signup", {
        name,
        organizationName,
        country,
        currency,
        consent: true,
      });
      refreshUser();
      router.push("/");
    } catch (err: any) {
      const code = err.message || "Verification failed";
      const friendly: Record<string, string> = {
        INVALID_OR_EXPIRED_OTP: "Invalid or expired code. Please try again.",
        EMAIL_ALREADY_REGISTERED: "An account with this email already exists.",
        PHONE_ALREADY_REGISTERED: "An account with this phone number already exists.",
      };
      setError(friendly[code] || code);
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
            <CardTitle className="text-2xl">Create your account</CardTitle>
            <CardDescription>
              Start managing your broiler production in minutes
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {/* Mode toggle */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={mode === "email" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => { setMode("email"); setOtpSent(false); setError(""); setInfo(""); }}
            >
              With Email
            </Button>
            <Button
              variant={mode === "phone" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => { setMode("phone"); setError(""); setInfo(""); }}
            >
              With Phone (OTP)
            </Button>
          </div>

          {/* Common fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Jane Farmer"
              />
            </div>

            {/* Email mode */}
            {mode === "email" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="jane@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                  />
                </div>
              </>
            )}

            {/* Phone mode */}
            {mode === "phone" && !otpSent && (
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  placeholder="e.g. 260970000000 or 0970000000"
                />
                <p className="text-xs text-muted-foreground">
                  Enter your phone number with country code (260 for Zambia). You&apos;ll receive a verification code via SMS.
                </p>
              </div>
            )}

            {mode === "phone" && otpSent && (
              <div className="space-y-2">
                {info && <p className="text-sm text-blue-600">{info}</p>}
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
                <p className="text-xs text-muted-foreground">
                  Enter the code sent to your phone.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="orgName">Farm / organization name</Label>
              <Input
                id="orgName"
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                required
                placeholder="Green Acres Poultry Farm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <select
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
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

            {/* Submit button depends on mode */}
            {mode === "email" && (
              <Button onClick={handleEmailSignup} className="w-full" disabled={loading}>
                {loading ? "Creating account..." : "Create account"}
              </Button>
            )}
            {mode === "phone" && !otpSent && (
              <Button onClick={handleSendOtp} className="w-full" disabled={loading}>
                {loading ? "Sending code..." : "Send verification code"}
              </Button>
            )}
            {mode === "phone" && otpSent && (
              <>
                <Button onClick={handleVerifyAndSignup} className="w-full" disabled={loading}>
                  {loading ? "Verifying..." : "Verify & create account"}
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
              </>
            )}

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
