import { PrismaClient } from '@prisma/client';

export async function seedVaccinationSchedules(prisma: PrismaClient) {
  console.log('[SEED] Vaccination schedules...');

  // Standard Broiler Schedule (Botswana context)
  const standardSchedule = await prisma.vaccinationSchedule.upsert({
    where: { name: 'Standard Broiler Schedule' },
    update: {},
    create: {
      name: 'Standard Broiler Schedule',
      isDefault: true,
      description: 'Standard vaccination program based on Botswana poultry practices',
    },
  });

  await prisma.vaccinationScheduleItem.deleteMany({
    where: { scheduleId: standardSchedule.id },
  });

  const standardItems = [
    { vaccineName: 'Newcastle (Lasota)', vaccineType: 'Live', ageDays: 0, adminMethod: 'Spray/Eye Drop', sortOrder: 0, notes: 'Day-old chicks at hatchery or on farm' },
    { vaccineName: 'Infectious Bursal Disease (IBD)', vaccineType: 'Live', ageDays: 7, adminMethod: 'Drinking Water', sortOrder: 1, notes: 'Gumboro vaccine' },
    { vaccineName: 'Newcastle (Lasota Booster)', vaccineType: 'Live', ageDays: 14, adminMethod: 'Drinking Water', sortOrder: 2, notes: 'Booster dose' },
    { vaccineName: 'Gumboro (Mild Strain)', vaccineType: 'Live', ageDays: 21, adminMethod: 'Drinking Water', sortOrder: 3, notes: 'Mild strain booster' },
  ];

  for (const item of standardItems) {
    await prisma.vaccinationScheduleItem.create({
      data: { scheduleId: standardSchedule.id, ...item },
    });
  }

  // Ross 308 Comprehensive Schedule
  const rossSchedule = await prisma.vaccinationSchedule.upsert({
    where: { name: 'Ross 308 Comprehensive Schedule' },
    update: {},
    create: {
      name: 'Ross 308 Comprehensive Schedule',
      isDefault: false,
      description: 'Comprehensive vaccination program for Ross 308 broilers',
    },
  });

  await prisma.vaccinationScheduleItem.deleteMany({
    where: { scheduleId: rossSchedule.id },
  });

  const rossItems = [
    { vaccineName: 'Marek Disease', vaccineType: 'Live', ageDays: 0, adminMethod: 'Subcutaneous Injection', sortOrder: 0, notes: 'At hatchery or day-old' },
    { vaccineName: 'Newcastle (Hitchner B1)', vaccineType: 'Live', ageDays: 0, adminMethod: 'Spray', sortOrder: 1, notes: 'Hatchery spray vaccination' },
    { vaccineName: 'Infectious Bursal Disease (IBD)', vaccineType: 'Live', ageDays: 7, adminMethod: 'Drinking Water', sortOrder: 2, notes: 'Intermediate or mild-plus strain' },
    { vaccineName: 'Newcastle (Lasota)', vaccineType: 'Live', ageDays: 14, adminMethod: 'Drinking Water', sortOrder: 3, notes: 'Booster' },
    { vaccineName: 'Infectious Bursal Disease (IBD)', vaccineType: 'Live', ageDays: 21, adminMethod: 'Drinking Water', sortOrder: 4, notes: 'Intermediate strain booster' },
    { vaccineName: 'Newcastle + IB (Booster)', vaccineType: 'Live', ageDays: 28, adminMethod: 'Drinking Water', sortOrder: 5, notes: 'Combined booster if needed' },
  ];

  for (const item of rossItems) {
    await prisma.vaccinationScheduleItem.create({
      data: { scheduleId: rossSchedule.id, ...item },
    });
  }

  console.log('[SEED] Vaccination schedules: 2');
}
