import { PrismaClient } from '@prisma/client';

export async function seedVaccinationSchedules(prisma: PrismaClient) {
  console.log('[SEED] Vaccination schedules...');

  // ── Standard Zambia Broiler Schedule ───────────────
  const standardSchedule = await prisma.vaccinationSchedule.upsert({
    where: { name: 'Standard Broiler Schedule' },
    update: {
      description: 'Standard Zambia broiler vaccination programme. Hatchery day-old vaccination + on-farm IBD and Newcastle boosters.',
    },
    create: {
      name: 'Standard Broiler Schedule',
      isDefault: true,
      description: 'Standard Zambia broiler vaccination programme. Hatchery day-old vaccination + on-farm IBD and Newcastle boosters.',
    },
  });

  await prisma.vaccinationScheduleItem.deleteMany({
    where: { scheduleId: standardSchedule.id },
  });

  const standardItems = [
    { vaccineName: "Marek's Disease + Newcastle + IB (Hatchery)", vaccineType: 'Live', ageDays: 0, adminMethod: 'Injection / Coarse Spray', sortOrder: 0, notes: 'Hatchery standard. Ensure DOC batch is certified. Source from commercial hatcheries (Ross Breeders ZM, Hybrid Poultry, Tiger Chicks).' },
    { vaccineName: 'Infectious Bursal Disease (IBD/Gumboro) — 1st Dose', vaccineType: 'Live', ageDays: 10, adminMethod: 'Drinking Water', sortOrder: 1, notes: 'Live Intermediate or Intermediate Plus (Cevamune / Nobilis D78). Do not vaccinate before Day 10 in high maternal antibody stock. Suspend chlorination 48h before. Use skim milk 2g/L stabilizer. Withdraw water 1-2h before vaccination.' },
    { vaccineName: 'Newcastle Disease + Infectious Bronchitis — 1st Farm Dose', vaccineType: 'Live', ageDays: 14, adminMethod: 'Drinking Water or Eye Drop', sortOrder: 2, notes: 'LaSota or Clone 30 live strain. Eye-drop ensures 100% intake but is labour-intensive. Suspend chlorination. Use skim milk stabilizer. Withdraw water 1-2h.' },
    { vaccineName: 'Infectious Bursal Disease (IBD/Gumboro) — 2nd Dose / Booster', vaccineType: 'Live', ageDays: 18, adminMethod: 'Drinking Water', sortOrder: 3, notes: 'Live Intermediate Plus booster. Essential in high field-challenge areas. Not needed if immune-complex (Transmune) was given at hatchery. Skim milk stabilizer. Withdraw water 1-2h.' },
    { vaccineName: 'Newcastle Disease — 2nd Farm Dose / Booster', vaccineType: 'Live', ageDays: 21, adminMethod: 'Drinking Water', sortOrder: 4, notes: 'LaSota or Clone 30 booster. Secures immunity to processing weight. NDV genotype VII.2 circulates in Lusaka - ensure full dose and proper administration. Skim milk stabilizer. Withdraw water 1-2h.' },
  ];

  for (const item of standardItems) {
    await prisma.vaccinationScheduleItem.create({
      data: { scheduleId: standardSchedule.id, ...item },
    });
  }

  // ── Ross 308 Comprehensive Schedule (Lusaka, Zambia) ─
  const rossSchedule = await prisma.vaccinationSchedule.upsert({
    where: { name: 'Ross 308 Comprehensive Schedule' },
    update: {
      description: 'Ross 308 broiler vaccination programme for Lusaka, Zambia. Hatchery day-old vaccination + on-farm IBD (Day 10 + 18) and Newcastle+IB (Day 14 + 21) boosters. Based on Aviagen, MSD, Ceva, and University of Zambia research.',
    },
    create: {
      name: 'Ross 308 Comprehensive Schedule',
      isDefault: false,
      description: 'Ross 308 broiler vaccination programme for Lusaka, Zambia. Hatchery day-old vaccination + on-farm IBD (Day 10 + 18) and Newcastle+IB (Day 14 + 21) boosters. Based on Aviagen, MSD, Ceva, and University of Zambia research.',
    },
  });

  await prisma.vaccinationScheduleItem.deleteMany({
    where: { scheduleId: rossSchedule.id },
  });

  const rossItems = [
    { vaccineName: "Marek's Disease Vaccine", vaccineType: 'Live HVT', ageDays: 0, adminMethod: 'Subcutaneous Injection', sortOrder: 0, notes: 'Hatchery standard. In ovo at 18 days incubation or subcutaneous at hatch. Source chicks from certified hatcheries (Ross Breeders Zambia, Hybrid Poultry, Tiger Chicks). Ensure DOC batch is certified.' },
    { vaccineName: 'Newcastle Disease + Infectious Bronchitis (Hatchery)', vaccineType: 'Live', ageDays: 0, adminMethod: 'Coarse Spray', sortOrder: 1, notes: 'Hatchery coarse spray with LaSota/H120 or Innovax ND-IBD (recombinant HVT expressing NDV + IBDV). Standard commercial practice for day-old chicks.' },
    { vaccineName: 'Infectious Bursal Disease (IBD/Gumboro) — 1st Dose', vaccineType: 'Live Intermediate / Intermediate Plus', ageDays: 10, adminMethod: 'Drinking Water', sortOrder: 2, notes: 'Cevamune or Nobilis Gumboro D78. 1st dose for early bursal protection. Do not vaccinate before Day 10 in high maternal antibody stock - vaccine may be neutralised. Ideally time using Deventer formula based on MDA titers. Suspend chlorination 48h before. Skim milk 2g/L stabilizer. Withdraw water 1-2h. Administer vitamins/electrolytes 24h before and after.' },
    { vaccineName: 'Newcastle Disease + Infectious Bronchitis — 1st Farm Dose', vaccineType: 'Live (LaSota or Clone 30)', ageDays: 14, adminMethod: 'Drinking Water or Eye Drop', sortOrder: 3, notes: '1st farm dose. LaSota or Clone 30 live strain. Protects against prevailing regional respiratory complexes. Eye-dropping ensures 100% systemic intake but is labour-intensive. Suspend chlorination. Skim milk stabilizer. Withdraw water 1-2h. Administer vitamins/electrolytes 24h before and after.' },
    { vaccineName: 'Infectious Bursal Disease (IBD/Gumboro) — 2nd Dose / Booster', vaccineType: 'Live Intermediate Plus', ageDays: 18, adminMethod: 'Drinking Water', sortOrder: 4, notes: '2nd dose / booster. Essential in Lusaka due to dense smallholder poultry concentrations posing high field challenge risk. Not needed if immune-complex vaccine (CEVAC Transmune) was given at hatchery. Skim milk stabilizer. Withdraw water 1-2h. Administer vitamins/electrolytes 24h before and after.' },
    { vaccineName: 'Newcastle Disease — 2nd Farm Dose / Booster', vaccineType: 'Live (LaSota or Clone 30)', ageDays: 21, adminMethod: 'Drinking Water', sortOrder: 5, notes: '2nd farm dose / booster. Secures late-stage respiratory immunity up to processing weight. NDV genotype VII.2 circulates in Lusaka Province - ensure full dose and proper administration. Skim milk stabilizer. Withdraw water 1-2h. Administer vitamins/electrolytes 24h before and after.' },
  ];

  for (const item of rossItems) {
    await prisma.vaccinationScheduleItem.create({
      data: { scheduleId: rossSchedule.id, ...item },
    });
  }

  // ── Ross 308 Zambia Schedule (Hatchery-Preferred) ───
  const zambiaSchedule = await prisma.vaccinationSchedule.upsert({
    where: { name: 'Ross 308 Zambia Schedule' },
    update: {
      description: 'Ross 308 advanced vaccination programme for Zambia: hatchery immune-complex preferred, with on-farm alternatives. Based on Aviagen, MSD, Ceva, and University of Zambia research. NDV genotype VII.2 confirmed circulating in Lusaka Province.',
    },
    create: {
      name: 'Ross 308 Zambia Schedule',
      isDefault: false,
      description: 'Ross 308 advanced vaccination programme for Zambia: hatchery immune-complex preferred, with on-farm alternatives. Based on Aviagen, MSD, Ceva, and University of Zambia research. NDV genotype VII.2 confirmed circulating in Lusaka Province.',
    },
  });

  await prisma.vaccinationScheduleItem.deleteMany({
    where: { scheduleId: zambiaSchedule.id },
  });

  const zambiaItems = [
    { vaccineName: "Marek's Disease Vaccine", vaccineType: 'Live HVT', ageDays: 0, adminMethod: 'In ovo / Subcutaneous', sortOrder: 0, notes: 'Hatchery standard. In ovo at 18 days incubation or subcutaneous at hatch. Source chicks only from hatchery-vaccinated parent flocks.' },
    { vaccineName: 'Newcastle + Infectious Bronchitis (Nobilis ND Clone 30 + IB MA5)', vaccineType: 'Live', ageDays: 0, adminMethod: 'Coarse spray / Eye drop', sortOrder: 1, notes: "Hatchery preferred. Use Clone 30 / H120 / Ma5 strains. Alternatively Innovax ND-IBD (recombinant, covers Marek's + ND + IBD in one dose)." },
    { vaccineName: 'Infectious Bursal Disease — Immune-Complex (CEVAC Transmune)', vaccineType: 'Immune-complex', ageDays: 0, adminMethod: 'Subcutaneous / In ovo', sortOrder: 2, notes: 'If hatchery service available. Overcomes maternal antibody (MDA) interference - no on-farm IBD booster needed if used. Single dose at hatchery.' },
    { vaccineName: 'Coccidiosis Vaccine (Fortegra)', vaccineType: 'Live', ageDays: 0, adminMethod: 'Coarse spray / Gel', sortOrder: 3, notes: 'Optional if bio-shuttle program with anticoccidial feed. Administer day-old at hatchery.' },
    { vaccineName: 'Infectious Bronchitis + Newcastle Booster (IB MA5 + Clone 30)', vaccineType: 'Live', ageDays: 10, adminMethod: 'Drinking water / Spray', sortOrder: 4, notes: 'High-challenge areas (Lusaka). Post-vaccination vitamins/electrolytes. Suspend chlorination 48h before. Skim milk 2g/L stabilizer. Withdraw water 1-2h.' },
    { vaccineName: 'Infectious Bursal Disease — Live (Nobilis Gumboro D78)', vaccineType: 'Live Intermediate', ageDays: 14, adminMethod: 'Drinking water', sortOrder: 5, notes: 'ONLY if immune-complex (Transmune) was NOT used at hatchery. Time using Deventer formula based on MDA titers. Skim milk stabilizer. Withdraw water 1-2h.' },
    { vaccineName: 'Newcastle Disease Booster (Clone 30 / LaSota)', vaccineType: 'Live', ageDays: 21, adminMethod: 'Drinking water', sortOrder: 6, notes: 'Critical in high-challenge areas; NDV genotype VII.2 circulating in Lusaka Province. Skim milk stabilizer. Withdraw water 1-2h. Administer vitamins/electrolytes 24h before and after.' },
    { vaccineName: 'Newcastle Disease Booster (LaSota)', vaccineType: 'Live', ageDays: 28, adminMethod: 'Drinking water', sortOrder: 7, notes: 'Only if birds are kept >42 days. Final ND booster for extended grow-out. Skim milk stabilizer. Withdraw water 1-2h.' },
  ];

  for (const item of zambiaItems) {
    await prisma.vaccinationScheduleItem.create({
      data: { scheduleId: zambiaSchedule.id, ...item },
    });
  }

  console.log('[SEED] Vaccination schedules: 3');
}
