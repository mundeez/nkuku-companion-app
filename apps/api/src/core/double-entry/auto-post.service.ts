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
}
