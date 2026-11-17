// One-off: regenerate lighting & temperature schedule items for every org
// after the v1.54.1 guidance corrections (RH 50-70% grow-out, 23h light
// through day 4, step-down days 5-7, generic week-1 33°C, water-temp note).
// Safe to re-run — the seed upserts by name and regenerates items.
import { PrismaClient } from '@prisma/client';
import { seedLightingTemperatureSchedules } from './lighting-temperature-schedules.js';

async function main() {
  const prisma = new PrismaClient();
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  for (const org of orgs) {
    await seedLightingTemperatureSchedules(prisma, org.id);
    console.log(`[RESEED] ${org.name}`);
  }
  const sched = await prisma.lightingTemperatureSchedule.findFirst({ where: { name: 'Ross 308 Whole House' } });
  const d4 = await prisma.lightingTemperatureScheduleItem.findFirst({ where: { ageDays: 4, scheduleId: sched!.id } });
  const d10 = await prisma.lightingTemperatureScheduleItem.findFirst({ where: { ageDays: 10, scheduleId: sched!.id } });
  console.log('day4 light:', d4?.lightHours?.toString(), '| day10 RH:', d10?.targetRhMinPct?.toString(), '-', d10?.targetRhMaxPct?.toString());
  await prisma.$disconnect();
}

main();
