import { PrismaClient, HousingType } from '@prisma/client';

const TARGET_AGE = 42;

interface DayValues {
  targetTempC: number;
  targetTempMinC: number;
  targetTempMaxC: number;
  targetRhMinPct: number;
  targetRhMaxPct: number;
  lightHours: number;
  darkHours: number;
  lightIntensityLux: number;
  darkIntensityLux: number;
  notes?: string;
}

function ross308WholeHouse(ageDays: number): DayValues {
  // Based on Ross 2025 Broiler Management Handbook Table 2.4 (whole-house).
  // Weights mapped from Ross 308 2022 Performance Objectives.
  const weight = [
    0.044, 0.062, 0.081, 0.102, 0.125, 0.151, 0.181, 0.213,
    0.249, 0.288, 0.330, 0.376, 0.425, 0.477, 0.533, 0.592,
    0.655, 0.720, 0.789, 0.860, 0.935, 1.012, 1.092, 1.174,
    1.258, 1.345, 1.434, 1.524, 1.616, 1.710, 1.805, 1.901,
    1.999, 2.097, 2.196, 2.296, 2.396, 2.496, 2.597, 2.697,
    2.798, 2.898, 2.998,
  ][ageDays] ?? 3.0;

  let targetTempC: number;
  if (weight <= 0.044) targetTempC = 30;
  else if (weight <= 0.100) targetTempC = 28;
  else if (weight <= 0.180) targetTempC = 27;
  else if (weight <= 0.290) targetTempC = 26;
  else if (weight <= 0.425) targetTempC = 25;
  else if (weight <= 0.590) targetTempC = 24;
  else if (weight <= 0.790) targetTempC = 23;
  else if (weight <= 1.015) targetTempC = 22;
  else if (weight <= 1.260) targetTempC = 21;
  else targetTempC = 20;

  // Light step-down per Ross 2025.
  let lightHours: number;
  let darkHours: number;
  let lightIntensityLux: number;
  if (ageDays <= 3) {
    lightHours = 23;
    darkHours = 1;
    lightIntensityLux = 35;
  } else if (ageDays <= 7) {
    // Gradual step-down from 22L/2D to 19L/5D.
    const step = ageDays - 3;
    lightHours = 22 - 0.75 * step;
    darkHours = 2 + 0.75 * step;
    lightIntensityLux = 35;
  } else if (ageDays >= 40) {
    // Pre-catch: 23L:1D for the last 3 days.
    lightHours = 23;
    darkHours = 1;
    lightIntensityLux = 7;
  } else {
    lightHours = 19;
    darkHours = 5;
    lightIntensityLux = 7;
  }

  const [rhMin, rhMax] = ageDays <= 3 ? [60, 70] : [50, 60];

  return {
    targetTempC,
    targetTempMinC: targetTempC - 1,
    targetTempMaxC: targetTempC + 1,
    targetRhMinPct: rhMin,
    targetRhMaxPct: rhMax,
    lightHours,
    darkHours,
    lightIntensityLux,
    darkIntensityLux: 0,
    notes: ageDays <= 3
      ? 'Brooding: 23h light, 1h dark. Intensity at least 30-40 lux for whole-house.'
      : ageDays <= 7
      ? 'Gradually step down to 4-6 hours continuous darkness by day 7.'
      : ageDays >= 40
      ? 'Pre-catch: 23h light, 1h dark.'
      : 'Grow-out: 18-20h light, 4-6h dark. Intensity 5-10 lux.',
  };
}

function ross308SpotBrooding(ageDays: number): DayValues {
  const base = ross308WholeHouse(ageDays);
  // Spot brooding edge temperatures are ~2°C higher for the first 2 weeks.
  if (ageDays <= 14) {
    base.targetTempMaxC = base.targetTempC + 2;
    base.targetTempMinC = base.targetTempC;
    base.targetTempC = base.targetTempMaxC;
  }
  // Light intensity at brooder edge is higher.
  if (ageDays <= 7) {
    base.lightIntensityLux = 90;
  }
  base.notes = ageDays <= 7
    ? 'Spot brooding: high light intensity at brooder edge (80-100 lux) to encourage feed/water intake.'
    : base.notes;
  return base;
}

function genericBroiler(ageDays: number, housingType: HousingType): DayValues {
  // Generic fallback derived from common extension guidance (WRC South Africa, UGA).
  let targetTempC: number;
  if (ageDays <= 7) targetTempC = 32;
  else if (ageDays <= 14) targetTempC = 29;
  else if (ageDays <= 21) targetTempC = 27;
  else if (ageDays <= 28) targetTempC = 24;
  else targetTempC = 21;

  if (housingType === 'spot_brooding' && ageDays <= 14) {
    targetTempC += 2;
  }

  let lightHours: number;
  let darkHours: number;
  let lightIntensityLux: number;
  if (ageDays <= 3) {
    lightHours = 23;
    darkHours = 1;
    lightIntensityLux = housingType === 'spot_brooding' ? 90 : 35;
  } else if (ageDays <= 7) {
    const step = ageDays - 3;
    lightHours = 22 - 0.75 * step;
    darkHours = 2 + 0.75 * step;
    lightIntensityLux = 35;
  } else if (ageDays >= 40) {
    lightHours = 23;
    darkHours = 1;
    lightIntensityLux = 7;
  } else {
    lightHours = 19;
    darkHours = 5;
    lightIntensityLux = 7;
  }

  const [rhMin, rhMax] = ageDays <= 3 ? [60, 70] : [50, 60];

  return {
    targetTempC,
    targetTempMinC: targetTempC - 1,
    targetTempMaxC: targetTempC + 1,
    targetRhMinPct: rhMin,
    targetRhMaxPct: rhMax,
    lightHours,
    darkHours,
    lightIntensityLux,
    darkIntensityLux: 0,
    notes: 'Generic broiler fallback schedule. Adjust based on breed-specific guidance and local conditions.',
  };
}

function generateItems(
  fn: (ageDays: number) => DayValues,
  targetAge = TARGET_AGE
) {
  const items = [];
  for (let ageDays = 0; ageDays <= targetAge; ageDays++) {
    const v = fn(ageDays);
    items.push({
      ageDays,
      lightHours: v.lightHours,
      darkHours: v.darkHours,
      lightIntensityLux: v.lightIntensityLux,
      darkIntensityLux: v.darkIntensityLux,
      targetTempC: v.targetTempC,
      targetTempMinC: v.targetTempMinC,
      targetTempMaxC: v.targetTempMaxC,
      targetRhMinPct: v.targetRhMinPct,
      targetRhMaxPct: v.targetRhMaxPct,
      notes: v.notes || '',
      sortOrder: ageDays,
    });
  }
  return items;
}

export async function seedLightingTemperatureSchedules(prisma: PrismaClient, organizationId: string) {
  console.log('[SEED] Lighting & temperature schedules...');

  const rossBreed = await prisma.breed.findUnique({ where: { name: 'Ross 308' } });

  // ── Ross 308 Whole House ───────────────────────────
  const rossWholeHouse = await prisma.lightingTemperatureSchedule.upsert({
    where: { name: 'Ross 308 Whole House' },
    update: {
      description: 'Ross 308 lighting and temperature schedule for whole-house brooding in Zambia.',
      housingType: 'whole_house',
      breedId: rossBreed?.id ?? null,
      isDefault: true,
    },
    create: {
      name: 'Ross 308 Whole House',
      organizationId,
      description: 'Ross 308 lighting and temperature schedule for whole-house brooding in Zambia.',
      housingType: 'whole_house',
      breedId: rossBreed?.id ?? null,
      isDefault: true,
    },
  });

  await prisma.lightingTemperatureScheduleItem.deleteMany({
    where: { scheduleId: rossWholeHouse.id },
  });
  for (const item of generateItems(ross308WholeHouse)) {
    await prisma.lightingTemperatureScheduleItem.create({
      data: { ...item, scheduleId: rossWholeHouse.id },
    });
  }
  console.log('[SEED] Ross 308 Whole House schedule created');

  // ── Ross 308 Spot Brooding ─────────────────────────
  const rossSpot = await prisma.lightingTemperatureSchedule.upsert({
    where: { name: 'Ross 308 Spot Brooding' },
    update: {
      description: 'Ross 308 lighting and temperature schedule for spot brooding in Zambia.',
      housingType: 'spot_brooding',
      breedId: rossBreed?.id ?? null,
    },
    create: {
      name: 'Ross 308 Spot Brooding',
      organizationId,
      description: 'Ross 308 lighting and temperature schedule for spot brooding in Zambia.',
      housingType: 'spot_brooding',
      breedId: rossBreed?.id ?? null,
    },
  });

  await prisma.lightingTemperatureScheduleItem.deleteMany({
    where: { scheduleId: rossSpot.id },
  });
  for (const item of generateItems(ross308SpotBrooding)) {
    await prisma.lightingTemperatureScheduleItem.create({
      data: { ...item, scheduleId: rossSpot.id },
    });
  }
  console.log('[SEED] Ross 308 Spot Brooding schedule created');

  // ── Generic Broiler Whole House ────────────────────
  const genericWholeHouse = await prisma.lightingTemperatureSchedule.upsert({
    where: { name: 'Generic Broiler Whole House' },
    update: {
      description: 'Generic broiler lighting and temperature schedule for whole-house brooding.',
      housingType: 'whole_house',
      breedId: null,
    },
    create: {
      name: 'Generic Broiler Whole House',
      organizationId,
      description: 'Generic broiler lighting and temperature schedule for whole-house brooding.',
      housingType: 'whole_house',
      breedId: null,
    },
  });

  await prisma.lightingTemperatureScheduleItem.deleteMany({
    where: { scheduleId: genericWholeHouse.id },
  });
  for (const item of generateItems((age) => genericBroiler(age, 'whole_house'))) {
    await prisma.lightingTemperatureScheduleItem.create({
      data: { ...item, scheduleId: genericWholeHouse.id },
    });
  }
  console.log('[SEED] Generic Broiler Whole House schedule created');

  // ── Generic Broiler Spot Brooding ──────────────────
  const genericSpot = await prisma.lightingTemperatureSchedule.upsert({
    where: { name: 'Generic Broiler Spot Brooding' },
    update: {
      description: 'Generic broiler lighting and temperature schedule for spot brooding.',
      housingType: 'spot_brooding',
      breedId: null,
    },
    create: {
      name: 'Generic Broiler Spot Brooding',
      organizationId,
      description: 'Generic broiler lighting and temperature schedule for spot brooding.',
      housingType: 'spot_brooding',
      breedId: null,
    },
  });

  await prisma.lightingTemperatureScheduleItem.deleteMany({
    where: { scheduleId: genericSpot.id },
  });
  for (const item of generateItems((age) => genericBroiler(age, 'spot_brooding'))) {
    await prisma.lightingTemperatureScheduleItem.create({
      data: { ...item, scheduleId: genericSpot.id },
    });
  }
  console.log('[SEED] Generic Broiler Spot Brooding schedule created');
}
