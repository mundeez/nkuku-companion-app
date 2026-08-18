"use client";

import { useEffect, useRef, useState } from "react";
import { getAdServe, recordAdImpression, adClickUrl, type AdPage, type AdServeResponse } from "@/lib/api/client";
import { Megaphone } from "lucide-react";

/**
 * Native-style ad card meant to be interleaved into list results (e.g.
 * every 5-10 items in document search results) so it visually matches
 * surrounding list items while carrying a persistent "Sponsored" label.
 * Renders nothing if no house ad is eligible (native placements do not use
 * the network fallback — reserved for banner slots only, keeping list UX
 * consistent). See docs/ADVERTISING_PLAN.md.
 */
export function AdNativeCard({ page }: { page: AdPage }) {
  const [result, setResult] = useState<AdServeResponse | null>(null);
  const [impressionFired, setImpressionFired] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getAdServe(page, "native")
      .then((r) => !cancelled && setResult(r))
      .catch(() => !cancelled && setResult({ source: "none" }));
    return () => {
      cancelled = true;
    };
  }, [page]);

  useEffect(() => {
    if (result?.source !== "house" || !result.campaign || impressionFired) return;
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

  if (!result || result.source !== "house" || !result.campaign) return null;
  const campaign = result.campaign;

  return (
    <div
      ref={ref}
      data-testid="ad-native-card"
      className="flex items-center gap-3 rounded-lg border p-3 bg-muted/10"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={campaign.creativeImageUrl} alt={campaign.altText} className="h-12 w-12 rounded object-cover shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Megaphone className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Sponsored</span>
        </div>
        <p className="text-sm font-medium truncate">{campaign.advertiserName}</p>
      </div>
      <a
        href={adClickUrl(campaign.id, page)}
        target="_blank"
        rel="noopener sponsored"
        className="text-sm text-primary underline shrink-0"
      >
        Learn more
      </a>
    </div>
  );
}
