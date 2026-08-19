import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/routes.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';
import { serveAd, recordAdEvent } from '../../core/ads/ad-serving.service.js';

const PAGE_VALUES = ['dashboard', 'projections', 'document_search', 'flock_detail'] as const;
const PLACEMENT_VALUES = ['banner', 'native'] as const;

const ServeQuerySchema = z.object({
  page: z.enum(PAGE_VALUES),
  placement: z.enum(PLACEMENT_VALUES),
});

const EventParamsSchema = z.object({ id: z.string().uuid() });
const EventQuerySchema = z.object({ page: z.enum(PAGE_VALUES) });
const ClickQuerySchema = EventQuerySchema;

export async function buildAdModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // ── GET /serve — what ad (if any) to show for this org/page/placement ──
  app.get('/serve', { preHandler: [authenticate] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    let query;
    try {
      query = ServeQuerySchema.parse(request.query);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid query' });
    }
    const result = await serveAd(prisma, { organizationId, page: query.page, placement: query.placement });
    return result;
  });

  // ── POST /:id/impression — fire-and-forget impression beacon ──
  app.post('/:id/impression', { preHandler: [authenticate] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const { id } = EventParamsSchema.parse(request.params);
    let query;
    try {
      query = EventQuerySchema.parse(request.query);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid query' });
    }
    await recordAdEvent(prisma, { campaignId: id, organizationId, eventType: 'impression', page: query.page });
    return reply.status(204).send();
  });

  // ── GET /:id/click — logs the click, then redirects to the target URL ──
  // A GET (not a beacon) so it can double as the actual link the user
  // clicks, keeping click accounting server-side (accurate CPC counting,
  // resistant to client-side tampering).
  app.get('/:id/click', { preHandler: [authenticate] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const { id } = EventParamsSchema.parse(request.params);
    let query;
    try {
      query = ClickQuerySchema.parse(request.query);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid query' });
    }
    const campaign = await prisma.adCampaign.findUnique({ where: { id } });
    if (!campaign) return reply.status(404).send({ error: 'NOT_FOUND' });

    // Best-effort metering: if the campaign is no longer eligible for this
    // org/page (expired, paused, budget exhausted, etc.) we still honor the
    // redirect — the user may have clicked a still-open tab from when it
    // *was* eligible — but we don't count it. See recordAdEvent for the
    // full re-validation this guards against (click-fraud / budget drain
    // via arbitrary campaign ids).
    await recordAdEvent(prisma, { campaignId: id, organizationId, eventType: 'click', page: query.page });
    return reply.redirect(campaign.targetUrl, 302);
  });
}
