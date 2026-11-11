// ── PLATFORM SUPPORT / COMMS / OPS (/api/v1/platform/*) ──
// P3 of the super-admin console (PLAN-super-admin-console.md §6):
//   • support inbox — ticket list/thread/reply/assign/status
//   • comms log — outbound-message viewer + resend
//   • system health — dependency RAG + cron freshness
//   • ops actions — trigger a cron job, toggle maintenance mode
//
// Registered inside buildPlatformModule's encapsulated scope, so the
// module-level IP allowlist onRequest hook covers every route here.
// Permissions follow the §3 matrix; dangerous actions (comms.resend,
// system.ops) additionally require fresh re-auth.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createRequire } from 'module';
import { promises as fsp } from 'fs';
import net from 'net';
import {
  requireStaff,
  requireReauth,
  getClientIp,
} from '../../core/staff-auth/staff-auth.service.js';
import { writePlatformAudit } from '../../core/staff-auth/audit.service.js';
import { sendTicketReplyEmail, deliverEmail } from '../../core/security/email.service.js';
import { getS3Client, getS3Bucket } from '../../core/storage/s3-client.js';
import { executeCronJob, type CronJobDef } from '../../core/cron/cron.service.js';
import {
  getMaintenanceMode,
  setPlatformFlag,
  MAINTENANCE_FLAG_KEY,
} from '../../core/platform-flags/flags.service.js';

const require2 = createRequire(import.meta.url);
const API_VERSION: string = require2('../../../package.json').version;

const TICKET_STATUSES = ['open', 'in_progress', 'waiting_on_user', 'resolved', 'closed'] as const;

const TicketListQuerySchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  // 'unassigned' | 'me' | staff uuid
  assigned: z.union([z.literal('unassigned'), z.literal('me'), z.string().uuid()]).optional(),
  orgId: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const StaffReplySchema = z.object({
  body: z.string().trim().min(1).max(10000),
  internalNote: z.boolean().optional().default(false),
});

const AssignSchema = z.object({
  staffId: z.string().uuid().nullable(),
});

const StatusSchema = z.object({
  status: z.enum(TICKET_STATUSES),
});

const CommsListQuerySchema = z.object({
  channel: z.enum(['email', 'sms', 'push']).optional(),
  status: z.enum(['sent', 'failed', 'bounced']).optional(),
  orgId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const MaintenanceSchema = z.object({
  enabled: z.boolean(),
  message: z.string().max(2000).optional(),
});

function auditCtx(request: any) {
  return {
    ip: getClientIp(request),
    userAgent: request.headers?.['user-agent'] ?? null,
    requestId: (request as any).id ?? null,
  };
}

function actorOf(request: any): { staffId: string; role: any; email: string } {
  const staff = request.staffUser;
  return { staffId: staff.staffId, role: staff.role, email: staff.email };
}

async function loadTicketOr404(prisma: any, id: string, reply: any) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) {
    reply.status(404).send({ error: 'NOT_FOUND', message: 'Ticket not found' });
    return null;
  }
  return ticket;
}

/** Run one dependency check; always resolves — failures are reported, never thrown. */
async function check(fn: () => Promise<Record<string, any>>): Promise<Record<string, any>> {
  const started = Date.now();
  try {
    const out = await Promise.race([
      fn(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout (3s)')), 3000)),
    ]);
    return { status: 'green', latencyMs: Date.now() - started, ...out };
  } catch (err: any) {
    return { status: 'red', latencyMs: Date.now() - started, error: err?.message ?? String(err) };
  }
}

const RAG_RANK: Record<string, number> = { green: 0, amber: 1, red: 2 };

export async function buildPlatformSupportModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  const redis = (app as any).redis;

  // ══════════════════════════════════════════════════════
  // SUPPORT INBOX
  // ══════════════════════════════════════════════════════

  // ── GET /tickets — inbox list (support.tickets.read) ──
  // `awaitingStaffReply` is the ball-in-our-court heuristic: open or
  // in-progress tickets whose newest activity needs a staff answer, plus
  // any ticket with activity after it was resolved (user re-pinged).
  app.get('/tickets', { preHandler: [requireStaff('support.tickets.read')] }, async (request) => {
    const q = TicketListQuerySchema.parse(request.query);
    const staff = (request as any).staffUser;

    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.orgId) where.organizationId = q.orgId;
    if (q.assigned === 'unassigned') where.assignedStaffId = null;
    else if (q.assigned === 'me') where.assignedStaffId = staff.staffId;
    else if (q.assigned) where.assignedStaffId = q.assigned;
    if (q.search) {
      where.OR = [
        { subject: { contains: q.search, mode: 'insensitive' } },
        { user: { email: { contains: q.search, mode: 'insensitive' } } },
        { user: { name: { contains: q.search, mode: 'insensitive' } } },
        { organization: { name: { contains: q.search, mode: 'insensitive' } } },
      ];
    }

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy: [{ status: 'asc' }, { lastMessageAt: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          organization: { select: { id: true, name: true } },
          user: { select: { id: true, email: true, name: true } },
          assignedStaff: { select: { id: true, email: true, name: true } },
          _count: { select: { messages: true } },
        },
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return {
      items: tickets.map((t: any) => {
        const activityAfterResolved = t.resolvedAt != null && t.lastMessageAt > t.resolvedAt;
        const awaitingStaffReply = t.status === 'open' || t.status === 'in_progress' || activityAfterResolved;
        return {
          id: t.id,
          subject: t.subject,
          category: t.category,
          status: t.status,
          priority: t.priority,
          organization: t.organization,
          requester: t.user,
          assignedStaff: t.assignedStaff,
          messageCount: t._count.messages,
          lastMessageAt: t.lastMessageAt,
          resolvedAt: t.resolvedAt,
          createdAt: t.createdAt,
          awaitingStaffReply,
        };
      }),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize),
    };
  });

  // ── GET /tickets/:id — full thread incl. internal notes + org summary ──
  app.get('/tickets/:id', { preHandler: [requireStaff('support.tickets.read')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true, planCode: true, suspendedAt: true, deletedAt: true, isDemo: true },
        },
        user: { select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true } },
        assignedStaff: { select: { id: true, email: true, name: true, role: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            authorUser: { select: { id: true, email: true, name: true } },
            authorStaff: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });
    if (!ticket) return reply.status(404).send({ error: 'NOT_FOUND' });

    const org = ticket.organization;
    return {
      ticket: {
        id: ticket.id,
        subject: ticket.subject,
        category: ticket.category,
        status: ticket.status,
        priority: ticket.priority,
        meta: ticket.meta,
        lastMessageAt: ticket.lastMessageAt,
        resolvedAt: ticket.resolvedAt,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
      },
      organization: org
        ? {
            id: org.id,
            name: org.name,
            planCode: org.planCode,
            suspended: !!org.suspendedAt,
            deletedAt: org.deletedAt,
            isDemo: org.isDemo,
          }
        : null,
      requester: ticket.user,
      assignedStaff: ticket.assignedStaff,
      messages: ticket.messages.map((m: any) => ({
        id: m.id,
        authorType: m.authorType,
        internalNote: m.internalNote,
        body: m.body,
        createdAt: m.createdAt,
        author: m.authorType === 'staff' ? m.authorStaff : m.authorUser,
      })),
    };
  });

  // ── POST /tickets/:id/reply — staff message or internal note ──
  // Public replies email the requester (template 'ticket_reply' via
  // deliver() → comms_log) and move open/in_progress tickets to
  // waiting_on_user. Internal notes create no email and no status change.
  app.post(
    '/tickets/:id/reply',
    { preHandler: [requireStaff('support.tickets.write')] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      let body;
      try {
        body = StaffReplySchema.parse(request.body);
      } catch (err: any) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
      }
      const actor = actorOf(request);

      const ticket = await prisma.supportTicket.findUnique({
        where: { id },
        include: { user: { select: { id: true, email: true, name: true } } },
      });
      if (!ticket) return reply.status(404).send({ error: 'NOT_FOUND' });

      const staff = await prisma.staffUser.findUnique({
        where: { id: actor.staffId },
        select: { name: true },
      });

      const now = new Date();
      const updateData: any = {};
      let statusChanged: string | null = null;
      if (!body.internalNote) {
        updateData.lastMessageAt = now;
        if (ticket.status === 'open' || ticket.status === 'in_progress') {
          updateData.status = 'waiting_on_user';
          statusChanged = 'waiting_on_user';
        }
      }

      const [message] = await prisma.$transaction([
        prisma.ticketMessage.create({
          data: {
            ticketId: id,
            authorType: 'staff',
            authorStaffId: actor.staffId,
            body: body.body,
            internalNote: body.internalNote,
          },
        }),
        Object.keys(updateData).length
          ? prisma.supportTicket.update({ where: { id }, data: updateData })
          : prisma.supportTicket.findUnique({ where: { id } }),
      ]);

      // Public replies email the requester (deliver() writes the comms row).
      let emailSent = false;
      if (!body.internalNote && ticket.user?.email) {
        const result = await sendTicketReplyEmail(
          ticket.user.email,
          { ticketSubject: ticket.subject, replyBody: body.body, staffName: staff?.name },
          { organizationId: ticket.organizationId, userId: ticket.user.id, sentByStaffId: actor.staffId },
        );
        emailSent = result.success;
      }

      return reply.status(201).send({
        message,
        statusChanged,
        emailSent,
      });
    },
  );

  // ── POST /tickets/:id/assign — assign to a staff member (or clear) ──
  app.post(
    '/tickets/:id/assign',
    { preHandler: [requireStaff('support.tickets.write')] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      let body;
      try {
        body = AssignSchema.parse(request.body);
      } catch (err: any) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
      }
      const actor = actorOf(request);

      const ticket = await loadTicketOr404(prisma, id, reply);
      if (!ticket) return;

      let assignee: any = null;
      if (body.staffId) {
        assignee = await prisma.staffUser.findUnique({ where: { id: body.staffId } });
        if (!assignee || !assignee.isActive) {
          return reply.status(422).send({ error: 'INVALID_STAFF', message: 'Staff user not found or inactive' });
        }
      }

      const updated = await prisma.supportTicket.update({
        where: { id },
        data: { assignedStaffId: body.staffId },
      });

      await writePlatformAudit(prisma, {
        actorStaffId: actor.staffId,
        actorRole: actor.role,
        action: 'ticket.assign',
        targetType: 'support_ticket',
        targetId: id,
        organizationId: ticket.organizationId,
        before: { assignedStaffId: ticket.assignedStaffId },
        after: { assignedStaffId: updated.assignedStaffId },
        ...auditCtx(request),
      });

      return {
        ticketId: id,
        assignedStaffId: updated.assignedStaffId,
        assignedStaff: assignee ? { id: assignee.id, email: assignee.email, name: assignee.name } : null,
      };
    },
  );

  // ── POST /tickets/:id/status — lifecycle transition ──
  // Terminal statuses (resolved/closed) stamp resolvedAt; moving back to
  // a live status clears it.
  app.post(
    '/tickets/:id/status',
    { preHandler: [requireStaff('support.tickets.write')] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      let body;
      try {
        body = StatusSchema.parse(request.body);
      } catch (err: any) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
      }
      const actor = actorOf(request);

      const ticket = await loadTicketOr404(prisma, id, reply);
      if (!ticket) return;

      const terminal = body.status === 'resolved' || body.status === 'closed';
      const updated = await prisma.supportTicket.update({
        where: { id },
        data: {
          status: body.status,
          resolvedAt: terminal ? ticket.resolvedAt ?? new Date() : null,
        },
      });

      await writePlatformAudit(prisma, {
        actorStaffId: actor.staffId,
        actorRole: actor.role,
        action: 'ticket.status',
        targetType: 'support_ticket',
        targetId: id,
        organizationId: ticket.organizationId,
        before: { status: ticket.status, resolvedAt: ticket.resolvedAt },
        after: { status: updated.status, resolvedAt: updated.resolvedAt },
        ...auditCtx(request),
      });

      return { ticketId: id, status: updated.status, resolvedAt: updated.resolvedAt };
    },
  );

  // ══════════════════════════════════════════════════════
  // COMMS LOG
  // ══════════════════════════════════════════════════════

  // ── GET /comms — outbound message log (comms.log.read) ──
  app.get('/comms', { preHandler: [requireStaff('comms.log.read')] }, async (request) => {
    const q = CommsListQuerySchema.parse(request.query);

    const where: any = {};
    if (q.channel) where.channel = q.channel;
    if (q.status) where.status = q.status;
    if (q.orgId) where.organizationId = q.orgId;
    if (q.from || q.to) {
      where.createdAt = {};
      if (q.from) where.createdAt.gte = new Date(q.from);
      if (q.to) where.createdAt.lte = new Date(q.to);
    }

    const [rows, total] = await Promise.all([
      prisma.commsLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          organization: { select: { id: true, name: true } },
          sentByStaff: { select: { id: true, email: true, name: true } },
          resendOf: { select: { id: true } },
        },
      }),
      prisma.commsLog.count({ where }),
    ]);

    return {
      items: rows.map((r: any) => ({
        id: r.id,
        channel: r.channel,
        toAddr: r.toAddr,
        subject: r.subject,
        template: r.template,
        providerRef: r.providerRef,
        status: r.status,
        error: r.error,
        resendOfId: r.resendOfId,
        organization: r.organization,
        sentByStaff: r.sentByStaff,
        createdAt: r.createdAt,
        hasBody: r.body != null,
      })),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize),
    };
  });

  // ── POST /comms/:id/resend — re-deliver verbatim (comms.resend + reauth) ──
  // Email only: 'sms'/'push' channels are reserved but no provider exists
  // yet, so they 422 UNSUPPORTED_CHANNEL. The new comms row carries
  // resendOfId pointing back at the original.
  app.post(
    '/comms/:id/resend',
    { preHandler: [requireStaff('comms.resend'), requireReauth()] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const actor = actorOf(request);

      const original = await prisma.commsLog.findUnique({ where: { id } });
      if (!original) return reply.status(404).send({ error: 'NOT_FOUND' });
      if (original.channel !== 'email') {
        return reply.status(422).send({
          error: 'UNSUPPORTED_CHANNEL',
          message: `Resend is only supported for email (row channel: ${original.channel})`,
        });
      }
      if (!original.body) {
        return reply.status(422).send({
          error: 'NO_STORED_BODY',
          message: 'This log row has no stored body to re-deliver',
        });
      }

      const result = await deliverEmail(
        original.toAddr,
        original.subject ?? '(no subject)',
        original.body,
        {
          template: original.template,
          ctx: {
            organizationId: original.organizationId,
            userId: original.userId,
            sentByStaffId: actor.staffId,
            resendOfId: original.id,
          },
        },
      );

      await writePlatformAudit(prisma, {
        actorStaffId: actor.staffId,
        actorRole: actor.role,
        action: 'comms.resend',
        targetType: 'comms_log',
        targetId: id,
        organizationId: original.organizationId,
        after: { toAddr: original.toAddr, channel: original.channel, delivered: result.success },
        ...auditCtx(request),
      });

      return reply.status(result.success ? 200 : 502).send({
        resent: result.success,
        message: result.message,
        resendOfId: original.id,
      });
    },
  );

  // ══════════════════════════════════════════════════════
  // SYSTEM HEALTH (platform.dashboard.read)
  // ══════════════════════════════════════════════════════
  // Aggregates dependency checks + cron freshness into a red/amber/green
  // board. NEVER 500s on a failing dependency — the dep is marked red and
  // the endpoint stays up (that's the whole point of a health panel).

  app.get('/health', { preHandler: [requireStaff('platform.dashboard.read')] }, async () => {
    const checks: Record<string, any> = {};

    // ── Postgres round-trip ──
    checks.db = await check(async () => {
      await prisma.$queryRaw`SELECT 1`;
      const sizeRows: any[] = await prisma.$queryRaw`SELECT pg_database_size(current_database()) AS bytes`;
      const bytes = Number(sizeRows?.[0]?.bytes ?? 0);
      return { dbSizeBytes: bytes, dbSizePretty: prettyBytes(bytes) };
    });

    // ── Redis PING ──
    checks.redis = await check(async () => {
      if (!redis) throw new Error('redis client not configured');
      const pong = await redis.ping();
      return { reply: pong };
    });

    // ── MinIO/S3 HEAD bucket ──
    checks.minio = await check(async () => {
      const { HeadBucketCommand } = await import('@aws-sdk/client-s3');
      const bucket = getS3Bucket();
      await getS3Client().send(new HeadBucketCommand({ Bucket: bucket }));
      return { bucket };
    });

    // ── ClamAV TCP reachability ──
    // Optional dep when REQUIRE_VIRUS_SCAN=false (uploads fail open) —
    // unreachable then maps to amber instead of red.
    const clamavRequired = process.env.REQUIRE_VIRUS_SCAN !== 'false';
    {
      const host = process.env.CLAMAV_HOST || 'clamav';
      const port = Number.parseInt(process.env.CLAMAV_PORT || '3310', 10);
      const tcp = await check(async () => {
        await new Promise<void>((resolve, reject) => {
          const socket = net.connect({ host, port, timeout: 2500 });
          socket.once('connect', () => {
            socket.destroy();
            resolve();
          });
          socket.once('error', reject);
          socket.once('timeout', () => {
            socket.destroy();
            reject(new Error('connect timeout'));
          });
        });
        return { host, port };
      });
      checks.clamav = {
        ...tcp,
        required: clamavRequired,
        status: tcp.status === 'red' && !clamavRequired ? 'amber' : tcp.status,
      };
    }

    // ── Disk free % (filesystem hosting the API working dir) ──
    checks.disk = await (async () => {
      try {
        const stats = await fsp.statfs('/');
        const freeBytes = Number(stats.bavail) * Number(stats.bsize);
        const totalBytes = Number(stats.blocks) * Number(stats.bsize);
        const freePercent = totalBytes > 0 ? (freeBytes / totalBytes) * 100 : 0;
        const status = freePercent < 5 ? 'red' : freePercent < 15 ? 'amber' : 'green';
        return { status, path: '/', freePercent: Math.round(freePercent * 10) / 10, freeBytes, totalBytes };
      } catch (err: any) {
        return { status: 'amber', error: err?.message ?? String(err), note: 'statfs unavailable on this platform' };
      }
    })();

    // ── API process ──
    checks.api = {
      status: 'green',
      uptimeSec: Math.round(process.uptime()),
      version: API_VERSION,
      node: process.version,
    };

    // ── Cron freshness ──
    // For every registered job: last cron_runs row → ok / stale / failed /
    // never-ran. RAG: failed run or running >1 h → red; older than the
    // job's maxAgeSec or never ran → amber; else green.
    const cronJobs: CronJobDef[] = ((app as any).cronJobs as CronJobDef[]) ?? [];
    checks.cron = await (async () => {
      const jobs: any[] = [];
      let worst = 'green';
      for (const job of cronJobs) {
        try {
          const last = await prisma.cronRun.findFirst({
            where: { name: job.name },
            orderBy: { startedAt: 'desc' },
          });
          let rag = 'green';
          let detail: string | undefined;
          if (!last) {
            rag = 'amber';
            detail = 'never ran';
          } else if (last.status === 'failed') {
            rag = 'red';
            detail = last.error ?? 'failed';
          } else if (last.status === 'running') {
            const runningFor = (Date.now() - new Date(last.startedAt).getTime()) / 1000;
            if (runningFor > 3600) {
              rag = 'red';
              detail = `running for ${Math.round(runningFor)}s (stuck?)`;
            } else {
              detail = 'running';
            }
          } else {
            const ageSec = (Date.now() - new Date(last.startedAt).getTime()) / 1000;
            if (ageSec > job.maxAgeSec) {
              rag = 'amber';
              detail = `stale (age ${Math.round(ageSec / 3600)}h > ${Math.round(job.maxAgeSec / 3600)}h budget)`;
            }
          }
          if (RAG_RANK[rag] > RAG_RANK[worst]) worst = rag;
          jobs.push({
            name: job.name,
            schedule: job.schedule,
            rag,
            detail,
            lastRunAt: last?.startedAt ?? null,
            lastFinishedAt: last?.finishedAt ?? null,
            lastStatus: last?.status ?? null,
            ageSec: last ? Math.round((Date.now() - new Date(last.startedAt).getTime()) / 1000) : null,
          });
        } catch (err: any) {
          if (RAG_RANK['amber'] > RAG_RANK[worst]) worst = 'amber';
          jobs.push({ name: job.name, schedule: job.schedule, rag: 'amber', detail: `check failed: ${err?.message}` });
        }
      }
      return { status: worst, jobs };
    })();

    // Overall RAG = worst of checks.
    let overall = 'green';
    for (const c of Object.values(checks)) {
      if ((RAG_RANK[c.status] ?? 0) > RAG_RANK[overall]) overall = c.status;
    }

    return {
      status: overall,
      checkedAt: new Date().toISOString(),
      checks,
    };
  });

  // ══════════════════════════════════════════════════════
  // OPS ACTIONS (system.ops + re-auth)
  // ══════════════════════════════════════════════════════

  // ── POST /ops/cron/:name/run — execute a registry job now ──
  // Fires asynchronously through the same executeCronJob wrapper the
  // scheduler uses (CronRun row + staff notify on failure).
  app.post(
    '/ops/cron/:name/run',
    { preHandler: [requireStaff('system.ops'), requireReauth()] },
    async (request, reply) => {
      const { name } = z.object({ name: z.string().min(1).max(60) }).parse(request.params);
      const actor = actorOf(request);

      const cronJobs: CronJobDef[] = ((app as any).cronJobs as CronJobDef[]) ?? [];
      const job = cronJobs.find((j) => j.name === name);
      if (!job) {
        return reply.status(404).send({
          error: 'UNKNOWN_JOB',
          message: `No cron job named '${name}'. Registered: ${cronJobs.map((j) => j.name).join(', ') || 'none'}`,
        });
      }

      // Async fire — the CronRun row tracks progress/failure.
      void executeCronJob(prisma, job);

      await writePlatformAudit(prisma, {
        actorStaffId: actor.staffId,
        actorRole: actor.role,
        action: 'system.cron_run',
        targetType: 'cron_job',
        targetId: name,
        after: { schedule: job.schedule },
        ...auditCtx(request),
      });

      return reply.status(202).send({ started: true, name: job.name });
    },
  );

  // ── POST /ops/maintenance — toggle platform maintenance mode ──
  // Writes the 'maintenance_mode' PlatformFlag read by tenant
  // authenticate() (10 s cache, invalidated here for immediacy).
  app.post(
    '/ops/maintenance',
    { preHandler: [requireStaff('system.ops'), requireReauth()] },
    async (request, reply) => {
      let body;
      try {
        body = MaintenanceSchema.parse(request.body);
      } catch (err: any) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
      }
      const actor = actorOf(request);

      const before = await getMaintenanceMode(prisma);
      const value = {
        enabled: body.enabled,
        message: body.message ?? null,
        by: actor.email,
        at: new Date().toISOString(),
      };
      await setPlatformFlag(prisma, MAINTENANCE_FLAG_KEY, value, actor.staffId);

      await writePlatformAudit(prisma, {
        actorStaffId: actor.staffId,
        actorRole: actor.role,
        action: 'system.maintenance',
        targetType: 'platform_flag',
        targetId: MAINTENANCE_FLAG_KEY,
        before,
        after: value,
        ...auditCtx(request),
      });

      return { maintenance: value };
    },
  );
}

function prettyBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log2(bytes) / 10));
  return `${(bytes / 2 ** (10 * i)).toFixed(1)} ${units[i]}`;
}
