import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import 'income_statement_screen.dart';
import 'balance_sheet_screen.dart';
import 'cash_flow_screen.dart';
import 'overheads_screen.dart';

class FinancialDashboardScreen extends StatefulWidget {
  const FinancialDashboardScreen({super.key});

  @override
  State<FinancialDashboardScreen> createState() => _FinancialDashboardScreenState();
}

class _FinancialDashboardScreenState extends State<FinancialDashboardScreen> {
  Map<String, dynamic>? _summary;
  List<dynamic> _trend = [];
  List<dynamic> _projections = [];
  bool _loading = true;
  bool _showProjections = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final summaryRes = await ApiService.dio.get('/api/v1/financial-engine/summary');
      final trendRes = await ApiService.dio.get('/api/v1/financial-engine/monthly-trend?year=${DateTime.now().year}');
      final projRes = await ApiService.dio.get('/api/v1/financial-engine/projections');
      if (!mounted) return;
      setState(() {
        _summary = summaryRes.data;
        _trend = trendRes.data as List;
        _projections = projRes.data as List;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      messenger.showSnackBar(
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
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Statements', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      Switch(
                        value: _showProjections,
                        onChanged: (v) => setState(() => _showProjections = v),
                        activeThumbColor: Colors.amber,
                      ),
                    ],
                  ),
                  if (_showProjections && _projections.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Card(
                      color: Colors.amber.shade50,
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(color: Colors.amber.shade200, borderRadius: BorderRadius.circular(4)),
                                  child: const Text('ESTIMATED', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            ..._projections.map((p) => ListTile(
                              dense: true,
                              title: Text(p['flock']?['name'] ?? 'Flock'),
                              trailing: Text('ZMW ${(p['amountZmw'] as num).toDouble().toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.amber)),
                            )),
                          ],
                        ),
                      ),
                    ),
                  ],
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
                  _StatementTile(
                    icon: Icons.settings,
                    title: 'Overheads',
                    subtitle: 'Monthly labour, utilities & more',
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const OverheadsScreen())),
                  ),
                  const SizedBox(height: 16),
                  const Text('Monthly Revenue vs Cost', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  if (_trend.isEmpty)
                    const Center(child: Text('No data yet', style: TextStyle(color: Colors.grey)))
                  else
                    _MonthlyRevenueCostChart(trend: _trend),
                  const SizedBox(height: 24),
                  const Text('Monthly Profit Trend', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  if (_trend.isEmpty)
                    const Center(child: Text('No data yet', style: TextStyle(color: Colors.grey)))
                  else
                    _MonthlyProfitChart(trend: _trend),
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

// ── Monthly Revenue vs Cost Bar Chart ──────────────

class _MonthlyRevenueCostChart extends StatelessWidget {
  final List<dynamic> trend;

  const _MonthlyRevenueCostChart({required this.trend});

  @override
  Widget build(BuildContext context) {
    final maxY = trend.fold<double>(0, (max, item) {
      final rev = (item['revenue'] ?? 0).toDouble();
      final cst = (item['cost'] ?? 0).toDouble();
      final bigger = rev > cst ? rev : cst;
      return bigger > max ? bigger : max;
    });

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: SizedBox(
          height: 220,
          child: BarChart(
            BarChartData(
              maxY: maxY * 1.2,
              gridData: const FlGridData(show: true, drawVerticalLine: false),
              titlesData: FlTitlesData(
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 28,
                    getTitlesWidget: (v, _) {
                      final idx = v.toInt();
                      if (idx < 0 || idx >= trend.length) return const SizedBox.shrink();
                      final label = (trend[idx]['label'] ?? '') as String;
                      return Text(label, style: const TextStyle(fontSize: 9));
                    },
                  ),
                ),
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 44,
                    getTitlesWidget: (v, _) => Text('ZMW${v.toInt()}', style: const TextStyle(fontSize: 8)),
                  ),
                ),
                topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              ),
              borderData: FlBorderData(show: false),
              barGroups: trend.asMap().entries.map((e) {
                final rev = (e.value['revenue'] ?? 0).toDouble();
                final cst = (e.value['cost'] ?? 0).toDouble();
                return BarChartGroupData(
                  x: e.key,
                  barRods: [
                    BarChartRodData(toY: rev, color: const Color(0xFF1B5E20), width: 6, borderRadius: BorderRadius.circular(2)),
                    BarChartRodData(toY: cst, color: const Color(0xFFD32F2F), width: 6, borderRadius: BorderRadius.circular(2)),
                  ],
                );
              }).toList(),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Monthly Profit Trend Line Chart ────────────────

class _MonthlyProfitChart extends StatelessWidget {
  final List<dynamic> trend;

  const _MonthlyProfitChart({required this.trend});

  @override
  Widget build(BuildContext context) {
    final spots = <FlSpot>[];
    double maxAbs = 0;

    for (int i = 0; i < trend.length; i++) {
      final profit = (trend[i]['profit'] ?? 0).toDouble();
      spots.add(FlSpot(i.toDouble(), profit));
      if (profit.abs() > maxAbs) maxAbs = profit.abs();
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: SizedBox(
          height: 200,
          child: LineChart(
            LineChartData(
              minY: -maxAbs * 1.2,
              maxY: maxAbs * 1.2,
              gridData: const FlGridData(show: true, drawVerticalLine: false),
              titlesData: FlTitlesData(
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 28,
                    getTitlesWidget: (v, _) {
                      final idx = v.toInt();
                      if (idx < 0 || idx >= trend.length) return const SizedBox.shrink();
                      final label = (trend[idx]['label'] ?? '') as String;
                      return Text(label, style: const TextStyle(fontSize: 9));
                    },
                  ),
                ),
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 44,
                    getTitlesWidget: (v, _) => Text('ZMW${v.toInt()}', style: const TextStyle(fontSize: 8)),
                  ),
                ),
                topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              ),
              borderData: FlBorderData(show: false),
              lineBarsData: [
                LineChartBarData(
                  spots: spots,
                  isCurved: true,
                  color: const Color(0xFF1B5E20),
                  barWidth: 2,
                  dotData: const FlDotData(show: true),
                  belowBarData: BarAreaData(
                    show: true,
                    color: const Color(0xFF1B5E20).withValues(alpha: 0.15),
                  ),
                ),
              ],
              extraLinesData: ExtraLinesData(
                horizontalLines: [
                  HorizontalLine(
                    y: 0,
                    color: Colors.grey,
                    strokeWidth: 1,
                    dashArray: [3, 3],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
