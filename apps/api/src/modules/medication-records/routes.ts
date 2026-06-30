import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';

const dateOrIso = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

const MedicationRecordCreateSchema = z.object({
  flockId: z.string().uuid(),
  recordDate: dateOrIso,
  productName: z.string().min(1).max(100),
  category: z.enum(['antibiotic', 'coccidiostat', 'electrolyte', 'vitamin', 'probiotic', 'acidifier', 'phytogenic', 'other']),
  dose: z.string().max(100).optional(),
  route: z.string().max(50).optional(),
  startDate: dateOrIso,
  endDate: dateOrIso.optional().nullable(),
  withdrawalDays: z.number().int().min(0).optional(),
  costZmw: z.number().nonnegative().optional(),
  veterinarian: z.string().max(100).optional(),
  notes: z.string().optional(),
});

export async function buildMedicationRecordModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const { flockId } = z.object({ flockId: z.string().uuid() }).parse(request.query);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    return prisma.medicationRecord.findMany({
      where: { flockId },
      orderBy: { recordDate: 'desc' },
    });
  });

  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const data = MedicationRecordCreateSchema.parse(request.body);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: data.flockId, createdBy: authUser.userId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    const startDate = new Date(data.startDate);
    const withdrawalDate = data.withdrawalDays
      ? new Date(startDate.getTime() + data.withdrawalDays * 24 * 60 * 60 * 1000)
      : null;

    const record = await prisma.medicationRecord.create({
      data: {
        ...data,
        recordDate: new Date(data.recordDate),
        startDate,
        endDate: data.endDate ? new Date(data.endDate) : null,
        withdrawalDate,
      },
    });

    if (data.costZmw && data.costZmw > 0) {
      await prisma.financialRecord.create({
        data: {
          flockId: data.flockId,
          sourceRecordId: record.id,
          sourceTable: 'medication_records',
          recordDate: new Date(data.recordDate),
          category: 'medication',
          description: `Medication - ${data.productName} (${data.category})`,
          amountZmw: data.costZmw,
          isIncome: false,
          isSystemGenerated: true,
          notes: 'Auto-generated from medication record',
        },
      });
    }

    return record;
  });

  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = MedicationRecordCreateSchema.partial().parse(request.body);
    const authUser = (request as any).authUser;

    const record = await prisma.medicationRecord.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.createdBy !== authUser.userId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    const startDate = data.startDate ? new Date(data.startDate) : record.startDate;
    const withdrawalDate = data.withdrawalDays !== undefined
      ? data.withdrawalDays > 0
        ? new Date(startDate.getTime() + data.withdrawalDays * 24 * 60 * 60 * 1000)
        : null
      : record.withdrawalDate;

    const updated = await prisma.medicationRecord.update({
      where: { id },
      data: {
        ...data,
        recordDate: data.recordDate ? new Date(data.recordDate) : undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate !== undefined ? (data.endDate ? new Date(data.endDate) : null) : undefined,
        withdrawalDate,
      },
    });

    const finRecord = await prisma.financialRecord.findFirst({ where: { sourceRecordId: id } });
    if (data.costZmw !== undefined) {
      if (data.costZmw > 0) {
        const desc = `Medication - ${data.productName || record.productName} (${data.category || record.category})`;
        if (finRecord) {
          await prisma.financialRecord.update({
            where: { id: finRecord.id },
            data: {
              amountZmw: data.costZmw,
              description: desc,
              recordDate: data.recordDate ? new Date(data.recordDate) : finRecord.recordDate,
            },
          });
        } else {
          await prisma.financialRecord.create({
            data: {
              flockId: record.flockId,
              sourceRecordId: id,
              sourceTable: 'medication_records',
              recordDate: new Date(data.recordDate || record.recordDate),
              category: 'medication',
              description: desc,
              amountZmw: data.costZmw,
              isIncome: false,
              isSystemGenerated: true,
              notes: 'Auto-generated from medication record',
            },
          });
        }
      } else if (finRecord) {
        await prisma.financialRecord.delete({ where: { id: finRecord.id } });
      }
    }

    return updated;
  });

  app.delete('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const authUser = (request as any).authUser;

    const record = await prisma.medicationRecord.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!record || record.flock.createdBy !== authUser.userId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    const finRecord = await prisma.financialRecord.findFirst({ where: { sourceRecordId: id } });
    if (finRecord) await prisma.financialRecord.delete({ where: { id: finRecord.id } });

    await prisma.medicationRecord.delete({ where: { id } });
    return { deleted: true };
  });
}
