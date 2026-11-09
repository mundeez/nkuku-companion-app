/**
 * Correction: move the paid/unpaid split of existing sales into Cash vs AR.
 *
 * For every SaleRecord:
 *   1. Find the old journal posting for its linked FinancialRecord
 *      (sourceId = FR id, sourceType 'migration' or 'manual'). May be absent.
 *   2. If present and not already reversed → reverse it ('AR correction v1.48').
 *   3. Re-post via AutoPostService.postSale with the CURRENT paid/unpaid
 *      amounts (entryDate = sale date, sourceType 'sale', journalEntryId stored).
 *   Skips sales that already have journalEntryId set (idempotent).
 *   Opening-balance payment rows get no posting — their paid part is already
 *   inside Cash via the re-posted split.
 *
 * Usage:
 *   docker compose exec api npx tsx src/db/seeds/correct-sales-receivables.ts            # dry-run (default)
 *   docker compose exec api npx tsx src/db/seeds/correct-sales-receivables.ts --apply
 */

import { PrismaClient } from '@prisma/client';
import { JournalEngine } from '../../core/double-entry/journal.engine.js';
import { AutoPostService } from '../../core/double-entry/auto-post.service.js';

const prisma = new PrismaClient();
const engine = new JournalEngine(prisma);
const autoPost = new AutoPostService(engine, prisma);

const APPLY = process.argv.includes('--apply');

function parseFrId(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/^\[FR:([0-9a-fA-F-]{36})\]/);
  return m ? m[1] : null;
}

async function main() {
  const sales = await prisma.saleRecord.findMany({
    orderBy: { saleDate: 'asc' },
    select: {
      id: true,
      organizationId: true,
      totalAmountZmw: true,
      amountPaidZmw: true,
      saleDate: true,
      notes: true,
      journalEntryId: true,
    },
  });

  const perOrg = new Map<string, { toFix: number; toReverse: number; cashToAr: number; zeroValue: number; alreadyPosted: number; anomalies: string[] }>();
  const report = (orgId: string) => {
    if (!perOrg.has(orgId)) perOrg.set(orgId, { toFix: 0, toReverse: 0, cashToAr: 0, zeroValue: 0, alreadyPosted: 0, anomalies: [] });
    return perOrg.get(orgId)!;
  };

  for (const sale of sales) {
    const org = report(sale.organizationId);
    if (sale.journalEntryId) {
      report(sale.organizationId).alreadyPosted++;
      continue; // already corrected/posted
    }

    const frId = parseFrId(sale.notes);
    const postings = frId
      ? await prisma.journalEntry.findMany({
          where: { sourceId: frId, sourceType: { in: ['migration', 'manual'] } },
        })
      : [];

    if (postings.length > 1) {
      org.anomalies.push(`${sale.id} (${postings.length} postings)`);
      continue;
    }

    const total = Number(sale.totalAmountZmw);
    const paid = Number(sale.amountPaidZmw ?? 0);
    const ar = Math.max(0, total - paid);

    if (total <= 0) {
      org.zeroValue++;
      if (APPLY) {
        // nothing to post — mark nothing
      }
      continue;
    }

    org.toFix++;
    if (postings.length === 1) org.toReverse++;
    org.cashToAr += ar;

    if (!APPLY) continue;

    if (postings.length === 1) {
      const alreadyReversed = await prisma.journalEntry.findFirst({
        where: { reversesId: postings[0].id },
      });
      if (!alreadyReversed) {
        await engine.reverse(postings[0].id, undefined, 'AR correction v1.48');
      }
    }
    await autoPost.postSale(sale.id);
  }

  console.log(APPLY ? '=== APPLIED ===' : '=== DRY RUN (use --apply to execute) ===');
  let grandAr = 0;
  for (const [orgId, s] of perOrg) {
    grandAr += s.cashToAr;
    console.log(`Org ${orgId}: sales to fix=${s.toFix}, entries to reverse=${s.toReverse}, Cash→AR movement=ZMW ${s.cashToAr.toFixed(2)}, already posted=${s.alreadyPosted}, zero-value skipped=${s.zeroValue}`);
    if (s.anomalies.length) console.log(`  ANOMALIES (skipped): ${s.anomalies.join(', ')}`);
  }
  console.log(`TOTAL Cash→AR movement: ZMW ${grandAr.toFixed(2)}`);

  // Trial-balance check
  const lines = await prisma.journalLine.findMany({
    select: { debitZmw: true, creditZmw: true },
  });
  const deb = lines.reduce((s, l) => s + Number(l.debitZmw ?? 0), 0);
  const cred = lines.reduce((s, l) => s + Number(l.creditZmw ?? 0), 0);
  const acc1020 = await prisma.journalLine.findMany({
    where: { account: { code: '1020' } },
    select: { debitZmw: true, creditZmw: true },
  });
  const arBalance = acc1020.reduce((s, l) => s + Number(l.debitZmw ?? 0) - Number(l.creditZmw ?? 0), 0);
  const remainingDue = (await prisma.saleRecord.findMany({ select: { totalAmountZmw: true, amountPaidZmw: true } }))
    .reduce((s, r) => s + Math.max(0, Number(r.totalAmountZmw) - Number(r.amountPaidZmw ?? 0)), 0);
  console.log(`Trial balance: debits=${deb.toFixed(2)} credits=${cred.toFixed(2)} ${Math.abs(deb - cred) < 0.01 ? 'BALANCED' : 'UNBALANCED'}`);
  console.log(`1020 balance=${arBalance.toFixed(2)} | sum(remainingDue)=${remainingDue.toFixed(2)}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
