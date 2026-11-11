import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';
import { AuditService } from '../../core/finance/audit.service.js';
import { assertFlockNotCompleted } from '../broiler-flocks/check-flock-locked.js';

// Individual feed bags: sealed → open → finished.
// Open/finished can be stepped back one level for mistake recovery.

const StatusBodySchema = z.object({});

export async function buildFeedBagModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  const audit = new AuditService(prisma);

  async function loadBag(request: any, reply: any) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const organizationId = getOrganizationId(request);
    const bag = await prisma.feedBag.findFirst({
      where: { id, organizationId },
      include: { flock: { select: { status: true } } },
    });
    if (!bag) {
      reply.status(404).send({ error: 'NOT_FOUND' });
      return null;
    }
    return bag;
  }

  async function transition(request: any, reply: any, action: 'open' | 'finish' | 'reseal') {
    const bag = await loadBag(request, reply);
    if (!bag) return;
    const _authUser = (request as any).authUser;

    if (assertFlockNotCompleted(reply, bag.flock.status, _authUser?.role)) return;

    const now = new Date();
    let data: any;
    if (action === 'open') {
      if (bag.status !== 'sealed') return reply.status(409).send({ error: 'INVALID_TRANSITION', message: `Bag is already ${bag.status}.` });
      data = { status: 'open', openedAt: now, openedById: _authUser.userId };
    } else if (action === 'finish') {
      if (bag.status === 'finished') return reply.status(409).send({ error: 'INVALID_TRANSITION', message: 'Bag is already finished.' });
      // sealed → finished allowed (bag used without an explicit open tap)
      data = {
        status: 'finished',
        finishedAt: now,
        finishedById: _authUser.userId,
        ...(bag.status === 'sealed' ? { openedAt: bag.openedAt ?? now, openedById: bag.openedById ?? _authUser.userId } : {}),
      };
    } else {
      // reseal: open → sealed (undo an accidental open)
      if (bag.status !== 'open') return reply.status(409).send({ error: 'INVALID_TRANSITION', message: 'Only an open bag can be resealed.' });
      data = { status: 'sealed', openedAt: null, openedById: null };
    }

    const updated = await prisma.feedBag.update({ where: { id: bag.id }, data });

    await audit.log({
      organizationId: bag.organizationId,
      userId: _authUser.userId,
      impersonatedByStaffId: _authUser.impersonation?.staffId,
      entityType: 'FeedBag',
      entityId: bag.id,
      action: 'update',
      previousState: { ...bag, transition: action },
      newState: updated,
      ipAddress: request.ip,
    });

    return updated;
  }

  // GET /api/v1/feed-bags?flockId=...&status=...
  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const { flockId, status } = z.object({
      flockId: z.string().uuid().optional(),
      status: z.enum(['sealed', 'open', 'finished']).optional(),
    }).parse(request.query);
    const organizationId = getOrganizationId(request);

    const where: any = { organizationId };
    if (flockId) where.flockId = flockId;
    if (status) where.status = status;

    return prisma.feedBag.findMany({
      where,
      orderBy: [{ stageName: 'asc' }, { bagIndex: 'asc' }],
      include: {
        supplier: { select: { name: true } },
        purchase: { select: { purchaseDate: true, unitPriceZmw: true } },
      },
    });
  });

  // GET /api/v1/feed-bags/summary?flockId=... — stock counts per stage+supplier
  app.get('/summary', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({ flockId: z.string().uuid() }).parse(request.query);
    const organizationId = getOrganizationId(request);

    const rows = await prisma.feedBag.groupBy({
      by: ['stageName', 'status', 'supplierId'],
      where: { organizationId, flockId },
      _count: { _all: true },
      _sum: { bagSizeKg: true },
    });

    const supplierIds = [...new Set(rows.map((r: any) => r.supplierId).filter(Boolean))] as string[];
    const suppliers = supplierIds.length
      ? await prisma.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true } })
      : [];
    const supplierName = new Map(suppliers.map((s: any) => [s.id, s.name]));

    const stages = new Map<string, any>();
    for (const r of rows) {
      const key = r.stageName;
      if (!stages.has(key)) {
        stages.set(key, { stageName: r.stageName, sealed: 0, open: 0, finished: 0, sealedKg: 0, openKg: 0, suppliers: new Set<string>() });
      }
      const s = stages.get(key);
      s[r.status] += r._count._all;
      if (r.status !== 'finished') s[r.status === 'sealed' ? 'sealedKg' : 'openKg'] += Number(r._sum.bagSizeKg ?? 0);
      if (r.supplierId) s.suppliers.add(supplierName.get(r.supplierId) ?? r.supplierId);
    }

    return {
      flockId,
      stages: [...stages.values()].map((s) => ({ ...s, suppliers: [...s.suppliers] })),
    };
  });

  // POST /api/v1/feed-bags/:id/open   (sealed → open)
  app.post('/:id/open', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    StatusBodySchema.parse(request.body ?? {});
    return transition(request, reply, 'open');
  });

  // POST /api/v1/feed-bags/:id/finish  (sealed|open → finished)
  app.post('/:id/finish', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    StatusBodySchema.parse(request.body ?? {});
    return transition(request, reply, 'finish');
  });

  // POST /api/v1/feed-bags/:id/reseal  (open → sealed, undo)
  app.post('/:id/reseal', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    StatusBodySchema.parse(request.body ?? {});
    return transition(request, reply, 'reseal');
  });
}
