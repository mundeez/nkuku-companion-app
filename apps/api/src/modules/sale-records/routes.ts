import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { authenticate, requireRole } from '../auth/routes.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';
import { AuditService } from '../../core/financial-engine/audit.service.js';
import { checkFlockNotLocked, assertFlockNotCompleted } from '../broiler-flocks/check-flock-locked.js';

const SaleRecordCreateSchema = z.object({
  flockId: z.string().uuid(),
  saleDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  customerName: z.string().max(200).optional(),
  customerPhone: z.string().max(50).optional(),
  birdCount: z.number().int().positive(),
  avgWeightKg: z.number().nonnegative().optional(),
  pricePerBirdZmw: z.number().nonnegative(),
  totalAmountZmw: z.number().nonnegative(),
  paymentStatus: z.enum(['pending', 'partial', 'paid']).default('pending'),
  amountPaidZmw: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

const SaleRecordUpdateSchema = SaleRecordCreateSchema.partial().omit({ flockId: true });

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

/** Serialize a sale record for API responses — strips [FR:] prefix from notes. */
function serializeSaleRecord(record: any): any {
  return { ...record, notes: stripFrPrefix(record.notes) };
}

/** Build a Prisma `where` clause from common filter params. */
function buildFilterWhere(organizationId: string, query: {
  fromDate?: string;
  toDate?: string;
  paymentStatus?: 'pending' | 'partial' | 'paid';
  flockId?: string;
  customer?: string;
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
    where.paymentStatus = query.paymentStatus;
  }

  if (query.customer) {
    where.OR = [
      { customerName: { contains: query.customer, mode: 'insensitive' } },
      { customerPhone: { contains: query.customer, mode: 'insensitive' } },
    ];
  }

  return where;
}

/** Shared query schema for filter params. */
const FilterQuerySchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  paymentStatus: z.enum(['pending', 'partial', 'paid']).optional(),
  flockId: z.string().uuid().optional(),
  customer: z.string().max(200).optional(),
});

/** Enforce payment consistency rules on create/update data.
 *  On PATCH, if paymentStatus is not provided, the existing record's status
 *  is used so that amountPaidZmw / totalAmountZmw changes stay consistent. */
function enforcePaymentRules(
  data: { paymentStatus?: string; amountPaidZmw?: number; totalAmountZmw?: number },
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
  data: { paymentStatus?: string; amountPaidZmw?: number; totalAmountZmw?: number },
  existingTotal?: number,
  existingStatus?: string,
): string | null {
  const total = data.totalAmountZmw ?? existingTotal;
  const status = data.paymentStatus ?? existingStatus;

  if (status === 'partial') {
    const paid = data.amountPaidZmw;
    if (paid !== undefined) {
      if (paid <= 0) {
        return 'Payment status "partial" requires amountPaidZmw > 0';
      }
      if (total !== undefined && paid >= total) {
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

  // GET /all — list all sale records for the user (for sales dashboard)
  app.get('/all', { preHandler: [authenticate] }, async (request) => {
    const organizationId = getOrganizationId(request);
    const query = FilterQuerySchema.extend({
      sortBy: z.enum(['saleDate', 'flockName', 'customerName', 'birdCount', 'pricePerBirdZmw', 'totalAmountZmw', 'paymentStatus']).optional(),
      sortDir: z.enum(['asc', 'desc']).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }).parse(request.query);

    const where = buildFilterWhere(organizationId, query);

    const sortBy = query.sortBy ?? 'saleDate';
    const sortDir = query.sortDir ?? 'desc';

    // Fields that require post-fetch sorting (relation or computed fields)
    const prismaSortFields = new Set(['saleDate', 'customerName', 'birdCount', 'pricePerBirdZmw', 'totalAmountZmw', 'paymentStatus']);

    const [records, total] = await Promise.all([
      prisma.saleRecord.findMany({
        where,
        include: { flock: { select: { name: true, breed: { select: { name: true } } } } },
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
  app.get('/dashboard', { preHandler: [authenticate] }, async (request) => {
    const organizationId = getOrganizationId(request);
    const query = FilterQuerySchema.parse(request.query);

    const where = buildFilterWhere(organizationId, query);

    const totals = await prisma.saleRecord.aggregate({
      where,
      _sum: { birdCount: true, totalAmountZmw: true, amountPaidZmw: true },
      _count: { _all: true },
    });

    const paymentBreakdown = await prisma.saleRecord.groupBy({
      by: ['paymentStatus'],
      where,
      _count: { _all: true },
      _sum: { totalAmountZmw: true },
    });

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

    return {
      totalRevenue: totals._sum.totalAmountZmw ? Number(totals._sum.totalAmountZmw) : 0,
      totalBirdsSold: totals._sum.birdCount ?? 0,
      totalPaid: totals._sum.amountPaidZmw ? Number(totals._sum.amountPaidZmw) : 0,
      outstanding: (totals._sum.totalAmountZmw ? Number(totals._sum.totalAmountZmw) : 0) - (totals._sum.amountPaidZmw ? Number(totals._sum.amountPaidZmw) : 0),
      salesCount: totals._count._all,
      avgPricePerBird: totals._sum.birdCount ? Number(totals._sum.totalAmountZmw ?? 0) / totals._sum.birdCount : 0,
      paymentBreakdown: paymentBreakdown.map((row: any) => ({
        paymentStatus: row.paymentStatus,
        count: row._count._all,
        totalAmount: row._sum.totalAmountZmw ? Number(row._sum.totalAmountZmw) : 0,
      })),
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
    const query = FilterQuerySchema.extend({
      limit: z.coerce.number().int().min(1).max(100).default(50),
      offset: z.coerce.number().int().min(0).default(0),
      sortBy: z.enum(['saleDate', 'customerName', 'birdCount', 'pricePerBirdZmw', 'totalAmountZmw', 'paymentStatus']).optional(),
      sortDir: z.enum(['asc', 'desc']).optional(),
    }).parse(request.query);

    const where = buildFilterWhere(organizationId, query);

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
        include: query.flockId ? undefined : { flock: { select: { name: true, breed: { select: { name: true } } } } },
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
      include: { flock: true, documents: { orderBy: { createdAt: 'desc' } } },
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
    const query = FilterQuerySchema.parse(request.query);

    if (query.flockId) {
      const flock = await prisma.broilerFlock.findFirst({
        where: { id: query.flockId, organizationId },
      });
      if (!flock) return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    const where = buildFilterWhere(organizationId, query);

    const birdSum = await prisma.saleRecord.aggregate({
      where,
      _sum: { birdCount: true, totalAmountZmw: true, amountPaidZmw: true },
    });

    const salesCount = await prisma.saleRecord.count({ where });

    const paymentBreakdown = await prisma.saleRecord.groupBy({
      by: ['paymentStatus'],
      where,
      _count: { _all: true },
      _sum: { totalAmountZmw: true },
    });

    const totalBirdsSold = birdSum._sum.birdCount ?? 0;
    const totalRevenue = birdSum._sum.totalAmountZmw
      ? Number(birdSum._sum.totalAmountZmw)
      : 0;
    const totalPaid = birdSum._sum.amountPaidZmw
      ? Number(birdSum._sum.amountPaidZmw)
      : 0;
    const outstanding = new Decimal(totalRevenue).minus(totalPaid).toNumber();

    return {
      totalBirdsSold,
      totalRevenue,
      totalPaid,
      outstanding,
      salesCount,
      paymentBreakdown: paymentBreakdown.map((row: any) => ({
        paymentStatus: row.paymentStatus,
        count: row._count._all,
        totalAmount: row._sum.totalAmountZmw ? Number(row._sum.totalAmountZmw) : 0,
      })),
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

    const created = await prisma.saleRecord.create({
      data: {
        ...finalData,
        saleDate: new Date(finalData.saleDate),
        flockId,
        amountPaidZmw: finalData.amountPaidZmw ?? null,
        notes: `${notesPrefix}${originalNotes}`,
        createdBy: _authUser.userId,
        organizationId,
      },
    });

    // Decrement flock currentCount by birdCount sold
    await prisma.broilerFlock.update({
      where: { id: flockId },
      data: { currentCount: { decrement: finalData.birdCount } },
    });

    await audit.log({
      organizationId,
      userId: _authUser.userId,
      entityType: 'SaleRecord',
      entityId: created.id,
      action: 'create',
      newState: created,
      ipAddress: request.ip,
    });

    return serializeSaleRecord(created);
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

    // Validate payment rules (use existing total + status if not being updated)
    const validationError = validatePaymentRules(data, Number(record.totalAmountZmw), record.paymentStatus);
    if (validationError) {
      return reply.status(422).send({ error: 'VALIDATION_ERROR', message: validationError });
    }

    // Enforce payment consistency
    const paymentOverrides = enforcePaymentRules(data, Number(record.totalAmountZmw), record.paymentStatus);

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

    const updated = await prisma.saleRecord.update({
      where: { id },
      data: updateData,
    });

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
      entityType: 'SaleRecord',
      entityId: id,
      action: 'update',
      previousState: record,
      newState: updated,
      ipAddress: request.ip,
    });

    return serializeSaleRecord(updated);
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
      entityType: 'SaleRecord',
      entityId: id,
      action: 'delete',
      previousState: record,
      ipAddress: request.ip,
    });

    return { deleted: true };
  });
}
