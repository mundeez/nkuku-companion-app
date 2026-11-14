import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';
import { AuditService } from '../../core/finance/audit.service.js';
import { assertFlockNotCompleted } from '../broiler-flocks/check-flock-locked.js';

// Individual feed bags: sealed → open → finished.
// Open/finished can be stepped back one level for mistake recovery.

const DateStr = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

const StatusBodySchema = z.object({
  date: DateStr.optional(),
  kgFed: z.coerce.number().positive().optional(),
});

const BagEditSchema = z.object({
  status: z.enum(['sealed', 'open', 'finished']).optional(),
  openedAt: DateStr.optional(),
  finishedAt: DateStr.optional(),
  kgFed: z.coerce.number().positive().optional(),
  removeFeedRecords: z.boolean().optional(),
});

const DAY_MS = 24 * 60 * 60 * 1000;

// Consumption of a finished bag is spread evenly across its opened→finished
// days so daily / per-chick / overall consumption analytics stay honest.
// Rebuilds the bag's linked feed records: caller provides totalKg.
async function syncBagRecords(prisma: any, bag: any, totalKg: number) {
  const finished = new Date(bag.finishedAt);
  const opened = bag.openedAt ? new Date(bag.openedAt) : finished;
  const span = Math.max(1, Math.floor((finished.getTime() - opened.getTime()) / DAY_MS) + 1);

  await prisma.feedRecord.deleteMany({ where: { feedBagId: bag.id } });

  const per = Math.floor((totalKg / span) * 1000) / 1000;
  const rows = [];
  let acc = 0;
  for (let i = 0; i < span; i++) {
    const d = new Date(opened.getTime() + i * DAY_MS);
    const qty = i === span - 1 ? Math.round((totalKg - acc) * 1000) / 1000 : per;
    acc += qty;
    rows.push({
      flockId: bag.flockId,
      supplierId: bag.supplierId,
      feedBagId: bag.id,
      recordDate: d,
      feedType: bag.stageName,
      feedBrand: bag.supplier?.name ?? null,
      quantityKg: qty,
      notes: `Auto: bag #${bag.bagIndex} finished${span > 1 ? ` (day ${i + 1}/${span})` : ''}${totalKg < Number(bag.bagSizeKg) ? ` (${totalKg}kg of ${bag.bagSizeKg}kg fed)` : ''}`,
    });
  }
  if (rows.length) await prisma.feedRecord.createMany({ data: rows });
  return rows.length;
}

export async function buildFeedBagModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  const audit = new AuditService(prisma);

  async function loadBag(request: any, reply: any) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const organizationId = getOrganizationId(request);
    const bag = await prisma.feedBag.findFirst({
      where: { id, organizationId },
      include: { flock: { select: { status: true } }, supplier: { select: { name: true } } },
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

    const body = StatusBodySchema.parse(request.body ?? {});
    const at = body.date ? new Date(body.date) : new Date();
    const bagKg = Number(bag.bagSizeKg);
    if (action === 'finish' && body.kgFed !== undefined && body.kgFed > bagKg) {
      return reply.status(400).send({ error: 'KG_EXCEEDS_BAG', message: `A ${bagKg}kg bag can't yield ${body.kgFed}kg.` });
    }

    let data: any;
    if (action === 'open') {
      if (bag.status !== 'sealed') return reply.status(409).send({ error: 'INVALID_TRANSITION', message: `Bag is already ${bag.status}.` });
      data = { status: 'open', openedAt: at, openedById: _authUser.userId };
    } else if (action === 'finish') {
      if (bag.status === 'finished') return reply.status(409).send({ error: 'INVALID_TRANSITION', message: 'Bag is already finished.' });
      // sealed → finished allowed (bag used without an explicit open tap)
      data = {
        status: 'finished',
        finishedAt: at,
        finishedById: _authUser.userId,
        ...(bag.status === 'sealed' ? { openedAt: bag.openedAt ?? at, openedById: bag.openedById ?? _authUser.userId } : {}),
      };
    } else {
      // reseal: open → sealed (undo an accidental open)
      if (bag.status !== 'open') return reply.status(409).send({ error: 'INVALID_TRANSITION', message: 'Only an open bag can be resealed.' });
      data = { status: 'sealed', openedAt: null, openedById: null };
    }

    const updated = await prisma.feedBag.update({ where: { id: bag.id }, data });

    // Finishing a bag is consumption — spread it across its opened→finished
    // days as linked feed records. No cost/finrec: the purchase already
    // booked the expense (Dr 5020 / Cr 1010) when the bag entered stock.
    if (action === 'finish') {
      const kgFed = body.kgFed ?? bagKg;
      const created = await syncBagRecords(prisma, { ...updated, supplier: bag.supplier }, kgFed);
      await audit.log({
        organizationId: bag.organizationId,
        userId: _authUser.userId,
        entityType: 'FeedBag',
        entityId: bag.id,
        action: 'update',
        newState: { feedRecordsCreated: created, kgFed },
        ipAddress: request.ip,
      });
    }

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
        _count: { select: { feedRecords: true } },
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

  // PATCH /api/v1/feed-bags/:id — owner/manager override: correct status +
  // dates directly. Transitioning to finished (re)generates the linked feed
  // records; leaving finished keeps or deletes them per removeFeedRecords.
  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const body = BagEditSchema.parse(request.body ?? {});
    const bag = await loadBag(request, reply);
    if (!bag) return;
    const _authUser = (request as any).authUser;

    if (assertFlockNotCompleted(reply, bag.flock.status, _authUser?.role)) return;

    const bagKg = Number(bag.bagSizeKg);
    if (body.kgFed !== undefined && body.kgFed > bagKg) {
      return reply.status(400).send({ error: 'KG_EXCEEDS_BAG', message: `A ${bagKg}kg bag can't yield ${body.kgFed}kg.` });
    }

    const newStatus = body.status ?? bag.status;
    const now = new Date();
    const finishedAt = newStatus === 'finished'
      ? (body.finishedAt ? new Date(body.finishedAt) : bag.finishedAt ?? now)
      : null;
    const openedAt = newStatus === 'sealed'
      ? null
      : body.openedAt
        ? new Date(body.openedAt)
        : (newStatus === 'finished' && !bag.openedAt ? finishedAt : bag.openedAt);

    const datesChanged =
      (body.openedAt !== undefined && openedAt?.getTime() !== bag.openedAt?.getTime()) ||
      (body.finishedAt !== undefined && finishedAt?.getTime() !== bag.finishedAt?.getTime());
    const becameFinished = newStatus === 'finished' && bag.status !== 'finished';
    const leftFinished = bag.status === 'finished' && newStatus !== 'finished';

    // How many linked records exist / their total kg (for resync on date edits)
    const existing = await prisma.feedRecord.aggregate({
      where: { feedBagId: bag.id },
      _sum: { quantityKg: true },
      _count: { _all: true },
    });
    const recordCount = existing._count._all;
    const existingKg = Number(existing._sum.quantityKg ?? 0);

    const { updated, recordsCreated, recordsRemoved } = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.feedBag.update({
        where: { id: bag.id },
        data: {
          status: newStatus,
          openedAt,
          finishedAt,
          ...(becameFinished && !bag.finishedById ? { finishedById: _authUser.userId } : {}),
          ...(newStatus === 'sealed' ? { openedById: null, finishedById: null } : {}),
        },
      });

      let recordsCreated = 0;
      let recordsRemoved = 0;
      if (newStatus === 'finished') {
        const needSync = becameFinished || body.kgFed !== undefined || datesChanged || recordCount === 0;
        if (needSync) {
          const totalKg = body.kgFed ?? (recordCount > 0 ? existingKg : bagKg);
          const synced = { ...updated, supplier: bag.supplier };
          recordsCreated = await syncBagRecords(tx, synced, totalKg);
        }
      } else if (leftFinished && recordCount > 0 && body.removeFeedRecords) {
        const del = await tx.feedRecord.deleteMany({ where: { feedBagId: bag.id } });
        recordsRemoved = del.count;
      }
      return { updated, recordsCreated, recordsRemoved };
    });

    await audit.log({
      organizationId: bag.organizationId,
      userId: _authUser.userId,
      impersonatedByStaffId: _authUser.impersonation?.staffId,
      entityType: 'FeedBag',
      entityId: bag.id,
      action: 'update',
      previousState: { status: bag.status, openedAt: bag.openedAt, finishedAt: bag.finishedAt, recordCount },
      newState: { status: newStatus, openedAt, finishedAt, recordsCreated, recordsRemoved },
      ipAddress: request.ip,
    });

    return updated;
  });

  // POST /api/v1/feed-bags/:id/open   (sealed → open; optional backdate)
  app.post('/:id/open', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    return transition(request, reply, 'open');
  });

  // POST /api/v1/feed-bags/:id/finish  (sealed|open → finished; optional date + kgFed)
  app.post('/:id/finish', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    return transition(request, reply, 'finish');
  });

  // POST /api/v1/feed-bags/:id/reseal  (open → sealed, undo)
  app.post('/:id/reseal', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    return transition(request, reply, 'reseal');
  });
}
