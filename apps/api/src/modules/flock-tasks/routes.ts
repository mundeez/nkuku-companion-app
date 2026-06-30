import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';

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

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: query.flockId, createdBy: authUser.userId },
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

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
      include: { breed: true },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    const startDate = new Date(flock.startDate);
    const targetAge = flock.targetAge || 42;
    const feedTransitionDay = flock.feedTransitionDay || 11;
    const finisherDay = 25; // configurable default for Ross 308

    const scheduleName = flock.breed?.name === 'Ross 308' ? 'Ross 308 Zambia Schedule' : 'Standard Broiler Schedule';
    const schedule = await prisma.vaccinationSchedule.findFirst({
      where: { name: scheduleName },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    const generatedTasks = [];

    for (let ageDays = 0; ageDays <= targetAge; ageDays++) {
      const taskDate = new Date(startDate.getTime() + ageDays * 24 * 60 * 60 * 1000);
      const dateStr = taskDate.toISOString().split('T')[0];

      // Daily routine tasks
      const routineTasks = [
        { category: 'environment', title: 'Check temperature and humidity 2x daily', description: 'Record morning and evening readings.' },
        { category: 'management', title: 'Record mortality and culls', description: 'Count dead birds and note cause if known.' },
        { category: 'management', title: 'Monitor feed and water consumption', description: 'Compare to expected daily targets.' },
        { category: 'environment', title: 'Inspect litter quality', description: 'Check for wet spots, caking, and ammonia.' },
      ];

      for (const task of routineTasks) {
        const existing = await prisma.flockTask.findFirst({
          where: {
            flockId,
            taskDate: { gte: new Date(dateStr), lt: new Date(taskDate.getTime() + 24 * 60 * 60 * 1000) },
            title: task.title,
          },
        });
        if (!existing) {
          generatedTasks.push(
            await prisma.flockTask.create({
              data: {
                flockId,
                taskDate: new Date(dateStr),
                ageDays,
                category: task.category as any,
                title: task.title,
                description: task.description,
              },
            })
          );
        }
      }

      // Weekly weight check (day 7, 14, 21, 28, 35, 42)
      if (ageDays > 0 && ageDays % 7 === 0) {
        const existing = await prisma.flockTask.findFirst({
          where: {
            flockId,
            taskDate: { gte: new Date(dateStr), lt: new Date(taskDate.getTime() + 24 * 60 * 60 * 1000) },
            title: 'Weekly weight sample',
          },
        });
        if (!existing) {
          generatedTasks.push(
            await prisma.flockTask.create({
              data: {
                flockId,
                taskDate: new Date(dateStr),
                ageDays,
                category: 'health',
                title: 'Weekly weight sample',
                description: `Weigh a representative sample and compare to ${flock.breed?.name || 'breed'} target.`,
              },
            })
          );
        }
      }

      // Feed transitions
      if (ageDays === feedTransitionDay) {
        const existing = await prisma.flockTask.findFirst({
          where: {
            flockId,
            taskDate: { gte: new Date(dateStr), lt: new Date(taskDate.getTime() + 24 * 60 * 60 * 1000) },
            title: 'Feed transition: Starter to Grower',
          },
        });
        if (!existing) {
          generatedTasks.push(
            await prisma.flockTask.create({
              data: {
                flockId,
                taskDate: new Date(dateStr),
                ageDays,
                category: 'feed',
                title: 'Feed transition: Starter to Grower',
                description: 'Transition gradually over 3 days.',
              },
            })
          );
        }
      }
      if (ageDays === finisherDay) {
        const existing = await prisma.flockTask.findFirst({
          where: {
            flockId,
            taskDate: { gte: new Date(dateStr), lt: new Date(taskDate.getTime() + 24 * 60 * 60 * 1000) },
            title: 'Feed transition: Grower to Finisher',
          },
        });
        if (!existing) {
          generatedTasks.push(
            await prisma.flockTask.create({
              data: {
                flockId,
                taskDate: new Date(dateStr),
                ageDays,
                category: 'feed',
                title: 'Feed transition: Grower to Finisher',
                description: 'Adjust feed to market target.',
              },
            })
          );
        }
      }

      // Vaccination tasks from schedule
      for (const item of schedule?.items || []) {
        if (item.ageDays === ageDays) {
          const existing = await prisma.flockTask.findFirst({
            where: {
              flockId,
              taskDate: { gte: new Date(dateStr), lt: new Date(taskDate.getTime() + 24 * 60 * 60 * 1000) },
              title: `Vaccination: ${item.vaccineName}`,
            },
          });
          if (!existing) {
            generatedTasks.push(
              await prisma.flockTask.create({
                data: {
                  flockId,
                  taskDate: new Date(dateStr),
                  ageDays,
                  category: 'vaccination',
                  title: `Vaccination: ${item.vaccineName}`,
                  description: `Administer via ${item.adminMethod}. ${item.notes || ''}`,
                },
              })
            );
          }
        }
      }
    }

    return { generated: generatedTasks.length, tasks: generatedTasks.slice(0, 20) };
  });

  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const data = FlockTaskCreateSchema.parse(request.body);
    const authUser = (request as any).authUser;

    const flock = await prisma.broilerFlock.findFirst({
      where: { id: data.flockId, createdBy: authUser.userId },
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

    const task = await prisma.flockTask.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!task || task.flock.createdBy !== authUser.userId) {
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

    const task = await prisma.flockTask.findFirst({
      where: { id },
      include: { flock: true },
    });
    if (!task || task.flock.createdBy !== authUser.userId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    await prisma.flockTask.delete({ where: { id } });
    return { deleted: true };
  });
}
