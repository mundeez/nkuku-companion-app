"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { useOrgAccess } from "@/lib/api/hooks";
import { useAuth } from "@/components/auth-provider";

// Routes that must stay reachable while the org is locked: billing (so the
// owner can re-subscribe) and support (so they can ask for help). Everything
// else is replaced by the lock view.
const ALLOWED_WHEN_LOCKED = ["/billing", "/support"];

/**
 * Subscription lock gate (P4). When `GET /api/v1/organizations/me/access`
 * reports `state: 'locked'` — or the billing-status fallback maps to
 * locked — the whole app surface is replaced by a lock view with a
 * plan-pick CTA, except billing/support routes which stay reachable.
 *
 * Locked mid-session is also covered: any mutation that returns
 * 402 SUBSCRIPTION_REQUIRED dispatches `nkuku:subscription-required`
 * (client.ts) which UpgradePromptProvider turns into a blocking dialog,
 * and the 5-minute access refetch flips this gate on the next poll.
 */
export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const { data: access } = useOrgAccess({ enabled: !!user });

  const locked = !!user && access?.state === "locked";
  const allowed = ALLOWED_WHEN_LOCKED.some((p) => pathname?.startsWith(p));

  if (!locked || allowed) return <>{children}</>;

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <h1 className="mb-2 text-xl font-semibold">Your subscription has ended</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {access?.planName
            ? `Your ${access.planName} plan is no longer active. `
            : ""}
          Pick a plan to restore access to your flocks, records, and reports.
          Your data is safe.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/billing"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Choose a plan
          </Link>
          <Link
            href="/support"
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Contact support
          </Link>
        </div>
      </div>
    </div>
  );
}
