import { PrismaClient } from '@prisma/client';
import { JournalEngine, JournalLineInput } from './journal.engine.js';

const CATEGORY_ACCOUNT_MAP: Record<string, { debit: string; credit: string }> = {
  chick_purchase: { debit: '1030', credit: '1010' },
  feed:           { debit: '5020', credit: '1010' },
  vaccines:       { debit: '5030', credit: '1010' },
  medication:     { debit: '5040', credit: '1010' },
  labor:          { debit: '6010', credit: '1010' },
  labour:         { debit: '6010', credit: '1010' },
  utilities:      { debit: '6020', credit: '1010' },
  electricity:    { debit: '6020', credit: '1010' },
  water:          { debit: '6030', credit: '1010' },
  transport:      { debit: '6040', credit: '1010' },
  equipment:      { debit: '1080', credit: '1010' },
  sales:          { debit: '1010', credit: '4010' },
  other:          { debit: '6080', credit: '1010' },
};

const MORTALITY_ENTRY = { debit: '5050', credit: '1040' };

export class AutoPostService {
  constructor(
    private readonly journalEngine: JournalEngine,
    private readonly prisma: PrismaClient,
  ) {}

  async postFromFinancialRecord(recordId: string, postedBy?: string, sourceType: string = 'manual'): Promise<void> {
    const record = await this.prisma.financialRecord.findUnique({
      where: { id: recordId },
      include: { flock: { select: { organizationId: true } } },
    });
    if (!record) throw new Error(`FinancialRecord not found: ${recordId}`);
    const organizationId = record.flock?.organizationId;
    if (!organizationId) {
      console.warn(`[AutoPost] FinancialRecord ${recordId} has no resolvable organization; skipping journal post.`);
      return;
    }

    const mapping = record.category === 'other' && record.description?.toLowerCase().includes('mortality')
      ? MORTALITY_ENTRY
      : CATEGORY_ACCOUNT_MAP[record.category];

    if (!mapping) {
      console.warn(`[AutoPost] No account mapping for category: ${record.category}`);
      return;
    }

    const amount = Number(record.amountZmw);
    if (amount <= 0) return;

    // The mapping already defines the correct debit/credit accounts for each category.
    // For sales: debit=1010 (Cash), credit=4010 (Revenue) — use directly without swapping.
    const lines: JournalLineInput[] = [
      { accountCode: mapping.debit,  debitZmw: amount, description: record.description, flockId: record.flockId ?? undefined },
      { accountCode: mapping.credit, creditZmw: amount, description: record.description },
    ];

    await this.journalEngine.post({
      entryDate: record.recordDate,
      description: record.description,
      reference: record.id,
      sourceType: sourceType as any,
      sourceId: record.id,
      lines,
      postedBy,
      organizationId,
    });
  }

  // Post a sale as Dr Cash (paid part) + Dr AR (unpaid part) / Cr Bird Sales.
  // Stores the created entry id on the SaleRecord for later reversal.
  async postSale(saleRecordId: string, postedBy?: string): Promise<string | null> {
    const sale = await this.prisma.saleRecord.findUnique({
      where: { id: saleRecordId },
      include: { flock: { select: { organizationId: true } } },
    });
    if (!sale) throw new Error(`SaleRecord not found: ${saleRecordId}`);
    const organizationId = sale.organizationId ?? sale.flock?.organizationId;
    if (!organizationId) {
      console.warn(`[AutoPost] SaleRecord ${saleRecordId} has no resolvable organization; skipping journal post.`);
      return null;
    }

    const total = Number(sale.totalAmountZmw);
    const paid = Number(sale.amountPaidZmw ?? 0);
    if (total <= 0) {
      console.debug(`[AutoPost] SaleRecord ${saleRecordId} has zero total — nothing to post.`);
      return null;
    }
    const description = `Sale: ${sale.birdCount} birds${sale.customerName ? ' to ' + sale.customerName : ''}`;
    const lines: JournalLineInput[] = [];
    if (paid > 0) {
      lines.push({ accountCode: '1010', debitZmw: paid, description, flockId: sale.flockId });
    }
    const unpaid = total - paid;
    if (unpaid > 0) {
      lines.push({ accountCode: '1020', debitZmw: unpaid, description, flockId: sale.flockId });
    }
    lines.push({ accountCode: '4010', creditZmw: total, description });
    if (lines.length < 2) return null;

    const journalId = await this.journalEngine.post({
      entryDate: sale.saleDate,
      description,
      reference: sale.id,
      sourceType: 'sale',
      sourceId: sale.id,
      lines,
      postedBy,
      organizationId,
    });

    await this.prisma.saleRecord.update({
      where: { id: sale.id },
      data: { journalEntryId: journalId },
    });
    return journalId;
  }

  // Post a payment/adjustment against AR. Positive amount: Dr Cash / Cr AR;
  // negative (adjustment down): Dr AR / Cr Cash.
  async postSalePaymentJournal(input: {
    paymentId: string;
    amount: number;
    paidAt: Date;
    description: string;
    flockId?: string;
    organizationId: string;
    postedBy?: string;
  }): Promise<string | null> {
    const amount = input.amount;
    if (amount === 0) return null;
    const abs = Math.abs(amount);
    const lines: JournalLineInput[] = amount > 0
      ? [
          { accountCode: '1010', debitZmw: abs, description: input.description, flockId: input.flockId },
          { accountCode: '1020', creditZmw: abs, description: input.description },
        ]
      : [
          { accountCode: '1020', debitZmw: abs, description: input.description, flockId: input.flockId },
          { accountCode: '1010', creditZmw: abs, description: input.description },
        ];

    return this.journalEngine.post({
      entryDate: input.paidAt,
      description: input.description,
      reference: input.paymentId,
      sourceType: 'sale_payment',
      sourceId: input.paymentId,
      lines,
      postedBy: input.postedBy,
      organizationId: input.organizationId,
    });
  }
}
