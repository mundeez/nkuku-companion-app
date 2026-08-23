import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { authenticate, requireRole } from '../auth/routes.js';
import { getLightingTemperatureScheduleForFlock } from '../../core/lighting-temperature-schedule.service.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';
import { checkFlockLimit } from '../../core/billing/feature-gate.js';
import { calculateItemsRequired } from '../../core/calculation-engine/index.js';
import { AuditService } from '../../core/financial-engine/audit.service.js';

const dateOrIso = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

const FlockCreateSchema = z.object({
  name: z.string().min(1).max(100),
  breedId: z.string().uuid(),
  supplierId: z.string().uuid().optional(),
  orderDate: dateOrIso,
  initialCount: z.number().int().min(1),
  targetWeight: z.number().positive().optional(),
  targetAge: z.number().int().positive().optional(),
  feedTransitionDay: z.number().int().min(1).max(28).optional(),
  finisherDay: z.number().int().min(20).max(42).optional(),
  chickPriceZmw: z.number().nonnegative().optional(),
  housingType: z.enum(['whole_house', 'spot_brooding']).optional(),
  chicksCollected: z.boolean().optional(),
  collectionDate: dateOrIso.nullable().optional(),
  expectedCollectionStart: dateOrIso.nullable().optional(),
  expectedCollectionEnd: dateOrIso.nullable().optional(),
  chickQualityNotes: z.string().max(500).optional().nullable(),
});

const FlockUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  breedId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional().nullable(),
  orderDate: dateOrIso.nullable().optional(),
  targetWeight: z.number().positive().optional(),
  targetAge: z.number().int().positive().optional(),
  feedTransitionDay: z.number().int().min(1).max(28).optional(),
  finisherDay: z.number().int().min(20).max(42).optional(),
  chickPriceZmw: z.number().nonnegative().optional().nullable(),
  housingType: z.enum(['whole_house', 'spot_brooding']).optional(),
  chicksCollected: z.boolean().optional(),
  collectionDate: dateOrIso.nullable().optional(),
  expectedCollectionStart: dateOrIso.nullable().optional(),
  expectedCollectionEnd: dateOrIso.nullable().optional(),
  chickQualityNotes: z.string().max(500).optional().nullable(),
  status: z.enum(['active', 'sold', 'completed', 'cancelled']).optional(),
  salePriceZmw: z.number().nonnegative().optional().nullable(),
  soldDate: dateOrIso.nullable().optional(),
  initialCount: z.number().int().min(0).optional(),
  currentCount: z.number().int().min(0).optional(),
});

export async function buildBroilerFlockModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  const audit = new AuditService(prisma);

  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);
    const query = z.object({
      status: z.enum(['active', 'completed', 'cancelled']).optional(),
      breedId: z.string().uuid().optional(),
    }).parse(request.query);

    const where: any = { organizationId };
    if (query.status) where.status = query.status;
    if (query.breedId) where.breedId = query.breedId;

    const flocks = await prisma.broilerFlock.findMany({
      where,
      include: {
        breed: true,
        supplier: { select: { id: true, name: true, contact: true, chickenType: true, feedStages: true } },
        financialRecords: { select: { amountZmw: true, isIncome: true, category: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    const today = new Date();
    const flockIds = flocks.map((f: any) => f.id);
    const mortalitySums = await prisma.mortalityEvent.groupBy({
      by: ['flockId'],
      where: { flockId: { in: flockIds } },
      _sum: { count: true },
    });
    const mortalityByFlock = new Map(mortalitySums.map((m: any) => [m.flockId, m._sum.count ?? 0]));

    // Batch-load mortality events with age/date for per-stage mortality adjustment
    const mortalityEvents = await prisma.mortalityEvent.findMany({
      where: { flockId: { in: flockIds } },
      select: { flockId: true, eventDate: true, count: true, ageDays: true },
    });
    const mortalityEventsByFlock = new Map<string, any[]>();
    for (const m of mortalityEvents) {
      const arr = mortalityEventsByFlock.get(m.flockId) ?? [];
      arr.push(m);
      mortalityEventsByFlock.set(m.flockId, arr);
    }

    // Batch-load feed purchases grouped by (flockId, feedStageId) for the flock card mini-list
    const feedPurchases = await prisma.feedPurchase.findMany({
      where: { flockId: { in: flockIds } },
      select: { flockId: true, feedStageId: true, bagsPurchased: true },
    });
    const purchasesByFlockStage = new Map<string, number>();
    for (const p of feedPurchases) {
      if (!p.feedStageId) continue;
      const key = `${p.flockId}:${p.feedStageId}`;
      purchasesByFlockStage.set(key, (purchasesByFlockStage.get(key) ?? 0) + p.bagsPurchased);
    }

    // Also batch-load existing FeedRecord entries (the old feed tracking system)
    // and convert them to purchased bags by matching feedType → stageName.
    // This ensures feed recorded before the FeedPurchase system shows up in
    // the procurement mini-list.
    const feedRecords = await prisma.feedRecord.findMany({
      where: { flockId: { in: flockIds } },
      select: { flockId: true, feedType: true, quantityKg: true },
    });
    const feedRecordsByFlock = new Map<string, any[]>();
    for (const fr of feedRecords) {
      const arr = feedRecordsByFlock.get(fr.flockId) ?? [];
      arr.push(fr);
      feedRecordsByFlock.set(fr.flockId, arr);
    }

    // Batch-load sale records for the 5 new financial computed fields
    const saleRecords = await prisma.saleRecord.findMany({
      where: { flockId: { in: flockIds } },
      select: {
        flockId: true,
        birdCount: true,
        totalAmountZmw: true,
        amountPaidZmw: true,
      },
    });
    const salesByFlock = new Map<string, any[]>();
    for (const s of saleRecords) {
      const arr = salesByFlock.get(s.flockId) ?? [];
      arr.push(s);
      salesByFlock.set(s.flockId, arr);
    }

    return flocks.map((f: any) => {
      const start = f.startDate ? new Date(f.startDate) : null;
      const ageDays = start ? Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) : null;
      const totalMortality = Number(mortalityByFlock.get(f.id) ?? 0);
      const mortalityRate = f.initialCount > 0 ? (totalMortality / f.initialCount) * 100 : 0;

      const finRecs = f.financialRecords || [];
      const finCost = finRecs.filter((r: any) => !r.isIncome).reduce((sum: number, r: any) => sum + Number(r.amountZmw), 0);
      const hasChickFin = finRecs.some((r: any) => r.category === 'chick_purchase' && !r.isIncome);
      const chickCost = !hasChickFin && f.chickPriceZmw ? Number(f.chickPriceZmw) * f.initialCount : 0;
      const totalCost = finCost + chickCost;
      const totalRevenue = finRecs.filter((r: any) => r.isIncome).reduce((sum: number, r: any) => sum + Number(r.amountZmw), 0);
      const salePrice = Number(f.salePriceZmw ?? 0);
      const survivors = Math.max(0, f.initialCount - totalMortality);
      const projectedRevenue = salePrice * survivors;
      const projectedProfit = projectedRevenue - totalCost;

      // Compact per-stage feed projection for the flock card mini-list.
      // Applies per-stage mortality adjustment: birdsAlive = initialCount −
      // mortality events on/before the stage's dayRangeStart.
      // Bags purchased aggregates both FeedPurchase records AND existing
      // FeedRecord entries (converted from kg to bags using the stage's
      // unit_size_kg, matched by feedType → stageName).
      const flockMortalityEvents = mortalityEventsByFlock.get(f.id) ?? [];
      const flockFeedRecords = feedRecordsByFlock.get(f.id) ?? [];
      const feedStages = (f.supplier?.feedStages || []).filter((fs: any) => fs.stageType === 'feed');
      const feedProjection = feedStages.map((fs: any) => {
        let birdsAlive = f.initialCount;
        if (fs.dayRangeStart != null && start) {
          const stageStartDay = fs.dayRangeStart;
          const mortalityBeforeStage = flockMortalityEvents.reduce((sum: number, m: any) => {
            const mAge = m.ageDays != null
              ? m.ageDays
              : start
                ? Math.floor((new Date(m.eventDate).getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
                : null;
            return mAge != null && mAge <= stageStartDay ? sum + m.count : sum;
          }, 0);
          birdsAlive = Math.max(0, f.initialCount - mortalityBeforeStage);
        }
        const { itemsRoundedUp } = calculateItemsRequired(birdsAlive, fs.intakePerBirdKg, fs.unitSizeKg);
        const bagsRequired = itemsRoundedUp ?? 0;

        // Start with FeedPurchase bags
        let bagsPurchased = purchasesByFlockStage.get(`${f.id}:${fs.id}`) ?? 0;

        // Add bags from FeedRecord entries that match this stage by name.
        // Match by case-insensitive exact name, or feedType startsWith stageName
        // (e.g., "Starter" matches "Starter" and "Starter (25kg)").
        // For stages with "(25kg)" suffix, only match if the feedType also
        // contains "25" to avoid double-counting across 50kg and 25kg variants.
        const stageLower = fs.stageName.toLowerCase();
        const is25kgVariant = stageLower.includes('25');
        for (const fr of flockFeedRecords) {
          const ftLower = (fr.feedType || '').toLowerCase();
          if (!ftLower) continue;
          // Match: exact name, or stageName starts with feedType
          const nameMatches = ftLower === stageLower
            || stageLower.startsWith(ftLower + ' ')
            || stageLower.startsWith(ftLower + '(');
          if (!nameMatches) continue;
          // For 25kg variant stages, only match if feedType mentions 25
          if (is25kgVariant && !ftLower.includes('25')) continue;
          // For non-25kg stages, skip if feedType mentions 25 (it belongs to the 25kg variant)
          if (!is25kgVariant && ftLower.includes('25')) continue;
          const unitSize = Number(fs.unitSizeKg);
          if (unitSize > 0) {
            bagsPurchased += Math.ceil(Number(fr.quantityKg) / unitSize);
          }
        }

        const bagsRemaining = bagsRequired - bagsPurchased;
        let status: 'complete' | 'partial' | 'not_started';
        if (bagsPurchased >= bagsRequired && bagsRequired > 0) status = 'complete';
        else if (bagsPurchased > 0) status = 'partial';
        else status = 'not_started';
        return {
          feedStageId: fs.id,
          stageName: fs.stageName,
          bagsRequired,
          bagsPurchased,
          bagsRemaining,
          status,
        };
      });

      // Compute 5 new sale-based financial fields
      const flockSales = salesByFlock.get(f.id) ?? [];
      const totalRevenueFromSales = flockSales.reduce((sum: number, s: any) => sum + Number(s.totalAmountZmw), 0);
      const totalBirdsSold = flockSales.reduce((sum: number, s: any) => sum + s.birdCount, 0);
      const totalOutstandingPayments = flockSales.reduce((sum: number, s: any) => {
        const outstanding = Number(s.totalAmountZmw) - Number(s.amountPaidZmw ?? 0);
        return sum + Math.max(0, outstanding);
      }, 0);
      const actualRevenueCollected = totalRevenue - totalOutstandingPayments;
      const actualProfit = totalRevenue - totalCost;
      const actualProfitLessOutstanding = actualProfit - totalOutstandingPayments;
      const actualAverageSalesPrice = totalBirdsSold > 0 ? totalRevenueFromSales / totalBirdsSold : 0;
      // Proportional cost allocation for unrealised profit
      const avgCostPerBird = totalBirdsSold > 0 ? totalCost / totalBirdsSold : 0;
      const totalBirdsOutstanding = flockSales.reduce((sum: number, s: any) => {
        const total = Number(s.totalAmountZmw);
        if (total <= 0) return sum;
        const outstanding = Number(s.totalAmountZmw) - Number(s.amountPaidZmw ?? 0);
        const fractionOutstanding = Math.max(0, outstanding) / total;
        return sum + s.birdCount * fractionOutstanding;
      }, 0);
      const unrealisedProfit = totalOutstandingPayments - (avgCostPerBird * totalBirdsOutstanding);

      return {
        ...f,
        ageDays,
        totalMortality,
        mortalityRate,
        totalCost,
        totalRevenue,
        projectedRevenue,
        projectedProfit,
        feedProjection,
        totalOutstandingPayments,
        actualRevenueCollected,
        actualProfitLessOutstanding,
        actualAverageSalesPrice,
        unrealisedProfit,
      };
    });
  });

  app.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);
    const flock = await prisma.broilerFlock.findFirst({
      where: { id, organizationId },
      include: {
        breed: { include: { performanceTargets: { orderBy: { ageDays: 'asc' } } } },
        supplier: { select: { id: true, name: true, contact: true, chickenType: true, feedStages: true } },
        growthRecords: { orderBy: { recordDate: 'desc' }, take: 1 },
        financialRecords: { select: { amountZmw: true, isIncome: true, category: true } },
        _count: {
          select: {
            growthRecords: true,
            feedRecords: true,
            mortalityEvents: true,
            vaccinationEvents: true,
            financialRecords: true,
          },
        },
      },
    });
    if (!flock) return reply.status(404).send({ error: 'NOT_FOUND' });
    const today = new Date();
    const start = flock.startDate ? new Date(flock.startDate) : null;
    const ageDays = start ? Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) : null;

    const totalMortality = await prisma.mortalityEvent.aggregate({
      where: { flockId: id },
      _sum: { count: true },
    });
    const deaths = totalMortality._sum.count ?? 0;
    const mortalityRate = flock.initialCount > 0 ? (deaths / flock.initialCount) * 100 : 0;

    // Compute sale-based financial fields for the detail page
    const finRecs = flock.financialRecords || [];
    const finCost = finRecs.filter((r: any) => !r.isIncome).reduce((sum: number, r: any) => sum + Number(r.amountZmw), 0);
    const hasChickFin = finRecs.some((r: any) => r.category === 'chick_purchase' && !r.isIncome);
    const chickCost = !hasChickFin && flock.chickPriceZmw ? Number(flock.chickPriceZmw) * flock.initialCount : 0;
    const totalCost = finCost + chickCost;
    const totalRevenue = finRecs.filter((r: any) => r.isIncome).reduce((sum: number, r: any) => sum + Number(r.amountZmw), 0);

    const flockSales = await prisma.saleRecord.findMany({
      where: { flockId: id },
      select: { birdCount: true, totalAmountZmw: true, amountPaidZmw: true },
    });
    const totalRevenueFromSales = flockSales.reduce((sum: number, s: any) => sum + Number(s.totalAmountZmw), 0);
    const totalBirdsSold = flockSales.reduce((sum: number, s: any) => sum + s.birdCount, 0);
    const totalOutstandingPayments = flockSales.reduce((sum: number, s: any) => {
      const outstanding = Number(s.totalAmountZmw) - Number(s.amountPaidZmw ?? 0);
      return sum + Math.max(0, outstanding);
    }, 0);
    const actualRevenueCollected = totalRevenue - totalOutstandingPayments;
    const actualProfit = totalRevenue - totalCost;
    const actualProfitLessOutstanding = actualProfit - totalOutstandingPayments;
    const actualAverageSalesPrice = totalBirdsSold > 0 ? totalRevenueFromSales / totalBirdsSold : 0;
    const avgCostPerBird = totalBirdsSold > 0 ? totalCost / totalBirdsSold : 0;
    const totalBirdsOutstanding = flockSales.reduce((sum: number, s: any) => {
      const total = Number(s.totalAmountZmw);
      if (total <= 0) return sum;
      const outstanding = Number(s.totalAmountZmw) - Number(s.amountPaidZmw ?? 0);
      const fractionOutstanding = Math.max(0, outstanding) / total;
      return sum + s.birdCount * fractionOutstanding;
    }, 0);
    const unrealisedProfit = totalOutstandingPayments - (avgCostPerBird * totalBirdsOutstanding);

    return {
      ...flock,
      ageDays,
      totalMortality: deaths,
      mortalityRate,
      totalCost,
      totalRevenue,
      totalOutstandingPayments,
      actualRevenueCollected,
      actualProfitLessOutstanding,
      actualAverageSalesPrice,
      unrealisedProfit,
    };
  });

  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager'), checkFlockLimit] }, async (request) => {
    const data = FlockCreateSchema.parse(request.body);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);
    const orderDate = new Date(data.orderDate);
    const collectionDate = data.collectionDate ? new Date(data.collectionDate) : null;
    // startDate is derived from collectionDate; null until chicks are collected
    const startDate = (data.chicksCollected && collectionDate) ? collectionDate : null;

    const flock = await prisma.broilerFlock.create({
      data: {
        name: data.name,
        breedId: data.breedId,
        supplierId: data.supplierId,
        orderDate,
        startDate,
        initialCount: data.initialCount,
        currentCount: data.initialCount,
        targetWeight: data.targetWeight,
        targetAge: data.targetAge,
        feedTransitionDay: data.feedTransitionDay ?? 18,
        finisherDay: data.finisherDay ?? 29,
        chickPriceZmw: data.chickPriceZmw,
        housingType: data.housingType ?? 'whole_house',
        chicksCollected: data.chicksCollected ?? false,
        collectionDate,
        expectedCollectionStart: data.expectedCollectionStart ? new Date(data.expectedCollectionStart) : null,
        expectedCollectionEnd: data.expectedCollectionEnd ? new Date(data.expectedCollectionEnd) : null,
        chickQualityNotes: data.chickQualityNotes,
        createdBy: _authUser.userId,
        organizationId,
      },
      include: { breed: true, supplier: { select: { name: true } } },
    });

    // Auto-create a financial record for chick purchase
    if (data.supplierId && data.chickPriceZmw && data.chickPriceZmw > 0) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: data.supplierId },
        select: { name: true },
      });
      await prisma.financialRecord.create({
        data: {
          flockId: flock.id,
          sourceTable: 'broiler_flocks',
          recordDate: orderDate,
          category: 'chick_purchase',
          description: `Day-old chicks - ${supplier?.name || 'Unknown'} (${data.initialCount} birds)`,
          amountZmw: data.chickPriceZmw * data.initialCount,
          isIncome: false,
          isSystemGenerated: true,
          notes: 'Auto-generated from flock creation',
        },
      });
    }

    return flock;
  });

  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const raw = FlockUpdateSchema.parse(request.body);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const updateData: any = { ...raw };
    if (raw.orderDate) updateData.orderDate = new Date(raw.orderDate);
    if (raw.orderDate === null) updateData.orderDate = null;
    if (raw.collectionDate) updateData.collectionDate = new Date(raw.collectionDate);
    if (raw.collectionDate === null) updateData.collectionDate = null;
    if (raw.expectedCollectionStart) updateData.expectedCollectionStart = new Date(raw.expectedCollectionStart);
    if (raw.expectedCollectionStart === null) updateData.expectedCollectionStart = null;
    if (raw.expectedCollectionEnd) updateData.expectedCollectionEnd = new Date(raw.expectedCollectionEnd);
    if (raw.expectedCollectionEnd === null) updateData.expectedCollectionEnd = null;
    if (raw.chickQualityNotes === '') updateData.chickQualityNotes = null;

    const existing = await prisma.broilerFlock.findFirst({
      where: { id, organizationId },
    });
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' });

    // When chicksCollected transitions to true, auto-set startDate = collectionDate
    if (raw.chicksCollected === true && !existing.chicksCollected) {
      const collDate = raw.collectionDate ? new Date(raw.collectionDate) : (existing.collectionDate ? new Date(existing.collectionDate) : new Date());
      updateData.startDate = collDate;
      updateData.collectionDate = collDate;
      // Clear the estimate fields since chicks are now collected
      updateData.expectedCollectionStart = null;
      updateData.expectedCollectionEnd = null;
    }
    // When chicksCollected transitions to false, clear startDate
    if (raw.chicksCollected === false && existing.chicksCollected) {
      updateData.startDate = null;
    }

    if (raw.status === 'sold' && existing.status !== 'sold') {
      updateData.soldDate = raw.soldDate ? new Date(raw.soldDate) : new Date();
    }

    const flock = await prisma.broilerFlock.update({
      where: { id },
      data: updateData,
    });

    // Auto-create sales financial record when flock is marked as sold
    if (raw.status === 'sold' && existing.status !== 'sold') {
      const salePrice = raw.salePriceZmw ?? existing.salePriceZmw ?? 0;
      const soldCount = raw.currentCount ?? existing.currentCount ?? 0;
      if (salePrice > 0 && soldCount > 0) {
        await prisma.financialRecord.create({
          data: {
            flockId: id,
            sourceTable: 'broiler_flocks',
            recordDate: flock.soldDate ?? new Date(),
            category: 'sales',
            description: `Bird sales - ${flock.name} (${soldCount} birds)`,
            amountZmw: salePrice * soldCount,
            isIncome: true,
            isSystemGenerated: true,
            notes: 'Auto-generated from flock sale',
          },
        });
      }
    }

    return prisma.broilerFlock.findUnique({ where: { id }, include: { breed: true, supplier: { select: { id: true, name: true, contact: true, chickenType: true, feedStages: true } } } });
  });

  app.delete('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);
    const result = await prisma.broilerFlock.deleteMany({
      where: { id, organizationId },
    });
    if (result.count === 0) return reply.status(404).send({ error: 'NOT_FOUND' });
    return { deleted: true };
  });

  // POST /api/v1/broiler-flocks/:id/complete — mark a flock as completed
  app.post('/:id/complete', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const existing = await prisma.broilerFlock.findFirst({
      where: { id, organizationId },
    });
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' });
    if (existing.status === 'completed') {
      return reply.status(409).send({ error: 'ALREADY_COMPLETED', message: 'This flock is already completed.' });
    }

    // Check for outstanding payments to include in the response as a warning
    const sales = await prisma.saleRecord.findMany({
      where: { flockId: id },
      select: { totalAmountZmw: true, amountPaidZmw: true },
    });
    const outstandingPayments = sales.reduce((sum: number, s: any) => {
      const outstanding = Number(s.totalAmountZmw) - Number(s.amountPaidZmw ?? 0);
      return sum + Math.max(0, outstanding);
    }, 0);
    const outstandingSalesCount = sales.filter((s: any) => {
      const outstanding = Number(s.totalAmountZmw) - Number(s.amountPaidZmw ?? 0);
      return outstanding > 0;
    }).length;

    const updated = await prisma.broilerFlock.update({
      where: { id },
      data: {
        status: 'completed',
        soldDate: existing.soldDate ?? new Date(),
      },
    });

    // Audit log the completion
    await audit.log({
      organizationId,
      userId: authUser.userId,
      entityType: 'BroilerFlock',
      entityId: id,
      action: 'update',
      previousState: { status: existing.status },
      newState: { status: 'completed', soldDate: updated.soldDate },
    });

    const warnings: any = {};
    if (outstandingPayments > 0) {
      warnings.outstandingPayments = outstandingPayments;
      warnings.outstandingSalesCount = outstandingSalesCount;
      warnings.message = `This flock has ${outstandingSalesCount} outstanding sale${outstandingSalesCount === 1 ? '' : 's'} totaling ZMW ${outstandingPayments.toFixed(2)}. Payment records can still be updated, but other records are locked for non-owners.`;
    }

    return { ...updated, warnings };
  });

  // GET /api/v1/broiler-flocks/:id/dashboard - Dashboard data
  app.get('/:id/dashboard', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);
    const flock = await prisma.broilerFlock.findFirst({
      where: { id, organizationId },
      include: {
        breed: true,
        growthRecords: { orderBy: { recordDate: 'desc' }, take: 1 },
        feedRecords: { orderBy: { recordDate: 'desc' }, take: 5 },
        mortalityEvents: { orderBy: { eventDate: 'desc' }, take: 5 },
        vaccinationEvents: { orderBy: { adminDate: 'desc' }, take: 5 },
        alerts: { where: { isResolved: false }, orderBy: { dueDate: 'asc' } },
        _count: {
          select: {
            growthRecords: true,
            feedRecords: true,
            waterRecords: true,
            mortalityEvents: true,
            vaccinationEvents: true,
            financialRecords: true,
          },
        },
      },
    });
    if (!flock) return reply.status(404).send({ error: 'NOT_FOUND' });

    // Calculate current age in days (null if not yet collected)
    const today = new Date();
    const startDate = flock.startDate ? new Date(flock.startDate) : null;
    const ageDays = startDate ? Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : null;

    // Get target weight for current age
    const target = ageDays !== null ? await prisma.performanceTarget.findUnique({
      where: { breedId_ageDays: { breedId: flock.breedId, ageDays } },
    }) : null;

    // Calculate mortality rate
    const totalMortality = await prisma.mortalityEvent.aggregate({
      where: { flockId: id },
      _sum: { count: true },
    });
    const mortalityRate = flock.initialCount > 0
      ? ((totalMortality._sum.count ?? 0) / flock.initialCount) * 100
      : 0;

    return {
      flock,
      ageDays,
      targetWeight: target?.targetWeight ?? null,
      targetFeed: target?.targetFeed ?? null,
      targetWater: target?.targetWater ?? null,
      targetFcr: target?.targetFcr ?? null,
      mortalityRate,
    };
  });

  // GET /api/v1/broiler-flocks/:id/feed-projection
  // Per-stage feed bag projection: bags required (based on startingCount minus
  // actual mortality up to the stage's dayRangeStart), bags purchased, remaining.
  app.get('/:id/feed-projection', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const organizationId = getOrganizationId(request);

    const flock = await prisma.broilerFlock.findFirst({
      where: { id, organizationId },
      include: {
        supplier: { include: { feedStages: { orderBy: { sortOrder: 'asc' } } } },
        mortalityEvents: { select: { eventDate: true, count: true, ageDays: true } },
        feedPurchases: { select: { feedStageId: true, bagsPurchased: true, totalCostZmw: true } },
        feedRecords: { select: { feedType: true, quantityKg: true, costZmw: true } },
      },
    });
    if (!flock) return reply.status(404).send({ error: 'NOT_FOUND' });

    // No supplier or feed stages → empty projection
    if (!flock.supplier || !flock.supplier.feedStages || flock.supplier.feedStages.length === 0) {
      return {
        flockId: id,
        flockName: flock.name,
        initialCount: flock.initialCount,
        currentCount: flock.currentCount,
        supplierName: flock.supplier?.name ?? null,
        stages: [],
        totals: { bagsRequired: 0, bagsPurchased: 0, bagsRemaining: 0, projectedCostZmw: 0, purchasedCostZmw: 0 },
      };
    }

    const startDate = flock.startDate ? new Date(flock.startDate) : null;
    const feedStages = flock.supplier.feedStages.filter((fs: any) => fs.stageType === 'feed');

    // Aggregate purchases by feedStageId
    const purchasesByStage = new Map<string, { bags: number; cost: number }>();
    for (const p of flock.feedPurchases) {
      if (!p.feedStageId) continue;
      const cur = purchasesByStage.get(p.feedStageId) ?? { bags: 0, cost: 0 };
      cur.bags += p.bagsPurchased;
      cur.cost += Number(p.totalCostZmw);
      purchasesByStage.set(p.feedStageId, cur);
    }

    // Also aggregate existing FeedRecord entries (old feed tracking system)
    // as purchased bags, matching feedType → stageName and converting kg → bags.
    const feedRecordBagsByStage = new Map<string, number>();
    for (const fs of feedStages) {
      const stageLower = fs.stageName.toLowerCase();
      const is25kgVariant = stageLower.includes('25');
      let bagsFromRecords = 0;
      for (const fr of flock.feedRecords) {
        const ftLower = (fr.feedType || '').toLowerCase();
        if (!ftLower) continue;
        const nameMatches = ftLower === stageLower
          || stageLower.startsWith(ftLower + ' ')
          || stageLower.startsWith(ftLower + '(');
        if (!nameMatches) continue;
        if (is25kgVariant && !ftLower.includes('25')) continue;
        if (!is25kgVariant && ftLower.includes('25')) continue;
        const unitSize = Number(fs.unitSizeKg);
        if (unitSize > 0) {
          bagsFromRecords += Math.ceil(Number(fr.quantityKg) / unitSize);
        }
      }
      if (bagsFromRecords > 0) {
        feedRecordBagsByStage.set(fs.id, bagsFromRecords);
      }
    }

    const stages: any[] = [];
    let totalBagsRequired = 0;
    let totalBagsPurchased = 0;
    let totalProjectedCost = 0;
    let totalPurchasedCost = 0;

    for (const fs of feedStages) {
      // Birds alive at the stage's dayRangeStart = initialCount − mortality on/before that day.
      // If dayRangeStart is null, use initialCount (no mortality adjustment).
      let birdsAlive = flock.initialCount;
      if (fs.dayRangeStart != null && startDate) {
        const stageStartDay = fs.dayRangeStart;
        // Mortality events with ageDays <= stageStartDay, or eventDate <= startDate + stageStartDay
        const mortalityBeforeStage = flock.mortalityEvents.reduce((sum: number, m: any) => {
          const mAge = m.ageDays != null
            ? m.ageDays
            : startDate
              ? Math.floor((new Date(m.eventDate).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
              : null;
          return mAge != null && mAge <= stageStartDay ? sum + m.count : sum;
        }, 0);
        birdsAlive = Math.max(0, flock.initialCount - mortalityBeforeStage);
      }

      const { itemsRoundedUp, itemsRaw } = calculateItemsRequired(
        birdsAlive,
        fs.intakePerBirdKg,
        fs.unitSizeKg,
      );

      const bagsRequired = itemsRoundedUp ?? 0;
      const purchased = purchasesByStage.get(fs.id) ?? { bags: 0, cost: 0 };
      // Combine FeedPurchase bags with FeedRecord-derived bags
      const bagsPurchased = purchased.bags + (feedRecordBagsByStage.get(fs.id) ?? 0);
      const bagsRemaining = bagsRequired - bagsPurchased;
      const projectedCostZmw = bagsRequired > 0
        ? new Decimal(bagsRequired).mul(fs.unitPriceZmw).toNumber()
        : 0;

      totalBagsRequired += bagsRequired;
      totalBagsPurchased += bagsPurchased;
      totalProjectedCost += projectedCostZmw;
      totalPurchasedCost += purchased.cost;

      let status: 'complete' | 'partial' | 'not_started';
      if (bagsPurchased >= bagsRequired && bagsRequired > 0) status = 'complete';
      else if (bagsPurchased > 0) status = 'partial';
      else status = 'not_started';

      stages.push({
        feedStageId: fs.id,
        stageName: fs.stageName,
        dayRangeStart: fs.dayRangeStart,
        dayRangeEnd: fs.dayRangeEnd,
        bagSizeKg: Number(fs.unitSizeKg),
        intakePerBirdKg: Number(fs.intakePerBirdKg),
        birdsAliveAtStageStart: birdsAlive,
        bagsRequired,
        bagsRaw: itemsRaw,
        bagsPurchased,
        bagsRemaining,
        unitPriceZmw: Number(fs.unitPriceZmw),
        projectedCostZmw,
        purchasedCostZmw: purchased.cost,
        status,
      });
    }

    return {
      flockId: id,
      flockName: flock.name,
      initialCount: flock.initialCount,
      currentCount: flock.currentCount,
      supplierName: flock.supplier.name,
      stages,
      totals: {
        bagsRequired: totalBagsRequired,
        bagsPurchased: totalBagsPurchased,
        bagsRemaining: totalBagsRequired - totalBagsPurchased,
        projectedCostZmw: totalProjectedCost,
        purchasedCostZmw: totalPurchasedCost,
      },
    };
  });

  // GET /api/v1/broiler-flocks/:id/timeline - Hatch-to-market event timeline
  app.get('/:id/timeline', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);
    const flock = await prisma.broilerFlock.findFirst({
      where: { id, organizationId },
      include: { breed: true },
    });
    if (!flock) return reply.status(404).send({ error: 'NOT_FOUND' });

    // If chicks not yet collected (no startDate), return empty calendar
    if (!flock.startDate) {
      return { flock, ageDays: null, events: [] };
    }

    const startDate = new Date(flock.startDate);
    const targetAge = flock.targetAge || 42;
    const feedTransitionDay = flock.feedTransitionDay || 18;
    const finisherDay = flock.finisherDay || 29;
    const today = new Date();
    const ageDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const scheduleName = flock.breed?.name === 'Ross 308' ? 'Ross 308 Comprehensive Schedule' : 'Standard Broiler Schedule';
    const schedule = await prisma.vaccinationSchedule.findFirst({
      where: { name: scheduleName },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    const completedVaccines = await prisma.vaccinationEvent.findMany({
      where: { flockId: id },
      orderBy: { adminDate: 'asc' },
    });

    const events: any[] = [];

    // Placement / brooding start
    events.push({
      ageDays: 0,
      date: startDate.toISOString().split('T')[0],
      type: 'management',
      title: 'Chick placement / brooding starts',
      description: 'Set brooder at 30°C, 60-70% RH, paper feed, 40g/chick.',
      completed: ageDays >= 0,
    });

    // Hatchery vaccines (day 1)
    for (const item of schedule?.items.filter((i: any) => i.ageDays === 0) || []) {
      const date = new Date(startDate.getTime() + 1 * 24 * 60 * 60 * 1000);
      const completed = completedVaccines.some((v: any) => v.vaccineName === item.vaccineName && Math.abs(v.ageDays - 0) <= 1);
      events.push({
        ageDays: 1,
        date: date.toISOString().split('T')[0],
        type: 'vaccination',
        title: `Vaccination: ${item.vaccineName}`,
        description: `Administer via ${item.adminMethod}. ${item.notes || ''}`,
        completed,
      });
    }

    // Feed transitions
    events.push({
      ageDays: feedTransitionDay,
      date: new Date(startDate.getTime() + feedTransitionDay * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      type: 'feed',
      title: 'Feed transition: Starter to Grower',
      description: 'Transition gradually over 3 days.',
      completed: ageDays >= feedTransitionDay,
    });
    events.push({
      ageDays: finisherDay,
      date: new Date(startDate.getTime() + finisherDay * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      type: 'feed',
      title: 'Feed transition: Grower to Finisher',
      description: 'Adjust feed to market target.',
      completed: ageDays >= finisherDay,
    });

    // On-farm vaccines (age > 1)
    for (const item of schedule?.items.filter((i: any) => i.ageDays > 0) || []) {
      const date = new Date(startDate.getTime() + item.ageDays * 24 * 60 * 60 * 1000);
      const completed = completedVaccines.some((v: any) => v.vaccineName === item.vaccineName && Math.abs(v.ageDays - item.ageDays) <= 1);
      events.push({
        ageDays: item.ageDays,
        date: date.toISOString().split('T')[0],
        type: 'vaccination',
        title: `Vaccination: ${item.vaccineName}`,
        description: `Administer via ${item.adminMethod}. ${item.notes || ''}`,
        completed,
      });
    }

    // Pre-slaughter withdrawal
    events.push({
      ageDays: targetAge - 7,
      date: new Date(startDate.getTime() + (targetAge - 7) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      type: 'management',
      title: 'Pre-slaughter withdrawal (coccidiostats)',
      description: 'Check label withdrawal period.',
      completed: ageDays >= targetAge - 7,
    });

    // Market / processing
    events.push({
      ageDays: targetAge,
      date: new Date(startDate.getTime() + targetAge * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      type: 'management',
      title: 'Market / processing date',
      description: `Target live weight ${flock.targetWeight ? flock.targetWeight + ' kg' : '2.3-2.5 kg'}.`,
      completed: ageDays >= targetAge,
    });

    events.sort((a, b) => a.ageDays - b.ageDays || a.type.localeCompare(b.type));

    return { flock, ageDays, events };
  });

  // GET /api/v1/broiler-flocks/:id/summary - Printable calendar data
  app.get('/:id/summary', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);
    const flock = await prisma.broilerFlock.findFirst({
      where: { id, organizationId },
      include: { breed: true },
    });
    if (!flock) return reply.status(404).send({ error: 'NOT_FOUND' });

    // If chicks not yet collected (no startDate), return minimal summary
    if (!flock.startDate) {
      return { flock, ageDays: null, targetAge: flock.targetAge || 42, days: [] };
    }

    const startDate = new Date(flock.startDate);
    const targetAge = flock.targetAge || 42;
    const today = new Date();
    const ageDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const scheduleName = flock.breed?.name === 'Ross 308' ? 'Ross 308 Comprehensive Schedule' : 'Standard Broiler Schedule';

    // The three post-flock queries are independent of each other — run them
    // concurrently to cut sequential round-trip latency from 3 awaits to 1.
    const [schedule, envSchedule, completedVaccines] = await Promise.all([
      prisma.vaccinationSchedule.findFirst({
        where: { name: scheduleName },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      }),
      getLightingTemperatureScheduleForFlock(prisma, flock, _authUser.userId),
      prisma.vaccinationEvent.findMany({
        where: { flockId: id },
        orderBy: { adminDate: 'asc' },
      }),
    ]);

    const days = [];
    for (let d = 0; d <= targetAge; d++) {
      const date = new Date(startDate.getTime() + d * 24 * 60 * 60 * 1000);
      const vaccines = (schedule?.items.filter((i: any) => i.ageDays === d) || []).map((item: any) => ({
        ...item,
        completed: completedVaccines.some((v: any) => v.vaccineName === item.vaccineName && Math.abs(v.ageDays - d) <= 1),
      }));

      const feedTransitionDay = flock.feedTransitionDay || 18;
      const finisherDay = flock.finisherDay || 29;
      const feedPhase = d < feedTransitionDay ? 'Starter' : d < finisherDay ? 'Grower' : 'Finisher';
      const managementTasks = [
        'Check temperature & humidity 2x daily',
        'Record mortality and culls',
        'Monitor feed and water consumption',
        'Inspect litter quality',
      ];
      if (d > 0 && d % 7 === 0) managementTasks.push('Weekly weight sample');
      if (d === feedTransitionDay) managementTasks.push('Feed transition: Starter to Grower');
      if (d === finisherDay) managementTasks.push('Feed transition: Grower to Finisher');

      const healthSupport = d === 0
        ? 'Day 1-3: Stress pack (glucose + electrolytes + vitamins A/D3/E/C) in drinking water. Rehydrates chicks, stimulates appetite, jumpstarts yolk-sac absorption. Hatchery vaccination complete.'
        : d === 1
          ? 'Continue stress pack. Monitor for dehydration. Brooder temp 32-33C.'
        : d === 2
          ? 'Continue stress pack (Day 3 last day). Monitor chick activity and feed intake.'
        : d === 9
          ? 'PRE-VACCINATION (Day 10 IBD): Administer vitamins/electrolytes 24h before vaccination. Suspend chlorination 48h before. Prepare skim milk 2g/L stabilizer.'
        : d === 10
          ? 'IBD VACCINATION DAY: Suspend chlorination. Use skim milk 2g/L stabilizer. Withdraw water 1-2h before. Administer Cevamune/Nobilis D78 via drinking water. 2-hour consumption window.'
        : d === 11
          ? 'POST-IBD VACCINATION: Administer vitamins/electrolytes for 24h after vaccination. Monitor for vaccine reaction and respiratory signs.'
        : d === 13
          ? 'PRE-VACCINATION (Day 14 ND+IB): Administer vitamins/electrolytes 24h before. Suspend chlorination. Prepare skim milk stabilizer.'
        : d === 14
          ? 'ND+IB VACCINATION DAY: LaSota or Clone 30 via drinking water or eye-drop. Suspend chlorination. Skim milk stabilizer. Withdraw water 1-2h. Eye-drop ensures 100% intake.'
        : d === 15
          ? 'POST-ND+IB VACCINATION: Vitamins/electrolytes for 24h. Monitor for respiratory signs (snicking, rales). Maintain gut health.'
        : d === 17
          ? 'PRE-VACCINATION (Day 18 IBD booster): Administer vitamins/electrolytes 24h before. Suspend chlorination. Prepare skim milk stabilizer.'
        : d === 18
          ? 'IBD BOOSTER VACCINATION DAY: Live Intermediate Plus via drinking water. Skim milk stabilizer. Withdraw water 1-2h. Essential in Lusaka high-challenge areas.'
        : d === 19
          ? 'POST-IBD BOOSTER: Vitamins/electrolytes for 24h. Monitor bursal reaction. Maintain gut health.'
        : d === 20
          ? 'PRE-VACCINATION (Day 21 ND booster): Administer vitamins/electrolytes 24h before. Suspend chlorination. Prepare skim milk stabilizer.'
        : d === 21
          ? 'ND BOOSTER VACCINATION DAY: LaSota or Clone 30 via drinking water. Skim milk stabilizer. Withdraw water 1-2h. Secures immunity to processing weight. NDV genotype VII.2 in Lusaka - ensure full dose.'
        : d === 22
          ? 'POST-ND BOOSTER: Vitamins/electrolytes for 24h. Final immunity consolidation window. Monitor flock health.'
        : d > 0 && d % 7 === 0
          ? 'Weekly check: vitamins/electrolytes if heat stress. Provide Vitamin C during peak heat (11AM-3PM) in hot season.'
          : 'Monitor; vitamins/electrolytes if stress or heat. Ensure clean water and proper ventilation.';

      const envItem = envSchedule?.items?.find((i: any) => i.ageDays === d) || null;
      const lightingTemperature = envItem ? {
        ageDays: d,
        lightHours: envItem.lightHours,
        darkHours: envItem.darkHours,
        lightIntensityLux: envItem.lightIntensityLux,
        targetTempC: envItem.targetTempC,
        targetTempMinC: envItem.targetTempMinC,
        targetTempMaxC: envItem.targetTempMaxC,
        targetRhMinPct: envItem.targetRhMinPct,
        targetRhMaxPct: envItem.targetRhMaxPct,
        notes: envItem.notes,
      } : null;

      days.push({
        day: d,
        age: `Day ${d}`,
        date: date.toISOString().split('T')[0],
        vaccines,
        lightingTemperature,
        feedPhase,
        managementTasks,
        healthSupport,
      });
    }

    return { flock, ageDays, targetAge, days };
  });

  // GET /api/v1/broiler-flocks/:id/performance - Expected performance for current age
  app.get('/:id/performance', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);
    const flock = await prisma.broilerFlock.findFirst({
      where: { id, organizationId },
      include: { breed: true },
    });
    if (!flock) return reply.status(404).send({ error: 'NOT_FOUND' });

    // If chicks not yet collected (no startDate), return null performance
    if (!flock.startDate) {
      return { flock, ageDays: null, target: null, records: [] };
    }

    const today = new Date();
    const startDate = new Date(flock.startDate);
    const ageDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const target = await prisma.performanceTarget.findUnique({
      where: { breedId_ageDays: { breedId: flock.breedId, ageDays } },
    });

    const nextTargets = await prisma.performanceTarget.findMany({
      where: { breedId: flock.breedId, ageDays: { gt: ageDays, lte: ageDays + 14 } },
      orderBy: { ageDays: 'asc' },
    });

    return {
      flock,
      ageDays,
      currentTarget: target,
      upcomingTargets: nextTargets,
    };
  });
}
