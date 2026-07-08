import 'package:flutter/material.dart';
import 'trial_balance_screen.dart';
import 'chart_of_accounts_screen.dart';
import 'journal_list_screen.dart';
import '../../services/ledger_service.dart';

class LedgerDashboardScreen extends StatefulWidget {
  const LedgerDashboardScreen({super.key});

  @override
  State<LedgerDashboardScreen> createState() => _LedgerDashboardScreenState();
}

class _LedgerDashboardScreenState extends State<LedgerDashboardScreen> {
  Map<String, dynamic>? _tb;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final tb = await LedgerService.getTrialBalance();
      setState(() { _tb = tb; _loading = false; });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  String _fmt(dynamic v) {
    if (v == null) return '0.00';
    final n = double.tryParse(v.toString());
    if (n == null) return '0.00';
    return n.toStringAsFixed(2);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ledger')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Trial balance summary
                  if (_tb != null) ...[
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  _tb!['isBalanced'] == true ? Icons.check_circle : Icons.error,
                                  color: _tb!['isBalanced'] == true ? Colors.green : Colors.red,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  _tb!['isBalanced'] == true ? 'Trial Balance is Balanced' : 'Out of Balance',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: _tb!['isBalanced'] == true ? Colors.green : Colors.red,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                              children: [
                                Column(
                                  children: [
                                    const Text('Total Debits', style: TextStyle(color: Colors.grey, fontSize: 12)),
                                    Text('ZMW ${_fmt(_tb!['totalDebits'])}',
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontFamily: 'monospace')),
                                  ],
                                ),
                                Column(
                                  children: [
                                    const Text('Total Credits', style: TextStyle(color: Colors.grey, fontSize: 12)),
                                    Text('ZMW ${_fmt(_tb!['totalCredits'])}',
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontFamily: 'monospace')),
                                  ],
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  // Navigation tiles
                  _ActionTile(
                    icon: Icons.account_balance,
                    title: 'Trial Balance',
                    subtitle: 'View full trial balance report',
                    onTap: () => Navigator.push(context,
                      MaterialPageRoute(builder: (_) => const TrialBalanceScreen())),
                  ),
                  _ActionTile(
                    icon: Icons.menu_book,
                    title: 'Chart of Accounts',
                    subtitle: 'Browse all ledger accounts',
                    onTap: () => Navigator.push(context,
                      MaterialPageRoute(builder: (_) => const ChartOfAccountsScreen())),
                  ),
                  _ActionTile(
                    icon: Icons.receipt_long,
                    title: 'Journal Entries',
                    subtitle: 'View posted journal entries',
                    onTap: () => Navigator.push(context,
                      MaterialPageRoute(builder: (_) => const JournalListScreen())),
                  ),
                ],
              ),
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _ActionTile({required this.icon, required this.title, required this.subtitle, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(icon, color: Colors.green),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
