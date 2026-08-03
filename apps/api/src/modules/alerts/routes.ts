import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';
import { getLightingTemperatureScheduleForFlock } from '../../core/lighting-temperature-schedule.service.js';

function publishNtfy(topic: string, title: string, message: string, priority: 'default' | 'urgent') {
  const baseUrl = process.env.NTFY_BASE_URL || 'http://ntfy';
  fetch(`${baseUrl}/${topic}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'Title': title,
      'Priority': priority,
      'Tags': 'bell',
    },
    body: message,
  }).catch((err) => {
    // Best-effort notifications: never throw
    console.error('ntfy publish failed:', err);
  });
}

const AlertCreateSchema = z.object({
  flockId: z.string().uuid(),
  alertType: z.enum(['temperature_adjustment', 'vaccination_due', 'feed_transition', 'weight_check', 'mortality_threshold', 'environmental', 'financial', 'medication_due', 'withdrawal_due', 'vaccine_expiry', 'environmental_threshold', 'task_due']),
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

  // DELETE /:id — delete an alert (owner/manager only)
  app.delete('/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const authUser = (request as any).authUser;

    const alert = await prisma.alert.findFirst({
      where: { id, flock: { createdBy: authUser.userId } },
    });
    if (!alert) return reply.status(404).send({ error: 'NOT_FOUND' });

    await prisma.alert.delete({ where: { id } });
    return { deleted: true };
  });

  // POST /api/v1/alerts/generate - Generate alerts for active flocks
  app.post('/generate', { preHandler: [authenticate] }, async (request) => {
    const authUser = (request as any).authUser;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const flocks = await prisma.broilerFlock.findMany({
      where: { createdBy: authUser.userId, status: 'active' },
      include: { breed: true },
    });

    const generatedAlerts = [];

    for (const flock of flocks) {
      if (!flock.startDate) continue; // skip flocks not yet collected
      const startDate = new Date(flock.startDate);
      const ageDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const targetAge = flock.targetAge || 42;
      const finisherDay = flock.finisherDay || 29;

      // Temperature adjustment alert (weekly)
      if (ageDays <= 28 && ageDays % 7 === 0) {
        const temp = ageDays <= 7 ? 32 : ageDays <= 14 ? 30 : ageDays <= 21 ? 28 : 26;
        const existingTempAlert = await prisma.alert.findFirst({
          where: { flockId: flock.id, alertType: 'temperature_adjustment', dueDate: today },
        });
        if (!existingTempAlert) {
          generatedAlerts.push(
            await prisma.alert.create({
              data: {
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
      }

      // Vaccination alerts using Zambia schedule for Ross 308
      const vaccinations = await prisma.vaccinationEvent.findMany({
        where: { flockId: flock.id },
      });
      const scheduleName = flock.breed?.name === 'Ross 308' ? 'Ross 308 Comprehensive Schedule' : 'Standard Broiler Schedule';
      const upcomingVaccines = await prisma.vaccinationScheduleItem.findMany({
        where: {
          schedule: { name: scheduleName },
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

      // Feed transition alerts
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
      if (ageDays === finisherDay && finisherDay <= targetAge) {
        generatedAlerts.push(
          await prisma.alert.create({
            data: {
              flockId: flock.id,
              alertType: 'feed_transition',
              title: 'Feed Transition: Grower to Finisher',
              message: `Transition flock from Grower to Finisher feed (Day ${finisherDay})`,
              severity: 'warning',
              dueDate: today,
            },
          })
        );
      }

      // Medication withdrawal alerts
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const medications = await prisma.medicationRecord.findMany({
        where: {
          flockId: flock.id,
          withdrawalDate: { gte: today, lte: tomorrow },
        },
      });
      for (const med of medications) {
        generatedAlerts.push(
          await prisma.alert.create({
            data: {
              flockId: flock.id,
              alertType: 'withdrawal_due',
              title: `Withdrawal Due: ${med.productName}`,
              message: `Medication ${med.productName} withdrawal period ends today. Do not slaughter before ${med.withdrawalDate?.toISOString().split('T')[0]}.`,
              severity: 'critical',
              dueDate: today,
            },
          })
        );
      }

      // Environmental threshold alerts (schedule-driven)
      const latestEnv = await prisma.environmentalRecord.findFirst({
        where: { flockId: flock.id },
        orderBy: { recordDate: 'desc' },
      });
      if (latestEnv && latestEnv.recordDate.toISOString().split('T')[0] === todayStr) {
        const envSchedule = await getLightingTemperatureScheduleForFlock(prisma, flock, authUser.userId);
        const envItem = envSchedule?.items?.find((i: any) => i.ageDays === ageDays);

        if (envItem) {
          const temp = latestEnv.temperatureC ? Number(latestEnv.temperatureC) : null;
          const tempMin = envItem.targetTempMinC ? Number(envItem.targetTempMinC) : (envItem.targetTempC ? Number(envItem.targetTempC) - 2 : null);
          const tempMax = envItem.targetTempMaxC ? Number(envItem.targetTempMaxC) : (envItem.targetTempC ? Number(envItem.targetTempC) + 2 : null);
          if (temp !== null && tempMin !== null && tempMax !== null && (temp < tempMin || temp > tempMax)) {
            generatedAlerts.push(
              await prisma.alert.create({
                data: {
                  flockId: flock.id,
                  alertType: 'environmental_threshold',
                  title: 'Temperature Out of Range',
                  message: `Current temperature ${temp}°C is outside target range ${tempMin}–${tempMax}°C for day ${ageDays}.`,
                  severity: 'warning',
                  dueDate: today,
                },
              })
            );
          }

          const humidity = latestEnv.humidityPct ? Number(latestEnv.humidityPct) : null;
          const rhMin = envItem.targetRhMinPct ?? null;
          const rhMax = envItem.targetRhMaxPct ?? null;
          if (humidity !== null && rhMin !== null && rhMax !== null && (humidity < rhMin || humidity > rhMax)) {
            generatedAlerts.push(
              await prisma.alert.create({
                data: {
                  flockId: flock.id,
                  alertType: 'environmental_threshold',
                  title: 'Humidity Out of Range',
                  message: `Current humidity ${humidity}% is outside target range ${rhMin}–${rhMax}%.`,
                  severity: 'warning',
                  dueDate: today,
                },
              })
            );
          }

          const lightHours = latestEnv.lightHours ? Number(latestEnv.lightHours) : null;
          const targetLightHours = envItem.lightHours ? Number(envItem.lightHours) : null;
          if (lightHours !== null && targetLightHours !== null && Math.abs(lightHours - targetLightHours) > 0.5) {
            generatedAlerts.push(
              await prisma.alert.create({
                data: {
                  flockId: flock.id,
                  alertType: 'environmental_threshold',
                  title: 'Light Hours Out of Range',
                  message: `Recorded light hours ${lightHours}h differs from target ${targetLightHours}h for day ${ageDays}.`,
                  severity: 'info',
                  dueDate: today,
                },
              })
            );
          }
        }
      }

      // Daily pending tasks
      const pendingTasks = await prisma.flockTask.findMany({
        where: {
          flockId: flock.id,
          taskDate: { lte: today },
          isCompleted: false,
          isSkipped: false,
        },
      });
      for (const task of pendingTasks) {
        generatedAlerts.push(
          await prisma.alert.create({
            data: {
              flockId: flock.id,
              alertType: 'task_due',
              title: `Task Due: ${task.title}`,
              message: task.description || task.title,
              severity: 'info',
              dueDate: today,
            },
          })
        );
      }
    }

    // Vaccine inventory expiry alerts (global, not flock-specific)
    const expiringVaccines = await prisma.vaccineInventory.findMany({
      where: {
        expiryDate: { lte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) },
        status: { in: ['available', 'in_use'] },
      },
    });
    for (const vaccine of expiringVaccines) {
      // Attach to the user's first active flock, or skip if none
      const targetFlock = flocks[0];
      if (targetFlock) {
        generatedAlerts.push(
          await prisma.alert.create({
            data: {
              flockId: targetFlock.id,
              alertType: 'vaccine_expiry',
              title: `Vaccine Expiring: ${vaccine.name}`,
              message: `Batch ${vaccine.batchNumber} expires on ${vaccine.expiryDate.toISOString().split('T')[0]}.`,
              severity: 'warning',
              dueDate: vaccine.expiryDate,
            },
          })
        );
      }
    }

    if (generatedAlerts.length > 0) {
      const criticalCount = generatedAlerts.filter((a: any) => a.severity === 'critical').length;
      const message = `Generated ${generatedAlerts.length} alert(s) for your active flocks. ${criticalCount} critical.`;
      const priority = criticalCount > 0 ? 'urgent' : 'default';
      const topic = process.env.NTFY_DEFAULT_TOPIC || 'nkuku-alerts';
      publishNtfy(topic, 'Nkuku Alerts', message, priority);
    }

    return { generated: generatedAlerts.length, alerts: generatedAlerts };
  });
}
