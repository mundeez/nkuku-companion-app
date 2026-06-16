import { PrismaClient } from '@prisma/client';

export async function seedBroilerBreeds(prisma: PrismaClient) {
  console.log('[SEED] Broiler breeds...');

  const breeds = [
    {
      name: 'Ross 308',
      supplier: 'Aviagen',
      isPrimary: true,
    },
    {
      name: 'Cobb 500',
      supplier: 'Cobb-Vantress',
      isPrimary: false,
    },
  ];

  for (const breed of breeds) {
    await prisma.breed.upsert({
      where: { name: breed.name },
      update: {},
      create: breed,
    });
    console.log('[SEED] Breed:', breed.name);
  }
}
