import type { IncomeStatement, BalanceSheet, CashFlowStatement } from './statements.service.js';

function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) =>
    row.map((cell) => {
      const str = String(cell);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  ).join('\n');
}

export class ReportGenerationService {
  generateCsvIncomeStatement(stmt: IncomeStatement): Buffer {
    const rows = [
      ['Nkuku Companion — Income Statement'],
      [`Period: ${stmt.period.startDate.toDateString()} to ${stmt.period.endDate.toDateString()}`],
      [],
      ['Revenue'],
      ...Object.entries(stmt.revenue.byCategory).map(([cat, amt]) => [`  ${cat}`, amt.toFixed(2)]),
      ['Total Revenue', stmt.revenue.total.toFixed(2)],
      [],
      ['Cost of Goods Sold'],
      ...Object.entries(stmt.cogs.byCategory).map(([cat, amt]) => [`  ${cat}`, amt.toFixed(2)]),
      ['Total COGS', stmt.cogs.total.toFixed(2)],
      [],
      ['Gross Profit', stmt.grossProfit.toFixed(2)],
      ['Gross Margin %', `${stmt.grossMargin.toFixed(2)}%`],
      [],
      ['Operating Expenses'],
      ...Object.entries(stmt.operatingExpenses.byCategory).map(([cat, amt]) => [`  ${cat}`, amt.toFixed(2)]),
      ['Total OpEx', stmt.operatingExpenses.total.toFixed(2)],
      [],
      ['Net Profit', stmt.netProfit.toFixed(2)],
      ['Net Margin %', `${stmt.netMargin.toFixed(2)}%`],
    ];
    return Buffer.from(toCsv(rows));
  }

  generateCsvBalanceSheet(sheet: BalanceSheet): Buffer {
    const rows = [
      ['Nkuku Companion — Balance Sheet'],
      [`As of: ${sheet.asOfDate.toDateString()}`],
      [],
      ['Assets'],
      ['  Current Assets'],
      ['    Cash', sheet.assets.current.cash.toFixed(2)],
      ['    Receivables', sheet.assets.current.receivables.toFixed(2)],
      ['    Inventory', sheet.assets.current.inventory.toFixed(2)],
      ['    Total Current', sheet.assets.current.total.toFixed(2)],
      ['  Fixed Assets'],
      ['    Equipment', sheet.assets.fixed.equipment.toFixed(2)],
      ['    Facilities', sheet.assets.fixed.facilities.toFixed(2)],
      ['    Total Fixed', sheet.assets.fixed.total.toFixed(2)],
      ['Total Assets', sheet.assets.total.toFixed(2)],
      [],
      ['Liabilities'],
      ['  Current Liabilities'],
      ['    Payables', sheet.liabilities.current.payables.toFixed(2)],
      ['    Short-term Debt', sheet.liabilities.current.shortTermDebt.toFixed(2)],
      ['    Total Current', sheet.liabilities.current.total.toFixed(2)],
      ['  Long-term Liabilities'],
      ['    Loans', sheet.liabilities.longTerm.loans.toFixed(2)],
      ['    Total Long-term', sheet.liabilities.longTerm.total.toFixed(2)],
      ['Total Liabilities', sheet.liabilities.total.toFixed(2)],
      [],
      ['Equity'],
      ['  Owner Capital', sheet.equity.ownerCapital.toFixed(2)],
      ['  Retained Earnings', sheet.equity.retainedEarnings.toFixed(2)],
      ['Total Equity', sheet.equity.total.toFixed(2)],
      [],
      ['Total Liabilities + Equity', sheet.totalLiabilitiesAndEquity.toFixed(2)],
    ];
    return Buffer.from(toCsv(rows));
  }

  generateCsvCashFlow(cf: CashFlowStatement): Buffer {
    const rows = [
      ['Nkuku Companion — Cash Flow Statement'],
      [`Period: ${cf.period.startDate.toDateString()} to ${cf.period.endDate.toDateString()}`],
      [],
      ['Operating Activities'],
      ['  Inflows', cf.operating.inflows.toFixed(2)],
      ['  Outflows', cf.operating.outflows.toFixed(2)],
      ['  Net Operating', cf.operating.net.toFixed(2)],
      [],
      ['Investing Activities'],
      ['  Inflows', cf.investing.inflows.toFixed(2)],
      ['  Outflows', cf.investing.outflows.toFixed(2)],
      ['  Net Investing', cf.investing.net.toFixed(2)],
      [],
      ['Financing Activities'],
      ['  Inflows', cf.financing.inflows.toFixed(2)],
      ['  Outflows', cf.financing.outflows.toFixed(2)],
      ['  Net Financing', cf.financing.net.toFixed(2)],
      [],
      ['Net Change', cf.netChange.toFixed(2)],
      ['Opening Balance', cf.openingBalance.toFixed(2)],
      ['Closing Balance', cf.closingBalance.toFixed(2)],
    ];
    return Buffer.from(toCsv(rows));
  }
}
