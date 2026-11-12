// ── PLATFORM P4: FEATURE FLAGS + ANNOUNCEMENTS ───────────
//
//   GET    /flags                     any staff        — list feature flags
//   POST   /flags                     flags.write      — create flag
//   PATCH  /flags/:key                flags.write      — update overrides/default
//   DELETE /flags/:key                flags.write      — delete flag
//
//   GET    /announcements             any staff        — list incl. scheduled
//   POST   /announcements             announcements.write — create
//   PATCH  /announcements/:id         announcements.write — update
//   DELETE /announcements/:id         announcements.write — delete
//
// Flag writes invalidate the tenant-facing 60 s flag cache; announcement
// writes take effect on the next tenant poll (no cache on the read side).

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireStaff, getClientIp } from '../../core/staff-auth/staff-auth.service.js';
import { writePlatformAudit } from '../../core/staff-auth/audit.service.js';
import { invalidateFeatureFlagCache } from '../../core/feature-flags/flag.service.js';

const FlagCreateSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9][a-z0-9_.-]*$/, 'Flag keys are lowercase snake/dot case'),
  description: z.string().max(255).optional().default(''),
  enabledByDefault: z.boolean().default(true),
  planOverrides: z.record(z.boolean()).optional(),
  orgOverrides: z.record(z.boolean()).optional(),
});

const FlagPatchSchema = z.object({
  description: z.string().max(255).optional(),
  enabledByDefault: z.boolean().optional(),
  planOverrides: z.record(z.boolean()).optional(),
  orgOverrides: z.record(z.boolean()).optional(),
});

const AnnouncementSchema = z.object({
  title: z.string().min(1).max(140),
  body: z.string().min(1),
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
  audience: z.enum(['all', 'plans', 'orgs']).default('all'),
  planCodes: z.array(z.string().max(30)).nullable().optional(),
  orgIds: z.array(z.string().uuid()).nullable().optional(),
  linkUrl: z.string().url().max(2000).nullable().optional(),
  linkLabel: z.string().max(60).nullable().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  isDismissible: z.boolean().default(true),
});

const AnnouncementPatchSchema = AnnouncementSchema.partial();

function auditCtx(request: any) {
  return {
    ip: getClientIp(request),
    userAgent: request.headers?.['user-agent'] ?? null,
    requestId: (request as any).id ?? null,
  };
}

function publicFlag(row: any) {
  return {
    key: row.key,
    description: row.description,
    enabledByDefault: row.enabledByDefault,
    planOverrides: row.planOverrides ?? {},
    orgOverrides: row.orgOverrides ?? {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function publicAnnouncement(row: any) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    severity: row.severity,
    audience: row.audience,
    planCodes: row.planCodes ?? null,
    orgIds: row.orgIds ?? null,
    linkUrl: row.linkUrl,
    linkLabel: row.linkLabel,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    isDismissible: row.isDismissible,
    createdByStaffId: row.createdByStaffId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    dismissalCount: row._count?.dismissals ?? 0,
  };
}

export async function buildPlatformFlagsAnnouncementsModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // ══════════════ FEATURE FLAGS ══════════════

  // ── GET /flags ──
  app.get('/flags', { preHandler: [requireStaff()] }, async () => {
    const rows = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
    return { items: rows.map(publicFlag), count: rows.length };
  });

  // ── POST /flags ──
  app.post('/flags', { preHandler: [requireStaff('flags.write')] }, async (request, reply) => {
    let body;
    try {
      body = FlagCreateSchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
    }
    const existing = await prisma.featureFlag.findUnique({ where: { key: body.key } });
    if (existing) return reply.status(409).send({ error: 'FLAG_EXISTS' });

    const row = await prisma.featureFlag.create({
      data: {
        key: body.key,
        description: body.description,
        enabledByDefault: body.enabledByDefault,
        planOverrides: body.planOverrides ?? {},
        orgOverrides: body.orgOverrides ?? {},
      },
    });
    invalidateFeatureFlagCache();

    const actor = (request as any).staffUser;
    await writePlatformAudit(prisma, {
      actorStaffId: actor.staffId,
      actorRole: actor.role,
      action: 'flag.create',
      targetType: 'feature_flag',
      targetId: row.key,
      after: publicFlag(row),
      ...auditCtx(request),
    });
    return reply.status(201).send({ flag: publicFlag(row) });
  });

  // ── PATCH /flags/:key ──
  app.patch('/flags/:key', { preHandler: [requireStaff('flags.write')] }, async (request, reply) => {
    const { key } = z.object({ key: z.string().min(1).max(60) }).parse(request.params);
    let body;
    try {
      body = FlagPatchSchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
    }
    const existing = await prisma.featureFlag.findUnique({ where: { key } });
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' });

    const data: any = {};
    if (body.description !== undefined) data.description = body.description;
    if (body.enabledByDefault !== undefined) data.enabledByDefault = body.enabledByDefault;
    if (body.planOverrides !== undefined) data.planOverrides = body.planOverrides;
    if (body.orgOverrides !== undefined) data.orgOverrides = body.orgOverrides;

    const row = await prisma.featureFlag.update({ where: { key }, data });
    invalidateFeatureFlagCache();

    const actor = (request as any).staffUser;
    await writePlatformAudit(prisma, {
      actorStaffId: actor.staffId,
      actorRole: actor.role,
      action: 'flag.update',
      targetType: 'feature_flag',
      targetId: key,
      before: publicFlag(existing),
      after: publicFlag(row),
      ...auditCtx(request),
    });
    return { flag: publicFlag(row) };
  });

  // ── DELETE /flags/:key ──
  app.delete('/flags/:key', { preHandler: [requireStaff('flags.write')] }, async (request, reply) => {
    const { key } = z.object({ key: z.string().min(1).max(60) }).parse(request.params);
    const existing = await prisma.featureFlag.findUnique({ where: { key } });
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' });
    await prisma.featureFlag.delete({ where: { key } });
    invalidateFeatureFlagCache();

    const actor = (request as any).staffUser;
    await writePlatformAudit(prisma, {
      actorStaffId: actor.staffId,
      actorRole: actor.role,
      action: 'flag.delete',
      targetType: 'feature_flag',
      targetId: key,
      before: publicFlag(existing),
      ...auditCtx(request),
    });
    return { deleted: true, key };
  });

  // ══════════════ ANNOUNCEMENTS ══════════════

  // ── GET /announcements — all rows incl. scheduled/expired ──
  app.get('/announcements', { preHandler: [requireStaff()] }, async () => {
    const rows = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { dismissals: true } } },
    });
    return { items: rows.map(publicAnnouncement), count: rows.length };
  });

  // ── POST /announcements ──
  app.post('/announcements', { preHandler: [requireStaff('announcements.write')] }, async (request, reply) => {
    let body;
    try {
      body = AnnouncementSchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
    }
    if (body.audience === 'plans' && (!body.planCodes || body.planCodes.length === 0)) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'planCodes required when audience=plans' });
    }
    if (body.audience === 'orgs' && (!body.orgIds || body.orgIds.length === 0)) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'orgIds required when audience=orgs' });
    }

    const actor = (request as any).staffUser;
    const row = await prisma.announcement.create({
      data: {
        title: body.title,
        body: body.body,
        severity: body.severity,
        audience: body.audience,
        planCodes: body.audience === 'plans' ? body.planCodes ?? [] : (body.planCodes ?? null),
        orgIds: body.audience === 'orgs' ? body.orgIds ?? [] : (body.orgIds ?? null),
        linkUrl: body.linkUrl ?? null,
        linkLabel: body.linkLabel ?? null,
        startsAt: body.startsAt ? new Date(body.startsAt) : new Date(),
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        isDismissible: body.isDismissible,
        createdByStaffId: actor.staffId,
      },
      include: { _count: { select: { dismissals: true } } },
    });

    await writePlatformAudit(prisma, {
      actorStaffId: actor.staffId,
      actorRole: actor.role,
      action: 'announcement.create',
      targetType: 'announcement',
      targetId: row.id,
      after: publicAnnouncement(row),
      ...auditCtx(request),
    });
    return reply.status(201).send({ announcement: publicAnnouncement(row) });
  });

  // ── PATCH /announcements/:id ──
  app.patch('/announcements/:id', { preHandler: [requireStaff('announcements.write')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    let body;
    try {
      body = AnnouncementPatchSchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
    }
    const existing = await prisma.announcement.findUnique({ where: { id }, include: { _count: { select: { dismissals: true } } } });
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' });

    const data: any = {};
    for (const key of ['title', 'body', 'severity', 'audience', 'isDismissible'] as const) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    if (body.planCodes !== undefined) data.planCodes = body.planCodes;
    if (body.orgIds !== undefined) data.orgIds = body.orgIds;
    if (body.linkUrl !== undefined) data.linkUrl = body.linkUrl;
    if (body.linkLabel !== undefined) data.linkLabel = body.linkLabel;
    if (body.startsAt !== undefined) data.startsAt = new Date(body.startsAt);
    if (body.endsAt !== undefined) data.endsAt = body.endsAt ? new Date(body.endsAt) : null;

    const row = await prisma.announcement.update({
      where: { id },
      data,
      include: { _count: { select: { dismissals: true } } },
    });

    const actor = (request as any).staffUser;
    await writePlatformAudit(prisma, {
      actorStaffId: actor.staffId,
      actorRole: actor.role,
      action: 'announcement.update',
      targetType: 'announcement',
      targetId: id,
      before: publicAnnouncement(existing),
      after: publicAnnouncement(row),
      ...auditCtx(request),
    });
    return { announcement: publicAnnouncement(row) };
  });

  // ── DELETE /announcements/:id ──
  app.delete('/announcements/:id', { preHandler: [requireStaff('announcements.write')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const existing = await prisma.announcement.findUnique({ where: { id }, include: { _count: { select: { dismissals: true } } } });
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' });
    await prisma.announcement.delete({ where: { id } });

    const actor = (request as any).staffUser;
    await writePlatformAudit(prisma, {
      actorStaffId: actor.staffId,
      actorRole: actor.role,
      action: 'announcement.delete',
      targetType: 'announcement',
      targetId: id,
      before: publicAnnouncement(existing),
      ...auditCtx(request),
    });
    return { deleted: true, id };
  });
}
