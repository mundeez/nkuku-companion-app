/**
 * Repair: Flock A - October 2026 — record hatchery/purchased chick extras.
 *
 * The flock was edited via the old "Initial Bird Count" field which bumped
 * initial_count 280→295 without touching current_count (280-1 mortality=279).
 * Truth per owner: 280 ordered + 5 free hatchery extras + 11 purchased
 * top-ups = 296 received, -1 mortality = 295 current.
 *
 * Steps (all in one tx):
 *   1. Revert initial_count to 280 (undo the drifted direct edit).
 *   2. Insert +5 hatchery_extra addition → initial 285, current 284.
 *   3. Insert +11 purchase addition @ 17.50 → initial 296, current 295,
 *      plus a chick_purchase financial record (ZMW 192.50).
 *   4. Auto-post the journal (Dr 1030 Inventory / Cr 1010 Cash).
 *
 * Idempotent: skips when additions already exist for the flock.
 */
import { PrismaClient } from '@prisma/client';
import { JournalEngine } from '../../core/double-entry/journal.engine.js';
import { AutoPostService } from '../../core/double-entry/auto-post.service.js';

const FLOCK_ID = '721ed1c6-97fc-4b61-bb68-777a179b8a07';
const prisma = new PrismaClient();

async function main() {
  const flock = await prisma.broilerFlock.findUnique({ where: { id: FLOCK_ID } });
  if (!flock) throw new Error('Flock not found');

  const existing = await prisma.flockChickAddition.count({ where: { flockId: FLOCK_ID } });
  if (existing > 0) {
    console.log(`Flock already has ${existing} chick addition(s) — nothing to do.`);
    console.log(`  initial=${flock.initialCount} current=${flock.currentCount}`);
    return;
  }

  console.log(`Before: initial=${flock.initialCount} current=${flock.currentCount}`);

  const { purchaseFinrec } = await prisma.$transaction(async (tx) => {
    // 1. Revert the drifted direct edit: initial 295 → 280 (the true order size)
    await tx.broilerFlock.update({ where: { id: FLOCK_ID }, data: { initialCount: 280 } });

    // 2. +5 free hatchery extras on collection day
    await tx.flockChickAddition.create({
      data: {
        flockId: FLOCK_ID,
        organizationId: flock.organizationId,
        additionDate: new Date('2026-10-24'),
        count: 5,
        reason: 'hatchery_extra',
        notes: 'Hatchery bonus chicks (supplied free with order)',
        createdBy: flock.createdBy,
      },
    });

    // 3. +11 purchased top-ups @ K17.50 → finrec 192.50
    const purchase = await tx.flockChickAddition.create({
      data: {
        flockId: FLOCK_ID,
        organizationId: flock.organizationId,
        additionDate: new Date('2026-10-24'),
        count: 11,
        reason: 'purchase',
        unitPriceZmw: 17.5,
        notes: 'Additional chicks purchased after initial order',
        createdBy: flock.createdBy,
      },
    });

    const purchaseFinrec = await tx.financialRecord.create({
      data: {
        flockId: FLOCK_ID,
        sourceRecordId: purchase.id,
        sourceTable: 'flock_chick_additions',
        recordDate: new Date('2026-10-24'),
        category: 'chick_purchase',
        description: `Additional chicks - ${flock.name} (11 birds @ ZMW 17.5)`,
        amountZmw: 192.5,
        isIncome: false,
        isSystemGenerated: true,
        notes: 'Auto-generated from chick addition',
      },
    });
    await tx.flockChickAddition.update({
      where: { id: purchase.id },
      data: { financialRecordId: purchaseFinrec.id },
    });

    // 4. Apply the +16 to both counts on top of the reverted initial
    await tx.broilerFlock.update({
      where: { id: FLOCK_ID },
      data: { initialCount: { increment: 16 }, currentCount: { increment: 16 } },
    });

    return { purchaseFinrec };
  });

  // Journal outside the tx, same as the API route
  const engine = new JournalEngine(prisma);
  const autoPost = new AutoPostService(engine, prisma);
  try {
    await autoPost.postFromFinancialRecord(purchaseFinrec.id, undefined, 'manual');
    console.log('  posted journal for purchased extras (Dr 1030 / Cr 1010, ZMW 192.50)');
  } catch (err: any) {
    console.error(`  journal post FAILED for ${purchaseFinrec.id}: ${err.message}`);
  }

  const after = await prisma.broilerFlock.findUnique({ where: { id: FLOCK_ID } });
  const additions = await prisma.flockChickAddition.findMany({ where: { flockId: FLOCK_ID } });
  console.log(`After: initial=${after!.initialCount} current=${after!.currentCount}`);
  for (const a of additions) {
    console.log(`  addition: +${a.count} ${a.reason} @ ${a.unitPriceZmw ?? 'free'} (${a.additionDate.toISOString().split('T')[0]})`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
