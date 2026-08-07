"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  getProfile,
  updateProfile,
  linkPhone,
  verifyPhone,
  unlinkPhone,
  sendEmailVerification,
  changePassword,
  unlinkSocialProvider,
  type SocialProvider,
} from "@/lib/api/client";

export function AccountSettings() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Profile edit
  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Phone linking
  const [phoneInput, setPhoneInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [phoneStep, setPhoneStep] = useState<"idle" | "otp">("idle");
  const [maskedPhone, setMaskedPhone] = useState("");

  // Password change
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  async function loadProfile() {
    try {
      const p = await getProfile();
      setProfile(p);
      setEditName(p.name || "");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  async function handleSaveName() {
    setSavingName(true);
    setError(null);
    setSuccess(null);
    try {
      await updateProfile(editName);
      setSuccess("Name updated");
      loadProfile();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingName(false);
    }
  }

  async function handleSendOtp() {
    setError(null);
    setSuccess(null);
    try {
      const result = await linkPhone(phoneInput);
      setMaskedPhone(result.maskedPhone);
      setPhoneStep("otp");
      setSuccess(result.message);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleVerifyOtp() {
    setError(null);
    setSuccess(null);
    try {
      await verifyPhone(phoneInput, otpInput);
      setSuccess("Phone linked successfully");
      setPhoneStep("idle");
      setPhoneInput("");
      setOtpInput("");
      loadProfile();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleUnlinkPhone() {
    setError(null);
    setSuccess(null);
    try {
      await unlinkPhone();
      setSuccess("Phone unlinked");
      loadProfile();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleSendEmailVerification() {
    setError(null);
    setSuccess(null);
    try {
      const result = await sendEmailVerification();
      setSuccess(result.message);
      if (result.devUrl) {
        // In dev mode, auto-verify by visiting the URL
        window.open(result.devUrl, "_blank");
      }
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleChangePassword() {
    setSavingPw(true);
    setError(null);
    setSuccess(null);
    try {
      await changePassword(currentPw, newPw);
      setSuccess("Password changed");
      setCurrentPw("");
      setNewPw("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingPw(false);
    }
  }

  async function handleUnlinkSocial(provider: SocialProvider) {
    setError(null);
    setSuccess(null);
    if (!confirm(`Unlink your ${provider} account?`)) return;
    try {
      await unlinkSocialProvider(provider);
      setSuccess(`${provider} unlinked`);
      loadProfile();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) return <div>Loading account...</div>;
  if (!profile) return <div>Failed to load profile</div>;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}
      {success && (
        <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600">{success}</div>
      )}

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Role</span>
            <Badge>{profile.role}</Badge>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Display Name</Label>
            <div className="flex gap-2">
              <Input
                id="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleSaveName} disabled={savingName || editName === profile.name}>
                {savingName ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">{profile.email || "No email set"}</span>
            {profile.emailVerified ? (
              <Badge variant="default">Verified</Badge>
            ) : (
              <Badge variant="destructive">Unverified</Badge>
            )}
          </div>
          {profile.email && !profile.emailVerified && (
            <Button variant="outline" size="sm" onClick={handleSendEmailVerification}>
              Send Verification Email
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Phone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Phone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {profile.phone ? (
            <>
              <div className="flex items-center justify-between">
                <span className="font-medium">{profile.phone}</span>
                {profile.phoneVerified ? (
                  <Badge variant="default">Verified</Badge>
                ) : (
                  <Badge variant="destructive">Unverified</Badge>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleUnlinkPhone}>
                Unlink Phone
              </Button>
            </>
          ) : phoneStep === "otp" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Enter the OTP sent to {maskedPhone}
              </p>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6-digit code"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                />
                <Button onClick={handleVerifyOtp}>Verify</Button>
                <Button variant="ghost" onClick={() => setPhoneStep("idle")}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Link a phone number</Label>
              <div className="flex gap-2">
                <Input
                  type="tel"
                  placeholder="e.g. 260970000000"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                />
                <Button onClick={handleSendOtp} disabled={!phoneInput}>Send OTP</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="current-pw">Current Password</Label>
            <Input
              id="current-pw"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              placeholder={profile.email ? "Enter current password" : "Set a password (social account)"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-pw">New Password</Label>
            <Input
              id="new-pw"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <Button onClick={handleChangePassword} disabled={savingPw || !newPw}>
            {savingPw ? "Saving..." : "Update Password"}
          </Button>
        </CardContent>
      </Card>

      {/* Social Accounts */}
      {profile.socialAccounts && profile.socialAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Linked Social Accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {profile.socialAccounts.map((acc: any) => (
              <div key={acc.provider} className="flex items-center justify-between">
                <div>
                  <span className="font-medium capitalize">{acc.provider}</span>
                  {acc.providerEmail && (
                    <span className="text-sm text-muted-foreground ml-2">{acc.providerEmail}</span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUnlinkSocial(acc.provider as SocialProvider)}
                >
                  Unlink
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
