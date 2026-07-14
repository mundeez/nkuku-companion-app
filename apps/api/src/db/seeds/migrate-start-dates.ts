import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[MIGRATE] Updating existing flocks...');

  // Flocks not collected: clear startDate (pending collection)
  const pending = await prisma.$executeRaw`
    UPDATE broiler_flocks SET start_date = NULL WHERE chicks_collected = false
  `;
  console.log('[MIGRATE] Cleared startDate for pending flocks');

  // Flocks collected with a collectionDate: set startDate = collectionDate
  await prisma.$executeRaw`
    UPDATE broiler_flocks
    SET start_date = collection_date
    WHERE chicks_collected = true AND collection_date IS NOT NULL
      AND (start_date IS NULL OR start_date != collection_date)
  `;
  console.log('[MIGRATE] Synced startDate = collectionDate for collected flocks');

  // Flocks collected without a collectionDate: keep existing startDate
  const noCollection = await prisma.broilerFlock.count({
    where: { chicksCollected: true, collectionDate: null },
  });
  if (noCollection > 0) {
    console.log(`[MIGRATE] ${noCollection} collected flocks have no collectionDate — keeping existing startDate`);
  }

  console.log('[MIGRATE] Done');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
