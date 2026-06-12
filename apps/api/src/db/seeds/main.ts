import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('[SEED] Starting...');

  // ── 1. Seed owner user ─────────────────
  const ownerPasswordHash = await bcrypt.hash(
    process.env.OWNER_PASSWORD || 'change_me',
    12,
  );
  const owner = await prisma.user.upsert({
    where: { email: process.env.OWNER_EMAIL || 'owner@nkuku.local' },
    update: {},
    create: {
      email: process.env.OWNER_EMAIL || 'owner@nkuku.local',
      passwordHash: ownerPasswordHash,
      role: 'owner',
      name: 'Farm Owner',
    },
  });
  console.log('[SEED] Owner user:', owner.email);

  // ── 2. Seed Suppliers + Feed Stages ─────
  const suppliersData = [
    {
      name: 'NUTRI FEED',
      description: 'Primary supplier. Baseline pricing structure for initial system seeding.',
      isDefault: true,
      createdBy: owner.id,
      stages: [
        { stageName: 'Starter', stageType: 'feed', dayRangeStart: 0, dayRangeEnd: 18, unitSizeKg: 50, unitPriceZmw: 785, intakePerBirdKg: 0.8, sortOrder: 0 },
        { stageName: 'Grower', stageType: 'feed', dayRangeStart: 19, dayRangeEnd: 28, unitSizeKg: 50, unitPriceZmw: 750, intakePerBirdKg: 1.2, sortOrder: 1 },
        { stageName: 'Finisher', stageType: 'feed', dayRangeStart: 29, dayRangeEnd: 42, unitSizeKg: 50, unitPriceZmw: 730, intakePerBirdKg: 1.5, sortOrder: 2 },
        { stageName: 'Day-old Chicks', stageType: 'chick', unitSizeKg: 1, unitPriceZmw: 18, intakePerBirdKg: 1.0, sortOrder: 99 },
      ],
    },
    {
      name: 'NOVATEK',
      description: 'Five-stage feed programme with pre-starter and withdrawal phases.',
      createdBy: owner.id,
      stages: [
        { stageName: 'Pre-starter', stageType: 'feed', dayRangeStart: 0, dayRangeEnd: 7, unitSizeKg: 50, unitPriceZmw: 795, intakePerBirdKg: 0.2, sortOrder: 0 },
        { stageName: 'Starter', stageType: 'feed', dayRangeStart: 0, dayRangeEnd: 12, unitSizeKg: 50, unitPriceZmw: 782, intakePerBirdKg: 0.5, sortOrder: 1 },
        { stageName: 'Grower', stageType: 'feed', dayRangeStart: 13, dayRangeEnd: 24, unitSizeKg: 50, unitPriceZmw: 740, intakePerBirdKg: 1.0, sortOrder: 2 },
        { stageName: 'Finisher', stageType: 'feed', dayRangeStart: 25, dayRangeEnd: 33, unitSizeKg: 50, unitPriceZmw: 720, intakePerBirdKg: 1.3, sortOrder: 3 },
        { stageName: 'Withdrawal', stageType: 'feed', dayRangeStart: 34, dayRangeEnd: 38, unitSizeKg: 50, unitPriceZmw: 704, intakePerBirdKg: 0.7, sortOrder: 4 },
        { stageName: 'Day-old Chicks', stageType: 'chick', unitSizeKg: 1, unitPriceZmw: 19, intakePerBirdKg: 1.0, sortOrder: 99 },
      ],
    },
    {
      name: 'TIGER FEED',
      description: 'Cost-competitive three-stage programme.',
      createdBy: owner.id,
      stages: [
        { stageName: 'Starter', stageType: 'feed', dayRangeStart: 0, dayRangeEnd: 18, unitSizeKg: 50, unitPriceZmw: 511, intakePerBirdKg: 0.8, sortOrder: 0 },
        { stageName: 'Grower', stageType: 'feed', dayRangeStart: 19, dayRangeEnd: 32, unitSizeKg: 50, unitPriceZmw: 472, intakePerBirdKg: 1.2, sortOrder: 1 },
        { stageName: 'Finishers', stageType: 'feed', dayRangeStart: 33, dayRangeEnd: 42, unitSizeKg: 50, unitPriceZmw: 442, intakePerBirdKg: 1.4, sortOrder: 2 },
        { stageName: 'Day-old Chicks', stageType: 'chick', unitSizeKg: 1, unitPriceZmw: 20, intakePerBirdKg: 1.0, sortOrder: 99 },
      ],
    },
    {
      name: 'BROWN BROILERS with TIGER FEED',
      description: 'Brown broiler-specific three-stage programme using TIGER FEED.',
      createdBy: owner.id,
      chickenType: 'BROWN',
      stages: [
        { stageName: 'Starter', stageType: 'feed', dayRangeStart: 0, dayRangeEnd: 18, unitSizeKg: 50, unitPriceZmw: 500, intakePerBirdKg: 0.8, sortOrder: 0 },
        { stageName: 'Grower', stageType: 'feed', dayRangeStart: 19, dayRangeEnd: 32, unitSizeKg: 50, unitPriceZmw: 480, intakePerBirdKg: 1.2, sortOrder: 1 },
        { stageName: 'Finishers', stageType: 'feed', dayRangeStart: 33, dayRangeEnd: 42, unitSizeKg: 50, unitPriceZmw: 450, intakePerBirdKg: 1.4, sortOrder: 2 },
        { stageName: 'Day-old Chicks', stageType: 'chick', unitSizeKg: 1, unitPriceZmw: 19, intakePerBirdKg: 1.0, sortOrder: 99 },
      ],
    },
    {
      name: 'ZAM FEED',
      description: 'Local Zambian supplier with standard three-stage programme.',
      createdBy: owner.id,
      stages: [
        { stageName: 'Starter', stageType: 'feed', dayRangeStart: 0, dayRangeEnd: 18, unitSizeKg: 50, unitPriceZmw: 714, intakePerBirdKg: 0.8, sortOrder: 0 },
        { stageName: 'Grower', stageType: 'feed', dayRangeStart: 19, dayRangeEnd: 28, unitSizeKg: 50, unitPriceZmw: 679, intakePerBirdKg: 1.2, sortOrder: 1 },
        { stageName: 'Finisher', stageType: 'feed', dayRangeStart: 29, dayRangeEnd: 42, unitSizeKg: 50, unitPriceZmw: 650, intakePerBirdKg: 1.5, sortOrder: 2 },
        { stageName: 'Day-old Chicks', stageType: 'chick', unitSizeKg: 1, unitPriceZmw: 19, intakePerBirdKg: 1.0, sortOrder: 99 },
      ],
    },
  ];

  for (const s of suppliersData) {
    const { stages, ...supplierCreate } = s;
    const supplier = await prisma.supplier.upsert({
      where: { name: supplierCreate.name },
      update: {},
      create: supplierCreate,
    });

    for (const stage of stages) {
      await prisma.feedStage.upsert({
        where: {
          supplierId_stageName: { supplierId: supplier.id, stageName: stage.stageName },
        },
        update: {},
        create: { ...stage, supplierId: supplier.id },
      });
    }
    console.log('[SEED] Supplier + stages:', supplier.name);
  }

  // ── 3. Seed Exchange Rate ───────────────
  await prisma.exchangeRate.upsert({
    where: {
      currencyFrom_currencyTo_effectiveDate: {
        currencyFrom: 'USD',
        currencyTo: 'ZMW',
        effectiveDate: new Date('2024-11-01'),
      },
    },
    update: {},
    create: {
      currencyFrom: 'USD',
      currencyTo: 'ZMW',
      rate: 17.71,
      effectiveDate: new Date('2024-11-01'),
      source: 'manual',
    },
  });
  console.log('[SEED] Exchange rate: USD/ZMW = 17.71');

  // ── 4. Seed Equipment Items ────────────
  const equipmentData = [
    { category: 'raising_equipment', name: 'Abbatoir Set (12,000 BPH)', unitCostUsd: 60000, isCompulsory: true, quantity: 1 },
    { category: 'cold_storage', name: 'Cold Room', unitCostUsd: 0, isCompulsory: true, quantity: 1, notes: 'Pricing TBD' },
    { category: 'other', name: 'Hot Smoker (500Kgs/Batch)', unitCostUsd: 14000, isCompulsory: false, quantity: 1 },
    { category: 'other', name: 'Cold Smoker (500Kgs/Batch)', unitCostUsd: 20000, isCompulsory: false, quantity: 1 },
    { category: 'raising_equipment', name: 'Raising Equipment Package (10206 capacity)', unitCostUsd: 13795.79, isCompulsory: true, quantity: 1, notes: 'Includes shipping to farm' },
  ];

  for (const eq of equipmentData) {
    await prisma.equipmentItem.upsert({
      where: { id: `seeded-${eq.name}` },
      update: {},
      create: { ...eq, id: `seeded-${eq.name}` },
    });
  }
  console.log('[SEED] Equipment items:', equipmentData.length);

  // ── 5. Seed Production Cycles & Batches ──
  const expansionRows = [
    { cycleNumber: 1, targetExecutionDt: '2024-12-05', growthQtyAdded: 0, totalQtyAtHand: 200, shootLabel: 'Shoot 1', revenueTargetZmw: 5000, salesDate: '2025-01-16' },
    { cycleNumber: 1, targetExecutionDt: '2024-12-26', growthQtyAdded: 0, totalQtyAtHand: 200, shootLabel: 'Shoot 2', revenueTargetZmw: 5000, salesDate: '2025-02-06' },
    { cycleNumber: 2, targetExecutionDt: '2025-01-16', growthQtyAdded: 100, totalQtyAtHand: 300, shootLabel: 'Shoot 1', revenueTargetZmw: 6000, salesDate: '2025-02-27' },
    { cycleNumber: 2, targetExecutionDt: '2025-02-06', growthQtyAdded: 100, totalQtyAtHand: 300, shootLabel: 'Shoot 2', revenueTargetZmw: 6000, salesDate: '2025-03-20' },
    { cycleNumber: 3, targetExecutionDt: '2025-02-27', growthQtyAdded: 150, totalQtyAtHand: 450, shootLabel: 'Shoot 1', revenueTargetZmw: 10000, salesDate: '2025-04-10' },
    { cycleNumber: 3, targetExecutionDt: '2025-03-20', growthQtyAdded: 150, totalQtyAtHand: 450, shootLabel: 'Shoot 2', revenueTargetZmw: 10000, salesDate: '2025-05-01' },
    { cycleNumber: 4, targetExecutionDt: '2025-04-10', growthQtyAdded: 200, totalQtyAtHand: 650, shootLabel: 'Shoot 1', revenueTargetZmw: 15000, salesDate: '2025-05-22' },
    { cycleNumber: 4, targetExecutionDt: '2025-05-01', growthQtyAdded: 200, totalQtyAtHand: 650, shootLabel: 'Shoot 2', revenueTargetZmw: 15000, salesDate: '2025-06-12' },
    { cycleNumber: 5, targetExecutionDt: '2025-05-22', growthQtyAdded: 300, totalQtyAtHand: 950, shootLabel: 'Shoot 1', revenueTargetZmw: 20000, salesDate: '2025-07-03' },
    { cycleNumber: 5, targetExecutionDt: '2025-06-12', growthQtyAdded: 300, totalQtyAtHand: 950, shootLabel: 'Shoot 2', revenueTargetZmw: 20000, salesDate: '2025-07-24' },
    { cycleNumber: 6, targetExecutionDt: '2025-07-03', growthQtyAdded: 450, totalQtyAtHand: 1400, shootLabel: 'Shoot 1', revenueTargetZmw: 30000, salesDate: '2025-08-14' },
    { cycleNumber: 6, targetExecutionDt: '2025-07-24', growthQtyAdded: 450, totalQtyAtHand: 1400, shootLabel: 'Shoot 2', revenueTargetZmw: 30000, salesDate: '2025-09-04' },
    { cycleNumber: 7, targetExecutionDt: '2025-08-14', growthQtyAdded: 600, totalQtyAtHand: 2000, shootLabel: 'Shoot 1', revenueTargetZmw: 50000, salesDate: '2025-09-25' },
    { cycleNumber: 7, targetExecutionDt: '2025-09-04', growthQtyAdded: 600, totalQtyAtHand: 2000, shootLabel: 'Shoot 2', revenueTargetZmw: 50000, salesDate: '2025-10-16' },
  ];

  for (const row of expansionRows) {
    const cycle = await prisma.productionCycle.upsert({
      where: { cycleNumber: row.cycleNumber },
      update: {},
      create: {
        cycleNumber: row.cycleNumber,
        label: `Cycle ${row.cycleNumber}`,
        status: 'planned',
        createdBy: owner.id,
      },
    });

    // Pick NUTRI FEED as default supplier for seeded batches
    const defaultSupplier = await prisma.supplier.findFirst({ where: { isDefault: true } });

    await prisma.batch.upsert({
      where: { id: `seeded-${cycle.id}-${row.shootLabel}` },
      update: {},
      create: {
        id: `seeded-${cycle.id}-${row.shootLabel}`,
        cycleId: cycle.id,
        supplierId: defaultSupplier!.id,
        shootLabel: row.shootLabel,
        targetExecutionDt: new Date(row.targetExecutionDt),
        salesDate: new Date(row.salesDate),
        growthQtyAdded: row.growthQtyAdded,
        totalQtyAtHand: row.totalQtyAtHand,
        revenueTargetZmw: row.revenueTargetZmw,
        status: 'planned',
        createdBy: owner.id,
      },
    });
  }
  console.log('[SEED] Production cycles + batches:', expansionRows.length);

  console.log('[SEED] Complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

