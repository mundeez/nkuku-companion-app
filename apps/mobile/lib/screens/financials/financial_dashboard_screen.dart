import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import 'income_statement_screen.dart';
import 'balance_sheet_screen.dart';
import 'cash_flow_screen.dart';

class FinancialDashboardScreen extends StatefulWidget {
  const FinancialDashboardScreen({super.key});

  @override
  State<FinancialDashboardScreen> createState() => _FinancialDashboardScreenState();
}

class _FinancialDashboardScreenState extends State<FinancialDashboardScreen> {
  Map<String, dynamic>? _summary;
  List<dynamic> _trend = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final summaryRes = await ApiService.dio.get('/api/v1/financial-engine/summary');
      final trendRes = await ApiService.dio.get('/api/v1/financial-engine/monthly-trend?year=${DateTime.now().year}');
      setState(() {
        _summary = summaryRes.data;
        _trend = trendRes.data as List;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to load financial data')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final revenue = (_summary?['totalRevenue'] ?? 0).toDouble();
    final cost = (_summary?['totalCost'] ?? 0).toDouble();
    final profit = (_summary?['netProfit'] ?? 0).toDouble();
    final margin = (_summary?['netMargin'] ?? 0).toDouble();

    return Scaffold(
      appBar: AppBar(title: const Text('Financial Dashboard')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Row(
                    children: [
                      Expanded(child: _KpiCard(label: 'Revenue', value: 'ZMW ${revenue.toStringAsFixed(2)}', color: Colors.green)),
                      const SizedBox(width: 8),
                      Expanded(child: _KpiCard(label: 'Cost', value: 'ZMW ${cost.toStringAsFixed(2)}', color: Colors.red)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(child: _KpiCard(label: 'Profit', value: 'ZMW ${profit.toStringAsFixed(2)}', color: profit >= 0 ? Colors.green : Colors.red)),
                      const SizedBox(width: 8),
                      Expanded(child: _KpiCard(label: 'Margin', value: '${margin.toStringAsFixed(1)}%', color: margin >= 0 ? Colors.green : Colors.red)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Text('Statements', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  _StatementTile(
                    icon: Icons.insert_drive_file,
                    title: 'Income Statement',
                    subtitle: 'Revenue, COGS, profit & loss',
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const IncomeStatementScreen())),
                  ),
                  _StatementTile(
                    icon: Icons.account_balance,
                    title: 'Balance Sheet',
                    subtitle: 'Assets, liabilities & equity',
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const BalanceSheetScreen())),
                  ),
                  _StatementTile(
                    icon: Icons.sync_alt,
                    title: 'Cash Flow',
                    subtitle: 'Operating, investing & financing',
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CashFlowScreen())),
                  ),
                  const SizedBox(height: 16),
                  const Text('Monthly Trend', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  if (_trend.isEmpty)
                    const Center(child: Text('No data yet', style: TextStyle(color: Colors.grey)))
                  else
                    SizedBox(
                      height: 200,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        itemCount: _trend.length,
                        itemBuilder: (context, index) {
                          final item = _trend[index];
                          final rev = (item['revenue'] ?? 0).toDouble();
                          final cst = (item['cost'] ?? 0).toDouble();
                          final prf = (item['profit'] ?? 0).toDouble();
                          return Container(
                            width: 80,
                            margin: const EdgeInsets.only(right: 8),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                Text('${prf.toStringAsFixed(0)}', style: TextStyle(fontSize: 10, color: prf >= 0 ? Colors.green : Colors.red)),
                                const SizedBox(height: 4),
                                Container(
                                  height: (rev.abs() / 100).clamp(10, 120),
                                  width: 24,
                                  decoration: BoxDecoration(color: Colors.green, borderRadius: BorderRadius.circular(4)),
                                ),
                                const SizedBox(height: 4),
                                Container(
                                  height: (cst.abs() / 100).clamp(10, 120),
                                  width: 24,
                                  decoration: BoxDecoration(color: Colors.red, borderRadius: BorderRadius.circular(4)),
                                ),
                                const SizedBox(height: 4),
                                Text(item['label'] ?? '', style: const TextStyle(fontSize: 10)),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
                ],
              ),
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _KpiCard({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
          ],
        ),
      ),
    );
  }
}

class _StatementTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _StatementTile({required this.icon, required this.title, required this.subtitle, required this.onTap});

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
