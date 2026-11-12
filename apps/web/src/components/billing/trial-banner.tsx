"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock } from "lucide-react";
import { useOrgAccess } from "@/lib/api/hooks";
import { useAuth } from "@/components/auth-provider";

/**
 * Slim banner shown on every authenticated page while the org is in its
 * 14-day trial (P4). Links through to the billing/plans page. Hidden on
 * /billing itself (the CTA destination) and on the public lock surface.
 */
export function TrialBanner() {
  const { user } = useAuth();
  const pathname = usePathname();
  const { data: access } = useOrgAccess({ enabled: !!user });

  if (!user || access?.state !== "trialing") return null;
  if (pathname?.startsWith("/billing")) return null;

  const days = access.daysLeftInTrial;

  return (
    <div className="flex items-center justify-center gap-3 bg-emerald-600 px-4 py-1.5 text-sm font-medium text-emerald-50">
      <Clock className="h-4 w-4" aria-hidden />
      <span>
        Trial:{" "}
        {days === null || days === undefined
          ? "active"
          : days === 1
          ? "1 day left"
          : `${days} days left`}
      </span>
      <Link
        href="/billing"
        className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 hover:bg-white"
      >
        Choose a plan
      </Link>
    </div>
  );
}
