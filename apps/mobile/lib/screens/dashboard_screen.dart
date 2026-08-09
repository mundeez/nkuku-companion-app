import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import '../models/dashboard_summary.dart';
import '../services/dashboard_service.dart';
import 'alerts_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  DashboardSummary? _summary;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadSummary();
  }

  Future<void> _loadSummary() async {
    try {
      setState(() => _loading = true);
      final summary = await DashboardService.fetchSummary();
      if (mounted) {
        setState(() {
          _summary = summary;
          _error = null;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Image.asset('assets/images/logo.png', height: 32),
            const SizedBox(width: 8),
            const Text('Dashboard'),
          ],
        ),
        actions: [
          IconButton(
              icon: const Icon(Icons.notifications_outlined),
              tooltip: 'Alerts',
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const AlertsScreen()),
              ),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadSummary,
        child: _buildBody(theme),
      ),
    );
  }

  Widget _buildBody(ThemeData theme) {
    if (_loading && _summary == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('Failed to load dashboard', style: theme.textTheme.titleMedium),
              const SizedBox(height: 8),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton(onPressed: _loadSummary, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }
    final s = _summary!;
    final k = s.kpis;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _KpiGrid(kpis: k),
        const SizedBox(height: 24),
        _SectionTitle(title: 'Financials', action: s.monthlyTrend.isEmpty ? const Text('No data yet', style: TextStyle(color: Colors.grey)) : null),
        const SizedBox(height: 12),
        if (s.monthlyTrend.isNotEmpty) _MonthlyTrendCard(items: s.monthlyTrend),
        const SizedBox(height: 24),
        _SectionTitle(title: 'Cost Breakdown'),
        const SizedBox(height: 12),
        if (s.costBreakdown.isNotEmpty) _CostBreakdownCard(items: s.costBreakdown),
        const SizedBox(height: 24),
        _SectionTitle(title: 'Flock Profitability'),
        const SizedBox(height: 12),
        if (s.flockProfitability.isNotEmpty) ...[
          _FlockProfitabilityChart(items: s.flockProfitability),
          const SizedBox(height: 12),
          _FlockProfitabilityList(items: s.flockProfitability)
        ] else
          const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text('No flocks with financial data yet.'),
            ),
          ),
        const SizedBox(height: 24),
        if (k.openAlerts > 0) ...[
          _SectionTitle(title: 'Alerts by Severity'),
          const SizedBox(height: 12),
          _AlertsSeverityChart(severity: s.alertsBySeverity),
          const SizedBox(height: 24),
        ],
        _SectionTitle(
          title: 'Recent Alerts',
          action: Text('${k.openAlerts} open', style: TextStyle(color: k.openAlerts > 0 ? theme.colorScheme.error : Colors.grey)),
        ),
        const SizedBox(height: 12),
        if (s.recentAlerts.isNotEmpty)
          _RecentAlertsList(alerts: s.recentAlerts)
        else
          const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text('No recent alerts.'),
            ),
          ),
        const SizedBox(height: 32),
      ],
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String title;
  final Widget? action;

  const _SectionTitle({required this.title, this.action});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        if (action != null) action!,
      ],
    );
  }
}

class _KpiGrid extends StatelessWidget {
  final DashboardKpis kpis;

  const _KpiGrid({required this.kpis});

  @override
  Widget build(BuildContext context) {
    final items = [
      _Kpi('Active Flocks', kpis.activeFlocks.toString(), Icons.trending_up, Colors.blue, subtitle: '${kpis.pendingFlocks} pending'),
      _Kpi('Total Birds', kpis.totalBirds.toString(), Icons.egg_alt, Colors.green, subtitle: 'Across active flocks'),
      _Kpi('Mortality Rate', '${kpis.mortalityRate.toStringAsFixed(1)}%', Icons.warning, _mortalityColor(kpis.mortalityRate), subtitle: 'Active flocks avg'),
      _Kpi('Net Profit', 'ZMW ${_fmt(kpis.netProfit)}', Icons.account_balance_wallet, kpis.netProfit < 0 ? Colors.red : Colors.green, subtitle: 'All flocks'),
      _Kpi('Profit / Bird', 'ZMW ${_fmt(kpis.profitPerBird)}', Icons.attach_money, kpis.profitPerBird < 0 ? Colors.red : Colors.green, subtitle: 'Per bird'),
      _Kpi('Open Alerts', kpis.openAlerts.toString(), Icons.notifications_active, kpis.openAlerts > 0 ? Colors.orange : Colors.grey, subtitle: '${kpis.openAlerts} critical'),
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 1.55,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: items.length,
      itemBuilder: (_, i) => _KpiCard(item: items[i]),
    );
  }

  Color _mortalityColor(double rate) {
    if (rate > 10) return Colors.red;
    if (rate > 5) return Colors.orange;
    return Colors.blue;
  }
}

class _Kpi {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final String subtitle;

  _Kpi(this.label, this.value, this.icon, this.color, {required this.subtitle});
}

class _KpiCard extends StatelessWidget {
  final _Kpi item;

  const _KpiCard({required this.item});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Icon(item.icon, size: 18, color: item.color),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(item.label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                ),
              ],
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: item.color)),
                Text(item.subtitle, style: const TextStyle(fontSize: 11, color: Colors.grey)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _MonthlyTrendCard extends StatelessWidget {
  final List<MonthlyTrendItem> items;

  const _MonthlyTrendCard({required this.items});

  @override
  Widget build(BuildContext context) {
    final maxY = items.map((e) => e.revenue > e.cost ? e.revenue : e.cost).reduce((a, b) => a > b ? a : b).toDouble();
    final interval = maxY > 0 ? maxY / 4 : 1.0;

    return SizedBox(
      height: 220,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: BarChart(
            BarChartData(
              maxY: maxY * 1.2,
              gridData: FlGridData(show: true, drawVerticalLine: false),
              titlesData: FlTitlesData(
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    getTitlesWidget: (v, _) {
                      final idx = v.toInt();
                      if (idx < 0 || idx >= items.length) return const SizedBox.shrink();
                      return Text(items[idx].month.substring(0, 3), style: const TextStyle(fontSize: 10));
                    },
                  ),
                ),
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(showTitles: true, reservedSize: 40, interval: interval),
                ),
                topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
              ),
              borderData: FlBorderData(show: false),
              barGroups: List.generate(items.length, (i) {
                return BarChartGroupData(
                  x: i,
                  barRods: [
                    BarChartRodData(toY: items[i].revenue, color: Colors.green, width: 6, borderRadius: BorderRadius.circular(2)),
                    BarChartRodData(toY: items[i].cost, color: Colors.red, width: 6, borderRadius: BorderRadius.circular(2)),
                  ],
                );
              }),
            ),
          ),
        ),
      ),
    );
  }
}

class _CostBreakdownCard extends StatelessWidget {
  final List<CostBreakdownItem> items;

  const _CostBreakdownCard({required this.items});

  static const _categoryColors = {
    'chick_purchase': Colors.blue,
    'feed': Colors.orange,
    'vaccines': Colors.green,
    'medication': Colors.purple,
    'labor': Colors.pink,
    'utilities': Colors.cyan,
    'equipment': Colors.deepOrange,
    'sales': Colors.lightGreen,
    'other': Colors.grey,
  };

  @override
  Widget build(BuildContext context) {
    final total = items.fold<double>(0, (sum, e) => sum + e.amount);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            SizedBox(
              height: 180,
              child: PieChart(
                PieChartData(
                  sectionsSpace: 2,
                  centerSpaceRadius: 32,
                  sections: items.where((e) => e.amount > 0).map((e) {
                    final pct = total > 0 ? e.amount / total : 0.0;
                    return PieChartSectionData(
                      value: e.amount,
                      title: '${(pct * 100).toStringAsFixed(0)}%',
                      color: _categoryColors[e.category] ?? Colors.grey,
                      radius: 48,
                      titleStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
                    );
                  }).toList(),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 12,
              runSpacing: 8,
              children: items.where((e) => e.amount > 0).map((e) {
                return Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(width: 10, height: 10, decoration: BoxDecoration(color: _categoryColors[e.category] ?? Colors.grey, borderRadius: BorderRadius.circular(2))),
                    const SizedBox(width: 4),
                    Text('${e.category}: ZMW ${_fmt(e.amount)}', style: const TextStyle(fontSize: 11)),
                  ],
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }
}

class _FlockProfitabilityList extends StatelessWidget {
  final List<FlockProfitabilityItem> items;

  const _FlockProfitabilityList({required this.items});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Column(
        children: items.map((f) {
          return ListTile(
            dense: true,
            title: Text('${f.flockName} (${f.breedName})'),
            subtitle: Text('Age ${f.ageDays}d · ${f.currentCount} birds · mortality ${f.mortalityRate.toStringAsFixed(1)}%'),
            trailing: Text(
              'ZMW ${_fmt(f.profit)}',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: f.profit < 0 ? Colors.red : Colors.green,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _RecentAlertsList extends StatelessWidget {
  final List<RecentAlertItem> alerts;

  const _RecentAlertsList({required this.alerts});

  Color _severityColor(String severity) {
    switch (severity) {
      case 'critical':
        return Colors.red;
      case 'warning':
        return Colors.orange;
      default:
        return Colors.blue;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Column(
        children: alerts.take(5).map((a) {
          return ListTile(
            dense: true,
            leading: Icon(Icons.warning, color: _severityColor(a.severity)),
            title: Text(a.title, maxLines: 1, overflow: TextOverflow.ellipsis),
            subtitle: Text('${a.flockName} · ${_timeAgo(a.createdAt)}'),
          );
        }).toList(),
      ),
    );
  }
}

String _fmt(double n) {
  final f = NumberFormat('#,##0', 'en_ZM');
  return f.format(n);
}

String _timeAgo(DateTime date) {
  final diff = DateTime.now().difference(date);
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  return '${diff.inDays}d ago';
}

// ── Flock Profitability Bar Chart ──────────────────

class _FlockProfitabilityChart extends StatelessWidget {
  final List<FlockProfitabilityItem> items;

  const _FlockProfitabilityChart({required this.items});

  @override
  Widget build(BuildContext context) {
    final maxAbs = items.fold<double>(0, (max, f) => f.profit.abs() > max ? f.profit.abs() : max);
    if (maxAbs == 0) return const SizedBox.shrink();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Net Profit per Flock', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            SizedBox(
              height: 180,
              child: BarChart(
                BarChartData(
                  maxY: maxAbs * 1.2,
                  minY: -maxAbs * 1.2,
                  gridData: const FlGridData(show: true, drawVerticalLine: false),
                  titlesData: FlTitlesData(
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 40,
                        getTitlesWidget: (v, _) {
                          final idx = v.toInt();
                          if (idx < 0 || idx >= items.length) return const SizedBox.shrink();
                          final name = items[idx].flockName;
                          return Text(name.length > 10 ? name.substring(0, 8) : name, style: const TextStyle(fontSize: 8), maxLines: 2, overflow: TextOverflow.ellipsis);
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
                  barGroups: items.asMap().entries.map((e) {
                    final profit = e.value.profit;
                    return BarChartGroupData(
                      x: e.key,
                      barRods: [
                        BarChartRodData(
                          toY: profit,
                          color: profit >= 0 ? const Color(0xFF22C55E) : const Color(0xFFEF4444),
                          width: 16,
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ],
                    );
                  }).toList(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Alerts Severity Pie Chart ──────────────────────

class _AlertsSeverityChart extends StatelessWidget {
  final AlertsBySeverity severity;

  const _AlertsSeverityChart({required this.severity});

  @override
  Widget build(BuildContext context) {
    final total = severity.critical + severity.warning + severity.info;
    if (total == 0) return const SizedBox.shrink();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Alerts by Severity', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            SizedBox(
              height: 160,
              child: PieChart(
                PieChartData(
                  sectionsSpace: 2,
                  centerSpaceRadius: 32,
                  sections: [
                    if (severity.critical > 0)
                      PieChartSectionData(
                        value: severity.critical.toDouble(),
                        title: '${severity.critical}',
                        color: const Color(0xFFEF4444),
                        radius: 48,
                        titleStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                    if (severity.warning > 0)
                      PieChartSectionData(
                        value: severity.warning.toDouble(),
                        title: '${severity.warning}',
                        color: const Color(0xFFF59E0B),
                        radius: 48,
                        titleStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                    if (severity.info > 0)
                      PieChartSectionData(
                        value: severity.info.toDouble(),
                        title: '${severity.info}',
                        color: const Color(0xFF3B82F6),
                        radius: 48,
                        titleStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 12,
              runSpacing: 6,
              children: [
                _legendItem(const Color(0xFFEF4444), 'Critical: ${severity.critical}'),
                _legendItem(const Color(0xFFF59E0B), 'Warning: ${severity.warning}'),
                _legendItem(const Color(0xFF3B82F6), 'Info: ${severity.info}'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _legendItem(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2))),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 11)),
      ],
    );
  }
}
