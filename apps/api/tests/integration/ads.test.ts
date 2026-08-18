import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const API_URL = 'http://localhost:3001';
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function registerUser(suffix: string, country = 'ZM', currency = 'ZMW') {
  const email = `ads-test-${suffix}@example.com`;
  const res = await fetch(`${API_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'TestPass123!',
      name: `Ads Test ${suffix}`,
      organizationName: `Ads Test Farm ${suffix}`,
      country,
      currency,
      consent: true,
    }),
  });
  const data = await res.json();
  return { ...data, email };
}

async function authedRequest(path: string, options: any = {}, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  return { status: res.status, data: await res.json().catch(() => null) };
}

function futureCampaignDates() {
  const start = new Date();
  start.setDate(start.getDate() - 1);
  const end = new Date();
  end.setDate(end.getDate() + 30);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

describe('Advertising (Phase 4b)', () => {
  let adminToken: string;
  let regularToken: string;
  let regularOrgId: string;
  let campaignId: string;

  beforeAll(async () => {
    const admin = await registerUser(`admin-${Date.now()}`);
    adminToken = admin.accessToken;
    await prisma.user.update({ where: { email: admin.email }, data: { isPlatformAdmin: true } });

    const regular = await registerUser(`regular-${Date.now()}`);
    regularToken = regular.accessToken;
    regularOrgId = regular.organization.id;
  });

  afterAll(async () => {
    await prisma.adCampaign.deleteMany({ where: { advertiserName: { startsWith: 'Test Advertiser' } } });
  });

  describe('Platform admin gating', () => {
    it('rejects non-platform-admin users from ad-campaigns admin routes', async () => {
      const { status } = await authedRequest('/api/v1/ad-campaigns', {}, regularToken);
      expect(status).toBe(403);
    });

    it('rejects unauthenticated requests', async () => {
      const { status } = await authedRequest('/api/v1/ad-campaigns');
      expect(status).toBe(401);
    });

    it('allows a platform admin to list campaigns', async () => {
      const { status, data } = await authedRequest('/api/v1/ad-campaigns', {}, adminToken);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('POST /ad-campaigns — create', () => {
    it('creates a house ad campaign as platform admin', async () => {
      const { startDate, endDate } = futureCampaignDates();
      const { status, data } = await authedRequest(
        '/api/v1/ad-campaigns',
        {
          method: 'POST',
          body: JSON.stringify({
            advertiserName: 'Test Advertiser Feed Co',
            creativeImageUrl: 'https://example.com/ad.png',
            targetUrl: 'https://example.com/promo',
            altText: 'Test ad',
            placement: 'banner',
            pages: ['dashboard', 'projections'],
            countryTargets: [],
            pricingModel: 'flat',
            flatFeeAmount: 500,
            currency: 'ZMW',
            priorityWeight: 5,
            startDate,
            endDate,
            status: 'active',
          }),
        },
        adminToken,
      );
      expect(status).toBe(201);
      expect(data.advertiserName).toBe('Test Advertiser Feed Co');
      expect(data.status).toBe('active');
      campaignId = data.id;
    });

    it('rejects a non-http(s) targetUrl (open-redirect guard)', async () => {
      const { startDate, endDate } = futureCampaignDates();
      const { status } = await authedRequest(
        '/api/v1/ad-campaigns',
        {
          method: 'POST',
          body: JSON.stringify({
            advertiserName: 'Test Advertiser XSS',
            creativeImageUrl: 'https://example.com/ad.png',
            targetUrl: 'javascript:alert(1)',
            altText: 'Test ad',
            placement: 'banner',
            pages: ['dashboard'],
            pricingModel: 'flat',
            flatFeeAmount: 100,
            startDate,
            endDate,
          }),
        },
        adminToken,
      );
      expect(status).toBe(400);
    });

    it('rejects invalid pricing model / rate combination', async () => {
      const { startDate, endDate } = futureCampaignDates();
      const { status } = await authedRequest(
        '/api/v1/ad-campaigns',
        {
          method: 'POST',
          body: JSON.stringify({
            advertiserName: 'Test Advertiser Bad',
            creativeImageUrl: 'https://example.com/ad.png',
            targetUrl: 'https://example.com/promo',
            altText: 'Test ad',
            placement: 'banner',
            pages: ['dashboard'],
            pricingModel: 'cpm',
            // missing cpmRate
            startDate,
            endDate,
          }),
        },
        adminToken,
      );
      expect(status).toBe(400);
    });
  });

  describe('GET /ads/serve — house ad selection', () => {
    it('serves the house ad to a Free-tier org on a matching page/placement', async () => {
      const { status, data } = await authedRequest('/api/v1/ads/serve?page=dashboard&placement=banner', {}, regularToken);
      expect(status).toBe(200);
      expect(data.source).toBe('house');
      expect(data.campaign.id).toBe(campaignId);
    });

    it('does not serve the ad on a non-matching page', async () => {
      const { status, data } = await authedRequest('/api/v1/ads/serve?page=flock_detail&placement=banner', {}, regularToken);
      expect(status).toBe(200);
      expect(data.source).toBe('none');
    });

    it('does not serve ads to a paid-tier org', async () => {
      const { status: subStatus } = await authedRequest(
        '/api/v1/billing/subscribe',
        { method: 'POST', body: JSON.stringify({ planCode: 'grower', billingCycle: 'monthly' }) },
        regularToken,
      );
      expect(subStatus).toBe(200);

      const { status, data } = await authedRequest('/api/v1/ads/serve?page=dashboard&placement=banner', {}, regularToken);
      expect(status).toBe(200);
      expect(data.source).toBe('none');

      // Downgrade back to free for subsequent tests
      const cancelResult = await authedRequest('/api/v1/billing/cancel', { method: 'POST', body: '{}' }, regularToken);
      expect(cancelResult.status).toBe(200);
    });

    it('respects country targeting', async () => {
      await authedRequest(
        `/api/v1/ad-campaigns/${campaignId}`,
        { method: 'PATCH', body: JSON.stringify({ countryTargets: ['BW'] }) },
        adminToken,
      );
      const { data } = await authedRequest('/api/v1/ads/serve?page=dashboard&placement=banner', {}, regularToken);
      // regularToken's org is ZM, campaign now targets BW only
      expect(data.source).toBe('none');

      // reset targeting
      await authedRequest(
        `/api/v1/ad-campaigns/${campaignId}`,
        { method: 'PATCH', body: JSON.stringify({ countryTargets: [] }) },
        adminToken,
      );
    });
  });

  describe('Impression/click metering', () => {
    it('records an impression and increments the counter', async () => {
      const before = await authedRequest(`/api/v1/ad-campaigns/${campaignId}`, {}, adminToken);
      const { status } = await authedRequest(
        `/api/v1/ads/${campaignId}/impression?page=dashboard`,
        { method: 'POST', body: '{}' },
        regularToken,
      );
      expect(status).toBe(204);
      const after = await authedRequest(`/api/v1/ad-campaigns/${campaignId}`, {}, adminToken);
      expect(after.data.impressionsCount).toBe(before.data.impressionsCount + 1);
    });

    it('stats endpoint reflects impressions', async () => {
      const { status, data } = await authedRequest(`/api/v1/ad-campaigns/${campaignId}/stats`, {}, adminToken);
      expect(status).toBe(200);
      expect(data.impressionsCount).toBeGreaterThan(0);
    });

    it('does not count an impression for a paused campaign (server-side re-validation)', async () => {
      await authedRequest(`/api/v1/ad-campaigns/${campaignId}`, { method: 'PATCH', body: JSON.stringify({ status: 'paused' }) }, adminToken);
      const before = await authedRequest(`/api/v1/ad-campaigns/${campaignId}`, {}, adminToken);

      const { status } = await authedRequest(
        `/api/v1/ads/${campaignId}/impression?page=dashboard`,
        { method: 'POST', body: '{}' },
        regularToken,
      );
      expect(status).toBe(204); // still 204 (fire-and-forget beacon), but silently not counted

      const after = await authedRequest(`/api/v1/ad-campaigns/${campaignId}`, {}, adminToken);
      expect(after.data.impressionsCount).toBe(before.data.impressionsCount);

      // restore for subsequent tests
      await authedRequest(`/api/v1/ad-campaigns/${campaignId}`, { method: 'PATCH', body: JSON.stringify({ status: 'active' }) }, adminToken);
    });
  });

  describe('Remove Ads add-on', () => {
    it('lists the remove_ads_addon add-on', async () => {
      const res = await fetch(`${API_URL}/api/v1/billing/addons`);
      const data = await res.json();
      expect(data.addons.some((a: any) => a.code === 'remove_ads_addon')).toBe(true);
    });

    it('purchasing the add-on stops ads from serving (mock payment)', async () => {
      const { status, data } = await authedRequest(
        '/api/v1/billing/addons/remove_ads_addon/subscribe',
        { method: 'POST', body: JSON.stringify({}) },
        regularToken,
      );
      expect(status).toBe(200);
      expect(data.checkout).toBeDefined();

      // The add-on's trialing subscription must have a trialEndsAt set, so
      // an unpaid add-on is swept back to past_due/suspended by the daily
      // billing cron instead of granting ad-free access indefinitely.
      const addonSub = await prisma.subscription.findFirst({
        where: { organizationId: regularOrgId, planCode: 'remove_ads_addon' },
        orderBy: { createdAt: 'desc' },
      });
      expect(addonSub?.trialEndsAt).not.toBeNull();

      // Mock-pay the addon invoice (dev-only endpoint, mock mode)
      const txRef = data.invoice?.providerRef;
      if (txRef) {
        await authedRequest(`/api/v1/billing/dev/mock-pay?txRef=${txRef}`, {}, regularToken);
      }

      const { data: serveData } = await authedRequest('/api/v1/ads/serve?page=dashboard&placement=banner', {}, regularToken);
      expect(serveData.source).toBe('none');

      // The org's actual plan must remain "free" — add-ons must never
      // overwrite the org's plan tier.
      const { data: subData } = await authedRequest('/api/v1/billing/subscription', {}, regularToken);
      expect(subData.planCode).toBe('free');
      expect(subData.addons.remove_ads_addon).toBe(true);

      await authedRequest('/api/v1/billing/addons/remove_ads_addon/cancel', { method: 'POST', body: '{}' }, regularToken);
    });
  });

  describe('DELETE /ad-campaigns/:id — soft delete', () => {
    it('marks the campaign as completed rather than removing it', async () => {
      const { status } = await authedRequest(`/api/v1/ad-campaigns/${campaignId}`, { method: 'DELETE' }, adminToken);
      expect(status).toBe(204);
      const { data } = await authedRequest(`/api/v1/ad-campaigns/${campaignId}`, {}, adminToken);
      expect(data.status).toBe('completed');
    });
  });
});
