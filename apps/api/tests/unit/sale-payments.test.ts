import { describe, it, expect, vi } from 'vitest';
import { AutoPostService } from '../../src/core/double-entry/auto-post.service.js';

// Payment status derivation from the payment-history sum.
function deriveStatus(total: number, paid: number) {
  return paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'pending';
}

describe('payment status derivation', () => {
  it('paid=0 → pending; 0<paid<total → partial; paid>=total → paid', () => {
    expect(deriveStatus(1000, 0)).toBe('pending');
    expect(deriveStatus(1000, 400)).toBe('partial');
    expect(deriveStatus(1000, 1000)).toBe('paid');
    expect(deriveStatus(1000, 1100)).toBe('paid');
    expect(deriveStatus(0, 0)).toBe('pending'); // zero-total sale never "paid"
  });
});

function makeMocks(sale: any, posted: any[] = []) {
  const prisma: any = {
    saleRecord: {
      findUnique: vi.fn().mockResolvedValue({ ...sale, flock: { organizationId: 'org1' } }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const engine: any = {
    post: vi.fn(async (input: any) => { posted.push(input); return 'journal-1'; }),
  };
  return { prisma, engine, posted };
}

const saleBase = {
  id: 'sale-1', organizationId: 'org1', flockId: 'f1',
  customerName: 'Musa', birdCount: 100, saleDate: new Date('2026-10-01'),
};

describe('AutoPostService.postSale line split', () => {
  it('paid=0 → Dr 1020 total / Cr 4010 total only', async () => {
    const { prisma, engine, posted } = makeMocks({ ...saleBase, totalAmountZmw: 1000, amountPaidZmw: 0 });
    const id = await new AutoPostService(engine, prisma).postSale('sale-1');
    expect(id).toBe('journal-1');
    const lines = posted[0].lines;
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ accountCode: '1020', debitZmw: 1000 });
    expect(lines[1]).toMatchObject({ accountCode: '4010', creditZmw: 1000 });
    expect(prisma.saleRecord.update).toHaveBeenCalledWith({ where: { id: 'sale-1' }, data: { journalEntryId: 'journal-1' } });
  });

  it('partial → Dr 1010 paid + Dr 1020 unpaid / Cr 4010', async () => {
    const { prisma, engine, posted } = makeMocks({ ...saleBase, totalAmountZmw: 1000, amountPaidZmw: 400 });
    await new AutoPostService(engine, prisma).postSale('sale-1');
    const lines = posted[0].lines;
    expect(lines.map((l: any) => l.accountCode)).toEqual(['1010', '1020', '4010']);
    expect(lines[0].debitZmw).toBe(400);
    expect(lines[1].debitZmw).toBe(600);
    expect(lines[2].creditZmw).toBe(1000);
  });

  it('total 0 → returns null, no journal post', async () => {
    const { prisma, engine, posted } = makeMocks({ ...saleBase, totalAmountZmw: 0, amountPaidZmw: 0 });
    const id = await new AutoPostService(engine, prisma).postSale('sale-1');
    expect(id).toBeNull();
    expect(posted).toHaveLength(0);
    expect(prisma.saleRecord.update).not.toHaveBeenCalled();
  });

  it('full → Dr 1010 total / Cr 4010 only', async () => {
    const { prisma, engine, posted } = makeMocks({ ...saleBase, totalAmountZmw: 1000, amountPaidZmw: 1000 });
    await new AutoPostService(engine, prisma).postSale('sale-1');
    const lines = posted[0].lines;
    expect(lines.map((l: any) => l.accountCode)).toEqual(['1010', '4010']);
  });
});

describe('postSalePaymentJournal direction', () => {
  it('positive → Dr 1010 / Cr 1020; negative → Dr 1020 / Cr 1010', async () => {
    const engine: any = { post: vi.fn(async (i: any) => i) };
    const svc = new AutoPostService(engine, {} as any);
    const base = { paymentId: 'p1', paidAt: new Date(), description: 'd', organizationId: 'o' };
    const pos = await svc.postSalePaymentJournal({ ...base, amount: 300 });
    expect(pos.lines[0].accountCode).toBe('1010');
    expect(pos.lines[1].accountCode).toBe('1020');
    const neg = await svc.postSalePaymentJournal({ ...base, amount: -150 });
    expect(neg.lines[0].accountCode).toBe('1020');
    expect(neg.lines[0].debitZmw).toBe(150);
    expect(neg.lines[1].accountCode).toBe('1010');
    expect(await svc.postSalePaymentJournal({ ...base, amount: 0 })).toBeNull();
  });
});
