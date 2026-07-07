import { PrismaClient } from '@prisma/client';

export async function seedChartOfAccounts(prisma: PrismaClient) {
  console.log('[SEED] Chart of accounts...');

  const accounts = [
    // ASSETS
    { code: '1000', name: 'ASSETS', accountType: 'asset', normalBalance: 'debit', isSystem: true },
    { code: '1010', name: 'Cash & Bank', accountType: 'asset', normalBalance: 'debit', parentCode: '1000', isSystem: true },
    { code: '1020', name: 'Accounts Receivable', accountType: 'asset', normalBalance: 'debit', parentCode: '1000' },
    { code: '1030', name: 'Live Inventory - Chicks', accountType: 'asset', normalBalance: 'debit', parentCode: '1000' },
    { code: '1040', name: 'Live Inventory - Growers', accountType: 'asset', normalBalance: 'debit', parentCode: '1000' },
    { code: '1050', name: 'Feed Inventory', accountType: 'asset', normalBalance: 'debit', parentCode: '1000' },
    { code: '1060', name: 'Medication & Vaccine Inventory', accountType: 'asset', normalBalance: 'debit', parentCode: '1000' },
    { code: '1070', name: 'Prepaid Expenses', accountType: 'asset', normalBalance: 'debit', parentCode: '1000' },
    { code: '1080', name: 'Equipment (at cost)', accountType: 'asset', normalBalance: 'debit', parentCode: '1000' },
    { code: '1081', name: 'Accumulated Depreciation - Equipment', accountType: 'asset', normalBalance: 'credit', parentCode: '1080' },

    // LIABILITIES
    { code: '2000', name: 'LIABILITIES', accountType: 'liability', normalBalance: 'credit', isSystem: true },
    { code: '2010', name: 'Accounts Payable', accountType: 'liability', normalBalance: 'credit', parentCode: '2000' },
    { code: '2020', name: 'Accrued Expenses', accountType: 'liability', normalBalance: 'credit', parentCode: '2000' },
    { code: '2030', name: 'Deferred Revenue', accountType: 'liability', normalBalance: 'credit', parentCode: '2000' },

    // EQUITY
    { code: '3000', name: 'EQUITY', accountType: 'equity', normalBalance: 'credit', isSystem: true },
    { code: '3010', name: "Owner's Capital", accountType: 'equity', normalBalance: 'credit', parentCode: '3000', isSystem: true },
    { code: '3020', name: 'Retained Earnings', accountType: 'equity', normalBalance: 'credit', parentCode: '3000', isSystem: true },
    { code: '3030', name: 'Current Year Earnings', accountType: 'equity', normalBalance: 'credit', parentCode: '3000', isSystem: true },

    // REVENUE
    { code: '4000', name: 'REVENUE', accountType: 'revenue', normalBalance: 'credit', isSystem: true },
    { code: '4010', name: 'Bird Sales Revenue', accountType: 'revenue', normalBalance: 'credit', parentCode: '4000' },
    { code: '4020', name: 'By-product Sales', accountType: 'revenue', normalBalance: 'credit', parentCode: '4000' },
    { code: '4030', name: 'Other Income', accountType: 'revenue', normalBalance: 'credit', parentCode: '4000' },

    // COGS
    { code: '5000', name: 'COST OF GOODS SOLD', accountType: 'expense', normalBalance: 'debit', isSystem: true },
    { code: '5010', name: 'Chick Purchase Cost', accountType: 'expense', normalBalance: 'debit', parentCode: '5000' },
    { code: '5020', name: 'Feed Cost', accountType: 'expense', normalBalance: 'debit', parentCode: '5000' },
    { code: '5030', name: 'Vaccine Cost', accountType: 'expense', normalBalance: 'debit', parentCode: '5000' },
    { code: '5040', name: 'Medication Cost', accountType: 'expense', normalBalance: 'debit', parentCode: '5000' },
    { code: '5050', name: 'Mortality Loss', accountType: 'expense', normalBalance: 'debit', parentCode: '5000' },

    // OPERATING EXPENSES
    { code: '6000', name: 'OPERATING EXPENSES', accountType: 'expense', normalBalance: 'debit', isSystem: true },
    { code: '6010', name: 'Labour / Wages', accountType: 'expense', normalBalance: 'debit', parentCode: '6000' },
    { code: '6020', name: 'Electricity', accountType: 'expense', normalBalance: 'debit', parentCode: '6000' },
    { code: '6030', name: 'Water', accountType: 'expense', normalBalance: 'debit', parentCode: '6000' },
    { code: '6040', name: 'Transport to Market', accountType: 'expense', normalBalance: 'debit', parentCode: '6000' },
    { code: '6050', name: 'Litter & Bedding', accountType: 'expense', normalBalance: 'debit', parentCode: '6000' },
    { code: '6060', name: 'Equipment Maintenance', accountType: 'expense', normalBalance: 'debit', parentCode: '6000' },
    { code: '6070', name: 'Insurance', accountType: 'expense', normalBalance: 'debit', parentCode: '6000' },
    { code: '6080', name: 'Other Overhead', accountType: 'expense', normalBalance: 'debit', parentCode: '6000' },
  ];

  for (const acc of accounts) {
    await prisma.account.upsert({
      where: { code: acc.code },
      update: { name: acc.name },
      create: acc,
    });
  }

  console.log(`[SEED] Chart of accounts: ${accounts.length} accounts`);
}
