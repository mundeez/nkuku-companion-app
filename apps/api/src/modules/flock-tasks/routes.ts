import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';
import { getLightingTemperatureScheduleForFlock } from '../../core/lighting-temperature-schedule.service.js';

const dateOrIso = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

const FlockTaskCreateSchema = z.object({
  flockId: z.string().uuid(),
  taskDate: dateOrIso,
  ageDays: z.number().int().min(0),
  category: z.enum(['vaccination', 'feed', 'water', 'environment', 'health', 'biosecurity', 'management']),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
});

const FlockTaskUpdateSchema = z.object({
  isCompleted: z.boolean().optional(),
  isSkipped: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

export async function buildFlockTaskModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const query = z.object({
      flockId: z.string().uuid(),
      date: dateOrIso.optional(),
      status: z.enum(['pending', 'completed', 'skipped']).optional(),
    }).parse(request.query);
    const authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: query.flockId, organizationId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    const where: any = { flockId: query.flockId };
    if (query.date) {
      const d = new Date(query.date);
      where.taskDate = { gte: d, lt: new Date(d.getTime() + 24 * 60 * 60 * 1000) };
    }
    if (query.status === 'pending') {
      where.isCompleted = false;
      where.isSkipped = false;
    } else if (query.status === 'completed') {
      where.isCompleted = true;
    } else if (query.status === 'skipped') {
      where.isSkipped = true;
    }

    return prisma.flockTask.findMany({
      where,
      orderBy: [{ taskDate: 'asc' }, { category: 'asc' }],
    });
  });

  app.post('/generate', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const { flockId } = z.object({ flockId: z.string().uuid() }).parse(request.body);
    const authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, organizationId },
      include: { breed: true },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    // If chicks not yet collected (no startDate), no tasks to generate
    if (!flock.startDate) return { generated: 0, tasks: [] };

    const startDate = new Date(flock.startDate);
    const targetAge = flock.targetAge || 42;
    const feedTransitionDay = flock.feedTransitionDay || 11;
    const finisherDay = 25; // configurable default for Ross 308

    const scheduleName = flock.breed?.name === 'Ross 308' ? 'Ross 308 Zambia Schedule' : 'Standard Broiler Schedule';
    const schedule = await prisma.vaccinationSchedule.findFirst({
      where: { name: scheduleName },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    const envSchedule = await getLightingTemperatureScheduleForFlock(prisma, flock, authUser.userId);

    // Fetch all existing tasks for this flock in a single query and index them
    // by `${dateStr}|${title}` so we can dedupe candidate tasks in memory instead
    // of issuing a findFirst + create per candidate (the previous loop fired
    // ~300-400 sequential round-trips, which exceeded the test timeout under
    // load). createMany then inserts all missing rows in one statement.
    const existing = await prisma.flockTask.findMany({
      where: { flockId },
      select: { taskDate: true, title: true },
    });
    const existingKeys = new Set(
      existing.map((t: { taskDate: Date; title: string }) => `${t.taskDate.toISOString().split('T')[0]}|${t.title}`)
    );

    type Candidate = {
      flockId: string;
      taskDate: Date;
      ageDays: number;
      category: 'vaccination' | 'feed' | 'water' | 'environment' | 'health' | 'biosecurity' | 'management';
      title: string;
      description?: string;
    };
    const candidates: Candidate[] = [];
    const seenKeys = new Set<string>();

    function pushCandidate(ageDays: number, dayTaskDate: Date, category: Candidate['category'], title: string, description?: string) {
      const key = `${dayTaskDate.toISOString().split('T')[0]}|${title}`;
      // Dedupe within this run (mirrors the old per-create findFirst check) and
      // against tasks that already exist in the database.
      if (seenKeys.has(key) || existingKeys.has(key)) return;
      seenKeys.add(key);
      candidates.push({ flockId, taskDate: dayTaskDate, ageDays, category, title, description });
    }

    for (let ageDays = 0; ageDays <= targetAge; ageDays++) {
      const taskDate = new Date(startDate.getTime() + ageDays * 24 * 60 * 60 * 1000);
      const dateStr = taskDate.toISOString().split('T')[0];
      const dayTaskDate = new Date(dateStr);

      // Daily routine tasks
      const routineTasks = [
        { category: 'environment' as const, title: 'Check temperature and humidity 2x daily', description: 'Record morning and evening readings.' },
        { category: 'management' as const, title: 'Record mortality and culls', description: 'Count dead birds and note cause if known.' },
        { category: 'management' as const, title: 'Monitor feed and water consumption', description: 'Compare to expected daily targets.' },
        { category: 'environment' as const, title: 'Inspect litter quality', description: 'Check for wet spots, caking, and ammonia.' },
      ];
      for (const task of routineTasks) {
        pushCandidate(ageDays, dayTaskDate, task.category, task.title, task.description);
      }

      // Weekly weight check (day 7, 14, 21, 28, 35, 42)
      if (ageDays > 0 && ageDays % 7 === 0) {
        pushCandidate(ageDays, dayTaskDate, 'health', 'Weekly weight sample', `Weigh a representative sample and compare to ${flock.breed?.name || 'breed'} target.`);
      }

      // Feed transitions
      if (ageDays === feedTransitionDay) {
        pushCandidate(ageDays, dayTaskDate, 'feed', 'Feed transition: Starter to Grower', 'Transition gradually over 3 days.');
      }
      if (ageDays === finisherDay) {
        pushCandidate(ageDays, dayTaskDate, 'feed', 'Feed transition: Grower to Finisher', 'Adjust feed to market target.');
      }

      // Vaccination tasks from schedule
      for (const item of schedule?.items || []) {
        if (item.ageDays === ageDays) {
          pushCandidate(ageDays, dayTaskDate, 'vaccination', `Vaccination: ${item.vaccineName}`, `Administer via ${item.adminMethod}. ${item.notes || ''}`);
        }
      }

      // Environment/lighting/temperature tasks from schedule
      const envItem = envSchedule?.items?.find((i: any) => i.ageDays === ageDays);
      if (envItem) {
        const envTasks = [] as { title: string; description: string }[];
        const lightHours = Number(envItem.lightHours);
        const darkHours = Number(envItem.darkHours);
        if (ageDays === 0) {
          envTasks.push({
            title: 'Preheat house and prepare brooding',
            description: `Target ${envItem.targetTempC}°C, humidity ${envItem.targetRhMinPct}-${envItem.targetRhMaxPct}%, litter 28-32°C. ${lightHours}h light at ${envItem.lightIntensityLux} lux.`,
          });
        } else if (ageDays === 4 && darkHours > 1) {
          envTasks.push({
            title: 'Start light step-down',
            description: `Begin reducing light hours toward ${lightHours}h light / ${darkHours}h dark.`,
          });
        } else if (ageDays === 7) {
          envTasks.push({
            title: 'Confirm grow-out lighting programme',
            description: `Target ${lightHours}h light / ${darkHours}h dark at ${envItem.lightIntensityLux} lux.`,
          });
        } else if (ageDays >= 40 && lightHours === 23) {
          envTasks.push({
            title: 'Pre-catch lighting: 23h light',
            description: 'Return to 23 hours light for 3 days before catching.',
          });
        }

        for (const envTask of envTasks) {
          pushCandidate(ageDays, dayTaskDate, 'environment', envTask.title, envTask.description);
        }
      }
    }

    if (candidates.length > 0) {
      await prisma.flockTask.createMany({
        data: candidates.map((c) => ({
          flockId: c.flockId,
          taskDate: c.taskDate,
          ageDays: c.ageDays,
          category: c.category,
          title: c.title,
          description: c.description,
        })),
      });
    }

    // Preview of the generated tasks (shape-compatible with FlockTask). The
    // web client ignores this and refetches; the mobile client only reads
    // `generated` and refetches, so client-generated ids here are safe.
    const tasks = candidates.slice(0, 20).map((c) => ({
      id: crypto.randomUUID(),
      flockId: c.flockId,
      taskDate: c.taskDate.toISOString(),
      ageDays: c.ageDays,
      category: c.category,
      title: c.title,
      description: c.description,
      isCompleted: false,
      isSkipped: false,
    }));

    return { generated: candidates.length, tasks };
  });

  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const data = FlockTaskCreateSchema.parse(request.body);
    const authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: data.flockId, organizationId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    return prisma.flockTask.create({
      data: {
        ...data,
        taskDate: new Date(data.taskDate),
      },
    });
  });

  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = FlockTaskUpdateSchema.parse(request.body);
    const authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const task = await prisma.flockTask.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!task || task.flock.organizationId !== organizationId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    const completedAt = data.isCompleted ? new Date() : data.isCompleted === false ? null : task.completedAt;

    const updated = await prisma.flockTask.update({
      where: { id },
      data: {
        ...data,
        isCompleted: data.isCompleted !== undefined ? data.isCompleted : task.isCompleted,
        isSkipped: data.isSkipped !== undefined ? data.isSkipped : task.isSkipped,
        completedAt,
        notes: data.notes === null ? null : data.notes,
      },
    });

    return updated;
  });

  app.delete('/:id', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const authUser = (request as any).authUser;
    const organizationId = getOrganizationId(request);

    const task = await prisma.flockTask.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!task || task.flock.organizationId !== organizationId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    await prisma.flockTask.delete({ where: { id } });
    return { deleted: true };
  });
}
