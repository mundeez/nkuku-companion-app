import { PrismaClient } from '@prisma/client';

export async function seedCobb500Performance(prisma: PrismaClient) {
  console.log('[SEED] Cobb 500 performance targets...');

  const breed = await prisma.breed.findUnique({
    where: { name: 'Cobb 500' },
  });

  if (!breed) {
    console.warn('[SEED] Cobb 500 breed not found, skipping performance targets');
    return;
  }

  const targets = [
    { ageDays: 0, targetWeight: 0.042, targetFeed: 0.000, targetFcr: 0.000 },
    { ageDays: 7, targetWeight: 0.185, targetFeed: 0.039, targetFcr: 0.958 },
    { ageDays: 14, targetWeight: 0.465, targetFeed: 0.075, targetFcr: 1.165 },
    { ageDays: 21, targetWeight: 0.865, targetFeed: 0.111, targetFcr: 1.250 },
    { ageDays: 28, targetWeight: 1.420, targetFeed: 0.148, targetFcr: 1.360 },
    { ageDays: 35, targetWeight: 2.100, targetFeed: 0.185, targetFcr: 1.500 },
    { ageDays: 42, targetWeight: 2.850, targetFeed: 0.222, targetFcr: 1.650 },
    { ageDays: 49, targetWeight: 3.650, targetFeed: 0.259, targetFcr: 1.820 },
    { ageDays: 56, targetWeight: 4.500, targetFeed: 0.296, targetFcr: 2.000 },
  ];

  for (const target of targets) {
    await prisma.performanceTarget.upsert({
      where: {
        breedId_ageDays: {
          breedId: breed.id,
          ageDays: target.ageDays,
        },
      },
      update: {},
      create: {
        breedId: breed.id,
        ...target,
      },
    });
  }

  console.log('[SEED] Cobb 500 performance targets:', targets.length);
}
