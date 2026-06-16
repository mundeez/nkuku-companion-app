import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';

const AlertCreateSchema = z.object({
  flockId: z.string().uuid(),
  alertType: z.enum(['temperature_adjustment', 'vaccination_due', 'feed_transition', 'weight_check', 'mortality_threshold', 'environmental', 'financial']),
  title: z.string().min(1).max(200),
  message: z.string().min(1),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export async function buildAlertModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const authUser = (request as any).authUser;
    const query = z.object({
      status: z.enum(['open', 'resolved']).optional(),
      severity: z.enum(['info', 'warning', 'critical']).optional(),
    }).parse(request.query);

    const where: any = {
      flock: { createdBy: authUser.userId },
    };

    if (query.status === 'open') where.isResolved = false;
    if (query.status === 'resolved') where.isResolved = true;
    if (query.severity) where.severity = query.severity;

    return prisma.alert.findMany({
      where,
      include: { flock: { select: { name: true } } },
      orderBy: [
        { isResolved: 'asc' },
        { dueDate: 'asc' },
      ],
    });
  });

  app.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const authUser = (request as any).authUser;

    const alert = await prisma.alert.findFirst({
      where: { id, flock: { createdBy: authUser.userId } },
      include: { flock: { select: { name: true } } },
    });
    if (!alert) return reply.status(404).send({ error: 'NOT_FOUND' });
    return alert;
  });

  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const data = AlertCreateSchema.parse(request.body);
    const authUser = (request as any).authUser;

    // Verify flock ownership
    const flock = await prisma.broilerFlock.findFirst({
      where: { id: data.flockId, createdBy: authUser.userId },
    });
    if (!flock) return { error: 'NOT_FOUND' };

    return prisma.alert.create({
      data: {
        ...data,
        dueDate: new Date(data.dueDate),
      },
    });
  });

  app.patch('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = z.object({
      isRead: z.boolean().optional(),
      isResolved: z.boolean().optional(),
    }).parse(request.body);
    const authUser = (request as any).authUser;

    const alert = await prisma.alert.findFirst({
      where: { id, flock: { createdBy: authUser.userId } },
    });
    if (!alert) return reply.status(404).send({ error: 'NOT_FOUND' });

    return prisma.alert.update({
      where: { id },
      data,
    });
  });

  // POST /api/v1/alerts/generate - Generate alerts for active flocks
  app.post('/generate', { preHandler: [authenticate] }, async (request) => {
    const authUser = (request as any).authUser;
    const today = new Date();

    const flocks = await prisma.broilerFlock.findMany({
      where: { createdBy: authUser.userId, status: 'active' },
      include: { breed: true },
    });

    const generatedAlerts = [];

    for (const flock of flocks) {
      const startDate = new Date(flock.startDate);
      const ageDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      // Temperature adjustment alert (weekly)
      if (ageDays <= 28 && ageDays % 7 === 0) {
        const temp = ageDays <= 7 ? 32 : ageDays <= 14 ? 30 : ageDays <= 21 ? 28 : 26;
        generatedAlerts.push(
          await prisma.alert.upsert({
            where: { id: `temp-${flock.id}-${ageDays}` },
            update: {},
            create: {
              flockId: flock.id,
              alertType: 'temperature_adjustment',
              title: 'Temperature Adjustment Required',
              message: `Week ${Math.ceil(ageDays / 7)}: Adjust brooder temperature to ${temp}°C`,
              severity: 'warning',
              dueDate: today,
            },
          })
        );
      }

      // Vaccination alerts
      const vaccinations = await prisma.vaccinationEvent.findMany({
        where: { flockId: flock.id },
      });
      const upcomingVaccines = await prisma.vaccinationScheduleItem.findMany({
        where: {
          schedule: { name: 'Ross 308 Comprehensive Schedule' },
          ageDays: { gt: ageDays - 2, lte: ageDays + 2 },
        },
      });

      for (const vaccine of upcomingVaccines) {
        const alreadyDone = vaccinations.some(v =>
          v.vaccineName === vaccine.vaccineName &&
          Math.abs(v.ageDays - vaccine.ageDays) <= 2
        );
        if (!alreadyDone) {
          generatedAlerts.push(
            await prisma.alert.create({
              data: {
                flockId: flock.id,
                alertType: 'vaccination_due',
                title: `Vaccination Due: ${vaccine.vaccineName}`,
                message: `Administer ${vaccine.vaccineName} via ${vaccine.adminMethod} at day ${vaccine.ageDays}`,
                severity: 'critical',
                dueDate: new Date(startDate.getTime() + vaccine.ageDays * 24 * 60 * 60 * 1000),
              },
            })
          );
        }
      }

      // Feed transition alert
      if (flock.feedTransitionDay && ageDays === flock.feedTransitionDay) {
        generatedAlerts.push(
          await prisma.alert.create({
            data: {
              flockId: flock.id,
              alertType: 'feed_transition',
              title: 'Feed Transition: Starter to Grower',
              message: `Transition flock from Starter to Grower feed (Day ${flock.feedTransitionDay})`,
              severity: 'warning',
              dueDate: today,
            },
          })
        );
      }
    }

    return { generated: generatedAlerts.length, alerts: generatedAlerts };
  });
}
