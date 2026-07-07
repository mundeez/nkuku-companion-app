/**
 * Migration Script: Single-Entry → Double-Entry
 *
 * Converts every existing FinancialRecord into a JournalEntry + JournalLines.
 *
 * Properties:
 *   - Non-destructive: FinancialRecord rows are NOT deleted
 *   - Idempotent: tracks via sourceId on JournalEntry; re-running skips migrated records
 *   - Batched: processes in batches of 100
 *   - Auditable: all migrated entries have sourceType: 'migration'
 *
 * Run inside container:
 *   docker compose exec api tsx src/db/seeds/migrate-to-double-entry.ts
 */

import { PrismaClient } from '@prisma/client';
import { JournalEngine } from '../../core/double-entry/journal.engine.js';
import { AutoPostService } from '../../core/double-entry/auto-post.service.js';

const prisma = new PrismaClient();
const engine = new JournalEngine(prisma);
const autoPost = new AutoPostService(engine, prisma);

const BATCH_SIZE = 100;
let migrated = 0;
let skipped = 0;
let errors = 0;
const errorDetails: string[] = [];

async function main() {
  console.log('[Migration] Starting single-entry -> double-entry migration...');

  // Skip projection records — they are estimates, not actuals
  const totalRecords = await prisma.financialRecord.count({ where: { isProjection: false } });
  console.log(`[Migration] Found ${totalRecords} non-projection financial records to migrate`);

  let cursor: string | undefined;

  while (true) {
    const records = await prisma.financialRecord.findMany({
      take: BATCH_SIZE,
      where: { isProjection: false },
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'asc' },
    });

    if (records.length === 0) break;
    cursor = records[records.length - 1].id;

    for (const record of records) {
      // Skip if already migrated (journal entry with this sourceId + sourceType='migration' exists)
      const existing = await prisma.journalEntry.findFirst({
        where: { sourceId: record.id, sourceType: 'migration' },
      });
      if (existing) { skipped++; continue; }

      try {
        await autoPost.postFromFinancialRecord(record.id, undefined, 'migration');
        migrated++;
      } catch (err: any) {
        console.error(`[Migration] FAILED record ${record.id} (category=${record.category}): ${err.message}`);
        errorDetails.push(`Record ${record.id} (category=${record.category}): ${err.message}`);
        errors++;
      }
    }

    console.log(`[Migration] Progress: migrated=${migrated}, skipped=${skipped}, errors=${errors}`);
  }

  console.log('');
  console.log(`[Migration] Complete.`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped (already migrated): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  if (errorDetails.length > 0) {
    console.log('  Error details:');
    errorDetails.forEach((e) => console.log(`    - ${e}`));
  }

  // Verification
  console.log('');
  console.log('[Migration] Running verification queries...');

  const imbalance = await prisma.$queryRaw`
    SELECT je.id, je.entry_number,
           SUM(jl.debit_zmw)  AS total_debit,
           SUM(jl.credit_zmw) AS total_credit
    FROM journal_entries je
    JOIN journal_lines jl ON jl.journal_id = je.id
    WHERE je.source_type = 'migration'
    GROUP BY je.id, je.entry_number
    HAVING ABS(SUM(jl.debit_zmw) - SUM(jl.credit_zmw)) > 0.01;
  ` as any[];

  if (imbalance.length === 0) {
    console.log('[Migration] VERIFICATION PASSED: All migrated entries are balanced.');
  } else {
    console.log(`[Migration] VERIFICATION FAILED: ${imbalance.length} imbalanced entries found!`);
    imbalance.forEach((r: any) => {
      console.log(`  ${r.entry_number}: debit=${r.total_debit}, credit=${r.total_credit}`);
    });
  }

  const totals = await prisma.$queryRaw`
    SELECT
      SUM(debit_zmw)  AS grand_debit,
      SUM(credit_zmw) AS grand_credit
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_id = je.id
    WHERE je.source_type = 'migration';
  ` as any[];

  const grandDebit = totals[0]?.grand_debit ?? 0;
  const grandCredit = totals[0]?.grand_credit ?? 0;
  console.log(`[Migration] Grand totals: debits=${grandDebit}, credits=${grandCredit}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[Migration] Fatal error:', err);
  process.exit(1);
});
