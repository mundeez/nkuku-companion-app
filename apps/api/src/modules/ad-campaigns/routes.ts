// ── AD CAMPAIGN ADMIN ────────────────────────────────────
// Platform-admin-only CRUD for house ad campaigns (Phase 4b). Not
// organization-scoped — see docs/ADVERTISING_PLAN.md §2.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/routes.js';
import { requirePlatformAdmin } from '../../core/billing/feature-gate.js';

const PAGE_VALUES = ['dashboard', 'projections', 'document_search', 'flock_detail'] as const;
const PLACEMENT_VALUES = ['banner', 'native'] as const;
const PRICING_MODEL_VALUES = ['flat', 'cpm', 'cpc'] as const;
const STATUS_VALUES = ['draft', 'active', 'paused', 'completed'] as const;

// Only http(s) URLs are allowed for creative/target URLs — z.string().url()
// alone accepts any scheme (javascript:, data:, file:, etc.), which would
// make the click-redirect endpoint (a same-origin trusted API URL) an open
// redirector to arbitrary schemes. See docs/ADVERTISING_PLAN.md.
const httpUrl = z.string().url().refine(
  (url) => {
    try {
      return ['http:', 'https:'].includes(new URL(url).protocol);
    } catch {
      return false;
    }
  },
  { message: 'Must be an http(s) URL' },
);

const CampaignBaseSchema = z.object({
  advertiserName: z.string().min(1).max(150),
  creativeImageUrl: httpUrl,
  targetUrl: httpUrl,
  altText: z.string().min(1).max(200),
  placement: z.enum(PLACEMENT_VALUES),
  pages: z.array(z.enum(PAGE_VALUES)).min(1),
  countryTargets: z.array(z.string().length(2)).default([]),
  pricingModel: z.enum(PRICING_MODEL_VALUES),
  flatFeeAmount: z.number().nonnegative().nullable().optional(),
  cpmRate: z.number().nonnegative().nullable().optional(),
  cpcRate: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).default('ZMW'),
  budgetCap: z.number().nonnegative().nullable().optional(),
  priorityWeight: z.number().int().min(1).default(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: z.enum(STATUS_VALUES).default('draft'),
});

const CreateCampaignSchema = CampaignBaseSchema.refine(
  (data) => data.endDate > data.startDate,
  { message: 'endDate must be after startDate', path: ['endDate'] },
).refine(
  (data) =>
    (data.pricingModel === 'flat' && data.flatFeeAmount != null) ||
    (data.pricingModel === 'cpm' && data.cpmRate != null) ||
    (data.pricingModel === 'cpc' && data.cpcRate != null),
  { message: 'The rate matching pricingModel must be provided', path: ['pricingModel'] },
);

const UpdateCampaignSchema = CampaignBaseSchema.partial();

const ParamsSchema = z.object({ id: z.string().uuid() });

// z.object().partial() (used for PATCH) drops the .refine() consistency
// checks from CreateCampaignSchema. Re-run them against the *merged*
// (existing + incoming patch) record so a partial update can't leave the
// campaign in an inconsistent state (e.g. endDate before startDate, or an
// active cpm campaign with no cpmRate) — see docs/ADVERTISING_PLAN.md.
function validateCampaignConsistency(merged: { startDate: Date; endDate: Date; pricingModel: string; flatFeeAmount: any; cpmRate: any; cpcRate: any }): string | null {
  if (!(new Date(merged.endDate) > new Date(merged.startDate))) return 'endDate must be after startDate';
  const rateOk =
    (merged.pricingModel === 'flat' && merged.flatFeeAmount != null) ||
    (merged.pricingModel === 'cpm' && merged.cpmRate != null) ||
    (merged.pricingModel === 'cpc' && merged.cpcRate != null);
  if (!rateOk) return 'The rate matching pricingModel must be provided';
  return null;
}

export async function buildAdCampaignModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  const guard = [authenticate, requirePlatformAdmin];

  // ── GET / — list all campaigns ──
  app.get('/', { preHandler: guard }, async (request, reply) => {
    let query;
    try {
      query = z.object({ status: z.enum(STATUS_VALUES).optional() }).parse(request.query);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid status' });
    }
    return prisma.adCampaign.findMany({
      where: query.status ? { status: query.status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  });

  // ── GET /:id — get one campaign ──
  app.get('/:id', { preHandler: guard }, async (request, reply) => {
    const { id } = ParamsSchema.parse(request.params);
    const campaign = await prisma.adCampaign.findUnique({ where: { id } });
    if (!campaign) return reply.status(404).send({ error: 'NOT_FOUND' });
    return campaign;
  });

  // ── GET /:id/stats — impressions/clicks/spend breakdown ──
  app.get('/:id/stats', { preHandler: guard }, async (request, reply) => {
    const { id } = ParamsSchema.parse(request.params);
    const campaign = await prisma.adCampaign.findUnique({ where: { id } });
    if (!campaign) return reply.status(404).send({ error: 'NOT_FOUND' });

    const [impressionsByDay, clicksByDay] = await Promise.all([
      prisma.adEvent.groupBy({
        by: ['page'],
        where: { adCampaignId: id, eventType: 'impression' },
        _count: { _all: true },
      }),
      prisma.adEvent.groupBy({
        by: ['page'],
        where: { adCampaignId: id, eventType: 'click' },
        _count: { _all: true },
      }),
    ]);

    return {
      campaignId: id,
      impressionsCount: campaign.impressionsCount,
      clicksCount: campaign.clicksCount,
      ctr: campaign.impressionsCount > 0 ? campaign.clicksCount / campaign.impressionsCount : 0,
      spendToDate: campaign.spendToDate,
      budgetCap: campaign.budgetCap,
      impressionsByPage: impressionsByDay.map((r: any) => ({ page: r.page, count: r._count._all })),
      clicksByPage: clicksByDay.map((r: any) => ({ page: r.page, count: r._count._all })),
    };
  });

  // ── POST / — create a campaign ──
  app.post('/', { preHandler: guard }, async (request, reply) => {
    const authUser = (request as any).authUser;
    let body;
    try {
      body = CreateCampaignSchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
    }
    const campaign = await prisma.adCampaign.create({
      data: { ...body, createdBy: authUser.userId },
    });
    return reply.status(201).send(campaign);
  });

  // ── PATCH /:id — update a campaign ──
  app.patch('/:id', { preHandler: guard }, async (request, reply) => {
    const { id } = ParamsSchema.parse(request.params);
    let body;
    try {
      body = UpdateCampaignSchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
    }
    const existing = await prisma.adCampaign.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' });

    const merged = { ...existing, ...body };
    const consistencyError = validateCampaignConsistency(merged);
    if (consistencyError) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: consistencyError });
    }

    const campaign = await prisma.adCampaign.update({ where: { id }, data: body });
    return campaign;
  });

  // ── DELETE /:id — soft-delete (mark completed) ──
  app.delete('/:id', { preHandler: guard }, async (request, reply) => {
    const { id } = ParamsSchema.parse(request.params);
    const existing = await prisma.adCampaign.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' });

    await prisma.adCampaign.update({ where: { id }, data: { status: 'completed' } });
    return reply.status(204).send();
  });
}
