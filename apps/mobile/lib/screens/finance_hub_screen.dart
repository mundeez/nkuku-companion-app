import 'package:flutter/material.dart';
import 'financials/financial_dashboard_screen.dart';
import 'ledger/ledger_dashboard_screen.dart';

/// Single bottom-nav entry point for both the P&L-style Financial Dashboard
/// and the double-entry Ledger, switched via a segmented control. Each inner
/// screen keeps its own AppBar/state; this widget only owns the switcher.
class FinanceHubScreen extends StatefulWidget {
  const FinanceHubScreen({super.key});

  @override
  State<FinanceHubScreen> createState() => _FinanceHubScreenState();
}

class _FinanceHubScreenState extends State<FinanceHubScreen> {
  int _index = 0;

  static const _pages = [
    FinancialDashboardScreen(),
    LedgerDashboardScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          Material(
            elevation: 1,
            color: Theme.of(context).colorScheme.surface,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
              child: SegmentedButton<int>(
                segments: const [
                  ButtonSegment(
                    value: 0,
                    label: Text('Financials'),
                    icon: Icon(Icons.attach_money),
                  ),
                  ButtonSegment(
                    value: 1,
                    label: Text('Ledger'),
                    icon: Icon(Icons.menu_book),
                  ),
                ],
                selected: {_index},
                onSelectionChanged: (s) => setState(() => _index = s.first),
              ),
            ),
          ),
          Expanded(
            child: IndexedStack(index: _index, children: _pages),
          ),
        ],
      ),
    );
  }
}
