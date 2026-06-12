import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/routes.js';
import { calculateBatchProjection, type FeedStageInput } from '../../core/calculation-engine/index.js';

const ProjectionCalculateSchema = z.object({
  birdCount: z.number().int().positive(),
  supplierId: z.string().uuid(),
  salesPricePerBird: z.coerce.number().positive(),
  mortalityPct: z.coerce.number().min(0).max(1).default(0.05),
  overheadCosts: z.array(z.coerce.number()).default([]),
});

export async function buildProjectionModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // POST /api/v1/projections/calculate
  // Returns a computed projection WITHOUT persisting to DB (what-if analysis)
  app.post('/calculate', { preHandler: [authenticate] }, async (request) => {
    const body = ProjectionCalculateSchema.parse(request.body);
    const supplier = await prisma.supplier.findUnique({
      where: { id: body.supplierId },
      include: { feedStages: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!supplier) return { error: 'SUPPLIER_NOT_FOUND' };

    const feedStages: FeedStageInput[] = supplier.feedStages.map((fs: any) => ({
      stageName: fs.stageName,
      stageType: fs.stageType as any,
      unitSizeKg: fs.unitSizeKg.toString(),
      unitPriceZmw: fs.unitPriceZmw.toString(),
      intakePerBirdKg: fs.intakePerBirdKg.toString(),
    }));

    const result = calculateBatchProjection(
      body.birdCount,
      feedStages,
      body.salesPricePerBird,
      body.mortalityPct,
      body.overheadCosts,
    );

    return { supplierName: supplier.name, ...result };
  });

  // POST /api/v1/projections/save
  // Persists a projection linked to a specific batch
  app.post('/save', { preHandler: [authenticate] }, async (request) => {
    const body = ProjectionCalculateSchema.extend({
      batchId: z.string().uuid(),
    }).parse(request.body);

    const { batchId, birdCount, supplierId, salesPricePerBird, mortalityPct, overheadCosts } = body;

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      include: { feedStages: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!supplier) return { error: 'SUPPLIER_NOT_FOUND' };

    const feedStages: FeedStageInput[] = supplier.feedStages.map((fs: any) => ({
      stageName: fs.stageName,
      stageType: fs.stageType as any,
      unitSizeKg: fs.unitSizeKg.toString(),
      unitPriceZmw: fs.unitPriceZmw.toString(),
      intakePerBirdKg: fs.intakePerBirdKg.toString(),
    }));

    const calc = calculateBatchProjection(
      birdCount,
      feedStages,
      salesPricePerBird,
      mortalityPct,
      overheadCosts,
    );

    const projection = await prisma.projection.create({
      data: {
        batchId,
        supplierId,
        birdCount,
        salesPricePerBird,
        mortalityPct,
        effectiveBirdCount: parseFloat(calc.effectiveBirdCount),
        totalFeedCost: parseFloat(calc.totalFeedCost),
        totalChickCost: parseFloat(calc.totalChickCost),
        totalOverheadCost: parseFloat(calc.totalOverheadCost),
        totalExpenses: parseFloat(calc.totalExpenses),
        projectedRevenue: parseFloat(calc.projectedRevenue),
        grossProfit: parseFloat(calc.grossProfit),
        netProfit: parseFloat(calc.netProfit),
      },
    });

    // Also generate batch_expenses for this projection
    for (const item of calc.breakdown) {
      if (item.itemsRoundedUp !== null) {
        await prisma.batchExpense.create({
          data: {
            batchId,
            expenseCategory: item.stageType === 'chick' ? 'chick' : 'feed',
            description: item.stageName,
            quantityItems: item.itemsRaw ? parseFloat(item.itemsRaw) : null,
            quantityRoundedUp: item.itemsRoundedUp,
            unitPriceZmw: parseFloat(item.unitPriceZmw),
            subtotalZmw: parseFloat(item.subtotalZmw),
            isProjected: true,
          },
        });
      }
    }

    return projection;
  });
}

