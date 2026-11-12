"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";

interface PlanLimitDetail {
  message?: string;
  feature?: string;
  limit?: string;
  currentPlan?: string;
  current?: number;
  max?: number;
}

/**
 * Listens for `nkuku:plan-limit` events (dispatched by lib/api/client.ts
 * whenever the API returns a 402 PLAN_LIMIT_REACHED) and shows a consistent
 * in-app "Upgrade your plan" prompt, instead of every call site needing its
 * own ad-hoc error handling. See docs/ADVERTISING_PLAN.md / MONETIZATION_PLAN.md Phase 4.
 */
export function UpgradePromptProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [detail, setDetail] = useState<PlanLimitDetail | null>(null);
  const [subscriptionRequired, setSubscriptionRequired] = useState(false);

  useEffect(() => {
    function handler(e: Event) {
      const custom = e as CustomEvent<PlanLimitDetail>;
      setDetail(custom.detail || {});
    }
    // P4: a mutation on a locked org returns 402 {code:'SUBSCRIPTION_REQUIRED'}
    // — surface a friendly dialog that points at the billing page.
    function subscriptionHandler() {
      setSubscriptionRequired(true);
    }
    window.addEventListener("nkuku:plan-limit", handler);
    window.addEventListener("nkuku:subscription-required", subscriptionHandler);
    return () => {
      window.removeEventListener("nkuku:plan-limit", handler);
      window.removeEventListener("nkuku:subscription-required", subscriptionHandler);
    };
  }, []);

  return (
    <>
      {children}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              Upgrade your plan
            </DialogTitle>
            <DialogDescription>
              {detail?.message || "This feature isn't available on your current plan."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>
              Not now
            </Button>
            <Button
              onClick={() => {
                setDetail(null);
                router.push("/billing");
              }}
            >
              View plans
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Locked org (P4): mutation returned 402 SUBSCRIPTION_REQUIRED */}
      <Dialog
        open={subscriptionRequired}
        onOpenChange={(open) => !open && setSubscriptionRequired(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              Your subscription has ended
            </DialogTitle>
            <DialogDescription>
              That change couldn&apos;t be saved because your subscription is no
              longer active. Choose a plan to restore full access — your data is
              safe.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubscriptionRequired(false)}>
              Not now
            </Button>
            <Button
              onClick={() => {
                setSubscriptionRequired(false);
                router.push("/billing");
              }}
            >
              Choose a plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
