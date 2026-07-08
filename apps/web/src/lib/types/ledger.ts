// ── Ledger / Double-Entry Types ───────────────────────

export interface Account {
  id: string;
  code: string;
  name: string;
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  normalBalance: 'debit' | 'credit';
  parentCode: string | null;
  description: string | null;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JournalLine {
  id: string;
  journalId: string;
  accountId: string;
  debitZmw: string | null;
  creditZmw: string | null;
  description: string | null;
  flockId: string | null;
  account?: Account;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  reference: string | null;
  sourceType: string;
  sourceId: string | null;
  periodLabel: string | null;
  isReversing: boolean;
  reversesId: string | null;
  postedBy: string | null;
  postedAt: string;
  createdAt: string;
  lines: JournalLine[];
}

export interface TrialBalanceLine {
  accountCode: string;
  accountName: string;
  accountType: string;
  debitBalance: string;
  creditBalance: string;
}

export interface TrialBalance {
  asOfDate: string;
  generatedAt: string;
  lines: TrialBalanceLine[];
  totalDebits: string;
  totalCredits: string;
  isBalanced: boolean;
}

export interface IncomeStatementLine {
  accountCode: string;
  accountName: string;
  debitBalance: string;
  creditBalance: string;
  netBalance: string;
}

export interface IncomeStatement {
  asOfDate: string;
  periodFrom: string;
  periodTo: string;
  generatedAt: string;
  revenue: IncomeStatementLine[];
  totalRevenue: string;
  costOfGoodsSold: IncomeStatementLine[];
  totalCogs: string;
  grossProfit: string;
  operatingExpenses: IncomeStatementLine[];
  totalOperatingExpenses: string;
  operatingProfit: string;
  netProfit: string;
}

export interface BalanceSheetLine {
  accountCode: string;
  accountName: string;
  balance: string;
}

export interface BalanceSheet {
  asOfDate: string;
  generatedAt: string;
  assets: BalanceSheetLine[];
  totalAssets: string;
  liabilities: BalanceSheetLine[];
  totalLiabilities: string;
  equity: BalanceSheetLine[];
  totalEquity: string;
  totalLiabilitiesAndEquity: string;
  isBalanced: boolean;
}

export interface AccountLedgerEntry {
  date: string;
  journalNumber: string;
  description: string;
  debitZmw: string | null;
  creditZmw: string | null;
  runningBalance: string;
}

export interface AccountLedger {
  account: { code: string; name: string; accountType: string; normalBalance: string };
  periodLabel: string;
  openingBalance: string;
  entries: AccountLedgerEntry[];
  closingBalance: string;
  totalDebits: string;
  totalCredits: string;
}
