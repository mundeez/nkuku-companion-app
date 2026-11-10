"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { ApiRequestError } from "@/lib/api/client";
import { isReauthFresh, reauth } from "@/lib/api/platform";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";

interface ReauthContextType {
  /** Ensure a fresh (<5 min) re-auth; opens the modal when stale. */
  ensureReauth: () => Promise<boolean>;
  /** Force the modal open regardless of freshness. */
  promptReauth: () => Promise<boolean>;
  /** Run fn() after a fresh re-auth; retries once on REAUTH_REQUIRED. */
  withReauth: <T>(fn: () => Promise<T>) => Promise<T>;
}

const ReauthContext = createContext<ReauthContextType>({
  ensureReauth: async () => false,
  promptReauth: async () => false,
  withReauth: async (fn) => fn(),
});

export function ReauthProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);
  const [method, setMethod] = useState<"password" | "totp">("password");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const openModal = useCallback((): Promise<boolean> => {
    setError("");
    setPassword("");
    setTotp("");
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    setOpen(false);
    const r = resolverRef.current;
    resolverRef.current = null;
    r?.(ok);
  }, []);

  const ensureReauth = useCallback(async (): Promise<boolean> => {
    if (isReauthFresh()) return true;
    return openModal();
  }, [openModal]);

  const promptReauth = useCallback(async (): Promise<boolean> => {
    return openModal();
  }, [openModal]);

  const withReauth = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      const ok = await ensureReauth();
      if (!ok) throw new ApiRequestError(0, { error: "CANCELLED", message: "Re-authentication cancelled" });
      try {
        return await fn();
      } catch (e) {
        if (e instanceof ApiRequestError && e.status === 403 && e.code === "REAUTH_REQUIRED") {
          const ok2 = await openModal();
          if (!ok2) throw e;
          return await fn();
        }
        throw e;
      }
    },
    [ensureReauth, openModal]
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await reauth(method === "password" ? { password } : { totp });
      close(true);
    } catch (err: any) {
      setError(
        err?.body?.error === "REAUTH_FAILED"
          ? "Verification failed — check your credentials and try again."
          : err?.message || "Re-authentication failed"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ReauthContext.Provider value={{ ensureReauth, promptReauth, withReauth }}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) close(false);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Confirm it&apos;s you
            </DialogTitle>
            <DialogDescription>
              This is a protected platform action. Re-verify your identity to continue — valid for 5 minutes.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <Tabs value={method} onValueChange={(v) => { setMethod(v as "password" | "totp"); setError(""); }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="password">Password</TabsTrigger>
                <TabsTrigger value="totp">Authenticator</TabsTrigger>
              </TabsList>
              <TabsContent value="password" className="space-y-2 pt-2">
                <Label htmlFor="reauth-password">Password</Label>
                <PasswordInput
                  id="reauth-password"
                  autoFocus
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={method === "password"}
                />
              </TabsContent>
              <TabsContent value="totp" className="space-y-2 pt-2">
                <Label htmlFor="reauth-totp">6-digit code</Label>
                <Input
                  id="reauth-totp"
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={totp}
                  onChange={(e) => setTotp(e.target.value)}
                  required={method === "totp"}
                />
              </TabsContent>
            </Tabs>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => close(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || (method === "password" ? !password : totp.length < 6)}>
                {busy ? "Verifying…" : "Verify"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </ReauthContext.Provider>
  );
}

export function useReauth() {
  return useContext(ReauthContext);
}
