"use client";

import { useEffect, useState } from "react";
import { totpConfirm, totpEnroll, totpVerify } from "@/lib/api/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, KeyRound } from "lucide-react";

/** Render the otpauth:// URL as a QR. Prefers the API-provided qrDataUrl;
 *  falls back to generating one client-side with the qrcode package. */
function OtpQr({ otpauthUrl, qrDataUrl }: { otpauthUrl: string; qrDataUrl?: string }) {
  const [dataUrl, setDataUrl] = useState(qrDataUrl ?? "");

  useEffect(() => {
    if (qrDataUrl || !otpauthUrl) return;
    let cancelled = false;
    import("qrcode")
      .then((QRCode) => QRCode.toDataURL(otpauthUrl, { width: 220, margin: 1 }))
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [otpauthUrl, qrDataUrl]);

  if (dataUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={dataUrl} alt="TOTP QR code" className="h-48 w-48 rounded-md bg-white p-2" />;
  }
  return (
    <div className="flex h-48 w-48 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
      QR unavailable — use manual key
    </div>
  );
}

export function TotpEnrollStep({
  ticket,
  onDone,
}: {
  ticket: string;
  onDone: (result: { recoveryCodes?: string[] }) => void;
}) {
  const [enroll, setEnroll] = useState<{ secret: string; otpauthUrl: string; qrDataUrl?: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    totpEnroll(ticket)
      .then(setEnroll)
      .catch((e) => setError(e.message || "Could not start TOTP enrolment"));
  }, [ticket]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await totpConfirm(ticket, code);
      onDone(res);
    } catch (err: any) {
      setError(err?.body?.error === "INVALID_TOTP_CODE" ? "Invalid code — try again" : err?.message || "Failed to confirm TOTP");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Two-factor authentication is required for staff. Scan this QR with your authenticator app
        (1Password, Authy, Google Authenticator), then enter the 6-digit code.
      </div>
      <div className="flex justify-center">
        {enroll ? (
          <OtpQr otpauthUrl={enroll.otpauthUrl} qrDataUrl={enroll.qrDataUrl} />
        ) : (
          <div className="h-48 w-48 animate-pulse rounded-md bg-muted" />
        )}
      </div>
      {enroll && (
        <div className="flex items-center justify-center gap-2">
          <code className="rounded bg-muted px-2 py-1 text-xs tracking-widest">{enroll.secret}</code>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              navigator.clipboard?.writeText(enroll.secret);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            title="Copy secret"
          >
            <Copy className="h-4 w-4" />
          </button>
          {copied && <span className="text-xs text-muted-foreground">Copied</span>}
        </div>
      )}
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="totp-code">6-digit code</Label>
          <Input
            id="totp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || code.length < 6}>
          {busy ? "Verifying…" : "Enable two-factor auth"}
        </Button>
      </form>
    </div>
  );
}

export function TotpVerifyStep({
  ticket,
  onDone,
}: {
  ticket: string;
  onDone: () => void;
}) {
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await totpVerify(ticket, code);
      onDone();
    } catch (err: any) {
      setError(err?.body?.error === "INVALID_TOTP_CODE" ? "Invalid code — try again" : err?.message || "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="totp-verify">{useRecovery ? "Recovery code" : "6-digit authenticator code"}</Label>
        <Input
          id="totp-verify"
          inputMode={useRecovery ? "text" : "numeric"}
          autoComplete="one-time-code"
          placeholder={useRecovery ? "XXXX-XXXX" : "123456"}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          autoFocus
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy || code.length < 6}>
        <KeyRound className="mr-2 h-4 w-4" /> {busy ? "Verifying…" : "Verify"}
      </Button>
      <button
        type="button"
        className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
        onClick={() => {
          setUseRecovery((v) => !v);
          setCode("");
          setError("");
        }}
      >
        {useRecovery ? "Use an authenticator code instead" : "Lost your device? Use a recovery code"}
      </button>
    </form>
  );
}

export function RecoveryCodesStep({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
        Save these recovery codes now — they are shown <strong>exactly once</strong>. Each can be used
        once in place of your authenticator code.
      </div>
      <div className="grid grid-cols-2 gap-2">
        {codes.map((c) => (
          <code key={c} className="rounded bg-muted px-2 py-1.5 text-center text-sm tracking-wider">
            {c}
          </code>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => {
            navigator.clipboard?.writeText(codes.join("\n"));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          <Copy className="mr-2 h-4 w-4" /> {copied ? "Copied" : "Copy all"}
        </Button>
        <Button className="flex-1" onClick={onDone}>
          I saved them — continue
        </Button>
      </div>
    </div>
  );
}
