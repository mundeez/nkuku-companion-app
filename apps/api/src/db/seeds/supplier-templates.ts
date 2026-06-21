import { PrismaClient } from '@prisma/client';

export async function seedSupplierCategoryTemplates(prisma: PrismaClient) {
  console.log('[SEED] Supplier category templates...');

  // ── Feed Category Template ─────────────────
  const feedTemplate = await prisma.supplierCategoryTemplate.upsert({
    where: { category: 'feed' },
    update: {},
    create: {
      category: 'feed',
      name: 'Standard Broiler Feed Programme',
      description: 'Standard feed programme for broiler production including starter, grower, finisher, and optional pre-starter/withdrawal phases.',
      sortOrder: 0,
    },
  });

  const feedItems = [
    {
      itemName: 'Pre-starter',
      itemType: 'feed' as const,
      sortOrder: 0,
      defaultFields: {
        dayRangeStart: 0,
        dayRangeEnd: 7,
        unitSizeKg: 50,
        intakePerBirdKg: 0.2,
      },
      isRequired: false,
    },
    {
      itemName: 'Starter',
      itemType: 'feed' as const,
      sortOrder: 1,
      defaultFields: {
        dayRangeStart: 0,
        dayRangeEnd: 18,
        unitSizeKg: 50,
        intakePerBirdKg: 0.8,
      },
      isRequired: true,
    },
    {
      itemName: 'Grower',
      itemType: 'feed' as const,
      sortOrder: 2,
      defaultFields: {
        dayRangeStart: 19,
        dayRangeEnd: 28,
        unitSizeKg: 50,
        intakePerBirdKg: 1.2,
      },
      isRequired: true,
    },
    {
      itemName: 'Finisher',
      itemType: 'feed' as const,
      sortOrder: 3,
      defaultFields: {
        dayRangeStart: 29,
        dayRangeEnd: 42,
        unitSizeKg: 50,
        intakePerBirdKg: 1.5,
      },
      isRequired: true,
    },
    {
      itemName: 'Withdrawal',
      itemType: 'feed' as const,
      sortOrder: 4,
      defaultFields: {
        dayRangeStart: 34,
        dayRangeEnd: 38,
        unitSizeKg: 50,
        intakePerBirdKg: 0.7,
      },
      isRequired: false,
    },
    {
      itemName: 'Day-old Chicks',
      itemType: 'chick' as const,
      sortOrder: 5,
      defaultFields: {
        unitSizeKg: 1,
        intakePerBirdKg: 1.0,
      },
      isRequired: true,
    },
  ];

  for (const item of feedItems) {
    await prisma.supplierCategoryTemplateItem.upsert({
      where: {
        templateId_itemName: { templateId: feedTemplate.id, itemName: item.itemName },
      },
      update: {},
      create: { ...item, templateId: feedTemplate.id },
    });
  }
  console.log(`[SEED] Feed template + ${feedItems.length} items`);

  // ── Vaccine Category Template ────────────────
  const vaccineTemplate = await prisma.supplierCategoryTemplate.upsert({
    where: { category: 'vaccine' },
    update: {},
    create: {
      category: 'vaccine',
      name: 'Vaccination Suppliers',
      description: 'Vaccine and medication suppliers for disease prevention programmes.',
      sortOrder: 1,
    },
  });

  const vaccineItems = [
    { itemName: 'Newcastle Disease', itemType: 'medication' as const, sortOrder: 0, defaultFields: { unitSizeKg: 1, intakePerBirdKg: 0.001 }, isRequired: false },
    { itemName: 'Gumboro (IBD)', itemType: 'medication' as const, sortOrder: 1, defaultFields: { unitSizeKg: 1, intakePerBirdKg: 0.001 }, isRequired: false },
    { itemName: 'Infectious Bronchitis', itemType: 'medication' as const, sortOrder: 2, defaultFields: { unitSizeKg: 1, intakePerBirdKg: 0.001 }, isRequired: false },
    { itemName: 'Coccidiosis', itemType: 'medication' as const, sortOrder: 3, defaultFields: { unitSizeKg: 1, intakePerBirdKg: 0.001 }, isRequired: false },
  ];

  for (const item of vaccineItems) {
    await prisma.supplierCategoryTemplateItem.upsert({
      where: {
        templateId_itemName: { templateId: vaccineTemplate.id, itemName: item.itemName },
      },
      update: {},
      create: { ...item, templateId: vaccineTemplate.id },
    });
  }
  console.log(`[SEED] Vaccine template + ${vaccineItems.length} items`);

  // ── Labour Category Template ─────────────────
  const labourTemplate = await prisma.supplierCategoryTemplate.upsert({
    where: { category: 'labour' },
    update: {},
    create: {
      category: 'labour',
      name: 'Labour & Services',
      description: 'Labour, cleaning, and farm maintenance service suppliers.',
      sortOrder: 2,
    },
  });

  const labourItems = [
    { itemName: 'Day Labour', itemType: 'other' as const, sortOrder: 0, defaultFields: { unitSizeKg: 1, intakePerBirdKg: 0 }, isRequired: false },
    { itemName: 'Housing Maintenance', itemType: 'other' as const, sortOrder: 1, defaultFields: { unitSizeKg: 1, intakePerBirdKg: 0 }, isRequired: false },
    { itemName: 'Cleaning & Sanitation', itemType: 'other' as const, sortOrder: 2, defaultFields: { unitSizeKg: 1, intakePerBirdKg: 0 }, isRequired: false },
  ];

  for (const item of labourItems) {
    await prisma.supplierCategoryTemplateItem.upsert({
      where: {
        templateId_itemName: { templateId: labourTemplate.id, itemName: item.itemName },
      },
      update: {},
      create: { ...item, templateId: labourTemplate.id },
    });
  }
  console.log(`[SEED] Labour template + ${labourItems.length} items`);

  // ── Equipment Category Template ──────────────
  const equipmentTemplate = await prisma.supplierCategoryTemplate.upsert({
    where: { category: 'equipment' },
    update: {},
    create: {
      category: 'equipment',
      name: 'Equipment & Supplies',
      description: 'Farm equipment, housing materials, and supply vendors.',
      sortOrder: 3,
    },
  });

  const equipmentItems = [
    { itemName: 'Feeders & Drinkers', itemType: 'other' as const, sortOrder: 0, defaultFields: { unitSizeKg: 1, intakePerBirdKg: 0 }, isRequired: false },
    { itemName: 'Housing Materials', itemType: 'other' as const, sortOrder: 1, defaultFields: { unitSizeKg: 1, intakePerBirdKg: 0 }, isRequired: false },
    { itemName: 'Brooding Equipment', itemType: 'other' as const, sortOrder: 2, defaultFields: { unitSizeKg: 1, intakePerBirdKg: 0 }, isRequired: false },
  ];

  for (const item of equipmentItems) {
    await prisma.supplierCategoryTemplateItem.upsert({
      where: {
        templateId_itemName: { templateId: equipmentTemplate.id, itemName: item.itemName },
      },
      update: {},
      create: { ...item, templateId: equipmentTemplate.id },
    });
  }
  console.log(`[SEED] Equipment template + ${equipmentItems.length} items`);

  // ── Misc Category Template ───────────────────
  const miscTemplate = await prisma.supplierCategoryTemplate.upsert({
    where: { category: 'misc' },
    update: {},
    create: {
      category: 'misc',
      name: 'Miscellaneous',
      description: 'Transport, utilities, and other miscellaneous suppliers.',
      sortOrder: 4,
    },
  });

  const miscItems = [
    { itemName: 'Transport', itemType: 'other' as const, sortOrder: 0, defaultFields: { unitSizeKg: 1, intakePerBirdKg: 0 }, isRequired: false },
    { itemName: 'Utilities', itemType: 'other' as const, sortOrder: 1, defaultFields: { unitSizeKg: 1, intakePerBirdKg: 0 }, isRequired: false },
    { itemName: 'Insurance', itemType: 'other' as const, sortOrder: 2, defaultFields: { unitSizeKg: 1, intakePerBirdKg: 0 }, isRequired: false },
  ];

  for (const item of miscItems) {
    await prisma.supplierCategoryTemplateItem.upsert({
      where: {
        templateId_itemName: { templateId: miscTemplate.id, itemName: item.itemName },
      },
      update: {},
      create: { ...item, templateId: miscTemplate.id },
    });
  }
  console.log(`[SEED] Misc template + ${miscItems.length} items`);
}
