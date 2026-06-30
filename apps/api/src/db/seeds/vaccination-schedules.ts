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

  // Ross 308 Zambia Schedule (evidence-based, matches Excel workbook)
  const zambiaSchedule = await prisma.vaccinationSchedule.upsert({
    where: { name: 'Ross 308 Zambia Schedule' },
    update: {},
    create: {
      name: 'Ross 308 Zambia Schedule',
      isDefault: false,
      description: 'Ross 308 vaccination program for Zambia: hatchery-based preferred, with on-farm alternatives. Based on Aviagen, MSD, Ceva, and University of Zambia research.',
    },
  });

  await prisma.vaccinationScheduleItem.deleteMany({
    where: { scheduleId: zambiaSchedule.id },
  });

  const zambiaItems = [
    { vaccineName: "Marek's Disease Vaccine", vaccineType: 'Live', ageDays: 1, adminMethod: 'In ovo / Subcutaneous', sortOrder: 0, notes: 'Hatchery standard. Source chicks from vaccinated parent flocks.' },
    { vaccineName: 'Newcastle + Infectious Bronchitis (Nobilis ND C2 + IB MA5)', vaccineType: 'Live', ageDays: 1, adminMethod: 'Coarse spray / Eye drop', sortOrder: 1, notes: 'Hatchery preferred. Use Clone 30 / H120 / Ma5 strains.' },
    { vaccineName: 'Infectious Bursal Disease — Immune-Complex (CEVAC Transmune)', vaccineType: 'Immune-complex', ageDays: 1, adminMethod: 'Subcutaneous / In ovo', sortOrder: 2, notes: 'If hatchery service available. Overcomes MDA interference.' },
    { vaccineName: 'Coccidiosis Vaccine (Fortegra)', vaccineType: 'Live', ageDays: 1, adminMethod: 'Coarse spray / Gel', sortOrder: 3, notes: 'Optional if bio-shuttle program. Administer day-old at hatchery.' },
    { vaccineName: 'Infectious Bronchitis + Newcastle Booster (IB MA5 + Clone 30)', vaccineType: 'Live', ageDays: 10, adminMethod: 'Drinking water / Spray', sortOrder: 4, notes: 'High-challenge areas (Lusaka). Post-vaccination vitamins/electrolytes.' },
    { vaccineName: 'Infectious Bursal Disease — Live (Nobilis Gumboro D78)', vaccineType: 'Live', ageDays: 14, adminMethod: 'Drinking water', sortOrder: 5, notes: 'Only if immune-complex vaccine was NOT used. Time using MDA / Deventer formula.' },
    { vaccineName: 'Newcastle Disease Booster (Clone 30 / LaSota)', vaccineType: 'Live', ageDays: 21, adminMethod: 'Drinking water', sortOrder: 6, notes: 'Critical in high-challenge areas; genotype VII.2 circulating in Lusaka.' },
    { vaccineName: 'Newcastle Disease Booster (LaSota)', vaccineType: 'Live', ageDays: 28, adminMethod: 'Drinking water', sortOrder: 7, notes: 'Only if birds are kept >42 days.' },
  ];

  for (const item of zambiaItems) {
    await prisma.vaccinationScheduleItem.create({
      data: { scheduleId: zambiaSchedule.id, ...item },
    });
  }

  console.log('[SEED] Vaccination schedules: 3');
}
