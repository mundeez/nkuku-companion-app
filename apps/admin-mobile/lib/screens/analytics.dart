import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../api.dart';

/// Growth & finance analytics — P5 parity with admin-web. Daily rollups
/// from platform_daily_stats (00:30 cron); demo org & staff excluded.
class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  Map<String, dynamic>? _overview;
  Map<String, dynamic>? _cohorts;
  String? _error;
  bool _loading = true;
  final _from = TextEditingController();
  final _to = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _from.dispose();
    _to.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final results = await Future.wait([
        Api.analyticsOverviewRange(
            from: _from.text.trim(), to: _to.text.trim()),
        Api.analyticsCohorts(),
      ]);
      if (mounted) {
        setState(() {
          _overview = results[0];
          _cohorts = results[1];
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

  Future<void> _exportCsv() async {
    try {
      final csv = await Api.analyticsCsv(
          from: _from.text.trim(), to: _to.text.trim());
      if (!mounted) return;
      final messenger = ScaffoldMessenger.of(context);
      await Clipboard.setData(ClipboardData(text: csv));
      messenger.showSnackBar(const SnackBar(
          content: Text('CSV copied to clipboard — paste into a sheet.')));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Export failed: $e')));
      }
    }
  }

  num _n(Map<String, dynamic>? m, String k) =>
      num.tryParse('${m?[k] ?? 0}') ?? 0;

  String _kwacha(num n) =>
      'K${n.toStringAsFixed(n.truncateToDouble() == n ? 0 : 2)}';

  @override
  Widget build(BuildContext context) {
    final latest = _overview?['latest'] as Map<String, dynamic>?;
    final series = (_overview?['series'] as List?) ?? const [];
    final funnel = latest?['funnel'] as Map<String, dynamic>?;
    final countries =
        Map<String, dynamic>.from((latest?['countries'] as Map?) ?? {});
    final cohortList = (_cohorts?['cohorts'] as List?) ?? const [];

    // Range totals for the KPI cards.
    var tSignups = 0, tActivations = 0, tNew = 0.0, tExp = 0.0, tChurn = 0.0,
        tRecov = 0;
    for (final d in series) {
      final m = d as Map<String, dynamic>;
      tSignups += _n(m, 'signups').toInt();
      tActivations += _n(m, 'activations').toInt();
      tNew += _n(m, 'newMrr').toDouble();
      tExp += _n(m, 'expansionMrr').toDouble();
      tChurn += _n(m, 'churnedMrr').toDouble();
      tRecov += _n(m, 'failedPaymentRecoveries').toInt();
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Analytics')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── Range filter + export ──
            Row(children: [
              Expanded(
                child: TextField(
                  controller: _from,
                  decoration: const InputDecoration(
                      hintText: 'From YYYY-MM-DD',
                      isDense: true,
                      border: OutlineInputBorder()),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _to,
                  decoration: const InputDecoration(
                      hintText: 'To YYYY-MM-DD',
                      isDense: true,
                      border: OutlineInputBorder()),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                  icon: const Icon(Icons.refresh), onPressed: _load),
              IconButton(
                  icon: const Icon(Icons.download_outlined),
                  tooltip: 'Copy CSV',
                  onPressed: _exportCsv),
            ]),
            const SizedBox(height: 4),
            const Text(
              'Daily rollups from platform_daily_stats (00:30 cron). '
              'Demo org & staff excluded.',
              style: TextStyle(fontSize: 11, color: Colors.grey),
            ),
            if (_loading && _overview == null)
              const Padding(
                padding: EdgeInsets.all(48),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null && _overview == null)
              Padding(
                padding: const EdgeInsets.all(24),
                child: Text('Error: $_error',
                    style: const TextStyle(color: Colors.red)),
              )
            else ...[
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text('Refresh failed: $_error',
                      style: const TextStyle(color: Colors.red)),
                ),
              // ── KPI cards ──
              _kpi('MRR (current)', _kwacha(_n(latest, 'mrrTotal')),
                  'basic ${_kwacha(_n(latest, 'mrrBasic'))} · grower ${_kwacha(_n(latest, 'mrrGrower'))} · biz ${_kwacha(_n(latest, 'mrrBusiness'))}'),
              _kpi('Signups (range)', '$tSignups',
                  '$tActivations first-flock activations'),
              _kpi('WAU / MAU',
                  '${_n(latest, 'wau')} / ${_n(latest, 'mau')}',
                  'audit-active tenant users'),
              _kpi('Net MRR movement',
                  _kwacha(tNew + tExp - tChurn),
                  '+${_kwacha(tNew)} new · +${_kwacha(tExp)} exp · −${_kwacha(tChurn)} churn'),
              const SizedBox(height: 8),
              // ── Charts ──
              _chartCard('MRR by plan', 'Normalized monthly ZMW',
                  _mrrChart(series)),
              _chartCard('Signups & activations',
                  'New orgs vs first flock', _signupsChart(series)),
              _chartCard('Weekly / monthly active users', '',
                  _activityChart(series)),
              // ── Funnel + countries ──
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Subscription funnel & countries',
                          style: TextStyle(
                              fontWeight: FontWeight.bold, fontSize: 14)),
                      const SizedBox(height: 8),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment:
                                  CrossAxisAlignment.start,
                              children: [
                                const Text('Funnel',
                                    style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600)),
                                if (funnel == null)
                                  const Text('No data yet',
                                      style: TextStyle(
                                          fontSize: 12,
                                          color: Colors.grey))
                                else
                                  for (final k in const [
                                    'trialing', 'active', 'past_due',
                                    'suspended', 'cancelled', 'everPaid',
                                  ])
                                    _kv(k.replaceAll('_', ' '),
                                        '${funnel[k] ?? 0}'),
                              ],
                            ),
                          ),
                          Expanded(
                            child: Column(
                              crossAxisAlignment:
                                  CrossAxisAlignment.start,
                              children: [
                                const Text('Active orgs by country',
                                    style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600)),
                                if (countries.isEmpty)
                                  const Text('No data yet',
                                      style: TextStyle(
                                          fontSize: 12,
                                          color: Colors.grey))
                                else
                                  ..._sortedCountries(countries)
                                      .map((e) =>
                                          _kv(e.key, '${e.value}')),
                                _kv('Recoveries (range)', '$tRecov'),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 8),
              // ── Cohorts ──
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Retention cohorts',
                          style: TextStyle(
                              fontWeight: FontWeight.bold, fontSize: 14)),
                      const Text(
                          'Signup month × months active — % of the cohort with tenant activity',
                          style: TextStyle(
                              fontSize: 11, color: Colors.grey)),
                      const SizedBox(height: 8),
                      if (cohortList.isEmpty)
                        const Text('No cohort data yet.',
                            style: TextStyle(
                                fontSize: 12, color: Colors.grey))
                      else
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: DataTable(
                            columns: [
                              const DataColumn(label: Text('Cohort')),
                              const DataColumn(label: Text('Size')),
                              ..._cohortMonths(cohortList).map(
                                  (m) => DataColumn(
                                      label: Text('M$m',
                                          style:
                                              const TextStyle(fontSize: 10)))),
                            ],
                            rows: [
                              for (final c in cohortList)
                                DataRow(cells: [
                                  DataCell(Text('${c['cohort']}',
                                      style: const TextStyle(
                                          fontSize: 11))),
                                  DataCell(Text('${c['size']}',
                                      style: const TextStyle(
                                          fontSize: 11))),
                                  for (final m
                                      in _cohortMonths(cohortList))
                                    DataCell(_cohortCell(c, m)),
                                ]),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  List<MapEntry<String, dynamic>> _sortedCountries(
          Map<String, dynamic> countries) =>
      countries.entries.toList()
        ..sort((a, b) =>
            (b.value is num ? b.value as num : 0)
                .compareTo(a.value is num ? a.value as num : 0));

  List<int> _cohortMonths(List<dynamic> cohorts) {
    var max = 0;
    for (final c in cohorts) {
      final months = (c['months'] as Map?) ?? {};
      for (final k in months.keys) {
        final m = int.tryParse('$k') ?? 0;
        if (m > max) max = m;
      }
    }
    return List.generate(max + 1, (i) => i);
  }

  Widget _cohortCell(Map<String, dynamic> c, int m) {
    final months = (c['months'] as Map?) ?? {};
    final v = months['$m'];
    final pct = v is num ? v.toDouble() : null;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      color: pct != null
          ? Colors.green.withValues(alpha: (pct / 100).clamp(0, 0.7))
          : null,
      child: Text(
          pct != null ? '${pct.toStringAsFixed(0)}%' : '—',
          style: const TextStyle(fontSize: 10)),
    );
  }

  Widget _kpi(String label, String value, String sub) => Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                  style: const TextStyle(
                      fontSize: 11, color: Colors.grey)),
              Text(value,
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.bold)),
              Text(sub,
                  style: const TextStyle(fontSize: 10, color: Colors.grey),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis),
            ],
          ),
        ),
      );

  Widget _kv(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 1),
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(k,
                  style: const TextStyle(fontSize: 12),
                  overflow: TextOverflow.ellipsis),
              Text(v,
                  style: const TextStyle(
                      fontSize: 12, fontFamily: 'monospace')),
            ]),
      );

  Widget _chartCard(String title, String sub, Widget chart) => Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 14)),
              if (sub.isNotEmpty)
                Text(sub,
                    style: const TextStyle(
                        fontSize: 11, color: Colors.grey)),
              const SizedBox(height: 8),
              SizedBox(height: 180, child: chart),
            ],
          ),
        ),
      );

  List<FlSpot> _spots(List<dynamic> series, String key) => [
        for (var i = 0; i < series.length; i++)
          FlSpot(i.toDouble(), _n(series[i] as Map<String, dynamic>, key).toDouble()),
      ];

  Widget _mrrChart(List<dynamic> series) {
    if (series.isEmpty) return _emptyChart();
    return LineChart(LineChartData(
      gridData: const FlGridData(show: false),
      titlesData: const FlTitlesData(show: false),
      lineBarsData: [
        for (final (key, color) in const [
          ('mrrBasic', Color(0xFF60A5FA)),
          ('mrrGrower', Color(0xFF34D399)),
          ('mrrBusiness', Color(0xFFF59E0B)),
          ('mrrEnterprise', Color(0xFFA78BFA)),
        ])
          LineChartBarData(
            spots: _spots(series, key),
            isCurved: true,
            color: color,
            barWidth: 2,
            dotData: const FlDotData(show: false),
            belowBarData: BarAreaData(
                show: true, color: color.withValues(alpha: 0.15)),
          ),
      ],
      lineTouchData: LineTouchData(
        touchTooltipData: LineTouchTooltipData(
          getTooltipItems: (spots) => [
            for (final s in spots)
              LineTooltipItem(
                  '${_seriesLabel(series, s.spotIndex)}\n${_kwacha(s.y)}',
                  const TextStyle(fontSize: 10, color: Colors.white)),
          ],
        ),
      ),
    ));
  }

  String _seriesLabel(List<dynamic> series, int i) =>
      '${(series[i] as Map)['date']}';

  Widget _signupsChart(List<dynamic> series) {
    if (series.isEmpty) return _emptyChart();
    return BarChart(BarChartData(
      gridData: const FlGridData(show: false),
      titlesData: const FlTitlesData(show: false),
      barGroups: [
        for (var i = 0; i < series.length; i++)
          BarChartGroupData(x: i, barRods: [
            BarChartRodData(
                toY: _n(series[i] as Map<String, dynamic>, 'signups').toDouble(),
                color: const Color(0xFF60A5FA), width: 6),
            BarChartRodData(
                toY: _n(series[i] as Map<String, dynamic>, 'activations').toDouble(),
                color: const Color(0xFF34D399), width: 6),
          ]),
      ],
    ));
  }

  Widget _activityChart(List<dynamic> series) {
    if (series.isEmpty) return _emptyChart();
    return LineChart(LineChartData(
      gridData: const FlGridData(show: false),
      titlesData: const FlTitlesData(show: false),
      lineBarsData: [
        LineChartBarData(
            spots: _spots(series, 'wau'),
            color: const Color(0xFF60A5FA),
            barWidth: 2,
            dotData: const FlDotData(show: false)),
        LineChartBarData(
            spots: _spots(series, 'mau'),
            color: const Color(0xFFF59E0B),
            barWidth: 2,
            dotData: const FlDotData(show: false)),
      ],
    ));
  }

  Widget _emptyChart() => const Center(
      child: Text('No data in range',
          style: TextStyle(color: Colors.grey, fontSize: 12)));
}
