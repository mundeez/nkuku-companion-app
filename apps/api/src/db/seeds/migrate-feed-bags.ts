/**
 * Backfill feed_bags for existing purchases + convert procurement-style
 * feed_records to feed_purchases.
 *
 * - Every feed_purchase gets bagsPurchased × FeedBag rows (bagIndex 1..N).
 *   Bags belonging to completed flocks are marked finished; active flocks'
 *   bags stay sealed so staff can track consumption going forward.
 * - feed_records that represent whole-bag procurement (round multiples of a
 *   bag size, supplier+brand+cost set) are converted to feed_purchases and
 *   their linked financial_records are re-pointed at the purchase. The
 *   journal entry is untouched (same financial record, same amount).
 *
 * Idempotent: skips purchases that already have bags and records already
 * converted. Safe to re-run.
 */
import { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';

const prisma = new PrismaClient();

// Conversion scope: only real procurement entries — whole-bag quantities.
// Daily feeding logs (demo data with arbitrary cumulative kg) are left as
// feed_records. Bag sizes to try, in order: 50, 25, 10.
const BAG_SIZES = [50, 25, 10];

function toBags(quantityKg: number): { bags: number; bagSize: number } | null {
  for (const size of BAG_SIZES) {
    if (quantityKg > 0 && quantityKg % size === 0) {
      const bags = quantityKg / size;
      if (bags >= 1 && Number.isInteger(bags) && bags <= 100) return { bags, bagSize: size };
    }
  }
  return null;
}

async function main() {
  // ── Step 1: backfill bags for existing purchases ──────────────────────
  const purchases = await prisma.feedPurchase.findMany({
    include: { flock: { select: { status: true } }, bags: { select: { id: true } } },
  });

  let bagsCreated = 0;
  for (const p of purchases) {
    if (p.bags.length > 0) continue; // already materialized
    const finished = p.flock.status === 'completed';
    const rows = Array.from({ length: p.bagsPurchased }, (_, i) => ({
      organizationId: p.organizationId,
      flockId: p.flockId,
      purchaseId: p.id,
      feedStageId: p.feedStageId,
      supplierId: p.supplierId,
      stageName: p.stageName,
      bagSizeKg: p.bagSizeKg,
      bagIndex: i + 1,
      status: finished ? ('finished' as const) : ('sealed' as const),
      ...(finished ? { finishedAt: p.purchaseDate, openedAt: p.purchaseDate } : {}),
    }));
    await prisma.feedBag.createMany({ data: rows });
    bagsCreated += rows.length;
  }
  console.log(`Backfilled ${bagsCreated} feed_bags across ${purchases.length} purchases`);

  // ── Step 2: convert procurement feed_records → feed_purchases ─────────
  // Records that are whole-bag multiples with a supplier are purchase
  // entries logged through the mobile feed-record form. Anything else
  // (partial kg, daily usage logs) stays a feed_record.
  const records = await prisma.feedRecord.findMany({
    where: {
      supplierId: { not: null },
      // Skip demo orgs — their feed_records are daily consumption logs
      // (cumulative kg), not procurement entries.
      flock: { organization: { isDemo: { not: true } } },
    },
    include: { flock: { select: { status: true, organizationId: true } } },
  });

  let converted = 0;
  for (const r of records) {
    const kg = Number(r.quantityKg);
    const conv = toBags(kg);
    if (!conv) continue; // loose-kg usage entry — leave as feed_record

    const existing = await prisma.financialRecord.findFirst({
      where: { sourceRecordId: r.id, sourceTable: 'feed_records' },
    });

    const stageName = (r as any).feedType as string;
    const unitPrice = conv.bags > 0 ? new Decimal(r.costZmw ?? 0).div(conv.bags) : new Decimal(0);
    const total = unitPrice.mul(conv.bags);

    const purchase = await prisma.feedPurchase.create({
      data: {
        organizationId: r.flock.organizationId,
        flockId: r.flockId,
        supplierId: r.supplierId,
        purchaseDate: r.recordDate,
        stageName,
        fulfillsFeedType: stageName,
        bagSizeKg: conv.bagSize,
        bagsPurchased: conv.bags,
        unitPriceZmw: unitPrice.toDecimalPlaces(2).toNumber(),
        totalCostZmw: total.toDecimalPlaces(2).toNumber(),
        notes: r.notes ? `Converted from feed record: ${r.notes}` : `Converted from feed record (${r.feedBrand ?? 'unknown brand'})`,
      },
    });

    // Materialize bags (finished if the flock is completed)
    const finished = r.flock.status === 'completed';
    await prisma.feedBag.createMany({
      data: Array.from({ length: conv.bags }, (_, i) => ({
        organizationId: r.flock.organizationId,
        flockId: r.flockId,
        purchaseId: purchase.id,
        supplierId: r.supplierId,
        stageName,
        bagSizeKg: conv.bagSize,
        bagIndex: i + 1,
        status: finished ? ('finished' as const) : ('sealed' as const),
        ...(finished ? { finishedAt: r.recordDate, openedAt: r.recordDate } : {}),
      })),
    });

    // Re-point the financial record at the purchase (journal untouched)
    if (existing) {
      await prisma.financialRecord.update({
        where: { id: existing.id },
        data: {
          sourceTable: 'feed_purchases',
          sourceRecordId: purchase.id,
          description: `Feed Purchase: ${conv.bags} × ${conv.bagSize}kg ${stageName} bags`,
          notes: `${existing.notes ?? ''} [relinked to purchase ${purchase.id}]`.trim(),
        },
      });
    }

    await prisma.feedRecord.delete({ where: { id: r.id } });
    converted++;
    console.log(`  converted ${r.id} → purchase ${purchase.id} (${conv.bags}×${conv.bagSize}kg ${stageName}, ${r.feedBrand})`);
  }
  console.log(`Converted ${converted} feed_records → feed_purchases`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
