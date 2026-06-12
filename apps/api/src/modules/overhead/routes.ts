import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';

const OverheadCreateSchema = z.object({
  batchId: z.string().uuid(),
  category: z.enum([
    'medication', 'vaccination', 'labour', 'electricity',
    'water', 'litter', 'transport_to_market', 'other',
  ]),
  description: z.string().optional(),
  amountZmw: z.coerce.number().positive(),
  isProjected: z.boolean().default(true),
  notes: z.string().optional(),
});

const MortalityCreateSchema = z.object({
  batchId: z.string().uuid(),
  recordedAt: z.string().datetime().optional(),
  dayOfCycle: z.number().int().optional(),
  birdsLost: z.number().int().min(0),
  cause: z.string().optional(),
  notes: z.string().optional(),
});

export async function buildOverheadModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // ── Overhead Costs ─────────────────────
  app.get('/costs', { preHandler: [authenticate] }, async (request) => {
    const query = z.object({ batchId: z.string().uuid().optional() }).parse(request.query);
    return prisma.overheadCost.findMany({
      where: query.batchId ? { batchId: query.batchId } : undefined,
      orderBy: { recordedAt: 'desc' },
    });
  });

  app.post('/costs', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const data = OverheadCreateSchema.parse(request.body);
    return prisma.overheadCost.create({ data });
  });

  app.delete('/costs/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await prisma.overheadCost.delete({ where: { id } });
    return { deleted: true };
  });

  // ── Exchange Rates ────────────────────
  app.get('/exchange-rates', { preHandler: [authenticate] }, async () => {
    return prisma.exchangeRate.findMany({ orderBy: { effectiveDate: 'desc' } });
  });

  app.post('/exchange-rates', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const data = z.object({
      currencyFrom: z.string().length(3).default('USD'),
      currencyTo: z.string().length(3).default('ZMW'),
      rate: z.coerce.number().positive(),
      effectiveDate: z.string().date(),
      source: z.string().optional(),
    }).parse(request.body);
    return prisma.exchangeRate.create({ data });
  });

  // ── Mortality Records ─────────────────
  app.get('/mortality', { preHandler: [authenticate] }, async (request) => {
    const query = z.object({ batchId: z.string().uuid().optional() }).parse(request.query);
    return prisma.mortalityRecord.findMany({
      where: query.batchId ? { batchId: query.batchId } : undefined,
      orderBy: { recordedAt: 'desc' },
    });
  });

  app.post('/mortality', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const data = MortalityCreateSchema.parse(request.body);
    const recordedAt = data.recordedAt ? new Date(data.recordedAt) : new Date();
    return prisma.mortalityRecord.create({
      data: { ...data, recordedAt },
    });
  });

  app.delete('/mortality/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await prisma.mortalityRecord.delete({ where: { id } });
    return { deleted: true };
  });
}

