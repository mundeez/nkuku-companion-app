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

  // GET /?flockId=...
  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({ flockId: z.string().uuid() }).parse(request.query);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    return prisma.saleRecord.findMany({
      where: { flockId },
      orderBy: { saleDate: 'desc' },
    });
  });

  // GET /:id
  app.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const authUser = (request as any).authUser;

    const record = await prisma.saleRecord.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.createdBy !== authUser.userId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    return record;
  });

  // GET /summary?flockId=...
  app.get('/summary', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({ flockId: z.string().uuid() }).parse(request.query);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    const birdSum = await prisma.saleRecord.aggregate({
      where: { flockId },
      _sum: { birdCount: true, totalAmountZmw: true, amountPaidZmw: true },
    });

    const salesCount = await prisma.saleRecord.count({ where: { flockId } });

    const paymentBreakdown = await prisma.saleRecord.groupBy({
      by: ['paymentStatus'],
      where: { flockId },
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
      paymentBreakdown: paymentBreakdown.map((row) => ({
        paymentStatus: row.paymentStatus,
        count: row._count._all,
        totalAmount: row._sum.totalAmountZmw ? Number(row._sum.totalAmountZmw) : 0,
      })),
    };
  });

  // POST /
  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager', 'sales_person')] }, async (request) => {
    const { flockId, ...data } = SaleRecordCreateSchema.parse(request.body);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

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
