// ── TENANT ANNOUNCEMENTS (/api/v1/announcements) ─────────
// P4: tenant-facing reads for platform announcements (staff publish via
// /api/v1/platform/announcements).
//
//   GET  /active          → announcements currently live for this org/user
//   POST /:id/dismiss     → record this user's dismissal
//
// Audience rules: 'all' | 'plans' (planCodes contains the org's EFFECTIVE
// plan code) | 'orgs' (orgIds contains the org id). Rows dismissed by the
// calling user are excluded from /active. This group is on the
// suspended-org read-only-lock allowlist (dismissals are POSTs).

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/routes.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';
import { getEffectivePlanCode } from '../../core/billing/billing.service.js';

function publicAnnouncement(row: any) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    severity: row.severity,
    linkUrl: row.linkUrl,
    linkLabel: row.linkLabel,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    isDismissible: row.isDismissible,
  };
}

export async function buildAnnouncementsModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // GET /api/v1/announcements/active
  app.get('/active', { preHandler: [authenticate] }, async (request) => {
    const organizationId = getOrganizationId(request);
    const userId = (request as any).authUser.userId;
    const now = new Date();
    const planCode = await getEffectivePlanCode(prisma, organizationId);

    const rows = await prisma.announcement.findMany({
      where: {
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: [{ severity: 'desc' }, { startsAt: 'desc' }],
    });

    // Audience + dismissal filtering in-process — both lists are tiny.
    const dismissed = new Set(
      (
        await prisma.announcementDismissal.findMany({
          where: { userId, announcementId: { in: rows.map((r: any) => r.id) } },
          select: { announcementId: true },
        })
      ).map((d: any) => d.announcementId),
    );

    const visible = rows.filter((row: any) => {
      if (dismissed.has(row.id)) return false;
      if (row.audience === 'all') return true;
      if (row.audience === 'plans') {
        const codes = Array.isArray(row.planCodes) ? (row.planCodes as string[]) : [];
        return codes.includes(planCode);
      }
      if (row.audience === 'orgs') {
        const ids = Array.isArray(row.orgIds) ? (row.orgIds as string[]) : [];
        return ids.includes(organizationId);
      }
      return false;
    });

    return { items: visible.map(publicAnnouncement), count: visible.length };
  });

  // POST /api/v1/announcements/:id/dismiss — upsert a dismissal row for
  // the calling user. Refused for non-dismissible announcements.
  app.post('/:id/dismiss', { preHandler: [authenticate] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    void organizationId; // org context implied by auth; dismissal is per-user
    const userId = (request as any).authUser.userId;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const announcement = await prisma.announcement.findUnique({ where: { id } });
    if (!announcement) return reply.status(404).send({ error: 'NOT_FOUND' });
    if (!announcement.isDismissible) {
      return reply.status(422).send({ error: 'NOT_DISMISSIBLE', message: 'This announcement cannot be dismissed' });
    }

    await prisma.announcementDismissal.upsert({
      where: { announcementId_userId: { announcementId: id, userId } },
      update: {},
      create: { announcementId: id, userId },
    });
    return { dismissed: true, announcementId: id };
  });
}
