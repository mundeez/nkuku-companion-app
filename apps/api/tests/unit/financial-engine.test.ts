import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { UnifiedFinancialService } from '../../src/core/financial-engine/unified-financial.service.js';
import { FinancialStatementService } from '../../src/core/financial-engine/statements.service.js';
import Decimal from 'decimal.js';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
const unified = new UnifiedFinancialService(prisma);
const statements = new FinancialStatementService(prisma);

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

async function seedTestData() {
  await prisma.user.upsert({
    where: { email: 'test-financial@nkuku.local' },
    update: {},
    create: {
      id: TEST_USER_ID,
      email: 'test-financial@nkuku.local',
      name: 'Test Financial User',
      passwordHash: 'hashed',
      role: 'owner',
    },
  });
  const breed = await prisma.breed.create({
    data: { name: 'Test Breed', supplier: 'Test Supplier' },
  });
  const flock = await prisma.broilerFlock.create({
    data: {
      name: 'Test Flock A',
      breedId: breed.id,
      startDate: new Date('2026-01-01'),
      initialCount: 100,
      currentCount: 95,
      createdBy: TEST_USER_ID,
    },
  });
  await prisma.financialRecord.createMany({
    data: [
      { flockId: flock.id, recordDate: new Date('2026-01-15'), category: 'feed', description: 'Feed 1', amountZmw: new Decimal(500), isIncome: false, notes: '' },
      { flockId: flock.id, recordDate: new Date('2026-01-20'), category: 'vaccines', description: 'Vaccine 1', amountZmw: new Decimal(200), isIncome: false, notes: '' },
      { flockId: flock.id, recordDate: new Date('2026-01-25'), category: 'sales', description: 'Sale 1', amountZmw: new Decimal(1000), isIncome: true, notes: '' },
    ],
  });
  return flock;
}

async function cleanup() {
  await prisma.financialRecord.deleteMany({ where: { flock: { createdBy: TEST_USER_ID } } });
  await prisma.broilerFlock.deleteMany({ where: { createdBy: TEST_USER_ID } });
  await prisma.breed.deleteMany({ where: { name: 'Test Breed' } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
}

describe('UnifiedFinancialService', () => {
  let flockId: string;

  beforeAll(async () => {
    await cleanup();
    const flock = await seedTestData();
    flockId = flock.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('returns correct unified summary totals', async () => {
    const result = await unified.getUnifiedSummary({ userId: TEST_USER_ID });
    expect(result.totalRevenue).toBe(1000);
    expect(result.totalCost).toBe(700);
    expect(result.netProfit).toBe(300);
  });

  it('returns category breakdown', async () => {
    const result = await unified.getUnifiedSummary({ userId: TEST_USER_ID });
    expect(result.categoryBreakdown.length).toBeGreaterThan(0);
    const feedCat = result.categoryBreakdown.find((c) => c.category === 'feed');
    expect(feedCat).toBeDefined();
    expect(feedCat?.cost).toBe(500);
  });

  it('returns flock breakdown', async () => {
    const result = await unified.getUnifiedSummary({ userId: TEST_USER_ID });
    expect(result.flockBreakdown.length).toBe(1);
    expect(result.flockBreakdown[0].flockName).toBe('Test Flock A');
  });

  it('filters by date range', async () => {
    const result = await unified.getUnifiedSummary({
      userId: TEST_USER_ID,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
    });
    expect(result.totalRevenue).toBe(1000);
  });

  it('filters by flockIds', async () => {
    const result = await unified.getUnifiedSummary({
      userId: TEST_USER_ID,
      flockIds: [flockId],
    });
    expect(result.flockBreakdown.length).toBe(1);
  });
});

describe('FinancialStatementService', () => {
  beforeAll(async () => {
    await cleanup();
    await seedTestData();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('generates income statement', async () => {
    const stmt = await statements.getIncomeStatement({ userId: TEST_USER_ID });
    expect(stmt.revenue.total).toBe(1000);
    expect(stmt.cogs.total).toBe(700);
    expect(stmt.grossProfit).toBe(300);
    expect(stmt.operatingExpenses.total).toBe(0);
    expect(stmt.netProfit).toBe(300);
    expect(stmt.grossMargin).toBeCloseTo(30, 1);
  });

  it('generates balance sheet', async () => {
    const sheet = await statements.getBalanceSheet(new Date('2026-02-01'), TEST_USER_ID);
    expect(sheet.assets.total).toBeGreaterThanOrEqual(0);
    expect(sheet.liabilities.total).toBeGreaterThanOrEqual(0);
    expect(sheet.equity.total).toBeDefined();
  });

  it('generates cash flow', async () => {
    const cf = await statements.getCashFlow({ userId: TEST_USER_ID });
    expect(cf.operating.inflows).toBe(1000);
    expect(cf.operating.outflows).toBe(700);
    expect(cf.operating.net).toBe(300);
    expect(cf.netChange).toBe(300);
  });
});
