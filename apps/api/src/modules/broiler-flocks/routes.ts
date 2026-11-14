import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { authenticate, requireRole } from '../auth/routes.js';
import { getLightingTemperatureScheduleForFlock } from '../../core/lighting-temperature-schedule.service.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';
import { checkFlockLimit } from '../../core/billing/feature-gate.js';
import { calculateItemsRequired } from '../../core/calculation-engine/index.js';
import { AuditService } from '../../core/finance/audit.service.js';
import { JournalEngine } from '../../core/double-entry/journal.engine.js';
import { AutoPostService } from '../../core/double-entry/auto-post.service.js';
import { checkFlockNotLocked, assertFlockNotCompleted } from './check-flock-locked.js';
import { ListQuerySchema, searchWhere, dateRange, orderBy } from '../../core/list-query.js';
import { resolveVaccinationSchedule } from '../../core/vaccination-schedule.resolver.js';
import { computeDailyWater, computeVaccineMixVolume, isWaterRoute } from '../../core/water-requirement.service.js';
import { buildVaccinationDayNotes } from '../../core/vaccination-notes.js';
import { displayDayOf } from '../../core/day-convention.js';

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
  vaccinationScheduleId: z.string().uuid().nullable().optional(),
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
  // initialCount/currentCount are intentionally absent: bird-count changes go
  // through the audited chick-additions, mortality and sales flows so the two
  // columns can't silently drift apart.
  vaccinationScheduleId: z.string().uuid().nullable().optional(),
});

const ChickAdditionCreateSchema = z.object({
  count: z.number().int().refine((n) => n !== 0, { message: 'count must be non-zero' }),
  reason: z.enum(['hatchery_extra', 'purchase', 'correction']),
  additionDate: dateOrIso,
  unitPriceZmw: z.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
});

export async function buildBroilerFlockModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  const audit = new AuditService(prisma);
  const journalEngine = new JournalEngine(prisma);
  const autoPost = new AutoPostService(journalEngine, prisma);
  const flockLock = checkFlockNotLocked(prisma);

  app.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);
    const query = z.object({
      status: z.enum(['active', 'completed', 'cancelled']).optional(),
      breedId: z.string().uuid().optional(),
      fields: z.string().optional(),
    }).extend(ListQuerySchema.shape).parse(request.query);

    const where: any = { organizationId };
    if (query.status) where.status = query.status;
    if (query.breedId) where.breedId = query.breedId;
    const qOr = searchWhere(query.q, ['name', 'breed.name']);
    if (qOr) where.OR = qOr;
    dateRange(where, 'startDate', query.fromDate, query.toDate);

    // When ?fields= is specified with only basic fields, skip heavy aggregation
    const requestedFields = query.fields?.split(',').map(f => f.trim()) ?? null;
    const isLightRequest = requestedFields !== null &&
      !requestedFields.some(f => f.startsWith('feedProjection') || f.startsWith('total') || f.startsWith('actual') || f.startsWith('unrealised') || f.startsWith('projected'));

    const flocks = await prisma.broilerFlock.findMany({
      where,
      include: {
        breed: true,
        supplier: { select: { id: true, name: true, contact: true, chickenType: true, feedStages: isLightRequest ? false : true } },
        financialRecords: isLightRequest ? { select: { amountZmw: true, isIncome: true, category: true } } : { select: { amountZmw: true, isIncome: true, category: true } },
        vaccinationSchedule: { select: { id: true, name: true } },
      },
      orderBy: orderBy(query.sortBy, query.sortDir, ['name', 'startDate', 'status', 'initialBirdCount'], { startDate: 'desc' }),
      ...(query.limit ? { take: query.limit, skip: query.offset } : {}),
    });

    const today = new Date();
    const flockIds = flocks.map((f: any) => f.id);

    // Skip heavy aggregation for light requests
    let mortalityByFlock = new Map<string, number>();
    let mortalityEventsByFlock = new Map<string, any[]>();
    let purchasesByFlockStage = new Map<string, number>();
    let feedRecordsByFlock = new Map<string, any[]>();
    let salesByFlock = new Map<string, any[]>();

    if (!isLightRequest) {
    const mortalitySums = await prisma.mortalityEvent.groupBy({
      by: ['flockId'],
      where: { flockId: { in: flockIds } },
      _sum: { count: true },
    });
    mortalityByFlock = new Map(mortalitySums.map((m: any) => [m.flockId, m._sum.count ?? 0]));

    // Batch-load mortality events with age/date for per-stage mortality adjustment
    const mortalityEvents = await prisma.mortalityEvent.findMany({
      where: { flockId: { in: flockIds } },
      select: { flockId: true, eventDate: true, count: true, ageDays: true },
    });
    mortalityEventsByFlock = new Map<string, any[]>();
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
    purchasesByFlockStage = new Map<string, number>();
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
    feedRecordsByFlock = new Map<string, any[]>();
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
    salesByFlock = new Map<string, any[]>();
    for (const s of saleRecords) {
      const arr = salesByFlock.get(s.flockId) ?? [];
      arr.push(s);
      salesByFlock.set(s.flockId, arr);
    }
    } // end if (!isLightRequest)

    reply.header('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');

    // When ?fields= is specified, project only the requested fields (light response)
    if (requestedFields) {
      return flocks.map((f: any) => {
        const start = f.startDate ? new Date(f.startDate) : null;
        const ageDays = start ? Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) : null;
        const totalMortality = Number(mortalityByFlock.get(f.id) ?? 0);
        const mortalityRate = f.initialCount > 0 ? (totalMortality / f.initialCount) * 100 : 0;
        const all: Record<string, any> = {
          id: f.id,
          name: f.name,
          breedId: f.breedId,
          breedName: f.breed?.name,
          supplierId: f.supplierId,
          supplierName: f.supplier?.name,
          startDate: f.startDate,
          initialCount: f.initialCount,
          currentCount: f.currentCount,
          status: f.status,
          ageDays,
          totalMortality,
          mortalityRate,
          targetWeight: f.targetWeight,
          targetAge: f.targetAge,
          housingType: f.housingType,
          chicksCollected: f.chicksCollected,
        };
        const filtered: Record<string, any> = {};
        for (const field of requestedFields) {
          if (field in all) filtered[field] = all[field];
        }
        return filtered;
      });
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
        vaccinationSchedule: { select: { id: true, name: true } },
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
    reply.header('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');
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

    if (data.vaccinationScheduleId) {
      const schedule = await prisma.vaccinationSchedule.findUnique({ where: { id: data.vaccinationScheduleId } });
      if (!schedule) return { error: 'VACCINATION_SCHEDULE_NOT_FOUND' };
    }

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
        vaccinationScheduleId: data.vaccinationScheduleId,
        createdBy: _authUser.userId,
        organizationId,
      },
      include: { breed: true, supplier: { select: { name: true } }, vaccinationSchedule: { select: { id: true, name: true } } },
    });

    // Remember the org default from the first explicitly chosen schedule
    if (data.vaccinationScheduleId) {
      await prisma.organization.updateMany({
        where: { id: organizationId, defaultVaccinationScheduleId: null },
        data: { defaultVaccinationScheduleId: data.vaccinationScheduleId },
      });
    }

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

    if (raw.vaccinationScheduleId) {
      const schedule = await prisma.vaccinationSchedule.findUnique({ where: { id: raw.vaccinationScheduleId } });
      if (!schedule) return reply.status(400).send({ error: 'VACCINATION_SCHEDULE_NOT_FOUND' });
    }

    // Completion lock: non-owners cannot modify a completed flock
    const authUser = (request as any).authUser;
    if (existing.status === 'completed' && authUser?.role !== 'owner') {
      return reply.status(403).send({
        error: 'FLOCK_COMPLETED',
        message: 'This flock is completed. Only the owner can modify it.',
      });
    }

    // Status transitions are owner-only — managers must use POST /:id/complete
    if (raw.status && authUser?.role !== 'owner') {
      return reply.status(403).send({
        error: 'STATUS_CHANGE_OWNER_ONLY',
        message: 'Flock status changes are restricted to the owner. Use the Complete Flock action.',
      });
    }

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
      include: { vaccinationSchedule: { select: { id: true, name: true } } },
    });

    // Auto-create sales financial record when flock is marked as sold
    if (raw.status === 'sold' && existing.status !== 'sold') {
      const salePrice = raw.salePriceZmw ?? existing.salePriceZmw ?? 0;
      const soldCount = existing.currentCount ?? 0;
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

  // ── Chick additions (hatchery extras / purchased top-ups / corrections) ──

  app.get('/:id/chick-additions', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const organizationId = getOrganizationId(request);
    const flock = await prisma.broilerFlock.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!flock) return reply.status(404).send({ error: 'NOT_FOUND' });
    const items = await prisma.flockChickAddition.findMany({
      where: { flockId: id },
      orderBy: [{ additionDate: 'asc' }, { createdAt: 'asc' }],
    });
    return { items };
  });

  app.post('/:id/chick-additions', { preHandler: [authenticate, requireRole('owner', 'manager'), flockLock] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = ChickAdditionCreateSchema.parse(request.body);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    if (data.reason !== 'correction' && data.count <= 0) {
      return reply.status(400).send({ error: 'INVALID_COUNT', message: 'Only corrections may reduce the bird count.' });
    }
    if (data.reason === 'purchase' && (data.unitPriceZmw === undefined || data.unitPriceZmw <= 0)) {
      return reply.status(400).send({ error: 'UNIT_PRICE_REQUIRED', message: 'Purchased chicks require a unit price.' });
    }
    if (data.reason !== 'purchase') data.unitPriceZmw = undefined;

    const flock = await prisma.broilerFlock.findFirst({ where: { id, organizationId } });
    if (!flock) return reply.status(404).send({ error: 'NOT_FOUND' });

    let addition: any;
    let finRecord: any;
    try {
      ({ addition, finRecord } = await prisma.$transaction(async (tx: any) => {
      let addition = await tx.flockChickAddition.create({
        data: {
          flockId: id,
          organizationId,
          additionDate: new Date(data.additionDate),
          count: data.count,
          reason: data.reason,
          unitPriceZmw: data.unitPriceZmw,
          notes: data.notes,
          createdBy: _authUser.userId,
        },
      });
      // Underflow guard lives inside the atomic update so two concurrent
      // corrections can't jointly drive a count below zero.
      const floor = Math.max(0, -data.count);
      const moved = await tx.broilerFlock.updateMany({
        where: { id, initialCount: { gte: floor }, currentCount: { gte: floor } },
        data: { initialCount: { increment: data.count }, currentCount: { increment: data.count } },
      });
      if (moved.count === 0) {
        throw Object.assign(new Error('COUNT_UNDERFLOW'), { code: 'COUNT_UNDERFLOW' });
      }
      let finRecord = null;
      if (data.reason === 'purchase') {
        const amount = new Decimal(data.count).mul(data.unitPriceZmw!).toNumber();
        finRecord = await tx.financialRecord.create({
          data: {
            flockId: id,
            sourceRecordId: addition.id,
            sourceTable: 'flock_chick_additions',
            recordDate: new Date(data.additionDate),
            category: 'chick_purchase',
            description: `Additional chicks - ${flock.name} (${data.count} birds @ ZMW ${data.unitPriceZmw})`,
            amountZmw: amount,
            isIncome: false,
            isSystemGenerated: true,
            notes: 'Auto-generated from chick addition',
          },
        });
        addition = await tx.flockChickAddition.update({ where: { id: addition.id }, data: { financialRecordId: finRecord.id } });
      }
      return { addition, finRecord };
      }));
    } catch (err: any) {
      if (err?.code === 'COUNT_UNDERFLOW') {
        return reply.status(400).send({ error: 'COUNT_UNDERFLOW', message: 'This change would take a bird count below zero.' });
      }
      throw err;
    }

    if (finRecord) {
      try {
        await autoPost.postFromFinancialRecord(finRecord.id, _authUser.userId, 'manual');
      } catch (err: any) {
        app.log.error(`[ChickAddition] Auto-post failed for FR ${finRecord.id}: ${err.message}`);
      }
    }

    await audit.log({
      organizationId,
      userId: _authUser.userId,
      impersonatedByStaffId: _authUser.impersonation?.staffId,
      entityType: 'FlockChickAddition',
      entityId: addition.id,
      action: 'create',
      newState: addition,
      ipAddress: request.ip,
    });

    return addition;
  });

  app.delete('/:id/chick-additions/:additionId', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id, additionId } = z.object({ id: z.string().uuid(), additionId: z.string().uuid() }).parse(request.params);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const addition = await prisma.flockChickAddition.findFirst({
      where: { id: additionId, flockId: id, organizationId },
      include: { flock: { select: { status: true, currentCount: true, initialCount: true } } },
    });
    if (!addition) return reply.status(404).send({ error: 'NOT_FOUND' });
    if (assertFlockNotCompleted(reply, addition.flock.status, _authUser?.role)) return;

    try {
      await prisma.$transaction(async (tx: any) => {
        await tx.flockChickAddition.delete({ where: { id: additionId } });
        // Atomic underflow guard — reversing +N must not take either count < 0.
        const floor = Math.max(0, addition.count);
        const moved = await tx.broilerFlock.updateMany({
          where: { id, initialCount: { gte: floor }, currentCount: { gte: floor } },
          data: { initialCount: { decrement: addition.count }, currentCount: { decrement: addition.count } },
        });
        if (moved.count === 0) {
          throw Object.assign(new Error('COUNT_UNDERFLOW'), { code: 'COUNT_UNDERFLOW' });
        }
      });
    } catch (err: any) {
      if (err?.code === 'COUNT_UNDERFLOW') {
        return reply.status(400).send({ error: 'COUNT_UNDERFLOW', message: 'Reversing this addition would take a bird count below zero.' });
      }
      throw err;
    }

    // Counts + row are committed — now unwind the financial trail.
    if (addition.financialRecordId) {
      const je = await prisma.journalEntry.findFirst({
        where: { sourceId: addition.financialRecordId, organizationId },
      });
      if (je) {
        try {
          await journalEngine.reverse(je.id, _authUser.userId, `Chick addition ${additionId} deleted`);
        } catch (err: any) {
          app.log.error(`[ChickAddition] Journal reversal failed for JE ${je.id}: ${err.message}`);
        }
      }
      await prisma.financialRecord.delete({ where: { id: addition.financialRecordId } });
    }

    await audit.log({
      organizationId,
      userId: _authUser.userId,
      impersonatedByStaffId: _authUser.impersonation?.staffId,
      entityType: 'FlockChickAddition',
      entityId: additionId,
      action: 'delete',
      previousState: addition,
      ipAddress: request.ip,
    });

    return { deleted: true };
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
      impersonatedByStaffId: authUser.impersonation?.staffId,
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
        feedPurchases: { select: { feedStageId: true, stageName: true, fulfillsFeedType: true, bagSizeKg: true, bagsPurchased: true, totalCostZmw: true } },
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

    // ── Feed-type model ────────────────────────────────────────────────
    // A feed type (e.g. "Starter") can be sold in alternative bag sizes
    // ("Starter" 50kg, "Starter (25kg)"). Requirement is computed ONCE in kg
    // per type, then expressed in each size: buying a 50kg bag reduces the
    // 25kg remaining by 2, and vice versa — sizes are never summed together.
    const typeKey = (name: string | null | undefined) =>
      (name || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();

    interface TypeBucket {
      requiredKg: number;
      birdsAlive: number;
      stages: any[];
      purchasedKg: number;
      purchasedCost: number;
      bagsByStage: Map<string, number>; // physical bags per stage row (purchase attribution)
    }
    const typeBuckets = new Map<string, TypeBucket>();
    const stageById = new Map<string, any>();
    const stageTypeKey = new Map<string, string>();

    for (const fs of feedStages) {
      stageById.set(fs.id, fs);
      const key = typeKey(fs.stageName);
      stageTypeKey.set(fs.id, key);

      let birdsAlive = flock.initialCount;
      if (fs.dayRangeStart != null && startDate) {
        const stageStartDay = fs.dayRangeStart;
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
      const requiredKg = birdsAlive * Number(fs.intakePerBirdKg || 0);

      // Alternative bag-size variants of the same type share one requirement.
      if (!typeBuckets.has(key)) {
        typeBuckets.set(key, { requiredKg, birdsAlive, stages: [fs], purchasedKg: 0, purchasedCost: 0, bagsByStage: new Map() });
      } else {
        typeBuckets.get(key)!.stages.push(fs);
      }
    }

    // Attribute purchases: kg credited to the feed TYPE (any size counts),
    // physical bag counts kept per stage row for display. Attribution order:
    // explicit fulfillsFeedType → linked feedStageId → normalized stage name.
    // The explicit field makes multi-supplier purchases count regardless of
    // how the other supplier names its stages.
    for (const p of flock.feedPurchases) {
      let key: string | undefined;
      if (p.fulfillsFeedType) key = typeKey(p.fulfillsFeedType);
      if (!key && p.feedStageId) key = stageTypeKey.get(p.feedStageId);
      if (!key) key = typeKey(p.stageName);
      const bucket = typeBuckets.get(key);
      if (!bucket) continue;

      const bagKg = Number(p.bagSizeKg || 0);
      bucket.purchasedKg += p.bagsPurchased * bagKg;
      bucket.purchasedCost += Number(p.totalCostZmw);

      let row = p.feedStageId ? stageById.get(p.feedStageId) : null;
      if (!row || typeKey(row.stageName) !== key) {
        row = bucket.stages.find((s: any) => Number(s.unitSizeKg) === bagKg) ?? null;
      }
      if (!row) {
        row = bucket.stages.reduce((a: any, b: any) => (Number(b.unitSizeKg) > Number(a.unitSizeKg) ? b : a));
      }
      bucket.bagsByStage.set(row.id, (bucket.bagsByStage.get(row.id) ?? 0) + p.bagsPurchased);
    }

    // Legacy FeedRecord kg counts as feed secured (reduces remaining) but is
    // not procurement — it does not inflate the purchased-bag count.
    for (const fr of flock.feedRecords) {
      const bucket = typeBuckets.get(typeKey(fr.feedType));
      if (bucket) bucket.purchasedKg += Number(fr.quantityKg || 0);
    }

    const stages: any[] = [];
    const types: any[] = [];
    let totalBagsRequired = 0;
    let totalBagsPurchased = 0;
    let totalBagsRemaining = 0;
    let totalProjectedCost = 0;
    let totalPurchasedCost = 0;
    let totalRequiredKg = 0;
    let totalPurchasedKg = 0;

    for (const [key, bucket] of typeBuckets) {
      const remainingKg = bucket.requiredKg - bucket.purchasedKg;
      const status: 'complete' | 'partial' | 'not_started' =
        remainingKg <= 0 && bucket.requiredKg > 0 ? 'complete'
        : bucket.purchasedKg > 0 ? 'partial'
        : 'not_started';

      for (const fs of bucket.stages) {
        const unitKg = Number(fs.unitSizeKg);
        const bagsRequired = unitKg > 0 ? Math.ceil(bucket.requiredKg / unitKg) : 0;
        const bagsPurchased = bucket.bagsByStage.get(fs.id) ?? 0;
        const bagsRemaining = unitKg > 0 ? Math.max(0, Math.ceil(remainingKg / unitKg)) : 0;
        const projectedCostZmw = bagsRequired > 0
          ? new Decimal(bagsRequired).mul(fs.unitPriceZmw).toNumber()
          : 0;

        stages.push({
          feedStageId: fs.id,
          stageName: fs.stageName,
          dayRangeStart: fs.dayRangeStart,
          dayRangeEnd: fs.dayRangeEnd,
          bagSizeKg: unitKg,
          intakePerBirdKg: Number(fs.intakePerBirdKg),
          birdsAliveAtStageStart: bucket.birdsAlive,
          bagsRequired,
          bagsRaw: unitKg > 0 ? bucket.requiredKg / unitKg : 0,
          bagsPurchased,
          bagsRemaining,
          unitPriceZmw: Number(fs.unitPriceZmw),
          projectedCostZmw,
          purchasedCostZmw: 0, // cost reported at type level below
          status,
        });
      }

      // Totals are expressed in each type's primary (largest) bag size so
      // units stay coherent — 25kg and 50kg bags are never summed together.
      const primary = bucket.stages.reduce((a: any, b: any) => (Number(b.unitSizeKg) > Number(a.unitSizeKg) ? b : a));
      const primaryKg = Number(primary.unitSizeKg) || 1;
      const typePurchasedBags = [...bucket.bagsByStage.values()].reduce((a, b) => a + b, 0);

      // Grouped per-type view (one row per feed type; per-size sub-columns)
      const typeRow = {
        typeName: primary.stageName.replace(/\s*\(.*?\)\s*/g, '').trim(),
        dayRangeStart: primary.dayRangeStart,
        dayRangeEnd: primary.dayRangeEnd,
        requiredKg: bucket.requiredKg,
        purchasedKg: bucket.purchasedKg,
        remainingKg,
        spentZmw: bucket.purchasedCost,
        remainingCostZmw: Math.ceil(Math.max(0, remainingKg) / primaryKg) * Number(primary.unitPriceZmw),
        coveragePct: bucket.requiredKg > 0 ? Math.min(100, (bucket.purchasedKg / bucket.requiredKg) * 100) : 0,
        overPurchasedKg: Math.max(0, -remainingKg),
        status,
        sizes: bucket.stages
          .slice()
          .sort((a: any, b: any) => Number(b.unitSizeKg) - Number(a.unitSizeKg))
          .map((s: any) => {
            const u = Number(s.unitSizeKg);
            return {
              feedStageId: s.id,
              unitKg: u,
              requiredBags: u > 0 ? Math.ceil(bucket.requiredKg / u) : 0,
              purchasedBags: bucket.bagsByStage.get(s.id) ?? 0,
              remainingBags: u > 0 ? Math.max(0, Math.ceil(remainingKg / u)) : 0,
              projectedCostZmw: u > 0 ? new Decimal(Math.ceil(bucket.requiredKg / u)).mul(s.unitPriceZmw).toNumber() : 0,
              unitPriceZmw: Number(s.unitPriceZmw),
            };
          }),
      };
      types.push(typeRow);

      totalBagsRequired += Math.ceil(bucket.requiredKg / primaryKg);
      totalBagsPurchased += typePurchasedBags;
      totalBagsRemaining += Math.max(0, Math.ceil(remainingKg / primaryKg));
      totalProjectedCost += Math.ceil(bucket.requiredKg / primaryKg) * Number(primary.unitPriceZmw);
      totalPurchasedCost += bucket.purchasedCost;
      totalRequiredKg += bucket.requiredKg;
      totalPurchasedKg += bucket.purchasedKg;
    }

    return {
      flockId: id,
      flockName: flock.name,
      initialCount: flock.initialCount,
      currentCount: flock.currentCount,
      supplierName: flock.supplier.name,
      stages,
      types,
      totals: {
        bagsRequired: totalBagsRequired,
        bagsPurchased: totalBagsPurchased,
        bagsRemaining: totalBagsRemaining,
        requiredKg: totalRequiredKg,
        purchasedKg: totalPurchasedKg,
        remainingKg: Math.max(0, totalRequiredKg - totalPurchasedKg),
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

    const [schedule, org, mortalityEvents, feedTargets, completedVaccines] = await Promise.all([
      resolveVaccinationSchedule(prisma, flock),
      prisma.organization.findUnique({ where: { id: organizationId }, select: { ambientTempC: true, hatchDayConvention: true } }),
      prisma.mortalityEvent.findMany({ where: { flockId: id }, select: { eventDate: true, count: true } }),
      prisma.performanceTarget.findMany({ where: { breedId: flock.breedId }, select: { ageDays: true, targetFeed: true } }),
      prisma.vaccinationEvent.findMany({ where: { flockId: id }, orderBy: { adminDate: 'asc' } }),
    ]);

    const ambientTempC = Number(org?.ambientTempC ?? 25);
    const conv = org?.hatchDayConvention ?? 'day1';
    const birdsAliveAt = (age: number) => {
      const date = new Date(startDate.getTime() + age * 24 * 60 * 60 * 1000);
      const deaths = mortalityEvents.reduce((sum: number, m: any) => sum + (new Date(m.eventDate) <= date ? m.count : 0), 0);
      return Math.max(0, flock.initialCount - deaths);
    };
    const feedTargetAt = (age: number) => feedTargets.find((t: any) => t.ageDays === age)?.targetFeed;
    const waterAt = (age: number) => {
      const feed = feedTargetAt(age);
      return feed != null ? computeDailyWater({ targetFeedKgPerBird: Number(feed), birdsAlive: birdsAliveAt(age), ambientTempC }) : null;
    };
    const vaccineEntry = (item: any) => {
      const water = waterAt(item.ageDays);
      const waterRoute = isWaterRoute(item.adminMethod);
      return {
        adminMethod: item.adminMethod,
        isWaterRoute: waterRoute,
        vaccineWater: waterRoute && water ? computeVaccineMixVolume({ daily: water, ageDays: item.ageDays, birdsAlive: birdsAliveAt(item.ageDays) }) : null,
      };
    };

    const events: any[] = [];

    // Placement / brooding start
    events.push({
      ageDays: 0,
      displayDay: displayDayOf(0, conv),
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
        displayDay: displayDayOf(1, conv),
        date: date.toISOString().split('T')[0],
        type: 'vaccination',
        title: `Vaccination: ${item.vaccineName}`,
        description: `Administer via ${item.adminMethod}. ${item.notes || ''}`,
        completed,
        ...vaccineEntry(item),
      });
    }

    // Feed transitions
    events.push({
      ageDays: feedTransitionDay,
      displayDay: displayDayOf(feedTransitionDay, conv),
      date: new Date(startDate.getTime() + feedTransitionDay * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      type: 'feed',
      title: 'Feed transition: Starter to Grower',
      description: 'Transition gradually over 3 days.',
      completed: ageDays >= feedTransitionDay,
    });
    events.push({
      ageDays: finisherDay,
      displayDay: displayDayOf(finisherDay, conv),
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
        displayDay: displayDayOf(item.ageDays, conv),
        date: date.toISOString().split('T')[0],
        type: 'vaccination',
        title: `Vaccination: ${item.vaccineName}`,
        description: `Administer via ${item.adminMethod}. ${item.notes || ''}`,
        completed,
        ...vaccineEntry(item),
      });
    }

    // Pre-slaughter withdrawal
    events.push({
      ageDays: targetAge - 7,
      displayDay: displayDayOf(targetAge - 7, conv),
      date: new Date(startDate.getTime() + (targetAge - 7) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      type: 'management',
      title: 'Pre-slaughter withdrawal (coccidiostats)',
      description: 'Check label withdrawal period.',
      completed: ageDays >= targetAge - 7,
    });

    // Market / processing
    events.push({
      ageDays: targetAge,
      displayDay: displayDayOf(targetAge, conv),
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

    // The post-flock queries are independent of each other — run them
    // concurrently to cut sequential round-trip latency.
    const [schedule, envSchedule, completedVaccines, org, mortalityEvents, feedTargets] = await Promise.all([
      resolveVaccinationSchedule(prisma, flock),
      getLightingTemperatureScheduleForFlock(prisma, flock, _authUser.userId),
      prisma.vaccinationEvent.findMany({
        where: { flockId: id },
        orderBy: { adminDate: 'asc' },
      }),
      prisma.organization.findUnique({ where: { id: organizationId }, select: { ambientTempC: true, hatchDayConvention: true } }),
      prisma.mortalityEvent.findMany({ where: { flockId: id }, select: { eventDate: true, count: true } }),
      prisma.performanceTarget.findMany({ where: { breedId: flock.breedId }, select: { ageDays: true, targetFeed: true } }),
    ]);

    const ambientTempC = Number(org?.ambientTempC ?? 25);
    const conv = org?.hatchDayConvention ?? 'day1';
    const birdsAliveAt = (date: Date) => {
      const deaths = mortalityEvents.reduce((sum: number, m: any) => sum + (new Date(m.eventDate) <= date ? m.count : 0), 0);
      return Math.max(0, flock.initialCount - deaths);
    };

    const days = [];
    for (let d = 0; d <= targetAge; d++) {
      const date = new Date(startDate.getTime() + d * 24 * 60 * 60 * 1000);
      const birdsAlive = birdsAliveAt(date);
      const feedTarget = feedTargets.find((t: any) => t.ageDays === d)?.targetFeed;
      const water = feedTarget != null
        ? computeDailyWater({ targetFeedKgPerBird: Number(feedTarget), birdsAlive, ambientTempC })
        : null;
      const vaccines = (schedule?.items.filter((i: any) => i.ageDays === d) || []).map((item: any) => {
        const waterRoute = isWaterRoute(item.adminMethod);
        return {
          ...item,
          displayDay: displayDayOf(item.ageDays, conv),
          adminMethod: item.adminMethod,
          isWaterRoute: waterRoute,
          vaccineWater: waterRoute && water
            ? computeVaccineMixVolume({ daily: water, ageDays: d, birdsAlive })
            : null,
          completed: completedVaccines.some((v: any) => v.vaccineName === item.vaccineName && Math.abs(v.ageDays - d) <= 1),
        };
      });

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

      // Vaccination-day guidance is derived from the resolved schedule so it
      // stays correct when a flock overrides its schedule.
      const vaccineNotes = buildVaccinationDayNotes(schedule?.items ?? [], d, vaccines, conv);

      const healthSupport = d === 0
        ? 'Day 1-3: Stress pack (glucose + electrolytes + vitamins A/D3/E/C) in drinking water. Rehydrates chicks, stimulates appetite, jumpstarts yolk-sac absorption. Hatchery vaccination complete.'
        : d === 1
          ? 'Continue stress pack. Monitor for dehydration. Brooder temp 32-33C.'
        : d === 2
          ? 'Continue stress pack (Day 3 last day). Monitor chick activity and feed intake.'
        : vaccineNotes
          ? vaccineNotes
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
        displayDay: displayDayOf(d, conv),
        age: `Day ${displayDayOf(d, conv)}`,
        date: date.toISOString().split('T')[0],
        birdsAlive,
        water,
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
