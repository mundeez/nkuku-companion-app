/**
 * Seed fictional demo data for the "Nkuku Demo Farm" organization (is_demo).
 * Powers marketing screenshots + prospective-customer walkthroughs.
 * Idempotent: wipes and recreates demo-org child data on each run.
 * Usage: npx tsx src/db/seeds/seed-demo-farm.ts  (inside the api container)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DAY = 86_400_000;
const today = () => new Date();
const d = (daysAgo: number) => new Date(today().getTime() - daysAgo * DAY);

async function main() {
  const org = await prisma.organization.findFirst({ where: { isDemo: true } });
  if (!org) throw new Error('No demo organization found (is_demo=true)');
  const orgId = org.id;
  const owner = await prisma.organizationMember.findFirst({ where: { organizationId: orgId, role: 'owner' } });
  if (!owner) throw new Error('Demo org has no owner');
  const userId = owner.userId;

  // ── wipe prior demo data (child tables first) ──
  const flockIds = (await prisma.broilerFlock.findMany({ where: { organizationId: orgId }, select: { id: true } })).map((f) => f.id);
  if (flockIds.length) {
    const kinds = ['growthRecord', 'feedRecord', 'waterRecord', 'mortalityEvent', 'vaccinationEvent', 'financialRecord', 'saleRecord', 'alert'] as const;
    for (const m of kinds) await (prisma as any)[m].deleteMany({ where: { flockId: { in: flockIds } } });
    await prisma.broilerFlock.deleteMany({ where: { organizationId: orgId } });
  }
  await prisma.supplier.deleteMany({ where: { organizationId: orgId, isDefault: false } });
  console.log('Cleared previous demo data');

  const breed = await prisma.breed.findFirst({ where: { name: { contains: 'Ross' } } });
  if (!breed) throw new Error('Ross 308 breed missing — run main seed first');
  const targets = await prisma.performanceTarget.findMany({ where: { breedId: breed.id }, orderBy: { ageDays: 'asc' } });
  const targetAt = (age: number) => targets.find((t) => t.ageDays === age)?.targetWeight?.toNumber() ?? null;

  const supplier = await prisma.supplier.create({
    data: { organizationId: orgId, name: 'Lusaka Chick & Feed Supplies', contact: '+260 97 7654321', chickenType: 'broiler' },
  });
  await prisma.feedStage.createMany({
    data: [
      { supplierId: supplier.id, stageName: 'Starter', stageType: 'feed', dayRangeStart: 0, dayRangeEnd: 10, unitSizeKg: 50, unitPriceZmw: 626, intakePerBirdKg: 0.045, sortOrder: 0 },
      { supplierId: supplier.id, stageName: 'Grower', stageType: 'feed', dayRangeStart: 11, dayRangeEnd: 24, unitSizeKg: 50, unitPriceZmw: 610, intakePerBirdKg: 0.115, sortOrder: 1 },
      { supplierId: supplier.id, stageName: 'Finisher', stageType: 'feed', dayRangeStart: 25, dayRangeEnd: 42, unitSizeKg: 50, unitPriceZmw: 582, intakePerBirdKg: 0.165, sortOrder: 2 },
      { supplierId: supplier.id, stageName: 'Day-old Chicks', stageType: 'chick', unitSizeKg: 1, unitPriceZmw: 12, intakePerBirdKg: 0, sortOrder: 99 },
    ],
  });

  // ═══ FLOCK 1 — "Batch 41" harvested & sold (complete story) ═══
  const f1 = await prisma.broilerFlock.create({
    data: {
      organizationId: orgId, name: 'Batch 41 — Harvested Oct', breedId: breed.id, supplierId: supplier.id,
      startDate: d(62), initialCount: 450, currentCount: 0, targetWeight: 2.5, targetAge: 42,
      chickPriceZmw: 11.5, chicksCollected: true, status: 'sold',
    } as any,
  });
  const mortality1 = [3, 2, 1, 2, 1, 1, 1];
  let alive1 = 450;
  for (let i = 0; i < mortality1.length; i++) {
    alive1 -= mortality1[i];
    await prisma.mortalityEvent.create({ data: { flockId: f1.id, eventDate: d(59 - i * 6), count: mortality1[i], cause: i % 2 ? 'heat stress' : 'early chick mortality' } });
  }
  for (let age = 3; age <= 39; age += 3) {
    const w = (targetAt(age) ?? age * 0.06) * (0.97 + Math.random() * 0.05) * 1000;
    await prisma.growthRecord.create({ data: { flockId: f1.id, recordDate: d(62 - age), sampleSize: 30, avgWeight: Math.round(w) } });
  }
  const feedTypes = ['starter', 'grower', 'finisher'] as const;
  for (let i = 0; i < 12; i++) {
    const age = 4 + i * 3;
    const ft = age <= 10 ? 'starter' : age <= 25 ? 'grower' : 'finisher';
    const kg = ft === 'starter' ? 75 + i * 6 : ft === 'grower' ? 160 + i * 10 : 240 + i * 8;
    await prisma.feedRecord.create({ data: { flockId: f1.id, supplierId: supplier.id, recordDate: d(62 - age), feedType: ft, feedBrand: 'Novatek', quantityKg: kg, costZmw: Math.round(kg * 11.2) } });
    await prisma.waterRecord.create({ data: { flockId: f1.id, recordDate: d(62 - age), quantityLiters: Math.round(kg * 1.85), ph: 6.8, temperature: 24 + (i % 3) } });
  }
  const vac = [['Newcastle + IB', 'La Sota', 1], ['Gumboro', 'Intermediate', 10], ['Gumboro booster', 'Intermediate', 18], ['Newcastle booster', 'La Sota', 24]] as const;
  for (const [name, type, age] of vac) {
    await prisma.vaccinationEvent.create({ data: { flockId: f1.id, vaccineName: name, vaccineType: type, adminDate: d(62 - age), adminMethod: 'drinking water', ageDays: age, costZmw: 85 } });
  }
  const expenses1: [string, number, number, string][] = [
    ['chick_purchase', 450 * 11.5, 62, 'Day-old chicks ×450 @ K11.50'],
    ['feed', 1890, 55, 'Starter feed 1.5 bags'],
    ['feed', 4520, 45, 'Grower feed — Novatek'],
    ['feed', 5260, 35, 'Finisher feed — Novatek'],
    ['vaccines', 340, 24, 'Vaccines + vitamins'],
    ['labor', 1200, 30, 'Casual labour'],
    ['utilities', 380, 28, 'Charcoal brooding + water'],
    ['other', 150, 26, 'Litter, disinfectant, crates'],
  ];
  for (const [cat, amt, ago, desc] of expenses1) {
    await prisma.financialRecord.create({ data: { flockId: f1.id, recordDate: d(ago), category: cat as any, description: desc, amountZmw: amt, isIncome: false } });
  }
  // sales: staggered harvest — 441 surviving birds across 3 sales
  const s1 = 450 - mortality1.reduce((a, b) => a + b, 0);
  const sales = [[190, 'Chipata Market Traders', 95, 'paid'], [150, 'City Lodges & Grill', 98, 'paid'], [s1 - 340, 'Walk-in customers', 90, 'paid']] as const;
  for (const [i, [birds, cust, price, status]] of sales.entries()) {
    await prisma.saleRecord.create({
      data: {
        organizationId: orgId, flockId: f1.id, saleDate: d(21 - i * 3), customerName: cust,
        customerPhone: `+260 97${7000000 + i * 3}`, birdCount: birds, avgWeightKg: 2.45 + i * 0.06,
        pricePerBirdZmw: price, totalAmountZmw: birds * price, paymentStatus: status as string,
        amountPaidZmw: birds * price, notes: 'Live bird sale',
      },
    });
    await prisma.financialRecord.create({ data: { flockId: f1.id, sourceTable: 'sale_records', recordDate: d(21 - i * 3), category: 'sales', description: `Bird sale — ${cust} (${birds} birds)`, amountZmw: birds * price, isIncome: true, isSystemGenerated: true } });
  }

  // ═══ FLOCK 2 — "Batch 42" active, day 26 ═══
  const f2 = await prisma.broilerFlock.create({
    data: {
      organizationId: orgId, name: 'Batch 42 — Broiler House A', breedId: breed.id, supplierId: supplier.id,
      startDate: d(26), initialCount: 500, currentCount: 488, targetWeight: 2.6, targetAge: 42,
      chickPriceZmw: 12.0, chicksCollected: true, status: 'active',
    } as any,
  });
  const mortality2 = [[24, 4, 'early chick mortality'], [22, 2, 'chilling'], [14, 3, 'heat stress'], [7, 2, 'sudden death'], [3, 1, 'injury']] as const;
  for (const [ago, n, cause] of mortality2) {
    await prisma.mortalityEvent.create({ data: { flockId: f2.id, eventDate: d(ago), count: n, cause } });
  }
  for (let age = 3; age <= 26; age += 3) {
    const w = (targetAt(age) ?? age * 0.06) * (1.0 + Math.random() * 0.04) * 1000;
    await prisma.growthRecord.create({ data: { flockId: f2.id, recordDate: d(26 - age), sampleSize: 35, avgWeight: Math.round(w) } });
  }
  for (let i = 0; i < 8; i++) {
    const age = 4 + i * 3;
    const ft = age <= 10 ? 'starter' : 'grower';
    const kg = ft === 'starter' ? 95 + i * 8 : 210 + i * 12;
    await prisma.feedRecord.create({ data: { flockId: f2.id, supplierId: supplier.id, recordDate: d(26 - age), feedType: ft, feedBrand: 'Novatek', quantityKg: kg, costZmw: Math.round(kg * 11.5) } });
    await prisma.waterRecord.create({ data: { flockId: f2.id, recordDate: d(26 - age), quantityLiters: Math.round(kg * 1.9), ph: 6.9, temperature: 25 + (i % 2) } });
  }
  for (const [name, type, age] of vac.slice(0, 3)) {
    await prisma.vaccinationEvent.create({ data: { flockId: f2.id, vaccineName: name, vaccineType: type, adminDate: d(26 - age), adminMethod: 'drinking water', ageDays: age, costZmw: 95 } });
  }
  // a future vaccination → drives an upcoming alert on the dashboard
  await prisma.vaccinationEvent.create({ data: { flockId: f2.id, vaccineName: 'Newcastle booster', vaccineType: 'La Sota', adminDate: new Date(today().getTime() + 2 * DAY), adminMethod: 'drinking water', ageDays: 28, nextDueDate: new Date(today().getTime() + 2 * DAY) } });
  const expenses2: [string, number, number, string][] = [
    ['chick_purchase', 500 * 12.0, 26, 'Day-old chicks ×500 @ K12.00'],
    ['feed', 2185, 20, 'Starter + grower feed'],
    ['feed', 3450, 8, 'Grower feed — Novatek'],
    ['vaccines', 285, 8, 'Vaccines to date'],
    ['utilities', 260, 6, 'Water + electricity'],
    ['labor', 800, 5, 'Casual labour'],
  ];
  for (const [cat, amt, ago, desc] of expenses2) {
    await prisma.financialRecord.create({ data: { flockId: f2.id, recordDate: d(ago), category: cat as any, description: desc, amountZmw: amt, isIncome: false } });
  }

  // ═══ FLOCK 3 — "Batch 43" brooding, day 6 ═══
  const f3 = await prisma.broilerFlock.create({
    data: {
      organizationId: orgId, name: 'Batch 43 — Broiler House B', breedId: breed.id, supplierId: supplier.id,
      startDate: d(6), initialCount: 300, currentCount: 296, targetWeight: 2.4, targetAge: 40,
      chickPriceZmw: 12.0, chicksCollected: true, status: 'active',
    } as any,
  });
  await prisma.mortalityEvent.create({ data: { flockId: f3.id, eventDate: d(4), count: 4, cause: 'early chick mortality' } });
  await prisma.growthRecord.create({ data: { flockId: f3.id, recordDate: d(3), sampleSize: 30, avgWeight: 195 } });
  await prisma.feedRecord.create({ data: { flockId: f3.id, supplierId: supplier.id, recordDate: d(4), feedType: 'starter', feedBrand: 'Novatek', quantityKg: 55, costZmw: 640 } });
  await prisma.waterRecord.create({ data: { flockId: f3.id, recordDate: d(4), quantityLiters: 110, ph: 7.0, temperature: 28 } });
  await prisma.vaccinationEvent.create({ data: { flockId: f3.id, vaccineName: 'Newcastle + IB', vaccineType: 'La Sota', adminDate: d(5), adminMethod: 'eye drop', ageDays: 1, costZmw: 45 } });
  await prisma.financialRecord.create({ data: { flockId: f3.id, recordDate: d(6), category: 'chick_purchase', description: 'Day-old chicks ×300 @ K12.00', amountZmw: 3600, isIncome: false } });
  await prisma.financialRecord.create({ data: { flockId: f3.id, recordDate: d(4), category: 'feed', description: 'Starter feed', amountZmw: 640, isIncome: false } });

  // ── alerts for dashboard liveliness ──
  const alertData: [string, string, string, string][] = [
    [f2.id, 'vaccination_due', 'warning', 'Newcastle booster due in 2 days for Batch 42 — Broiler House A'],
    [f2.id, 'weight_check', 'info', 'Batch 42 tracking 4% above target weight at day 26'],
    [f3.id, 'environmental', 'warning', 'Maintain brooder at 32–33°C through week 1'],
  ];
  for (const [flockId, t, sev, msg] of alertData) {
    await prisma.alert.create({ data: { flockId, alertType: t, severity: sev, title: msg.split('—')[0].trim(), message: msg, dueDate: new Date(today().getTime() + 2 * DAY) } as any });
  }

  console.log('Demo data seeded:', { orgId, flocks: [f1.id, f2.id, f3.id] });
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
