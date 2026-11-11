import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { authenticate, requireRole } from '../auth/routes.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';
import { AuditService } from '../../core/finance/audit.service.js';
import { JournalEngine } from '../../core/double-entry/journal.engine.js';
import { AutoPostService } from '../../core/double-entry/auto-post.service.js';
import { checkFlockNotLocked, assertFlockNotCompleted } from '../broiler-flocks/check-flock-locked.js';

const FeedPurchaseCreateSchema = z.object({
  flockId: z.string().uuid(),
  feedStageId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  purchaseDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  stageName: z.string().min(1).max(50),
  // Explicit projected feed type (e.g. "Starter") — supplier-agnostic attribution.
  fulfillsFeedType: z.string().max(50).optional(),
  bagSizeKg: z.coerce.number().positive(),
  bagsPurchased: z.number().int().positive(),
  unitPriceZmw: z.coerce.number().nonnegative(),
  notes: z.string().optional(),
});

// Materialize individual FeedBag rows (1..bagsPurchased) for a purchase.
async function materializeBags(prisma: any, purchase: any, fromIndex = 1) {
  const rows = [];
  for (let i = fromIndex; i <= purchase.bagsPurchased; i++) {
    rows.push({
      organizationId: purchase.organizationId,
      flockId: purchase.flockId,
      purchaseId: purchase.id,
      feedStageId: purchase.feedStageId,
      supplierId: purchase.supplierId,
      stageName: purchase.stageName,
      bagSizeKg: purchase.bagSizeKg,
      bagIndex: i,
    });
  }
  if (rows.length) await prisma.feedBag.createMany({ data: rows });
}

const FeedPurchaseUpdateSchema = FeedPurchaseCreateSchema.partial().omit({ flockId: true });

export async function buildFeedPurchaseModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  const audit = new AuditService(prisma);
  const journalEngine = new JournalEngine(prisma);
  const autoPost = new AutoPostService(journalEngine, prisma);
  const flockLock = checkFlockNotLocked(prisma);

  // GET /api/v1/feed-purchases?flockId=...
  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({ flockId: z.string().uuid().optional() }).parse(request.query);
    const organizationId = getOrganizationId(request);

    const where: any = { organizationId };
    if (flockId) where.flockId = flockId;

    return prisma.feedPurchase.findMany({
      where,
      orderBy: { purchaseDate: 'desc' },
      include: {
        feedStage: { select: { stageName: true, unitSizeKg: true } },
        supplier: { select: { name: true } },
      },
    });
  });

  // POST /api/v1/feed-purchases
  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager'), flockLock] }, async (request, reply) => {
    const data = FeedPurchaseCreateSchema.parse(request.body);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: data.flockId, organizationId },
    });
    if (!flock) return reply.status(404).send({ error: 'NOT_FOUND' });

    // Validate that feedStageId and supplierId belong to the caller's organization
    // to prevent cross-tenant information leakage.
    if (data.feedStageId) {
      const feedStage = await prisma.feedStage.findFirst({
        where: { id: data.feedStageId, supplier: { organizationId } },
      });
      if (!feedStage) return reply.status(400).send({ error: 'FEED_STAGE_NOT_FOUND' });
    }
    if (data.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: data.supplierId, organizationId },
      });
      if (!supplier) return reply.status(400).send({ error: 'SUPPLIER_NOT_FOUND' });
    }

    const totalCostZmw = new Decimal(data.bagsPurchased).mul(data.unitPriceZmw).toNumber();

    // Create the FeedPurchase
    const purchase = await prisma.feedPurchase.create({
      data: {
        organizationId,
        flockId: data.flockId,
        feedStageId: data.feedStageId ?? null,
        supplierId: data.supplierId ?? null,
        purchaseDate: new Date(data.purchaseDate),
        stageName: data.stageName,
        fulfillsFeedType: data.fulfillsFeedType ?? null,
        bagSizeKg: data.bagSizeKg,
        bagsPurchased: data.bagsPurchased,
        unitPriceZmw: data.unitPriceZmw,
        totalCostZmw,
        notes: data.notes ?? null,
        createdBy: _authUser.userId,
      },
    });

    // Materialize individual bags for lifecycle tracking (sealed → open → finished)
    await materializeBags(prisma, purchase);

    // Auto-create a linked FinancialRecord (category: feed, expense)
    const description = `Feed Purchase: ${data.bagsPurchased} × ${data.bagSizeKg}kg ${data.stageName} bags`;
    if (totalCostZmw > 0) {
      const financialRecord = await prisma.financialRecord.create({
        data: {
          flockId: data.flockId,
          sourceRecordId: purchase.id,
          sourceTable: 'feed_purchases',
          recordDate: new Date(data.purchaseDate),
          category: 'feed',
          description,
          amountZmw: totalCostZmw,
          isIncome: false,
          isSystemGenerated: true,
          notes: data.notes ? `Auto-generated from feed purchase: ${data.notes}` : 'Auto-generated from feed purchase',
        },
      });

      // Auto-post the double-entry journal entry (debit 5020 Feed COGS, credit 1010 Cash)
      try {
        await autoPost.postFromFinancialRecord(financialRecord.id, _authUser.userId, 'feed_purchase');
      } catch (err: any) {
        // Journal post failure should not block the purchase; log and continue.
        app.log.error(`[FeedPurchase] Auto-post failed for FR ${financialRecord.id}: ${err.message}`);
      }
    }

    await audit.log({
      organizationId,
      userId: _authUser.userId,
      impersonatedByStaffId: _authUser.impersonation?.staffId,
      entityType: 'FeedPurchase',
      entityId: purchase.id,
      action: 'create',
      newState: purchase,
      ipAddress: request.ip,
    });

    return purchase;
  });

  // PATCH /api/v1/feed-purchases/:id
  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = FeedPurchaseUpdateSchema.parse(request.body);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const existing = await prisma.feedPurchase.findFirst({
      where: { id, organizationId },
      include: { flock: { select: { status: true } } },
    });
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' });

    if (assertFlockNotCompleted(reply, existing.flock.status, (request as any).authUser?.role)) return;

    // Validate that feedStageId and supplierId belong to the caller's organization
    // to prevent cross-tenant information leakage.
    if (data.feedStageId) {
      const feedStage = await prisma.feedStage.findFirst({
        where: { id: data.feedStageId, supplier: { organizationId } },
      });
      if (!feedStage) return reply.status(400).send({ error: 'FEED_STAGE_NOT_FOUND' });
    }
    if (data.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: data.supplierId, organizationId },
      });
      if (!supplier) return reply.status(400).send({ error: 'SUPPLIER_NOT_FOUND' });
    }

    // Recompute totalCostZmw if bags or price changed
    const bagsPurchased = data.bagsPurchased ?? existing.bagsPurchased;
    const unitPriceZmw = data.unitPriceZmw !== undefined ? Number(data.unitPriceZmw) : Number(existing.unitPriceZmw);
    const totalCostZmw = new Decimal(bagsPurchased).mul(unitPriceZmw).toNumber();

    // Reducing bagsPurchased: ensure enough sealed bags exist to remove,
    // BEFORE touching the purchase row.
    let removableBags: any[] = [];
    if (data.bagsPurchased !== undefined && data.bagsPurchased < existing.bagsPurchased) {
      const bagCount = await prisma.feedBag.count({ where: { purchaseId: id } });
      const excess = bagCount - data.bagsPurchased;
      if (excess > 0) {
        removableBags = await prisma.feedBag.findMany({
          where: { purchaseId: id, status: 'sealed' },
          orderBy: { bagIndex: 'desc' },
          take: excess,
        });
        if (removableBags.length < excess) {
          return reply.status(400).send({
            error: 'BAGS_ALREADY_CONSUMED',
            message: `Only ${removableBags.length} sealed bag(s) can be removed — the rest are already open/finished.`,
          });
        }
      }
    }

    const updated = await prisma.feedPurchase.update({
      where: { id },
      data: {
        feedStageId: data.feedStageId,
        supplierId: data.supplierId,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
        stageName: data.stageName,
        fulfillsFeedType: data.fulfillsFeedType,
        bagSizeKg: data.bagSizeKg,
        bagsPurchased: data.bagsPurchased,
        unitPriceZmw: data.unitPriceZmw,
        totalCostZmw,
        notes: data.notes,
      },
    });

    // Keep materialized bags in sync with the purchase.
    if (data.bagsPurchased !== undefined && data.bagsPurchased !== existing.bagsPurchased) {
      const bagCount = await prisma.feedBag.count({ where: { purchaseId: id } });
      if (data.bagsPurchased > bagCount) {
        await materializeBags(prisma, { ...updated, bagsPurchased: data.bagsPurchased }, bagCount + 1);
      } else if (removableBags.length) {
        await prisma.feedBag.deleteMany({ where: { id: { in: removableBags.map((b: any) => b.id) } } });
      }
    }
    // Denormalized bag fields describe the physical item — keep them current.
    if (data.stageName !== undefined || data.bagSizeKg !== undefined || data.feedStageId !== undefined || data.supplierId !== undefined) {
      await prisma.feedBag.updateMany({
        where: { purchaseId: id },
        data: {
          stageName: updated.stageName,
          bagSizeKg: updated.bagSizeKg,
          feedStageId: updated.feedStageId,
          supplierId: updated.supplierId,
        },
      });
    }

    // Sync the linked FinancialRecord
    const finRecord = await prisma.financialRecord.findFirst({
      where: { sourceRecordId: id, sourceTable: 'feed_purchases' },
    });
    if (finRecord) {
      const newAmount = totalCostZmw;
      const desc = `Feed Purchase: ${bagsPurchased} × ${updated.bagSizeKg}kg ${updated.stageName} bags`;
      if (newAmount > 0) {
        await prisma.financialRecord.update({
          where: { id: finRecord.id },
          data: {
            amountZmw: newAmount,
            description: desc,
            recordDate: data.purchaseDate ? new Date(data.purchaseDate) : finRecord.recordDate,
          },
        });
        // Re-post is not possible (journal is immutable); the original entry stands.
        // A correction would require a manual reversal + new entry. We log a warning.
        app.log.warn(`[FeedPurchase] FinancialRecord ${finRecord.id} updated; journal entry not auto-corrected (immutable).`);
      } else {
        // Amount zeroed — remove the financial record
        await prisma.financialRecord.delete({ where: { id: finRecord.id } });
      }
    }

    await audit.log({
      organizationId,
      userId: _authUser.userId,
      impersonatedByStaffId: _authUser.impersonation?.staffId,
      entityType: 'FeedPurchase',
      entityId: id,
      action: 'update',
      previousState: existing,
      newState: updated,
      ipAddress: request.ip,
    });

    return updated;
  });

  // DELETE /api/v1/feed-purchases/:id
  app.delete('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const existing = await prisma.feedPurchase.findFirst({
      where: { id, organizationId },
      include: { flock: { select: { status: true } } },
    });
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' });

    if (assertFlockNotCompleted(reply, existing.flock.status, (request as any).authUser?.role)) return;

    // Delete the linked FinancialRecord
    const finRecord = await prisma.financialRecord.findFirst({
      where: { sourceRecordId: id, sourceTable: 'feed_purchases' },
    });
    if (finRecord) {
      // Reverse the journal entry (if one was posted) before deleting the FR.
      const je = await prisma.journalEntry.findFirst({
        where: { sourceId: finRecord.id, organizationId },
      });
      if (je) {
        try {
          await journalEngine.reverse(je.id, _authUser.userId, `Feed purchase ${id} deleted`);
        } catch (err: any) {
          app.log.error(`[FeedPurchase] Journal reversal failed for JE ${je.id}: ${err.message}`);
        }
      }
      await prisma.financialRecord.delete({ where: { id: finRecord.id } });
    }

    await prisma.feedPurchase.delete({ where: { id } });

    await audit.log({
      organizationId,
      userId: _authUser.userId,
      impersonatedByStaffId: _authUser.impersonation?.staffId,
      entityType: 'FeedPurchase',
      entityId: id,
      action: 'delete',
      previousState: existing,
      ipAddress: request.ip,
    });

    return { deleted: true };
  });
}
