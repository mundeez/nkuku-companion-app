import { PrismaClient } from '@prisma/client';

export async function seedRoss308Performance(prisma: PrismaClient) {
  console.log('[SEED] Ross 308 performance targets...');

  const breed = await prisma.breed.findUnique({
    where: { name: 'Ross 308' },
  });

  if (!breed) {
    console.warn('[SEED] Ross 308 breed not found, skipping performance targets');
    return;
  }

  // Official Aviagen 2022 As-Hatched Performance Data
  const targets = [
    { ageDays: 0, targetWeight: 0.044, targetFeed: 0.000, targetFcr: 0.000 },
    { ageDays: 1, targetWeight: 0.062, targetFeed: 0.016, targetFcr: 0.258 },
    { ageDays: 2, targetWeight: 0.081, targetFeed: 0.020, targetFcr: 0.352 },
    { ageDays: 3, targetWeight: 0.102, targetFeed: 0.024, targetFcr: 0.476 },
    { ageDays: 4, targetWeight: 0.125, targetFeed: 0.027, targetFcr: 0.577 },
    { ageDays: 5, targetWeight: 0.151, targetFeed: 0.031, targetFcr: 0.658 },
    { ageDays: 6, targetWeight: 0.181, targetFeed: 0.035, targetFcr: 0.724 },
    { ageDays: 7, targetWeight: 0.213, targetFeed: 0.039, targetFcr: 0.780 },
    { ageDays: 8, targetWeight: 0.249, targetFeed: 0.044, targetFcr: 0.826 },
    { ageDays: 9, targetWeight: 0.288, targetFeed: 0.048, targetFcr: 0.865 },
    { ageDays: 10, targetWeight: 0.330, targetFeed: 0.052, targetFcr: 0.900 },
    { ageDays: 11, targetWeight: 0.376, targetFeed: 0.057, targetFcr: 0.930 },
    { ageDays: 12, targetWeight: 0.425, targetFeed: 0.062, targetFcr: 0.957 },
    { ageDays: 13, targetWeight: 0.477, targetFeed: 0.067, targetFcr: 0.982 },
    { ageDays: 14, targetWeight: 0.533, targetFeed: 0.072, targetFcr: 1.005 },
    { ageDays: 15, targetWeight: 0.592, targetFeed: 0.077, targetFcr: 1.026 },
    { ageDays: 16, targetWeight: 0.655, targetFeed: 0.083, targetFcr: 1.047 },
    { ageDays: 17, targetWeight: 0.720, targetFeed: 0.088, targetFcr: 1.066 },
    { ageDays: 18, targetWeight: 0.789, targetFeed: 0.094, targetFcr: 1.086 },
    { ageDays: 19, targetWeight: 0.860, targetFeed: 0.100, targetFcr: 1.105 },
    { ageDays: 20, targetWeight: 0.935, targetFeed: 0.105, targetFcr: 1.123 },
    { ageDays: 21, targetWeight: 1.012, targetFeed: 0.111, targetFcr: 1.142 },
    { ageDays: 22, targetWeight: 1.092, targetFeed: 0.117, targetFcr: 1.160 },
    { ageDays: 23, targetWeight: 1.174, targetFeed: 0.122, targetFcr: 1.178 },
    { ageDays: 24, targetWeight: 1.258, targetFeed: 0.128, targetFcr: 1.196 },
    { ageDays: 25, targetWeight: 1.345, targetFeed: 0.134, targetFcr: 1.214 },
    { ageDays: 26, targetWeight: 1.434, targetFeed: 0.139, targetFcr: 1.233 },
    { ageDays: 27, targetWeight: 1.524, targetFeed: 0.145, targetFcr: 1.251 },
    { ageDays: 28, targetWeight: 1.616, targetFeed: 0.150, targetFcr: 1.269 },
    { ageDays: 29, targetWeight: 1.710, targetFeed: 0.156, targetFcr: 1.288 },
    { ageDays: 30, targetWeight: 1.805, targetFeed: 0.161, targetFcr: 1.306 },
    { ageDays: 31, targetWeight: 1.901, targetFeed: 0.166, targetFcr: 1.325 },
    { ageDays: 32, targetWeight: 1.999, targetFeed: 0.171, targetFcr: 1.343 },
    { ageDays: 33, targetWeight: 2.097, targetFeed: 0.176, targetFcr: 1.362 },
    { ageDays: 34, targetWeight: 2.196, targetFeed: 0.180, targetFcr: 1.381 },
    { ageDays: 35, targetWeight: 2.296, targetFeed: 0.185, targetFcr: 1.399 },
    { ageDays: 36, targetWeight: 2.396, targetFeed: 0.189, targetFcr: 1.418 },
    { ageDays: 37, targetWeight: 2.496, targetFeed: 0.193, targetFcr: 1.437 },
    { ageDays: 38, targetWeight: 2.597, targetFeed: 0.197, targetFcr: 1.456 },
    { ageDays: 39, targetWeight: 2.697, targetFeed: 0.201, targetFcr: 1.474 },
    { ageDays: 40, targetWeight: 2.798, targetFeed: 0.204, targetFcr: 1.493 },
    { ageDays: 41, targetWeight: 2.898, targetFeed: 0.207, targetFcr: 1.512 },
    { ageDays: 42, targetWeight: 2.998, targetFeed: 0.211, targetFcr: 1.531 },
    { ageDays: 43, targetWeight: 3.097, targetFeed: 0.213, targetFcr: 1.550 },
    { ageDays: 44, targetWeight: 3.197, targetFeed: 0.216, targetFcr: 1.569 },
    { ageDays: 45, targetWeight: 3.295, targetFeed: 0.219, targetFcr: 1.587 },
    { ageDays: 46, targetWeight: 3.393, targetFeed: 0.221, targetFcr: 1.606 },
    { ageDays: 47, targetWeight: 3.490, targetFeed: 0.223, targetFcr: 1.625 },
    { ageDays: 48, targetWeight: 3.586, targetFeed: 0.225, targetFcr: 1.644 },
    { ageDays: 49, targetWeight: 3.681, targetFeed: 0.227, targetFcr: 1.663 },
    { ageDays: 50, targetWeight: 3.776, targetFeed: 0.229, targetFcr: 1.681 },
    { ageDays: 51, targetWeight: 3.869, targetFeed: 0.230, targetFcr: 1.700 },
    { ageDays: 52, targetWeight: 3.961, targetFeed: 0.231, targetFcr: 1.719 },
    { ageDays: 53, targetWeight: 4.052, targetFeed: 0.233, targetFcr: 1.738 },
    { ageDays: 54, targetWeight: 4.142, targetFeed: 0.233, targetFcr: 1.756 },
    { ageDays: 55, targetWeight: 4.230, targetFeed: 0.234, targetFcr: 1.775 },
    { ageDays: 56, targetWeight: 4.318, targetFeed: 0.234, targetFcr: 1.793 },
  ];

  for (const target of targets) {
    const targetWater = target.ageDays === 0 ? 0 : Number((target.targetFeed * 1.8).toFixed(3));
    await prisma.performanceTarget.upsert({
      where: {
        breedId_ageDays: {
          breedId: breed.id,
          ageDays: target.ageDays,
        },
      },
      update: {
        targetWeight: target.targetWeight,
        targetFeed: target.targetFeed,
        targetFcr: target.targetFcr,
        targetWater,
      },
      create: {
        breedId: breed.id,
        ...target,
        targetWater,
      },
    });
  }

  console.log('[SEED] Ross 308 performance targets:', targets.length);
}
