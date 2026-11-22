import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { authenticate, requireRole } from '../auth/routes.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';
import { AuditService } from '../../core/finance/audit.service.js';
import { checkFlockNotLocked, assertFlockNotCompleted } from '../broiler-flocks/check-flock-locked.js';
import { JournalEngine } from '../../core/double-entry/journal.engine.js';
import { AutoPostService } from '../../core/double-entry/auto-post.service.js';

const PAYMENT_METHODS = ['cash', 'mobile_money_airtel', 'mobile_money_mtn', 'mobile_money_zamtel', 'bank_transfer', 'other'] as const;
const PaymentMethodSchema = z.enum(PAYMENT_METHODS);

const SaleRecordCreateSchema = z.object({
  flockId: z.string().uuid(),
  saleDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  customerName: z.string().max(200).nullish(),
  customerPhone: z.string().max(50).nullish(),
  birdCount: z.number().int().positive(),
  avgWeightKg: z.number().nonnegative().nullish(),
  pricePerBirdZmw: z.number().nonnegative(),
  totalAmountZmw: z.number().nonnegative(),
  paymentStatus: z.enum(['pending', 'partial', 'paid']).default('pending'),
  amountPaidZmw: z.number().nonnegative().nullish(),
  initialPaymentMethod: PaymentMethodSchema.optional(),
  notes: z.string().nullish(),
});

const SaleRecordUpdateSchema = SaleRecordCreateSchema.partial().omit({ flockId: true });

const PaymentCreateSchema = z.object({
  amountZmw: z.number().positive(),
  paidAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  method: PaymentMethodSchema.default('cash'),
  reference: z.string().max(120).nullish(),
  note: z.string().nullish(),
});

/** Parse a linked FinancialRecord id from the notes prefix `[FR:{id}]`. */
function parseFinancialRecordId(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const match = notes.match(/^\[FR:([0-9a-fA-F-]{36})\]/);
  return match ? match[1] : null;
}

/** Strip the `[FR:<uuid>]` prefix from notes for API responses. */
function stripFrPrefix(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const stripped = notes.replace(/^\[FR:[0-9a-fA-F-]{36}\]\s?/, '');
  return stripped || null;
}

/** Derive the effective payment status from monetary values at read time.
 *  The persisted paymentStatus column can go stale relative to
 *  amountPaidZmw / payment rows, so all read paths use this derivation:
 *  paid when amountPaid covers the total (and total > 0),
 *  pending when nothing is paid, partial otherwise. */
function derivePaymentStatus(totalAmountZmw: unknown, amountPaidZmw: unknown): 'pending' | 'partial' | 'paid' {
  const total = Number(totalAmountZmw ?? 0);
  const paid = Number(amountPaidZmw ?? 0);
  if (paid >= total && total > 0) return 'paid';
  if (paid <= 0) return 'pending';
  return 'partial';
}

/** Aggregate payment breakdown in JS from records selected under the
 *  existing `where` scope. Returns { paymentStatus, count, totalAmount,
 *  outstandingAmount }[] — outstandingAmount sums only the unpaid remainder
 *  (total − paid) so pending+partial reconcile with the Outstanding KPI. */
function aggregatePaymentBreakdown(records: { paymentStatus?: string | null; totalAmountZmw: unknown; amountPaidZmw: unknown }[]): { paymentStatus: string; count: number; totalAmount: number; outstandingAmount: number }[] {
  const map = new Map<string, { paymentStatus: string; count: number; totalAmount: number; outstandingAmount: number }>();
  for (const r of records) {
    const status = derivePaymentStatus(r.totalAmountZmw, r.amountPaidZmw);
    const total = Number(r.totalAmountZmw ?? 0);
    const paid = Number(r.amountPaidZmw ?? 0);
    const entry = map.get(status) ?? { paymentStatus: status, count: 0, totalAmount: 0, outstandingAmount: 0 };
    entry.count += 1;
    entry.totalAmount += total;
    entry.outstandingAmount += Math.max(0, total - paid);
    map.set(status, entry);
  }
  return [...map.values()];
}

/** Compute total production costs for a set of flocks, respecting an
 *  optional [fromDate, toDate] period on the underlying cost dates.
 *  Costs = Σ non-income, non-projection FinancialRecord amounts
 *  (feed purchases/records, medication, vaccination, chick_purchase, … —
 *  the same basis the flock list uses for totalCost) + chick-cost fallback
 *  (chickPriceZmw × initialCount when no chick_purchase record exists) +
 *  Σ FlockOverheadAllocation.allocatedAmount (ledger overhead allocations).
 *  The chick fallback has no cost date of its own, so with a period filter
 *  it is included only when the flock's startDate/orderDate/createdAt
 *  falls inside the period. */
async function computeCostTotals(
  prisma: any,
  flockIds: string[],
  opts: { fromDate?: string; toDate?: string },
): Promise<number> {
  if (flockIds.length === 0) return 0;

  const periodStart = opts.fromDate ? new Date(opts.fromDate) : null;
  const periodEnd = opts.toDate ? new Date(opts.toDate) : null;
  if (periodEnd) periodEnd.setDate(periodEnd.getDate() + 1); // exclusive, mirrors saleDate filter
  const dateCond: any = {};
  if (periodStart) dateCond.gte = periodStart;
  if (periodEnd) dateCond.lt = periodEnd;
  const hasPeriod = !!(periodStart || periodEnd);
  const inPeriod = hasPeriod ? dateCond : undefined;

  const [expenseRecs, overheadAllocs, chickFinRecs, flocks] = await Promise.all([
    prisma.financialRecord.findMany({
      where: {
        flockId: { in: flockIds },
        isIncome: false,
        isProjection: false,
        ...(inPeriod ? { recordDate: inPeriod } : {}),
      },
      select: { flockId: true, amountZmw: true },
    }),
    prisma.flockOverheadAllocation.findMany({
      where: {
        flockId: { in: flockIds },
        ...(inPeriod ? { allocationDate: inPeriod } : {}),
      },
      select: { flockId: true, allocatedAmount: true },
    }),
    // All-time chick_purchase expenses — decides who needs the price×count fallback
    prisma.financialRecord.findMany({
      where: { flockId: { in: flockIds }, category: 'chick_purchase', isIncome: false },
      select: { flockId: true },
      distinct: ['flockId'],
    }),
    prisma.broilerFlock.findMany({
      where: { id: { in: flockIds } },
      select: { id: true, chickPriceZmw: true, initialCount: true, startDate: true, orderDate: true, createdAt: true },
    }),
  ]);

  const costByFlock = new Map<string, number>();
  const add = (flockId: string, amount: number) =>
    costByFlock.set(flockId, (costByFlock.get(flockId) ?? 0) + amount);

  for (const r of expenseRecs) add(r.flockId, Number(r.amountZmw));
  for (const o of overheadAllocs) add(o.flockId, Number(o.allocatedAmount));

  const hasChickRecord = new Set(chickFinRecs.map((r: any) => r.flockId));
  for (const f of flocks) {
    if (hasChickRecord.has(f.id) || !f.chickPriceZmw || !f.initialCount) continue;
    if (hasPeriod) {
      const d = f.startDate ?? f.orderDate ?? f.createdAt;
      if (d && ((periodStart && d < periodStart) || (periodEnd && d >= periodEnd))) continue;
    }
    add(f.id, Number(f.chickPriceZmw) * f.initialCount);
  }

  return [...costByFlock.values()].reduce((s, v) => s + v, 0);
}

/** Profit figures shared by /dashboard and /summary. */
function profitFields(totalRevenue: number, totalPaid: number, outstanding: number, totalCosts: number, totalBirdsSold: number) {
  const totalProfit = totalRevenue - totalCosts;
  return {
    totalCosts,
    totalProfit,
    // Accrual profit minus the outstanding receivable — worst case if unpaid sales never collect.
    profitLessOutstanding: totalProfit - Math.max(0, outstanding),
    // Cash-basis profit: money actually collected minus costs.
    cashProfit: totalPaid - totalCosts,
    avgProfitPerBird: totalBirdsSold > 0 ? totalProfit / totalBirdsSold : 0,
    avgCostsPerBird: totalBirdsSold > 0 ? totalCosts / totalBirdsSold : 0,
  };
}

/** Serialize a sale record for API responses — strips [FR:] prefix from notes
 *  and adds derived payment fields. paymentStatus is overridden with the
 *  read-time derivation so badges reflect monetary values, not the possibly
 *  stale persisted column. */
function serializeSaleRecord(record: any): any {
  const total = Number(record.totalAmountZmw ?? 0);
  const paid = Number(record.amountPaidZmw ?? 0);
  const paymentsCount = record._count?.payments ?? record.payments?.length;
  return {
    ...record,
    paymentStatus: derivePaymentStatus(total, paid),
    notes: stripFrPrefix(record.notes),
    remainingDueZmw: Math.max(0, total - paid),
    paidPct: total > 0 ? Math.round((paid / total) * 1000) / 10 : 0,
    paymentsCount,
  };
}

/** Prisma `where` fragments reproducing derivePaymentStatus() at the DB
 *  level, so list/summary filters match the read-time derivation — the
 *  persisted paymentStatus column can go stale vs amountPaidZmw /
 *  totalAmountZmw. Requires the fieldReference preview feature.
 *  Mirrors derivePaymentStatus: paid ⇔ paid ≥ total ∧ total > 0,
 *  pending ⇔ paid ≤ 0, partial otherwise. */
function paymentStatusConditions(prisma: any, statuses: string[]): any[] {
  const fields = prisma.saleRecord.fields;
  const byStatus: Record<string, any> = {
    paid: {
      AND: [
        { totalAmountZmw: { gt: 0 } },
        { amountPaidZmw: { gte: fields.totalAmountZmw } },
      ],
    },
    pending: { amountPaidZmw: { lte: 0 } },
    partial: {
      AND: [
        { amountPaidZmw: { gt: 0 } },
        { OR: [{ totalAmountZmw: { lte: 0 } }, { amountPaidZmw: { lt: fields.totalAmountZmw } }] },
      ],
    },
  };
  const conds = statuses.map((s) => byStatus[s] ?? byStatus.pending);
  return conds.length === 1 ? conds : [{ OR: conds }];
}

/** Build a Prisma `where` clause from common filter params. */
function buildFilterWhere(prisma: any, organizationId: string, query: {
  fromDate?: string;
  toDate?: string;
  /** Single status or comma-separated list ("pending,partial"). */
  paymentStatus?: string;
  flockId?: string;
  customer?: string;
  q?: string;
}): any {
  const where: any = { flock: { organizationId } };

  if (query.flockId) {
    where.flockId = query.flockId;
  }

  if (query.fromDate || query.toDate) {
    where.saleDate = {};
    if (query.fromDate) where.saleDate.gte = new Date(query.fromDate);
    // Fix toDate boundary: add 1 day and use lt so records on the end date are included
    if (query.toDate) {
      const end = new Date(query.toDate);
      end.setDate(end.getDate() + 1);
      where.saleDate.lt = end;
    }
  }

  if (query.paymentStatus) {
    const statuses = query.paymentStatus.split(',').filter(Boolean);
    where.AND = [...(where.AND ?? []), ...paymentStatusConditions(prisma, statuses)];
  }

  if (query.customer) {
    where.OR = [
      { customerName: { contains: query.customer, mode: 'insensitive' } },
      { customerPhone: { contains: query.customer, mode: 'insensitive' } },
    ];
  }

  // Standard ?q= search across customer + notes (M-1)
  if (query.q) {
    const contains = { contains: query.q, mode: 'insensitive' as const };
    where.AND = [...(where.AND || []), { OR: [{ customerName: contains }, { customerPhone: contains }, { notes: contains }] }];
  }

  return where;
}

/** Shared query schema for filter params. */
const FilterQuerySchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Single status or comma-separated list (e.g. "pending,partial" for outstanding)
  paymentStatus: z.string().regex(/^(pending|partial|paid)(,(pending|partial|paid))*$/).optional(),
  flockId: z.string().uuid().optional(),
  customer: z.string().max(200).optional(),
  q: z.string().max(200).optional(),
});

/** Enforce payment consistency rules on create/update data.
 *  On PATCH, if paymentStatus is not provided, the existing record's status
 *  is used so that amountPaidZmw / totalAmountZmw changes stay consistent. */
function enforcePaymentRules(
  data: { paymentStatus?: string; amountPaidZmw?: number | null; totalAmountZmw?: number | null },
  existingTotal?: number,
  existingStatus?: string,
): { amountPaidZmw?: number | null } {
  const total = data.totalAmountZmw ?? existingTotal ?? 0;
  const status = data.paymentStatus ?? existingStatus;

  if (status === 'paid') {
    return { amountPaidZmw: total };
  }
  if (status === 'pending') {
    return { amountPaidZmw: 0 };
  }
  // For partial or unspecified, leave amountPaidZmw as provided
  return {};
}

/** Validate payment consistency — returns error message or null.
 *  On PATCH, existingStatus is used when paymentStatus is not in the patch. */
function validatePaymentRules(
  data: { paymentStatus?: string; amountPaidZmw?: number | null; totalAmountZmw?: number | null },
  existingTotal?: number,
  existingStatus?: string,
): string | null {
  const total = data.totalAmountZmw ?? existingTotal;
  const status = data.paymentStatus ?? existingStatus;

  if (status === 'partial') {
    const paid = data.amountPaidZmw;
    if (paid != null) {
      if (paid <= 0) {
        return 'Payment status "partial" requires amountPaidZmw > 0';
      }
      if (total != null && paid >= total) {
        return 'Payment status "partial" requires amountPaidZmw < totalAmountZmw';
      }
    }
  }

  // If amountPaidZmw is being changed on a paid/pending record without a
  // matching status change, reject — the caller must use enforcePaymentRules.
  if (status === 'paid' && data.amountPaidZmw !== undefined && data.paymentStatus === undefined) {
    if (data.amountPaidZmw !== total) {
      return 'Cannot change amountPaidZmw on a "paid" record — set paymentStatus explicitly or amountPaidZmw equal to totalAmountZmw';
    }
  }
  if (status === 'pending' && data.amountPaidZmw !== undefined && data.paymentStatus === undefined) {
    if (data.amountPaidZmw !== 0) {
      return 'Cannot set a non-zero amountPaidZmw on a "pending" record — change paymentStatus to "partial" or "paid" first';
    }
  }

  if (status === 'paid' && total !== undefined && data.amountPaidZmw !== undefined && data.amountPaidZmw !== total) {
    return 'Payment status "paid" requires amountPaidZmw equal to totalAmountZmw (will be auto-set)';
  }

  return null;
}

export async function buildSaleRecordModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  const audit = new AuditService(prisma);
  const flockLock = checkFlockNotLocked(prisma);
  const journalEngine = new JournalEngine(prisma);
  const autoPost = new AutoPostService(journalEngine, prisma);

  const PAYMENT_INCLUDE = { _count: { select: { payments: true } } } as const;

  // Recompute amountPaidZmw + paymentStatus from the payment history.
  async function recomputeSaleTotals(saleId: string) {
    const sum = await prisma.salePayment.aggregate({
      where: { saleRecordId: saleId },
      _sum: { amountZmw: true },
    });
    const paid = Number(sum._sum.amountZmw ?? 0);
    const sale = await prisma.saleRecord.findUnique({ where: { id: saleId } });
    const total = Number(sale?.totalAmountZmw ?? 0);
    const paymentStatus = derivePaymentStatus(total, paid);
    return prisma.saleRecord.update({
      where: { id: saleId },
      data: { amountPaidZmw: paid, paymentStatus },
      include: PAYMENT_INCLUDE,
    });
  }

  async function findSaleScoped(id: string, organizationId: string) {
    const record = await prisma.saleRecord.findFirst({
      where: { id },
      include: { flock: true, ...PAYMENT_INCLUDE },
    });
    if (!record || record.flock.organizationId !== organizationId) return null;
    return record;
  }

  // GET /:id/payments — payment history
  app.get('/:id/payments', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const organizationId = getOrganizationId(request);
    const record = await findSaleScoped(id, organizationId);
    if (!record) return reply.status(404).send({ error: 'NOT_FOUND' });
    return prisma.salePayment.findMany({
      where: { saleRecordId: id },
      orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
    });
  });

  // POST /:id/payments — record a payment
  app.post('/:id/payments', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = PaymentCreateSchema.parse(request.body);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const record = await findSaleScoped(id, organizationId);
    if (!record) return reply.status(404).send({ error: 'NOT_FOUND' });

    const total = Number(record.totalAmountZmw);
    const paidSoFar = Number(record.amountPaidZmw ?? 0);
    const remaining = total - paidSoFar;
    if (data.amountZmw > remaining + 0.005) {
      return reply.status(400).send({ error: 'PAYMENT_EXCEEDS_DUE', message: `Payment exceeds remaining due of ${remaining.toFixed(2)} ZMW` });
    }

    const paidAt = data.paidAt ? new Date(data.paidAt) : new Date();

    const payment = await prisma.$transaction(async (tx: any) => {
      const p = await tx.salePayment.create({
        data: {
          saleRecordId: id,
          organizationId,
          amountZmw: data.amountZmw,
          paidAt,
          method: data.method,
          reference: data.reference ?? null,
          note: data.note ?? null,
          createdBy: _authUser.userId,
        },
      });

      const sum = await tx.salePayment.aggregate({
        where: { saleRecordId: id },
        _sum: { amountZmw: true },
      });
      const paid = Number(sum._sum.amountZmw ?? 0);
      const paymentStatus = derivePaymentStatus(total, paid);
      await tx.saleRecord.update({
        where: { id },
        data: { amountPaidZmw: paid, paymentStatus },
      });
      return p;
    });

    // Journal post AFTER the tx commits — JournalEngine uses the global prisma
    // and journal rows are immutable, so a tx rollback could orphan an entry.
    const warnings: string[] = [];
    try {
      const journalId = await autoPost.postSalePaymentJournal({
        paymentId: payment.id,
        amount: data.amountZmw,
        paidAt,
        description: `Payment: ${record.customerName ?? 'customer'} — sale ${record.saleDate.toISOString().split('T')[0]}`,
        flockId: record.flockId,
        organizationId,
        postedBy: _authUser.userId,
      });
      if (journalId) {
        await prisma.salePayment.update({ where: { id: payment.id }, data: { journalEntryId: journalId } });
        payment.journalEntryId = journalId;
      }
    } catch (e) {
      request.log.error({ err: e, paymentId: payment.id }, 'sale payment journal post failed after commit');
      warnings.push('JOURNAL_POST_FAILED');
    }

    const updated = await recomputeSaleTotals(id);
    return reply.status(201).send({ payment, sale: serializeSaleRecord(updated), warnings });
  });

  // DELETE /:id/payments/:paymentId — owner only
  app.delete('/:id/payments/:paymentId', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id, paymentId } = z.object({ id: z.string().uuid(), paymentId: z.string().uuid() }).parse(request.params);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const record = await findSaleScoped(id, organizationId);
    if (!record) return reply.status(404).send({ error: 'NOT_FOUND' });
    const payment = await prisma.salePayment.findFirst({ where: { id: paymentId, saleRecordId: id } });
    if (!payment) return reply.status(404).send({ error: 'NOT_FOUND' });

    if (payment.journalEntryId) {
      try {
        await journalEngine.reverse(payment.journalEntryId, _authUser.userId, 'Payment deleted');
      } catch (e) {
        request.log.error({ err: e, paymentId }, 'payment journal reversal failed');
      }
    }
    await prisma.salePayment.delete({ where: { id: paymentId } });
    const updated = await recomputeSaleTotals(id);
    return { deleted: true, sale: serializeSaleRecord(updated) };
  });

  // GET /all — list all sale records for the user (for sales dashboard)
  app.get('/all', { preHandler: [authenticate] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    reply.header('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');
    const query = FilterQuerySchema.extend({
      sortBy: z.enum(['saleDate', 'flockName', 'customerName', 'birdCount', 'pricePerBirdZmw', 'totalAmountZmw', 'paymentStatus']).optional(),
      sortDir: z.enum(['asc', 'desc']).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }).parse(request.query);

    const where = buildFilterWhere(prisma, organizationId, query);

    const sortBy = query.sortBy ?? 'saleDate';
    const sortDir = query.sortDir ?? 'desc';

    // Fields that require post-fetch sorting (relation or computed fields)
    const prismaSortFields = new Set(['saleDate', 'customerName', 'birdCount', 'pricePerBirdZmw', 'totalAmountZmw', 'paymentStatus']);

    const [records, total] = await Promise.all([
      prisma.saleRecord.findMany({
        where,
        include: { flock: { select: { name: true, breed: { select: { name: true } } } }, ...PAYMENT_INCLUDE },
        orderBy: prismaSortFields.has(sortBy) ? { [sortBy]: sortDir } : { saleDate: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      prisma.saleRecord.count({ where }),
    ]);

    // Post-fetch sort for flockName (requires relation field)
    if (sortBy === 'flockName') {
      records.sort((a: any, b: any) => {
        const aName = a.flock?.name ?? '';
        const bName = b.flock?.name ?? '';
        return sortDir === 'asc' ? aName.localeCompare(bName) : bName.localeCompare(aName);
      });
    }

    return {
      data: records.map(serializeSaleRecord),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  });

  // GET /dashboard — global sales summary for the sales dashboard
  app.get('/dashboard', { preHandler: [authenticate] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    reply.header('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    const query = FilterQuerySchema.parse(request.query);

    const where = buildFilterWhere(prisma, organizationId, query);

    const totals = await prisma.saleRecord.aggregate({
      where,
      _sum: { birdCount: true, totalAmountZmw: true, amountPaidZmw: true },
      _count: { _all: true },
    });

    // Derive payment breakdown at read time from monetary values — the
    // persisted paymentStatus column can go stale vs amountPaidZmw.
    const breakdownRecords = await prisma.saleRecord.findMany({
      where,
      select: { paymentStatus: true, totalAmountZmw: true, amountPaidZmw: true },
    });
    const paymentBreakdown = aggregatePaymentBreakdown(breakdownRecords);

    // Top customers by revenue
    const topCustomers = await prisma.saleRecord.groupBy({
      by: ['customerName'],
      where: { ...where, customerName: { not: null } },
      _sum: { totalAmountZmw: true },
      _count: { _all: true },
      orderBy: { _sum: { totalAmountZmw: 'desc' } },
      take: 10,
    });

    // Daily sales for charting — respect date range if provided, else last 30 days
    let chartWhere = where;
    if (!query.fromDate && !query.toDate) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      chartWhere = { ...where, saleDate: { ...where.saleDate, gte: thirtyDaysAgo } };
    }

    const recentSales = await prisma.saleRecord.findMany({
      where: chartWhere,
      orderBy: { saleDate: 'asc' },
      select: { saleDate: true, birdCount: true, totalAmountZmw: true },
    });

    const dailySales: Record<string, { birds: number; revenue: number }> = {};
    for (const s of recentSales) {
      const dateKey = s.saleDate.toISOString().split('T')[0];
      if (!dailySales[dateKey]) dailySales[dateKey] = { birds: 0, revenue: 0 };
      dailySales[dateKey].birds += s.birdCount;
      dailySales[dateKey].revenue += Number(s.totalAmountZmw);
    }

    // Cost/profit scope: the flocks that produced the filtered sales
    // (or the explicitly filtered flock). Costs respect the same period.
    const scopeFlocks = query.flockId
      ? [query.flockId]
      : (await prisma.saleRecord.findMany({ where, select: { flockId: true }, distinct: ['flockId'] })).map((r: any) => r.flockId);
    const totalRevenue = totals._sum.totalAmountZmw ? Number(totals._sum.totalAmountZmw) : 0;
    const totalPaid = totals._sum.amountPaidZmw ? Number(totals._sum.amountPaidZmw) : 0;
    const outstanding = totalRevenue - totalPaid;
    const totalBirdsSold = totals._sum.birdCount ?? 0;
    const totalCosts = await computeCostTotals(prisma, scopeFlocks, query);

    return {
      totalRevenue,
      totalBirdsSold,
      totalPaid,
      outstanding,
      ...profitFields(totalRevenue, totalPaid, outstanding, totalCosts, totalBirdsSold),
      salesCount: totals._count._all,
      avgPricePerBird: totalBirdsSold ? totalRevenue / totalBirdsSold : 0,
      paymentBreakdown,
      topCustomers: topCustomers.map((row: any) => ({
        customerName: row.customerName,
        totalAmount: row._sum.totalAmountZmw ? Number(row._sum.totalAmountZmw) : 0,
        saleCount: row._count._all,
      })),
      dailySales: Object.entries(dailySales).map(([date, data]) => ({ date, ...data })),
    };
  });

  // GET /?flockId=... (optional — returns all user's sales if no flockId)
  // Supports the same filter params as /all plus pagination.
  app.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    reply.header('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');
    const query = FilterQuerySchema.extend({
      limit: z.coerce.number().int().min(1).max(100).default(50),
      offset: z.coerce.number().int().min(0).default(0),
      sortBy: z.enum(['saleDate', 'customerName', 'birdCount', 'pricePerBirdZmw', 'totalAmountZmw', 'paymentStatus']).optional(),
      sortDir: z.enum(['asc', 'desc']).optional(),
    }).parse(request.query);

    const where = buildFilterWhere(prisma, organizationId, query);

    if (query.flockId) {
      const flock = await prisma.broilerFlock.findFirst({
        where: { id: query.flockId, organizationId },
      });
      if (!flock) return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    const sortBy = query.sortBy ?? 'saleDate';
    const sortDir = query.sortDir ?? 'desc';

    const [records, total] = await Promise.all([
      prisma.saleRecord.findMany({
        where,
        include: query.flockId ? PAYMENT_INCLUDE : { flock: { select: { name: true, breed: { select: { name: true } } } }, ...PAYMENT_INCLUDE },
        orderBy: { [sortBy]: sortDir },
        take: query.limit,
        skip: query.offset,
      }),
      prisma.saleRecord.count({ where }),
    ]);

    return {
      data: records.map(serializeSaleRecord),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  });

  // GET /:id
  app.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const organizationId = getOrganizationId(request);

    const record = await prisma.saleRecord.findFirst({
      where: { id },
      include: { flock: true, documents: { orderBy: { createdAt: 'desc' } }, ...PAYMENT_INCLUDE },
    });
    if (!record || record.flock.organizationId !== organizationId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    // Strip sensitive fields from documents
    const { _flock, documents, ...safe } = record;
    return {
      ...serializeSaleRecord(safe),
      documents: documents.map((doc: any) => {
        const { filePath: _filePath, storageKey: _storageKey, contentText: _contentText, ...docSafe } = doc;
        return { ...docSafe, downloadUrl: `/api/v1/documents/${doc.id}/download` };
      }),
    };
  });

  // GET /summary?flockId=... (optional — returns global summary if no flockId)
  // Supports the same filter params as /all.
  app.get('/summary', { preHandler: [authenticate] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    reply.header('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    const query = FilterQuerySchema.parse(request.query);

    if (query.flockId) {
      const flock = await prisma.broilerFlock.findFirst({
        where: { id: query.flockId, organizationId },
      });
      if (!flock) return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    const where = buildFilterWhere(prisma, organizationId, query);

    const birdSum = await prisma.saleRecord.aggregate({
      where,
      _sum: { birdCount: true, totalAmountZmw: true, amountPaidZmw: true },
    });

    const salesCount = await prisma.saleRecord.count({ where });

    // Derive payment breakdown at read time from monetary values — the
    // persisted paymentStatus column can go stale vs amountPaidZmw.
    const breakdownRecords = await prisma.saleRecord.findMany({
      where,
      select: { paymentStatus: true, totalAmountZmw: true, amountPaidZmw: true },
    });
    const paymentBreakdown = aggregatePaymentBreakdown(breakdownRecords);

    const totalBirdsSold = birdSum._sum.birdCount ?? 0;
    const totalRevenue = birdSum._sum.totalAmountZmw
      ? Number(birdSum._sum.totalAmountZmw)
      : 0;
    const totalPaid = birdSum._sum.amountPaidZmw
      ? Number(birdSum._sum.amountPaidZmw)
      : 0;
    const outstanding = new Decimal(totalRevenue).minus(totalPaid).toNumber();

    // Same cost/profit scope as /dashboard — flocks behind the filtered sales.
    const scopeFlocks = query.flockId
      ? [query.flockId]
      : (await prisma.saleRecord.findMany({ where, select: { flockId: true }, distinct: ['flockId'] })).map((r: any) => r.flockId);
    const totalCosts = await computeCostTotals(prisma, scopeFlocks, query);

    return {
      totalBirdsSold,
      totalRevenue,
      totalPaid,
      outstanding,
      ...profitFields(totalRevenue, totalPaid, outstanding, totalCosts, totalBirdsSold),
      salesCount,
      paymentBreakdown,
    };
  });

  // POST /
  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager', 'sales_person'), flockLock] }, async (request, reply) => {
    const { flockId, ...data } = SaleRecordCreateSchema.parse(request.body);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, organizationId },
    });
    if (!flock) return reply.status(404).send({ error: 'NOT_FOUND' });

    // Validate payment rules
    const validationError = validatePaymentRules(data);
    if (validationError) {
      return reply.status(422).send({ error: 'VALIDATION_ERROR', message: validationError });
    }

    // Enforce payment consistency
    const paymentOverrides = enforcePaymentRules(data);
    const finalData = { ...data, ...paymentOverrides };

    const description = `Sale: ${finalData.birdCount} birds${finalData.customerName ? ' to ' + finalData.customerName : ''}`;

    // Create the linked FinancialRecord first so we can store its id in the SaleRecord notes.
    const financialRecord = await prisma.financialRecord.create({
      data: {
        flockId,
        recordDate: new Date(finalData.saleDate),
        category: 'sales',
        description,
        amountZmw: finalData.totalAmountZmw,
        isIncome: true,
      },
    });

    const notesPrefix = `[FR:${financialRecord.id}]`;
    const originalNotes = finalData.notes ? ` ${finalData.notes}` : '';

    const { initialPaymentMethod, ...createData } = finalData as any;
    const created = await prisma.saleRecord.create({
      data: {
        ...createData,
        saleDate: new Date(createData.saleDate),
        flockId,
        amountPaidZmw: createData.amountPaidZmw ?? null,
        notes: `${notesPrefix}${originalNotes}`,
        createdBy: _authUser.userId,
        organizationId,
      },
    });

    // Record an initial payment row when an amount paid was supplied.
    // The sale's own journal entry already puts this into Cash, so the
    // payment row itself gets no separate posting (journalEntryId = null).
    const initialPaid = Number(created.amountPaidZmw ?? 0);
    if (initialPaid > 0) {
      await prisma.salePayment.create({
        data: {
          saleRecordId: created.id,
          organizationId,
          amountZmw: initialPaid,
          paidAt: created.saleDate,
          method: initialPaymentMethod ?? 'cash',
          note: 'Recorded with sale',
          createdBy: _authUser.userId,
        },
      });
    }

    // Post the sale to the journal: Dr Cash (paid) + Dr AR (unpaid) / Cr Bird Sales.
    try {
      await autoPost.postSale(created.id, _authUser.userId);
    } catch (e) {
      request.log.error(e, 'sale journal post failed');
    }

    // Decrement flock currentCount by birdCount sold
    await prisma.broilerFlock.update({
      where: { id: flockId },
      data: { currentCount: { decrement: finalData.birdCount } },
    });

    await audit.log({
      organizationId,
      userId: _authUser.userId,
      impersonatedByStaffId: _authUser.impersonation?.staffId,
      entityType: 'SaleRecord',
      entityId: created.id,
      action: 'create',
      newState: created,
      ipAddress: request.ip,
    });

    return serializeSaleRecord({ ...created, _count: { payments: initialPaid > 0 ? 1 : 0 } });
  });

  // PATCH /:id
  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager', 'sales_person')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = SaleRecordUpdateSchema.parse(request.body);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const record = await prisma.saleRecord.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.organizationId !== organizationId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    // Direct amountPaidZmw edits are owner-only manual corrections: the delta
    // is logged as a signed 'adjustment' payment row with its own journal.
    const currentPaid = Number(record.amountPaidZmw ?? 0);
    const manualPaidCorrection = data.amountPaidZmw !== undefined && data.amountPaidZmw !== currentPaid;
    if (manualPaidCorrection && _authUser.role !== 'owner') {
      return reply.status(403).send({ error: 'PAYMENT_EDIT_OWNER_ONLY', message: 'Only an owner can correct the amount paid directly — use Record Payment instead.' });
    }

    // When the field is a manual correction, remove it from the normal
    // validation/enforcement path — the adjustment mechanism owns it.
    const validationData = manualPaidCorrection ? { ...data, amountPaidZmw: undefined, paymentStatus: undefined } : data;
    const validationError = validatePaymentRules(validationData, Number(record.totalAmountZmw), record.paymentStatus);
    if (validationError) {
      return reply.status(422).send({ error: 'VALIDATION_ERROR', message: validationError });
    }

    // Enforce payment consistency
    const paymentOverrides = manualPaidCorrection ? {} : enforcePaymentRules(data, Number(record.totalAmountZmw), record.paymentStatus);

    // Preserve the [FR:<id>] prefix in notes — clients may strip it for
    // display, so re-prepend it on update to keep the FinancialRecord link.
    const updateData: any = {
      ...data,
      ...paymentOverrides,
      saleDate: data.saleDate ? new Date(data.saleDate) : undefined,
    };
    if (data.notes !== undefined) {
      const existingFrId = parseFinancialRecordId(record.notes);
      updateData.notes = existingFrId
        ? `[FR:${existingFrId}]${data.notes ? ' ' + data.notes : ''}`
        : data.notes;
    }

    if (manualPaidCorrection) {
      delete updateData.amountPaidZmw;
      delete updateData.paymentStatus;
    }

    const updated = await prisma.saleRecord.update({
      where: { id },
      data: updateData,
    });

    // Log the manual correction as an adjustment payment (signed delta).
    if (manualPaidCorrection) {
      const delta = data.amountPaidZmw! - currentPaid;
      const adj = await prisma.salePayment.create({
        data: {
          saleRecordId: id,
          organizationId,
          amountZmw: delta,
          paidAt: new Date(),
          method: 'adjustment',
          note: 'Manual correction',
          createdBy: _authUser.userId,
        },
      });
      try {
        const journalId = await autoPost.postSalePaymentJournal({
          paymentId: adj.id,
          amount: delta,
          paidAt: adj.paidAt,
          description: `Adjustment: ${record.customerName ?? 'customer'} — sale ${record.saleDate.toISOString().split('T')[0]}`,
          flockId: record.flockId,
          organizationId,
          postedBy: _authUser.userId,
        });
        if (journalId) {
          await prisma.salePayment.update({ where: { id: adj.id }, data: { journalEntryId: journalId } });
        }
      } catch (e) {
        request.log.error({ err: e, paymentId: adj.id }, 'adjustment journal post failed');
      }
      await recomputeSaleTotals(id);
    }

    // If the sale total changed and the sale is already posted, reverse and
    // re-post with the new paid/unpaid split.
    if (data.totalAmountZmw !== undefined && record.journalEntryId) {
      try {
        await journalEngine.reverse(record.journalEntryId, _authUser.userId, 'Sale total changed');
        await autoPost.postSale(id, _authUser.userId);
      } catch (e) {
        request.log.error(e, 'sale journal re-post failed');
      }
    }

    // If birdCount changed, adjust the flock's currentCount by the delta.
    // Enforce the flock-completed lock for non-owners when birdCount changes.
    if (data.birdCount !== undefined && data.birdCount !== record.birdCount) {
      if (assertFlockNotCompleted(reply, record.flock.status, (request as any).authUser?.role)) return;
      const delta = record.birdCount - data.birdCount; // positive = birds returned to flock
      await prisma.broilerFlock.update({
        where: { id: record.flockId },
        data: { currentCount: { increment: delta } },
      });
    }

    // Update the linked FinancialRecord if amount or date changed.
    const financialRecordId = parseFinancialRecordId(record.notes);
    if (financialRecordId && (data.totalAmountZmw !== undefined || data.saleDate !== undefined)) {
      const frUpdate: any = {};
      if (data.totalAmountZmw !== undefined) frUpdate.amountZmw = data.totalAmountZmw;
      if (data.saleDate !== undefined) frUpdate.recordDate = new Date(data.saleDate);

      // Update description-relevant fields if present.
      if (data.birdCount !== undefined || data.customerName !== undefined) {
        const birdCount = data.birdCount ?? record.birdCount;
        const customerName = data.customerName !== undefined ? data.customerName : record.customerName;
        frUpdate.description = `Sale: ${birdCount} birds${customerName ? ' to ' + customerName : ''}`;
      }

      try {
        await prisma.financialRecord.update({
          where: { id: financialRecordId },
          data: frUpdate,
        });
      } catch {
        // Linked FinancialRecord may have been deleted; ignore.
      }
    }

    await audit.log({
      organizationId,
      userId: _authUser.userId,
      impersonatedByStaffId: _authUser.impersonation?.staffId,
      entityType: 'SaleRecord',
      entityId: id,
      action: 'update',
      previousState: record,
      newState: updated,
      ipAddress: request.ip,
    });

    const refreshed = await prisma.saleRecord.findUnique({ where: { id }, include: PAYMENT_INCLUDE });
    return serializeSaleRecord(refreshed ?? updated);
  });

  // DELETE /:id
  app.delete('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const _authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const record = await prisma.saleRecord.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.organizationId !== organizationId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    if (assertFlockNotCompleted(reply, record.flock.status, (request as any).authUser?.role)) return;

    // Reverse every journal posting tied to this sale (the sale's own entry
    // plus each payment/adjustment entry) before the rows cascade away.
    const paymentsWithJournals = await prisma.salePayment.findMany({
      where: { saleRecordId: id, journalEntryId: { not: null } },
    });
    for (const p of paymentsWithJournals) {
      await journalEngine.reverse(p.journalEntryId!, _authUser.userId, 'Sale deleted');
    }
    if (record.journalEntryId) {
      await journalEngine.reverse(record.journalEntryId, _authUser.userId, 'Sale deleted');
    }

    // Delete the linked FinancialRecord first, if present.
    const financialRecordId = parseFinancialRecordId(record.notes);
    if (financialRecordId) {
      try {
        await prisma.financialRecord.delete({ where: { id: financialRecordId } });
      } catch {
        // Linked FinancialRecord may already be gone; ignore.
      }
    }

    await prisma.saleRecord.delete({ where: { id } });

    // Restore flock currentCount by birdCount that was sold
    await prisma.broilerFlock.update({
      where: { id: record.flockId },
      data: { currentCount: { increment: record.birdCount } },
    });

    await audit.log({
      organizationId,
      userId: _authUser.userId,
      impersonatedByStaffId: _authUser.impersonation?.staffId,
      entityType: 'SaleRecord',
      entityId: id,
      action: 'delete',
      previousState: record,
      ipAddress: request.ip,
    });

    return { deleted: true };
  });
}
