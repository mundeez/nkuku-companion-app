// ── AD SERVING ────────────────────────────────────────────
// Selects which house ad campaign (if any) to serve for a given
// page/placement/organization, records impressions/clicks, and meters
// spend for CPM/CPC campaigns. See docs/ADVERTISING_PLAN.md.

import type { PrismaClient, AdCampaign, AdPage, AdPlacement } from '@prisma/client';
import { shouldShowAds } from '../billing/feature-gate.js';

export type AdServeResult =
  | { source: 'none' }
  | { source: 'house'; campaign: PublicCampaign }
  | { source: 'network' };

export interface PublicCampaign {
  id: string;
  advertiserName: string;
  creativeImageUrl: string;
  targetUrl: string;
  altText: string;
  placement: AdPlacement;
}

function toPublicCampaign(c: AdCampaign): PublicCampaign {
  return {
    id: c.id,
    advertiserName: c.advertiserName,
    creativeImageUrl: c.creativeImageUrl,
    targetUrl: c.targetUrl,
    altText: c.altText,
    placement: c.placement,
  };
}

/**
 * Pick an active, eligible house ad campaign for the given page/placement,
 * targeted (or untargeted) to the organization's country, weighted by
 * priorityWeight. Returns null if none match.
 */
export async function selectHouseAd(
  prisma: PrismaClient,
  params: { page: AdPage; placement: AdPlacement; organizationCountry: string | null },
): Promise<AdCampaign | null> {
  const { page, placement, organizationCountry } = params;
  const now = new Date();

  const candidates = await prisma.adCampaign.findMany({
    where: {
      status: 'active',
      placement,
      pages: { has: page },
      startDate: { lte: now },
      endDate: { gte: now },
    },
  });

  const eligible = candidates.filter((c) => isCampaignEligible(c, organizationCountry));

  if (eligible.length === 0) return null;

  // Weighted random selection by priorityWeight
  const totalWeight = eligible.reduce((sum, c) => sum + Math.max(1, c.priorityWeight), 0);
  let roll = Math.random() * totalWeight;
  for (const c of eligible) {
    roll -= Math.max(1, c.priorityWeight);
    if (roll <= 0) return c;
  }
  return eligible[eligible.length - 1];
}

/**
 * Country + budget eligibility check shared by selectHouseAd (candidate
 * filtering) and recordAdEvent (server-side re-validation before counting
 * an impression/click, so a client can't inflate spend/metrics for a
 * campaign it was never actually served — see docs/ADVERTISING_PLAN.md).
 * Untargeted campaigns (empty countryTargets) match any org, including
 * ones with an unknown country. Targeted campaigns require a known,
 * matching org country — an org with no country never matches a targeted
 * campaign (fail closed, not open).
 */
function isCampaignEligible(c: AdCampaign, organizationCountry: string | null): boolean {
  if (c.budgetCap != null && Number(c.spendToDate) >= Number(c.budgetCap)) return false;
  if (c.countryTargets.length > 0 && (!organizationCountry || !c.countryTargets.includes(organizationCountry))) {
    return false;
  }
  return true;
}

/**
 * Decide what to serve for a given org/page/placement: a house ad if one is
 * eligible, otherwise a signal to render the network fallback (Google
 * AdSense/AdMob) if enabled, otherwise nothing. Returns `none` immediately
 * if the org shouldn't see ads at all (paid tier, or has the remove-ads
 * add-on).
 */
export async function serveAd(
  prisma: PrismaClient,
  params: { organizationId: string; page: AdPage; placement: AdPlacement },
): Promise<AdServeResult> {
  const { organizationId, page, placement } = params;

  const showAds = await shouldShowAds(prisma, organizationId);
  if (!showAds) return { source: 'none' };

  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { country: true } });
  const houseAd = await selectHouseAd(prisma, { page, placement, organizationCountry: org?.country ?? null });
  if (houseAd) return { source: 'house', campaign: toPublicCampaign(houseAd) };

  const networkEnabled =
    process.env.ADSENSE_ENABLED === 'true' || process.env.ADMOB_ENABLED === 'true';
  if (networkEnabled) return { source: 'network' };

  return { source: 'none' };
}

/**
 * Record an impression or click for a campaign, update its counters, and
 * meter spend for cpm/cpc campaigns — auto-pausing the campaign once its
 * budget cap is reached.
 *
 * Re-validates that the campaign could actually have been served to this
 * org/page right now (active, in its date window, on this page, country
 * match, org still ad-eligible) before counting anything. Without this, any
 * authenticated user could hit these endpoints with an arbitrary campaign
 * id to inflate impressions/clicks and drain a CPC/CPM budget for a
 * campaign never actually shown to them. Returns `false` (nothing
 * recorded) if the event doesn't check out.
 */
export async function recordAdEvent(
  prisma: PrismaClient,
  params: { campaignId: string; organizationId: string; eventType: 'impression' | 'click'; page: AdPage },
): Promise<boolean> {
  const { campaignId, organizationId, eventType, page } = params;

  const showAds = await shouldShowAds(prisma, organizationId);
  if (!showAds) return false;

  const campaign = await prisma.adCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return false;

  const now = new Date();
  if (
    campaign.status !== 'active' ||
    campaign.startDate > now ||
    campaign.endDate < now ||
    !campaign.pages.includes(page)
  ) {
    return false;
  }

  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { country: true } });
  if (!isCampaignEligible(campaign, org?.country ?? null)) return false;

  await prisma.adEvent.create({
    data: { adCampaignId: campaignId, organizationId, eventType, page },
  });

  const counterUpdate =
    eventType === 'impression' ? { impressionsCount: { increment: 1 } } : { clicksCount: { increment: 1 } };

  let spendIncrement = 0;
  if (campaign.pricingModel === 'cpm' && eventType === 'impression' && campaign.cpmRate) {
    spendIncrement = Number(campaign.cpmRate) / 1000;
  } else if (campaign.pricingModel === 'cpc' && eventType === 'click' && campaign.cpcRate) {
    spendIncrement = Number(campaign.cpcRate);
  }

  const updated = await prisma.adCampaign.update({
    where: { id: campaignId },
    data: {
      ...counterUpdate,
      ...(spendIncrement > 0 ? { spendToDate: { increment: spendIncrement } } : {}),
    },
  });

  if (updated.budgetCap != null && Number(updated.spendToDate) >= Number(updated.budgetCap) && updated.status === 'active') {
    await prisma.adCampaign.update({ where: { id: campaignId }, data: { status: 'completed' } });
  }

  return true;
}
