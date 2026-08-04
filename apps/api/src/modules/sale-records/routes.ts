import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { authenticate, requireRole } from '../auth/routes.js';
import { AuditService } from '../../core/financial-engine/audit.service.js';

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

export async function buildSaleRecordModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  const audit = new AuditService(prisma);

  // GET /all — list all sale records for the user (for sales dashboard)
  app.get('/all', { preHandler: [authenticate] }, async (request) => {
    const authUser = (request as any).authUser;
    const query = z.object({
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      paymentStatus: z.enum(['pending', 'partial', 'paid']).optional(),
    }).parse(request.query);

    const where: any = { flock: { createdBy: authUser.userId } };
    if (query.fromDate) where.saleDate = { gte: new Date(query.fromDate) };
    if (query.toDate) where.saleDate = { ...where.saleDate, lte: new Date(query.toDate) };
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus;

    return prisma.saleRecord.findMany({
      where,
      include: { flock: { select: { name: true, breed: { select: { name: true } } } } },
      orderBy: { saleDate: 'desc' },
    });
  });

  // GET /dashboard — global sales summary for the sales dashboard
  app.get('/dashboard', { preHandler: [authenticate] }, async (request) => {
    const authUser = (request as any).authUser;
    const query = z.object({
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
    }).parse(request.query);

    const where: any = { flock: { createdBy: authUser.userId } };
    if (query.fromDate) where.saleDate = { gte: new Date(query.fromDate) };
    if (query.toDate) where.saleDate = { ...where.saleDate, lte: new Date(query.toDate) };

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

    // Daily sales for charting (last 30 days by default)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentSales = await prisma.saleRecord.findMany({
      where: { ...where, saleDate: { gte: thirtyDaysAgo } },
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
  app.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const { flockId } = z.object({ flockId: z.string().uuid().optional() }).parse(request.query);
    const authUser = (request as any).authUser;

    if (flockId) {
      const flock = await prisma.broilerFlock.findFirst({
        where: { id: flockId, createdBy: authUser.userId },
      });
      if (!flock) return reply.status(404).send({ error: 'NOT_FOUND' });

      return prisma.saleRecord.findMany({
        where: { flockId },
        orderBy: { saleDate: 'desc' },
      });
    }

    // No flockId — return all sales for the user
    return prisma.saleRecord.findMany({
      where: { flock: { createdBy: authUser.userId } },
      include: { flock: { select: { name: true, breed: { select: { name: true } } } } },
      orderBy: { saleDate: 'desc' },
    });
  });

  // GET /:id
  app.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const authUser = (request as any).authUser;

    const record = await prisma.saleRecord.findFirst({
      where: { id },
      include: { flock: true, documents: { orderBy: { createdAt: 'desc' } } },
    });
    if (!record || record.flock.createdBy !== authUser.userId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    // Strip sensitive fields from documents
    const { flock, documents, ...safe } = record;
    return {
      ...safe,
      documents: documents.map((doc: any) => {
        const { filePath, storageKey, contentText, ...docSafe } = doc;
        return { ...docSafe, downloadUrl: `/api/v1/documents/${doc.id}/download` };
      }),
    };
  });

  // GET /summary?flockId=... (optional — returns global summary if no flockId)
  app.get('/summary', { preHandler: [authenticate] }, async (request, reply) => {
    const { flockId } = z.object({ flockId: z.string().uuid().optional() }).parse(request.query);
    const authUser = (request as any).authUser;

    const where = flockId
      ? { flockId }
      : { flock: { createdBy: authUser.userId } };

    if (flockId) {
      const flock = await prisma.broilerFlock.findFirst({
        where: { id: flockId, createdBy: authUser.userId },
      });
      if (!flock) return reply.status(404).send({ error: 'NOT_FOUND' });
    }

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
  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager', 'sales_person')] }, async (request, reply) => {
    const { flockId, ...data } = SaleRecordCreateSchema.parse(request.body);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
    });
    if (!flock) return reply.status(404).send({ error: 'NOT_FOUND' });

    const description = `Sale: ${data.birdCount} birds${data.customerName ? ' to ' + data.customerName : ''}`;

    // Create the linked FinancialRecord first so we can store its id in the SaleRecord notes.
    const financialRecord = await prisma.financialRecord.create({
      data: {
        flockId,
        recordDate: new Date(data.saleDate),
        category: 'sales',
        description,
        amountZmw: data.totalAmountZmw,
        isIncome: true,
      },
    });

    const notesPrefix = `[FR:${financialRecord.id}]`;
    const originalNotes = data.notes ? ` ${data.notes}` : '';

    const created = await prisma.saleRecord.create({
      data: {
        ...data,
        saleDate: new Date(data.saleDate),
        flockId,
        amountPaidZmw: data.amountPaidZmw ?? null,
        notes: `${notesPrefix}${originalNotes}`,
        createdBy: authUser.userId,
      },
    });

    // Decrement flock currentCount by birdCount sold
    await prisma.broilerFlock.update({
      where: { id: flockId },
      data: { currentCount: { decrement: data.birdCount } },
    });

    await audit.log({
      userId: authUser.userId,
      entityType: 'SaleRecord',
      entityId: created.id,
      action: 'create',
      newState: created,
      ipAddress: request.ip,
    });

    return created;
  });

  // PATCH /:id
  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager', 'sales_person')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = SaleRecordUpdateSchema.parse(request.body);
    const authUser = (request as any).authUser;

    const record = await prisma.saleRecord.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.createdBy !== authUser.userId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    const updated = await prisma.saleRecord.update({
      where: { id },
      data: {
        ...data,
        saleDate: data.saleDate ? new Date(data.saleDate) : undefined,
        amountPaidZmw: data.amountPaidZmw !== undefined ? data.amountPaidZmw : undefined,
      },
    });

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
      userId: authUser.userId,
      entityType: 'SaleRecord',
      entityId: id,
      action: 'update',
      previousState: record,
      newState: updated,
      ipAddress: request.ip,
    });

    return updated;
  });

  // DELETE /:id
  app.delete('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const authUser = (request as any).authUser;

    const record = await prisma.saleRecord.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.createdBy !== authUser.userId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
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
      userId: authUser.userId,
      entityType: 'SaleRecord',
      entityId: id,
      action: 'delete',
      previousState: record,
      ipAddress: request.ip,
    });

    return { deleted: true };
  });
}
