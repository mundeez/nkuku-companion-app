import { Decimal } from 'decimal.js';
import { PrismaClient } from '@prisma/client';

export interface JournalLineInput {
  accountCode: string;
  debitZmw?: number;
  creditZmw?: number;
  description?: string;
  flockId?: string;
  batchId?: string;
}

export interface JournalEntryInput {
  entryDate: Date;
  description: string;
  reference?: string;
  sourceType: string;
  sourceId?: string;
  lines: JournalLineInput[];
  isReversing?: boolean;
  reversesId?: string;
  postedBy?: string;
}

export class JournalEngine {
  constructor(private readonly prisma: PrismaClient) {}

  async post(input: JournalEntryInput): Promise<string> {
    if (input.lines.length < 2) {
      throw new Error('JOURNAL_REQUIRES_AT_LEAST_2_LINES');
    }

    const accounts = await this.prisma.account.findMany({
      where: {
        code: { in: input.lines.map((l) => l.accountCode) },
        isActive: true,
      },
    });

    const accountMap = new Map(accounts.map((a) => [a.code, a]));
    for (const line of input.lines) {
      if (!accountMap.has(line.accountCode)) {
        throw new Error(`ACCOUNT_NOT_FOUND: ${line.accountCode}`);
      }
      const hasDebit = line.debitZmw !== undefined && line.debitZmw > 0;
      const hasCredit = line.creditZmw !== undefined && line.creditZmw > 0;
      if (hasDebit === hasCredit) {
        throw new Error(`LINE_MUST_HAVE_EXACTLY_ONE_OF_DEBIT_OR_CREDIT: ${line.accountCode}`);
      }
    }

    const totalDebit = input.lines.reduce(
      (sum, l) => sum.plus(l.debitZmw ?? 0),
      new Decimal(0),
    );
    const totalCredit = input.lines.reduce(
      (sum, l) => sum.plus(l.creditZmw ?? 0),
      new Decimal(0),
    );

    if (!totalDebit.eq(totalCredit)) {
      throw new Error(
        `JOURNAL_OUT_OF_BALANCE: debits=${totalDebit.toFixed(2)}, credits=${totalCredit.toFixed(2)}`,
      );
    }

    const year = new Date().getFullYear();
    const lastEntry = await this.prisma.journalEntry.findFirst({
      where: { entryNumber: { startsWith: `JE-${year}-` } },
      orderBy: { entryNumber: 'desc' },
    });
    const nextSeq = lastEntry
      ? parseInt(lastEntry.entryNumber.split('-')[2], 10) + 1
      : 1;
    const entryNumber = `JE-${year}-${String(nextSeq).padStart(6, '0')}`;

    const periodLabel = input.entryDate.toISOString().substring(0, 7);

    const entry = await this.prisma.$transaction(async (tx) => {
      const je = await tx.journalEntry.create({
        data: {
          entryNumber,
          entryDate: input.entryDate,
          description: input.description,
          reference: input.reference,
          sourceType: input.sourceType as any,
          sourceId: input.sourceId,
          periodLabel,
          isReversing: input.isReversing ?? false,
          reversesId: input.reversesId,
          postedBy: input.postedBy,
        },
      });

      for (const line of input.lines) {
        const account = accountMap.get(line.accountCode)!;
        await tx.journalLine.create({
          data: {
            journalId: je.id,
            accountId: account.id,
            debitZmw: line.debitZmw ? new Decimal(line.debitZmw) : null,
            creditZmw: line.creditZmw ? new Decimal(line.creditZmw) : null,
            description: line.description,
            flockId: line.flockId,
            batchId: line.batchId,
          },
        });
      }

      return je;
    });

    return entry.id;
  }

  async reverse(journalId: string, postedBy?: string, reason?: string): Promise<string> {
    const original = await this.prisma.journalEntry.findUnique({
      where: { id: journalId },
      include: { lines: { include: { account: true } } },
    });

    if (!original) throw new Error(`JOURNAL_ENTRY_NOT_FOUND: ${journalId}`);

    const reversalLines: JournalLineInput[] = original.lines.map((l) => ({
      accountCode: l.account.code,
      debitZmw: l.creditZmw ? Number(l.creditZmw) : undefined,
      creditZmw: l.debitZmw ? Number(l.debitZmw) : undefined,
      description: `Reversal: ${l.description ?? ''}`,
      flockId: l.flockId ?? undefined,
      batchId: l.batchId ?? undefined,
    }));

    return this.post({
      entryDate: new Date(),
      description: `REVERSAL of ${original.entryNumber} - ${reason ?? 'Correction'}`,
      reference: original.reference ?? undefined,
      sourceType: original.sourceType,
      sourceId: original.sourceId ?? undefined,
      lines: reversalLines,
      isReversing: true,
      reversesId: journalId,
      postedBy,
    });
  }
}
