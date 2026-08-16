import 'package:flutter/material.dart';
import '../../services/ledger_service.dart';
import 'account_ledger_screen.dart';

class ChartOfAccountsScreen extends StatefulWidget {
  const ChartOfAccountsScreen({super.key});

  @override
  State<ChartOfAccountsScreen> createState() => _ChartOfAccountsScreenState();
}

class _ChartOfAccountsScreenState extends State<ChartOfAccountsScreen> {
  List<dynamic> _accounts = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final accounts = await LedgerService.getAccounts();
      setState(() { _accounts = accounts; _loading = false; });
    } catch (e) {
      setState(() { _error = 'Failed to load accounts'; _loading = false; });
    }
  }

  static const _typeOrder = ['asset', 'liability', 'equity', 'revenue', 'expense'];
  static const _typeLabels = {
    'asset': 'Assets',
    'liability': 'Liabilities',
    'equity': 'Equity',
    'revenue': 'Revenue',
    'expense': 'Expenses',
  };
  static const _typeIcons = {
    'asset': Icons.account_balance_wallet,
    'liability': Icons.credit_card,
    'equity': Icons.pie_chart,
    'revenue': Icons.trending_up,
    'expense': Icons.trending_down,
  };
  static const _typeColors = {
    'asset': Colors.blue,
    'liability': Colors.orange,
    'equity': Colors.purple,
    'revenue': Colors.green,
    'expense': Colors.red,
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Chart of Accounts')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(_error!, style: const TextStyle(color: Colors.red)),
                    const SizedBox(height: 16),
                    ElevatedButton(onPressed: _load, child: const Text('Retry')),
                  ],
                ))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    children: _typeOrder.map((type) {
                      final accounts = _accounts.where((a) => a['accountType'] == type).toList();
                      if (accounts.isEmpty) return const SizedBox.shrink();
                      return Card(
                        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        child: ExpansionTile(
                          leading: Icon(_typeIcons[type], color: _typeColors[type]),
                          title: Text(_typeLabels[type]!, style: const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Text('${accounts.length} accounts'),
                          initiallyExpanded: true,
                          children: accounts.map((a) => ListTile(
                            dense: true,
                            leading: Text(a['code'], style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
                            title: Text(a['name'],
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 14)),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (a['isSystem'] == true)
                                  const Padding(
                                    padding: EdgeInsets.only(right: 8),
                                    child: Chip(
                                      label: Text('System', style: TextStyle(fontSize: 10)),
                                      visualDensity: VisualDensity.compact,
                                    ),
                                  ),
                                const Icon(Icons.chevron_right, size: 18),
                              ],
                            ),
                            onTap: () => Navigator.push(context,
                              MaterialPageRoute(builder: (_) => AccountLedgerScreen(
                                code: a['code'],
                                name: a['name'],
                              ))),
                          )).toList(),
                        ),
                      );
                    }).toList(),
                  ),
                ),
    );
  }
}
