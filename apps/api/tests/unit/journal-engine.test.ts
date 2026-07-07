import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JournalEngine } from '../../src/core/double-entry/journal.engine.js';

describe('JournalEngine', () => {
  let engine: JournalEngine;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      account: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'acc-1', code: '5020', isActive: true },
          { id: 'acc-2', code: '2010', isActive: true },
        ]),
      },
      journalEntry: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: 'je-1', entryNumber: 'JE-2026-000001' }),
        findUnique: vi.fn(),
      },
      journalLine: { create: vi.fn() },
      $transaction: vi.fn().mockImplementation((fn) => fn(mockPrisma)),
    };
    engine = new JournalEngine(mockPrisma as any);
  });

  it('accepts a balanced entry', async () => {
    const id = await engine.post({
      entryDate: new Date('2026-01-15'),
      description: 'Feed purchase',
      sourceType: 'feed_record',
      lines: [
        { accountCode: '5020', debitZmw: 500.00 },
        { accountCode: '2010', creditZmw: 500.00 },
      ],
    });
    expect(id).toBe('je-1');
  });

  it('rejects an out-of-balance entry', async () => {
    await expect(engine.post({
      entryDate: new Date(),
      description: 'Bad entry',
      sourceType: 'manual',
      lines: [
        { accountCode: '5020', debitZmw: 500.00 },
        { accountCode: '2010', creditZmw: 400.00 },
      ],
    })).rejects.toThrow('JOURNAL_OUT_OF_BALANCE');
  });

  it('rejects entry with fewer than 2 lines', async () => {
    await expect(engine.post({
      entryDate: new Date(),
      description: 'Single line',
      sourceType: 'manual',
      lines: [{ accountCode: '5020', debitZmw: 100 }],
    })).rejects.toThrow('JOURNAL_REQUIRES_AT_LEAST_2_LINES');
  });

  it('rejects a line with both debit and credit', async () => {
    await expect(engine.post({
      entryDate: new Date(),
      description: 'Invalid line',
      sourceType: 'manual',
      lines: [
        { accountCode: '5020', debitZmw: 100, creditZmw: 100 },
        { accountCode: '2010', creditZmw: 100 },
      ],
    })).rejects.toThrow('LINE_MUST_HAVE_EXACTLY_ONE_OF_DEBIT_OR_CREDIT');
  });

  it('rejects a line with neither debit nor credit', async () => {
    await expect(engine.post({
      entryDate: new Date(),
      description: 'Empty line',
      sourceType: 'manual',
      lines: [
        { accountCode: '5020' },
        { accountCode: '2010', creditZmw: 100 },
      ],
    })).rejects.toThrow('LINE_MUST_HAVE_EXACTLY_ONE_OF_DEBIT_OR_CREDIT');
  });

  it('rejects unknown account codes', async () => {
    mockPrisma.account.findMany.mockResolvedValue([]);
    await expect(engine.post({
      entryDate: new Date(),
      description: 'Unknown account',
      sourceType: 'manual',
      lines: [
        { accountCode: '9999', debitZmw: 100 },
        { accountCode: '2010', creditZmw: 100 },
      ],
    })).rejects.toThrow('ACCOUNT_NOT_FOUND');
  });

  it('handles multi-line compound entries correctly', async () => {
    mockPrisma.account.findMany.mockResolvedValue([
      { id: 'a1', code: '5020', isActive: true },
      { id: 'a2', code: '5030', isActive: true },
      { id: 'a3', code: '2010', isActive: true },
    ]);
    const id = await engine.post({
      entryDate: new Date(),
      description: 'Combined purchase',
      sourceType: 'manual',
      lines: [
        { accountCode: '5020', debitZmw: 300.00 },
        { accountCode: '5030', debitZmw: 200.00 },
        { accountCode: '2010', creditZmw: 500.00 },
      ],
    });
    expect(id).toBe('je-1');
  });

  it('rejects inactive accounts', async () => {
    mockPrisma.account.findMany.mockResolvedValue([]);
    await expect(engine.post({
      entryDate: new Date(),
      description: 'Inactive account',
      sourceType: 'manual',
      lines: [
        { accountCode: '5020', debitZmw: 100 },
        { accountCode: '2010', creditZmw: 100 },
      ],
    })).rejects.toThrow('ACCOUNT_NOT_FOUND');
  });

  it('handles zero-amount lines correctly', async () => {
    await expect(engine.post({
      entryDate: new Date(),
      description: 'Zero amounts',
      sourceType: 'manual',
      lines: [
        { accountCode: '5020', debitZmw: 0 },
        { accountCode: '2010', creditZmw: 100 },
      ],
    })).rejects.toThrow('LINE_MUST_HAVE_EXACTLY_ONE_OF_DEBIT_OR_CREDIT');
  });

  it('generates sequential entry numbers', async () => {
    mockPrisma.journalEntry.count.mockResolvedValue(42);
    await engine.post({
      entryDate: new Date('2026-07-07'),
      description: 'Test entry',
      sourceType: 'manual',
      lines: [
        { accountCode: '5020', debitZmw: 100 },
        { accountCode: '2010', creditZmw: 100 },
      ],
    });
    expect(mockPrisma.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entryNumber: 'JE-2026-000043',
        }),
      }),
    );
  });

  it('reverses an entry by swapping debits and credits', async () => {
    mockPrisma.journalEntry.findUnique.mockResolvedValue({
      id: 'je-original',
      entryNumber: 'JE-2026-000001',
      description: 'Original entry',
      reference: 'ref-1',
      sourceType: 'feed_record',
      sourceId: 'src-1',
      lines: [
        { account: { code: '5020' }, debitZmw: '500.00', creditZmw: null, description: 'Feed cost', flockId: null, batchId: null },
        { account: { code: '2010' }, debitZmw: null, creditZmw: '500.00', description: 'AP', flockId: null, batchId: null },
      ],
    });

    const id = await engine.reverse('je-original', 'user-1', 'Data entry error');
    expect(id).toBe('je-1');
    expect(mockPrisma.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isReversing: true,
          reversesId: 'je-original',
        }),
      }),
    );
  });

  it('rejects reversal of non-existent entry', async () => {
    mockPrisma.journalEntry.findUnique.mockResolvedValue(null);
    await expect(engine.reverse('nonexistent')).rejects.toThrow('JOURNAL_ENTRY_NOT_FOUND');
  });
});
