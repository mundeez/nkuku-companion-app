import type { PrismaClient } from '@prisma/client';

export async function getLightingTemperatureScheduleForFlock(
  prisma: PrismaClient,
  flock: any,
  userId: string
) {
  const breedId = flock.breedId;
  const housingType = flock.housingType || 'whole_house';

  const orderBy = [{ isDefault: 'desc' as const }, { createdAt: 'desc' as const }];

  const userBreedHousing = await prisma.lightingTemperatureSchedule.findFirst({
    where: { breedId, housingType, createdBy: userId },
    include: { items: { orderBy: { ageDays: 'asc' } } },
    orderBy,
  });
  if (userBreedHousing) return userBreedHousing;

  const userGenericHousing = await prisma.lightingTemperatureSchedule.findFirst({
    where: { breedId: null, housingType, createdBy: userId },
    include: { items: { orderBy: { ageDays: 'asc' } } },
    orderBy,
  });
  if (userGenericHousing) return userGenericHousing;

  const systemBreedHousing = await prisma.lightingTemperatureSchedule.findFirst({
    where: { breedId, housingType, createdBy: null },
    include: { items: { orderBy: { ageDays: 'asc' } } },
    orderBy,
  });
  if (systemBreedHousing) return systemBreedHousing;

  const systemGenericHousing = await prisma.lightingTemperatureSchedule.findFirst({
    where: { breedId: null, housingType, createdBy: null },
    include: { items: { orderBy: { ageDays: 'asc' } } },
    orderBy,
  });

  return systemGenericHousing;
}
