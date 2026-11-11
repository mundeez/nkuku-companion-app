/**
 * Repair: post missing journal entries for feed-purchase financial records.
 *
 * `feed_purchase` was missing from the JournalSourceType DB enum, so every
 * purchase auto-post threw and was only logged — leaving financial_records
 * with no journal entry. Run after migration
 * 20261112000002_journal_source_feed_purchase. Idempotent: skips records
 * that already have a journal.
 */
import { PrismaClient } from '@prisma/client';
import { JournalEngine } from '../../core/double-entry/journal.engine.js';
import { AutoPostService } from '../../core/double-entry/auto-post.service.js';

const prisma = new PrismaClient();

async function main() {
  const records = await prisma.financialRecord.findMany({
    where: { sourceTable: 'feed_purchases' },
    select: { id: true, description: true, amountZmw: true, recordDate: true },
  });
  const posted = await prisma.journalEntry.findMany({
    where: { sourceId: { in: records.map((r) => r.id) } },
    select: { sourceId: true },
  });
  const haveJournal = new Set(posted.map((j) => j.sourceId));
  const orphans = records.filter((r) => !haveJournal.has(r.id));

  console.log(`Found ${orphans.length} feed_purchases financial records without journal entries`);

  const engine = new JournalEngine(prisma);
  const autoPost = new AutoPostService(engine, prisma);

  let done = 0;
  for (const fr of orphans) {
    try {
      await autoPost.postFromFinancialRecord(fr.id, undefined, 'feed_purchase');
      done++;
      console.log(`  posted journal for ${fr.id} — ${fr.description} (ZMW ${fr.amountZmw}, ${fr.recordDate.toISOString().split('T')[0]})`);
    } catch (err: any) {
      console.error(`  FAILED ${fr.id}: ${err.message}`);
    }
  }
  console.log(`Posted ${done}/${orphans.length} journals`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
