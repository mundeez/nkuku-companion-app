// ── TENANT SUPPORT (/api/v1/support) ─────────────────────
// Tenant-side half of the P3 support inbox (PLAN-super-admin-console.md
// §6 P3): "Contact support" tickets filed by tenant users, answered by
// platform staff via /api/v1/platform/tickets. Every route is behind the
// tenant authenticate() preHandler; org scoping rules:
//   • the requester always sees their own tickets
//   • owners see ALL tickets in their organization
//   • internalNote messages are never returned to tenant callers
// POSTs are rate-limited per user (in-memory, 24 h rolling window).

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/routes.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';
import { notifyStaff } from '../../core/comms/staff-notify.js';

const CreateTicketSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(1).max(10000),
  category: z.string().trim().min(1).max(40).optional(),
});

const ReplySchema = z.object({
  body: z.string().trim().min(1).max(10000),
});

const ListQuerySchema = z.object({
  status: z.enum(['open', 'in_progress', 'waiting_on_user', 'resolved', 'closed']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ── Per-user in-memory rate limiting (24 h rolling window) ──
// The redis limiter elsewhere is a 60-second window, too tight for
// "10 tickets/day". Buckets are per-process — sufficient anti-spam for a
// single-instance API; env overrides allow tuning without a deploy.
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const TICKET_LIMIT = Number.parseInt(process.env.SUPPORT_TICKETS_PER_DAY || '10', 10);
const REPLY_LIMIT = Number.parseInt(process.env.SUPPORT_REPLIES_PER_DAY || '60', 10);
const buckets = new Map<string, number[]>();

/** True when the key has exceeded `limit` calls in the last 24 h. */
function isRateLimited(key: string, limit: number): boolean {
  if (limit <= 0) return false; // 0 disables (mirrors *_RATE_LIMIT=0 convention)
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return true;
  }
  hits.push(now);
  buckets.set(key, hits);
  return false;
}

/** Load a ticket visible to this user: own tickets, or any org ticket for owners. */
async function loadTicketOr404(prisma: any, id: string, user: any, reply: any) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  // Existence is hidden cross-tenant and from non-owner members —
  // deliberately the same 404 shape for both cases.
  if (
    !ticket ||
    ticket.organizationId !== user.organizationId ||
    (user.role !== 'owner' && ticket.userId !== user.userId)
  ) {
    reply.status(404).send({ error: 'NOT_FOUND', message: 'Ticket not found' });
    return null;
  }
  return ticket;
}

export async function buildSupportModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // ── POST /tickets — file a support ticket ──
  // Captures client diagnostics (x-app-version / x-device-info headers)
  // into ticket.meta and pages staff on the platform-ops ntfy topic.
  app.post('/tickets', { preHandler: [authenticate] }, async (request, reply) => {
    let body;
    try {
      body = CreateTicketSchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
    }
    const user = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    if (isRateLimited(`support-ticket:${user.userId}`, TICKET_LIMIT)) {
      return reply.status(429).send({
        error: 'RATE_LIMIT_EXCEEDED',
        message: `Too many support tickets. Limit is ${TICKET_LIMIT} per day.`,
      });
    }

    const meta: Record<string, string> = {};
    const appVersion = request.headers['x-app-version'];
    const deviceInfo = request.headers['x-device-info'];
    if (typeof appVersion === 'string' && appVersion) meta.appVersion = appVersion.slice(0, 60);
    if (typeof deviceInfo === 'string' && deviceInfo) meta.deviceInfo = deviceInfo.slice(0, 500);

    const ticket = await prisma.supportTicket.create({
      data: {
        organizationId,
        userId: user.userId,
        subject: body.subject,
        category: body.category ?? 'general',
        lastMessageAt: new Date(),
        ...(Object.keys(meta).length ? { meta } : {}),
        messages: {
          create: {
            authorType: 'user',
            authorUserId: user.userId,
            body: body.body,
          },
        },
      },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    notifyStaff('New support ticket', `${org?.name ?? organizationId}: ${body.subject}`, 3, [
      'ticket',
      'support',
    ]);

    return reply.status(201).send({ ticket });
  });

  // ── GET /tickets — own tickets (owner sees all org tickets) ──
  app.get('/tickets', { preHandler: [authenticate] }, async (request) => {
    const user = (request as any).authUser;
    const organizationId = getOrganizationId(request);
    const q = ListQuerySchema.parse(request.query);

    const where: any = { organizationId };
    if (user.role !== 'owner') where.userId = user.userId;
    if (q.status) where.status = q.status;

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true,
          subject: true,
          category: true,
          status: true,
          priority: true,
          userId: true,
          lastMessageAt: true,
          resolvedAt: true,
          createdAt: true,
          // Tenant-facing count excludes staff-only internal notes.
          _count: { select: { messages: { where: { internalNote: false } } } },
        },
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return {
      items: tickets.map((t: any) => ({
        id: t.id,
        subject: t.subject,
        category: t.category,
        status: t.status,
        priority: t.priority,
        userId: t.userId,
        lastMessageAt: t.lastMessageAt,
        resolvedAt: t.resolvedAt,
        createdAt: t.createdAt,
        messageCount: t._count.messages,
      })),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize),
    };
  });

  // ── GET /tickets/:id — ticket + thread (internal notes excluded) ──
  app.get('/tickets/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const user = (request as any).authUser;

    const ticket = await loadTicketOr404(prisma, id, user, reply);
    if (!ticket) return;

    const messages = await prisma.ticketMessage.findMany({
      where: { ticketId: id, internalNote: false },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        authorType: true,
        body: true,
        createdAt: true,
        authorUser: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      ticket: {
        id: ticket.id,
        subject: ticket.subject,
        category: ticket.category,
        status: ticket.status,
        priority: ticket.priority,
        userId: ticket.userId,
        lastMessageAt: ticket.lastMessageAt,
        resolvedAt: ticket.resolvedAt,
        createdAt: ticket.createdAt,
      },
      messages: messages.map((m: any) => ({
        id: m.id,
        authorType: m.authorType,
        body: m.body,
        createdAt: m.createdAt,
        author: m.authorUser
          ? { id: m.authorUser.id, name: m.authorUser.name, email: m.authorUser.email }
          : null,
      })),
    };
  });

  // ── POST /tickets/:id/reply — user message on the thread ──
  // A reply on a waiting_on_user/resolved ticket reopens it to 'open'
  // (the user clearly isn't done); closed tickets refuse replies.
  app.post('/tickets/:id/reply', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    let body;
    try {
      body = ReplySchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
    }
    const user = (request as any).authUser;

    const ticket = await loadTicketOr404(prisma, id, user, reply);
    if (!ticket) return;
    if (ticket.status === 'closed') {
      return reply.status(422).send({ error: 'TICKET_CLOSED', message: 'This ticket is closed — open a new ticket instead' });
    }
    if (isRateLimited(`support-reply:${user.userId}`, REPLY_LIMIT)) {
      return reply.status(429).send({
        error: 'RATE_LIMIT_EXCEEDED',
        message: `Too many replies. Limit is ${REPLY_LIMIT} per day.`,
      });
    }

    const now = new Date();
    const reopen = ticket.status === 'waiting_on_user' || ticket.status === 'resolved';
    const [message] = await prisma.$transaction([
      prisma.ticketMessage.create({
        data: { ticketId: id, authorType: 'user', authorUserId: user.userId, body: body.body },
      }),
      prisma.supportTicket.update({
        where: { id },
        data: {
          lastMessageAt: now,
          ...(reopen ? { status: 'open', resolvedAt: null } : {}),
        },
      }),
    ]);

    return reply.status(201).send({ message });
  });

  // ── POST /tickets/:id/close — requester or owner closes the ticket ──
  app.post('/tickets/:id/close', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const user = (request as any).authUser;

    const ticket = await loadTicketOr404(prisma, id, user, reply);
    if (!ticket) return;
    if (ticket.status === 'closed') {
      return reply.status(422).send({ error: 'ALREADY_CLOSED' });
    }

    const updated = await prisma.supportTicket.update({
      where: { id },
      data: { status: 'closed', resolvedAt: ticket.resolvedAt ?? new Date() },
    });

    return { ticket: { id: updated.id, status: updated.status, resolvedAt: updated.resolvedAt } };
  });
}
