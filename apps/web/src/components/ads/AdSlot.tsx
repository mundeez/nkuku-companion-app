"use client";

import { useEffect, useRef, useState } from "react";
import { getAdServe, recordAdImpression, adClickUrl, type AdPage, type AdPlacement, type AdServeResponse } from "@/lib/api/client";

/**
 * Banner (or native card, via `variant="native"`) ad slot. Serves a house
 * ad if one is eligible for this org/page, falls back to a network ad unit
 * placeholder if enabled, or renders nothing (paid tiers, remove-ads
 * add-on, or no fill). See docs/ADVERTISING_PLAN.md.
 *
 * Impressions are only counted once the slot is actually scrolled into
 * view (IntersectionObserver), matching standard ad-viewability practice.
 */
export function AdSlot({ page, variant = "banner" }: { page: AdPage; variant?: AdPlacement }) {
  const [result, setResult] = useState<AdServeResponse | null>(null);
  const [impressionFired, setImpressionFired] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getAdServe(page, variant)
      .then((r) => !cancelled && setResult(r))
      .catch(() => !cancelled && setResult({ source: "none" }));
    return () => {
      cancelled = true;
    };
  }, [page, variant]);

  useEffect(() => {
    if (!result || result.source !== "house" || !result.campaign || impressionFired) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setImpressionFired(true);
          recordAdImpression(result.campaign!.id, page).catch(() => {});
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [result, impressionFired, page]);

  if (!result || result.source === "none") return null;

  // Network fallback (Google AdSense) — inert placeholder until
  // ADSENSE_ENABLED and real ad-unit IDs are configured (see
  // docs/ADVERTISING_PLAN.md §7 rollout step 6).
  if (result.source === "network") {
    return (
      <div
        ref={ref}
        data-testid="ad-slot-network"
        className="w-full rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 flex items-center justify-center text-xs text-muted-foreground py-6"
      >
        Advertisement
      </div>
    );
  }

  const campaign = result.campaign!;
  return (
    <div ref={ref} data-testid="ad-slot-house" className="w-full rounded-md border overflow-hidden bg-card">
      <a
        href={adClickUrl(campaign.id, page)}
        target="_blank"
        rel="noopener sponsored"
        className="block relative"
      >
        <span className="absolute top-1 left-1 z-10 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          Sponsored
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={campaign.creativeImageUrl} alt={campaign.altText} className="w-full h-auto object-cover" />
      </a>
    </div>
  );
}
