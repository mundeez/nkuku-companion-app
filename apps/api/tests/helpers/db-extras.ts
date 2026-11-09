// Applies DB-level extras that committed Prisma migrations intentionally do
// NOT contain. Runs in the test api boot command (docker-compose.test.yml)
// AFTER `prisma migrate deploy`, before seed + dev server.
//
// Background: JournalSourceType enum values 'sale' and 'sale_payment' are
// added on the shared/prod Postgres by a superuser one-off script
// (infra/sql/add-sale-source-types.sql) because the app DB user does not own
// the enum type there — so they can't live in a normal migration. In the
// test stack POSTGRES_USER is the instance superuser, so this just works.
// Idempotent (ADD VALUE IF NOT EXISTS).

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ENUM_VALUES = ['sale', 'sale_payment'];

for (const value of ENUM_VALUES) {
  await prisma.$executeRawUnsafe(
    `ALTER TYPE "JournalSourceType" ADD VALUE IF NOT EXISTS '${value}'`,
  );
}

await prisma.$disconnect();
console.log(`[test-db-extras] JournalSourceType ensured: ${ENUM_VALUES.join(', ')}`);
