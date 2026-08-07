/**
 * Settlement Script: Clear AP/Accrued balances to Owner's Capital
 *
 * The original auto-post mapping credited AP (2010) or Accrued (2020) for
 * all expense purchases, treating them as credit purchases. In reality,
 * these were cash purchases funded by the owner. This script creates
 * balancing journal entries to settle the outstanding AP/Accrued balances
 * by debiting them and crediting Owner's Capital (3010).
 *
 * If a previous (incorrect) settlement credited Cash instead of Capital,
 * this script will reverse it first.
 *
 * This restores the balance sheet equation: Assets = Liabilities + Equity.
 *
 * Run inside container:
 *   docker compose exec api npx tsx src/db/seeds/settle-ap-to-cash.ts
 */

import { PrismaClient } from '@prisma/client';
import { JournalEngine, JournalLineInput } from '../../core/double-entry/journal.engine.js';

const prisma = new PrismaClient();
const engine = new JournalEngine(prisma);

async function main() {
  console.log('[Settle-AP] Starting AP/Accrued settlement...');

  // This is a one-off historical-data fix predating multi-tenancy; all
  // affected journal entries belong to the original "Organization #1".
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!org) throw new Error('No organization found — cannot attribute settlement entries.');

  const asOf = new Date('2026-12-31');

  // Step 1: Reverse any incorrect settlement entries (those that credited Cash)
  const wrongSettlements = await prisma.journalEntry.findMany({
    where: {
      sourceType: 'migration',
      description: { contains: 'Settle' },
    },
    include: { lines: { include: { account: true } } },
  });

  for (const entry of wrongSettlements) {
    // Check if it credits Cash (1010) — that's the wrong one
    const creditsCash = entry.lines.some(
      (l) => l.account.code === '1010' && Number(l.creditZmw ?? 0) > 0,
    );
    if (!creditsCash) continue;

    // Check if already reversed
    const alreadyReversed = await prisma.journalEntry.findFirst({
      where: { reversesId: entry.id },
    });
    if (alreadyReversed) {
      console.log(`[Settle-AP] ${entry.entryNumber} already reversed, skipping`);
      continue;
    }

    console.log(`[Settle-AP] Reversing incorrect settlement ${entry.entryNumber}...`);
    await engine.reverse(entry.id, undefined, 'Correcting settlement to Owner Capital');
    console.log(`[Settle-AP] Reversed.`);
  }

  // Step 2: Settle remaining AP/Accrued balances to Owner's Capital
  const accounts = await prisma.account.findMany({
    where: { code: { in: ['2010', '2020'] }, isActive: true },
  });

  let settled = 0;
  let skipped = 0;

  for (const account of accounts) {
    const agg = await prisma.journalLine.aggregate({
      where: {
        accountId: account.id,
        journal: { entryDate: { lte: asOf } },
      },
      _sum: { debitZmw: true, creditZmw: true },
    });

    const debitSum = Number(agg._sum.debitZmw ?? 0);
    const creditSum = Number(agg._sum.creditZmw ?? 0);
    const netBalance = debitSum - creditSum; // negative = credit balance (liability)

    if (Math.abs(netBalance) < 0.01) {
      console.log(`[Settle-AP] ${account.code} (${account.name}): zero balance, skipping`);
      skipped++;
      continue;
    }

    if (netBalance > 0) {
      console.log(`[Settle-AP] ${account.code} (${account.name}): debit balance ${netBalance}, skipping`);
      skipped++;
      continue;
    }

    const settleAmount = Math.abs(netBalance);
    console.log(`[Settle-AP] ${account.code} (${account.name}): settling ${settleAmount} to Owner's Capital`);

    // Check if already settled to capital
    const existing = await prisma.journalEntry.findFirst({
      where: {
        sourceType: 'migration',
        description: `Settle ${account.code} balance to Owner's Capital`,
      },
    });
    if (existing) {
      console.log(`[Settle-AP]   already settled (JE ${existing.entryNumber}), skipping`);
      skipped++;
      continue;
    }

    // Create settlement entry: Dr AP/Accrued, Cr Owner's Capital
    const lines: JournalLineInput[] = [
      { accountCode: account.code, debitZmw: settleAmount, description: `Settle ${account.name} balance to Owner's Capital` },
      { accountCode: '3010', creditZmw: settleAmount, description: `Owner capital contribution for ${account.name} settlement` },
    ];

    await engine.post({
      entryDate: asOf,
      description: `Settle ${account.code} balance to Owner's Capital`,
      sourceType: 'migration',
      lines,
      organizationId: org.id,
    });
    settled++;
  }

  console.log('');
  console.log(`[Settle-AP] Complete. Settled: ${settled}, Skipped: ${skipped}`);

  // Verify balance sheet
  const types = ['asset', 'liability', 'equity', 'revenue', 'expense'];
  const totals: Record<string, number> = {};
  for (const type of types) {
    const accts = await prisma.account.findMany({ where: { accountType: type as any, isActive: true } });
    let sum = 0;
    for (const a of accts) {
      const agg = await prisma.journalLine.aggregate({
        where: { accountId: a.id, journal: { entryDate: { lte: asOf } } },
        _sum: { debitZmw: true, creditZmw: true },
      });
      sum += Number(agg._sum.debitZmw ?? 0) - Number(agg._sum.creditZmw ?? 0);
    }
    totals[type] = sum;
  }

  const totalAssets = totals['asset'];
  const totalLiab = Math.abs(totals['liability']);
  const netIncome = Math.abs(totals['revenue']) - Math.abs(totals['expense']);
  const totalEquity = Math.abs(totals['equity']) + netIncome;
  const totalLE = totalLiab + totalEquity;

  console.log('');
  console.log('=== Balance Sheet Verification ===');
  console.log(`Total Assets:       ${totalAssets.toFixed(2)}`);
  console.log(`Total Liabilities:  ${totalLiab.toFixed(2)}`);
  console.log(`Total Equity:       ${totalEquity.toFixed(2)}`);
  console.log(`Total L+E:          ${totalLE.toFixed(2)}`);
  console.log(`Diff (A - LE):      ${(totalAssets - totalLE).toFixed(2)}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[Settle-AP] FATAL:', err);
  process.exit(1);
});
