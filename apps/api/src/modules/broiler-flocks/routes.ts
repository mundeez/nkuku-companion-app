import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';

const dateOrIso = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

const FlockCreateSchema = z.object({
  name: z.string().min(1).max(100),
  breedId: z.string().uuid(),
  supplierId: z.string().uuid().optional(),
  startDate: dateOrIso,
  initialCount: z.number().int().min(1),
  targetWeight: z.number().positive().optional(),
  targetAge: z.number().int().positive().optional(),
  feedTransitionDay: z.number().int().min(1).max(21).optional(),
  chickPriceZmw: z.number().nonnegative().optional(),
  chicksCollected: z.boolean().optional(),
  collectionDate: dateOrIso.nullable().optional(),
  chickQualityNotes: z.string().max(500).optional().nullable(),
});

const FlockUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  breedId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional().nullable(),
  targetWeight: z.number().positive().optional(),
  targetAge: z.number().int().positive().optional(),
  feedTransitionDay: z.number().int().min(1).max(21).optional(),
  chickPriceZmw: z.number().nonnegative().optional().nullable(),
  chicksCollected: z.boolean().optional(),
  collectionDate: dateOrIso.nullable().optional(),
  chickQualityNotes: z.string().max(500).optional().nullable(),
  status: z.enum(['active', 'sold', 'completed', 'cancelled']).optional(),
  salePriceZmw: z.number().nonnegative().optional().nullable(),
  soldDate: dateOrIso.nullable().optional(),
  currentCount: z.number().int().min(0).optional(),
});

export async function buildBroilerFlockModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const authUser = (request as any).authUser;
    const query = z.object({
      status: z.enum(['active', 'completed', 'cancelled']).optional(),
      breedId: z.string().uuid().optional(),
    }).parse(request.query);

    const where: any = { createdBy: authUser.userId };
    if (query.status) where.status = query.status;
    if (query.breedId) where.breedId = query.breedId;

    return prisma.broilerFlock.findMany({
      where,
      include: { breed: true, supplier: { select: { id: true, name: true, contact: true, chickenType: true, feedStages: true } } },
      orderBy: { startDate: 'desc' },
    });
  });

  app.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const authUser = (request as any).authUser;
    const flock = await prisma.broilerFlock.findFirst({
      where: { id, createdBy: authUser.userId },
      include: {
        breed: { include: { performanceTargets: { orderBy: { ageDays: 'asc' } } } },
        supplier: { select: { id: true, name: true, contact: true, chickenType: true, feedStages: true } },
        growthRecords: { orderBy: { recordDate: 'desc' }, take: 1 },
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
    return flock;
  });

  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const data = FlockCreateSchema.parse(request.body);
    const authUser = (request as any).authUser;
    const startDate = new Date(data.startDate);
    const collectionDate = data.collectionDate ? new Date(data.collectionDate) : null;

    const flock = await prisma.broilerFlock.create({
      data: {
        name: data.name,
        breedId: data.breedId,
        supplierId: data.supplierId,
        startDate,
        initialCount: data.initialCount,
        currentCount: data.initialCount,
        targetWeight: data.targetWeight,
        targetAge: data.targetAge,
        feedTransitionDay: data.feedTransitionDay ?? 11,
        chickPriceZmw: data.chickPriceZmw,
        chicksCollected: data.chicksCollected ?? false,
        collectionDate,
        chickQualityNotes: data.chickQualityNotes,
        createdBy: authUser.userId,
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
          recordDate: startDate,
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
    const authUser = (request as any).authUser;

    const updateData: any = { ...raw };
    if (raw.collectionDate) updateData.collectionDate = new Date(raw.collectionDate);
    if (raw.collectionDate === null) updateData.collectionDate = null;
    if (raw.chickQualityNotes === '') updateData.chickQualityNotes = null;

    const existing = await prisma.broilerFlock.findFirst({
      where: { id, createdBy: authUser.userId },
    });
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' });

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
    const authUser = (request as any).authUser;
    const result = await prisma.broilerFlock.deleteMany({
      where: { id, createdBy: authUser.userId },
    });
    if (result.count === 0) return reply.status(404).send({ error: 'NOT_FOUND' });
    return { deleted: true };
  });

  // GET /api/v1/broiler-flocks/:id/dashboard - Dashboard data
  app.get('/:id/dashboard', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const authUser = (request as any).authUser;
    const flock = await prisma.broilerFlock.findFirst({
      where: { id, createdBy: authUser.userId },
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

    // Calculate current age in days
    const today = new Date();
    const startDate = new Date(flock.startDate);
    const ageDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Get target weight for current age
    const target = await prisma.performanceTarget.findUnique({
      where: { breedId_ageDays: { breedId: flock.breedId, ageDays } },
    });

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

  // GET /api/v1/broiler-flocks/:id/timeline - Hatch-to-market event timeline
  app.get('/:id/timeline', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const authUser = (request as any).authUser;
    const flock = await prisma.broilerFlock.findFirst({
      where: { id, createdBy: authUser.userId },
      include: { breed: true },
    });
    if (!flock) return reply.status(404).send({ error: 'NOT_FOUND' });

    const startDate = new Date(flock.startDate);
    const targetAge = flock.targetAge || 42;
    const feedTransitionDay = flock.feedTransitionDay || 11;
    const finisherDay = 25;
    const today = new Date();
    const ageDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const scheduleName = flock.breed?.name === 'Ross 308' ? 'Ross 308 Zambia Schedule' : 'Standard Broiler Schedule';
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
    for (const item of schedule?.items.filter(i => i.ageDays === 1) || []) {
      const date = new Date(startDate.getTime() + 1 * 24 * 60 * 60 * 1000);
      const completed = completedVaccines.some(v => v.vaccineName === item.vaccineName && Math.abs(v.ageDays - 1) <= 1);
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
    for (const item of schedule?.items.filter(i => i.ageDays > 1) || []) {
      const date = new Date(startDate.getTime() + item.ageDays * 24 * 60 * 60 * 1000);
      const completed = completedVaccines.some(v => v.vaccineName === item.vaccineName && Math.abs(v.ageDays - item.ageDays) <= 1);
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
    const authUser = (request as any).authUser;
    const flock = await prisma.broilerFlock.findFirst({
      where: { id, createdBy: authUser.userId },
      include: { breed: true },
    });
    if (!flock) return reply.status(404).send({ error: 'NOT_FOUND' });

    const startDate = new Date(flock.startDate);
    const targetAge = flock.targetAge || 42;
    const today = new Date();
    const ageDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const scheduleName = flock.breed?.name === 'Ross 308' ? 'Ross 308 Zambia Schedule' : 'Standard Broiler Schedule';
    const schedule = await prisma.vaccinationSchedule.findFirst({
      where: { name: scheduleName },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    const completedVaccines = await prisma.vaccinationEvent.findMany({
      where: { flockId: id },
      orderBy: { adminDate: 'asc' },
    });

    const days = [];
    for (let d = 0; d <= targetAge; d++) {
      const date = new Date(startDate.getTime() + d * 24 * 60 * 60 * 1000);
      const vaccines = (schedule?.items.filter(i => i.ageDays === d) || []).map(item => ({
        ...item,
        completed: completedVaccines.some(v => v.vaccineName === item.vaccineName && Math.abs(v.ageDays - d) <= 1),
      }));

      const feedPhase = d < (flock.feedTransitionDay || 11) ? 'Starter' : d < 25 ? 'Grower' : 'Finisher';
      const managementTasks = [
        'Check temperature & humidity 2x daily',
        'Record mortality and culls',
        'Monitor feed and water consumption',
        'Inspect litter quality',
      ];
      if (d > 0 && d % 7 === 0) managementTasks.push('Weekly weight sample');
      if (d === (flock.feedTransitionDay || 11)) managementTasks.push('Feed transition: Starter to Grower');
      if (d === 25) managementTasks.push('Feed transition: Grower to Finisher');

      const healthSupport = d === 0
        ? 'Electrolytes + vitamins in water for first 3-5 days; probiotics recommended'
        : d === 1
          ? 'Stress pack after transport and vaccination; monitor for dehydration'
          : d === 10
            ? 'Post-vaccination support: electrolytes/vitamins; watch respiratory signs'
            : d === 14
              ? 'Post-IBD vaccine support; monitor bursal reaction; maintain gut health'
              : 'Monitor; vitamins/electrolytes if stress or heat';

      days.push({
        day: d,
        age: `Day ${d}`,
        date: date.toISOString().split('T')[0],
        vaccines,
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
    const authUser = (request as any).authUser;
    const flock = await prisma.broilerFlock.findFirst({
      where: { id, createdBy: authUser.userId },
      include: { breed: true },
    });
    if (!flock) return reply.status(404).send({ error: 'NOT_FOUND' });

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
