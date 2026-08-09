import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import '../models/breed.dart';
import '../models/environmental_record.dart';
import '../models/feed_record.dart';
import '../models/financial_record.dart';
import '../models/growth_record.dart';
import '../models/mortality_event.dart';
import '../models/vaccination_event.dart';
import '../models/water_record.dart';

// ── Color palettes (matching web app) ──────────────

const _feedColors = {
  'Starter': Color(0xFFF59E0B),
  'Grower': Color(0xFF3B82F6),
  'Finisher': Color(0xFF10B981),
  'Chick': Color(0xFFEC4899),
};

const _categoryColors = {
  'chick_purchase': Color(0xFF3B82F6),
  'feed': Color(0xFFF59E0B),
  'vaccines': Color(0xFF10B981),
  'medication': Color(0xFF8B5CF6),
  'labor': Color(0xFFEC4899),
  'utilities': Color(0xFF06B6D4),
  'equipment': Color(0xFFF97316),
  'sales': Color(0xFF22C55E),
  'other': Color(0xFF94A3B8),
};

const _mortalityColors = [
  Color(0xFFEF4444),
  Color(0xFFF59E0B),
  Color(0xFF8B5CF6),
  Color(0xFF06B6D4),
  Color(0xFF94A3B8),
  Color(0xFFEC4899),
];

String _fmtDate(DateTime d) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return '${months[d.month - 1]} ${d.day}';
}

String _fmtZmw(double n) => n.toStringAsFixed(0);

// ── Growth Chart: Weight vs Target Line Chart ──────

class GrowthChart extends StatelessWidget {
  final List<GrowthRecord> records;
  final List<PerformanceTarget> targets;
  final String? startDate;

  const GrowthChart({super.key, required this.records, required this.targets, this.startDate});

  @override
  Widget build(BuildContext context) {
    if (records.isEmpty) return const SizedBox.shrink();

    final sorted = [...records]..sort((a, b) => a.recordDate.compareTo(b.recordDate));
    final start = startDate != null ? DateTime.tryParse(startDate!) : null;

    final spots = <FlSpot>[];
    final targetSpots = <FlSpot>[];
    double maxY = 0;

    for (int i = 0; i < sorted.length; i++) {
      final r = sorted[i];
      final ageDays = start != null
          ? r.recordDate.difference(start).inDays
          : i;
      final weight = r.avgWeight;
      spots.add(FlSpot(ageDays.toDouble(), weight));
      if (weight > maxY) maxY = weight;
      final target = targets.where((t) => t.ageDays == ageDays).firstOrNull;
      if (target?.targetWeightG != null) {
        final tw = target!.targetWeightG!;
        targetSpots.add(FlSpot(ageDays.toDouble(), tw));
        if (tw > maxY) maxY = tw;
      }
    }

    if (spots.isEmpty) return const SizedBox.shrink();

    final minX = spots.first.x;
    final maxX = spots.last.x;

    return _ChartCard(
      title: 'Weight vs Target',
      subtitle: 'Actual weight (g) vs breed performance targets',
      legend: const [
        _LegendItem(color: Color(0xFF2563EB), label: 'Actual'),
        _LegendItem(color: Color(0xFFF59E0B), label: 'Target', dashed: true),
      ],
      child: SizedBox(
        height: 220,
        child: LineChart(
          LineChartData(
            minY: 0,
            maxY: maxY * 1.15,
            minX: minX,
            maxX: maxX,
            gridData: const FlGridData(show: true, drawVerticalLine: false),
            titlesData: FlTitlesData(
              bottomTitles: AxisTitles(
                axisNameWidget: const Text('Day', style: TextStyle(fontSize: 10)),
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 28,
                  getTitlesWidget: (v, _) => Text('D${v.toInt()}', style: const TextStyle(fontSize: 9)),
                ),
              ),
              leftTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 40,
                  getTitlesWidget: (v, _) => Text('${v.toInt()}g', style: const TextStyle(fontSize: 9)),
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
                color: const Color(0xFF2563EB),
                barWidth: 2,
                dotData: const FlDotData(show: true),
                belowBarData: BarAreaData(show: false),
              ),
              if (targetSpots.isNotEmpty)
                LineChartBarData(
                  spots: targetSpots,
                  isCurved: true,
                  color: const Color(0xFFF59E0B),
                  barWidth: 2,
                  dashArray: [5, 5],
                  dotData: const FlDotData(show: false),
                  belowBarData: BarAreaData(show: false),
                ),
            ],
            lineTouchData: const LineTouchData(enabled: false),
          ),
        ),
      ),
    );
  }
}

// ── FCR Trend Chart ────────────────────────────────

class FcrChart extends StatelessWidget {
  final List<GrowthRecord> records;
  final List<PerformanceTarget> targets;
  final double? currentFcr;
  final String? startDate;

  const FcrChart({
    super.key,
    required this.records,
    required this.targets,
    this.currentFcr,
    this.startDate,
  });

  @override
  Widget build(BuildContext context) {
    if (records.isEmpty) return const SizedBox.shrink();

    final sorted = [...records]..sort((a, b) => a.recordDate.compareTo(b.recordDate));
    final start = startDate != null ? DateTime.tryParse(startDate!) : null;

    // Calculate cumulative FCR at each growth record point
    // FCR = cumulative feed intake / weight gain
    // We use the breed target FCR as reference and compute actual FCR
    // if we have enough data (feed records + growth records)
    final spots = <FlSpot>[];
    final targetSpots = <FlSpot>[];
    double maxY = 0;

    for (int i = 0; i < sorted.length; i++) {
      final r = sorted[i];
      final ageDays = start != null ? r.recordDate.difference(start).inDays : i;
      final target = targets.where((t) => t.ageDays == ageDays).firstOrNull;

      // Use target FCR as reference line
      if (target?.feedConversionRatio != null) {
        final tfcr = target!.feedConversionRatio!;
        targetSpots.add(FlSpot(ageDays.toDouble(), tfcr));
        if (tfcr > maxY) maxY = tfcr;
      }
    }

    // If we have a current FCR value, show it as a horizontal reference
    if (currentFcr != null && currentFcr! > 0) {
      if (currentFcr! > maxY) maxY = currentFcr!;
      // Show as a single point at the latest age
      if (sorted.isNotEmpty) {
        final lastAge = start != null
            ? sorted.last.recordDate.difference(start).inDays
            : sorted.length - 1;
        spots.add(FlSpot(lastAge.toDouble(), currentFcr!));
      }
    }

    if (targetSpots.isEmpty && spots.isEmpty) return const SizedBox.shrink();

    final minX = 0.0;
    final maxX = targetSpots.isNotEmpty ? targetSpots.last.x : (spots.isNotEmpty ? spots.last.x : 1.0);

    return _ChartCard(
      title: 'FCR Trend',
      subtitle: 'Feed Conversion Ratio vs breed targets',
      legend: [
        if (targetSpots.isNotEmpty) const _LegendItem(color: Color(0xFFF59E0B), label: 'Target FCR', dashed: true),
        if (spots.isNotEmpty) const _LegendItem(color: Color(0xFF2563EB), label: 'Actual FCR'),
      ],
      child: SizedBox(
        height: 200,
        child: LineChart(
          LineChartData(
            minY: 0,
            maxY: (maxY * 1.2).clamp(1.0, 10.0).toDouble(),
            minX: minX,
            maxX: maxX,
            gridData: const FlGridData(show: true, drawVerticalLine: false),
            titlesData: FlTitlesData(
              bottomTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 28,
                  getTitlesWidget: (v, _) => Text('D${v.toInt()}', style: const TextStyle(fontSize: 9)),
                ),
              ),
              leftTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 36,
                  getTitlesWidget: (v, _) => Text(v.toStringAsFixed(1), style: const TextStyle(fontSize: 9)),
                ),
              ),
              topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            ),
            borderData: FlBorderData(show: false),
            lineBarsData: [
              if (targetSpots.isNotEmpty)
                LineChartBarData(
                  spots: targetSpots,
                  isCurved: true,
                  color: const Color(0xFFF59E0B),
                  barWidth: 2,
                  dashArray: [5, 5],
                  dotData: const FlDotData(show: false),
                  belowBarData: BarAreaData(show: false),
                ),
              if (spots.isNotEmpty)
                LineChartBarData(
                  spots: spots,
                  isCurved: false,
                  color: const Color(0xFF2563EB),
                  barWidth: 3,
                  dotData: const FlDotData(show: true),
                  belowBarData: BarAreaData(show: false),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Feed Chart: Consumption Bar + Cost Line ────────

class FeedChart extends StatelessWidget {
  final List<FeedRecord> records;

  const FeedChart({super.key, required this.records});

  @override
  Widget build(BuildContext context) {
    if (records.isEmpty) return const SizedBox.shrink();

    final sorted = [...records]..sort((a, b) => a.recordDate.compareTo(b.recordDate));
    final maxY = sorted.fold<double>(0, (max, r) => r.quantityKg > max ? r.quantityKg : max);

    return _ChartCard(
      title: 'Feed Consumption',
      subtitle: 'Daily feed quantity (kg) and cost (ZMW)',
      legend: [
        for (final entry in _feedColors.entries)
          if (sorted.any((r) => r.feedType == entry.key))
            _LegendItem(color: entry.value, label: entry.key),
      ],
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
                    if (idx < 0 || idx >= sorted.length) return const SizedBox.shrink();
                    return Text(_fmtDate(sorted[idx].recordDate), style: const TextStyle(fontSize: 8));
                  },
                ),
              ),
              leftTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 36,
                  getTitlesWidget: (v, _) => Text('${v.toInt()}kg', style: const TextStyle(fontSize: 9)),
                ),
              ),
              topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              rightTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 40,
                  getTitlesWidget: (v, _) => Text('ZMW${v.toInt()}', style: const TextStyle(fontSize: 8)),
                ),
              ),
            ),
            borderData: FlBorderData(show: false),
            barGroups: sorted.asMap().entries.map((e) {
              final r = e.value;
              final color = _feedColors[r.feedType] ?? Colors.orange;
              return BarChartGroupData(
                x: e.key,
                barRods: [
                  BarChartRodData(
                    toY: r.quantityKg,
                    color: color,
                    width: 12,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ],
              );
            }).toList(),
          ),
        ),
      ),
    );
  }
}

// ── Water Chart: Consumption Bar + pH Line ─────────

class WaterChart extends StatelessWidget {
  final List<WaterRecord> records;

  const WaterChart({super.key, required this.records});

  @override
  Widget build(BuildContext context) {
    if (records.isEmpty) return const SizedBox.shrink();

    final sorted = [...records]..sort((a, b) => a.recordDate.compareTo(b.recordDate));
    final maxY = sorted.fold<double>(0, (max, r) => r.quantityLiters > max ? r.quantityLiters : max);

    return _ChartCard(
      title: 'Water Consumption & pH',
      subtitle: 'Daily water intake (L) with pH levels',
      legend: const [
        _LegendItem(color: Color(0xFF06B6D4), label: 'Water (L)'),
        _LegendItem(color: Color(0xFF22C55E), label: 'pH 7.0 optimal', dashed: true),
      ],
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
                    if (idx < 0 || idx >= sorted.length) return const SizedBox.shrink();
                    return Text(_fmtDate(sorted[idx].recordDate), style: const TextStyle(fontSize: 8));
                  },
                ),
              ),
              leftTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 36,
                  getTitlesWidget: (v, _) => Text('${v.toInt()}L', style: const TextStyle(fontSize: 9)),
                ),
              ),
              topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              rightTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 36,
                  getTitlesWidget: (v, _) => Text(v.toStringAsFixed(1), style: const TextStyle(fontSize: 9)),
                ),
              ),
            ),
            borderData: FlBorderData(show: false),
            barGroups: sorted.asMap().entries.map((e) {
              return BarChartGroupData(
                x: e.key,
                barRods: [
                  BarChartRodData(
                    toY: e.value.quantityLiters,
                    color: const Color(0xFF06B6D4),
                    width: 12,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ],
              );
            }).toList(),
            extraLinesData: ExtraLinesData(
              horizontalLines: [
                // pH reference line at 7.0 (optimal)
                if (sorted.any((r) => r.ph != null))
                  HorizontalLine(
                    y: 7.0 * (maxY * 1.2 / 14), // Scale pH onto the bar chart Y axis
                    color: const Color(0xFF22C55E),
                    strokeWidth: 1,
                    dashArray: [3, 3],
                    label: HorizontalLineLabel(
                      show: true,
                      style: const TextStyle(fontSize: 9, color: Color(0xFF22C55E)),
                      labelResolver: (_) => 'pH 7.0',
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Mortality Chart: Cumulative Area + Cause Pie ──

class MortalityChart extends StatelessWidget {
  final List<MortalityEvent> records;

  const MortalityChart({super.key, required this.records});

  @override
  Widget build(BuildContext context) {
    if (records.isEmpty) return const SizedBox.shrink();

    final sorted = [...records]..sort((a, b) => a.eventDate.compareTo(b.eventDate));

    // Cumulative deaths
    int cumulative = 0;
    final cumSpots = <FlSpot>[];
    for (int i = 0; i < sorted.length; i++) {
      cumulative += sorted[i].count;
      cumSpots.add(FlSpot(i.toDouble(), cumulative.toDouble()));
    }
    final maxY = cumulative.toDouble();

    // Cause breakdown
    final causeMap = <String, int>{};
    for (final r in sorted) {
      final c = r.cause ?? 'Unknown';
      causeMap[c] = (causeMap[c] ?? 0) + r.count;
    }
    final causes = causeMap.entries.toList();

    return Column(
      children: [
        _ChartCard(
          title: 'Cumulative Mortality',
          subtitle: 'Running total of deaths over time',
          child: SizedBox(
            height: 200,
            child: LineChart(
              LineChartData(
                minY: 0,
                maxY: maxY * 1.15 + 1,
                gridData: const FlGridData(show: true, drawVerticalLine: false),
                titlesData: FlTitlesData(
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 28,
                      getTitlesWidget: (v, _) {
                        final idx = v.toInt();
                        if (idx < 0 || idx >= sorted.length) return const SizedBox.shrink();
                        return Text(_fmtDate(sorted[idx].eventDate), style: const TextStyle(fontSize: 8));
                      },
                    ),
                  ),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 28,
                      getTitlesWidget: (v, _) => Text(v.toInt().toString(), style: const TextStyle(fontSize: 9)),
                    ),
                  ),
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                ),
                borderData: FlBorderData(show: false),
                lineBarsData: [
                  LineChartBarData(
                    spots: cumSpots,
                    isCurved: false,
                    color: const Color(0xFFEF4444),
                    barWidth: 2,
                    dotData: const FlDotData(show: true),
                    belowBarData: BarAreaData(
                      show: true,
                      color: const Color(0xFFEF4444).withValues(alpha: 0.3),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        if (causes.isNotEmpty) ...[
          const SizedBox(height: 12),
          _ChartCard(
            title: 'Causes',
            subtitle: 'Death breakdown by cause',
            legend: [
              for (int i = 0; i < causes.length; i++)
                _LegendItem(
                  color: _mortalityColors[i % _mortalityColors.length],
                  label: causes[i].key,
                ),
            ],
            child: SizedBox(
              height: 180,
              child: PieChart(
                PieChartData(
                  sectionsSpace: 2,
                  centerSpaceRadius: 32,
                  sections: causes.asMap().entries.map((e) {
                    final total = causes.fold<int>(0, (s, c) => s + c.value);
                    final pct = total > 0 ? e.value.value / total : 0.0;
                    return PieChartSectionData(
                      value: e.value.value.toDouble(),
                      title: '${(pct * 100).toStringAsFixed(0)}%',
                      color: _mortalityColors[e.key % _mortalityColors.length],
                      radius: 48,
                      titleStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
                    );
                  }).toList(),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

// ── Financial Chart: Cost Breakdown Pie + Rev vs Cost Bar ─

class FinancialChart extends StatelessWidget {
  final List<FinancialRecord> records;

  const FinancialChart({super.key, required this.records});

  @override
  Widget build(BuildContext context) {
    if (records.isEmpty) return const SizedBox.shrink();

    final costMap = <String, double>{};
    double totalRevenue = 0;
    double totalCost = 0;

    for (final r in records) {
      if (r.isIncome) {
        totalRevenue += r.amountZmw;
      } else {
        totalCost += r.amountZmw;
        costMap[r.category] = (costMap[r.category] ?? 0) + r.amountZmw;
      }
    }

    final costEntries = costMap.entries.where((e) => e.value > 0).toList();

    return Column(
      children: [
        if (costEntries.isNotEmpty)
          _ChartCard(
            title: 'Cost Breakdown',
            subtitle: 'By category (ZMW)',
            legend: [
              for (final e in costEntries)
                _LegendItem(
                  color: _categoryColors[e.key] ?? Colors.grey,
                  label: '${e.key}: ZMW ${_fmtZmw(e.value)}',
                ),
            ],
            child: SizedBox(
              height: 200,
              child: PieChart(
                PieChartData(
                  sectionsSpace: 2,
                  centerSpaceRadius: 40,
                  sections: costEntries.map((e) {
                    final pct = totalCost > 0 ? e.value / totalCost : 0.0;
                    return PieChartSectionData(
                      value: e.value,
                      title: '${(pct * 100).toStringAsFixed(0)}%',
                      color: _categoryColors[e.key] ?? Colors.grey,
                      radius: 48,
                      titleStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
                    );
                  }).toList(),
                ),
              ),
            ),
          ),
        const SizedBox(height: 12),
        if (totalRevenue > 0 || totalCost > 0)
          _ChartCard(
            title: 'Revenue vs Cost',
            subtitle: 'Total (ZMW)',
            child: SizedBox(
              height: 200,
              child: BarChart(
                BarChartData(
                  maxY: (totalRevenue > totalCost ? totalRevenue : totalCost) * 1.2,
                  gridData: const FlGridData(show: true, drawVerticalLine: false),
                  titlesData: FlTitlesData(
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 28,
                        getTitlesWidget: (v, _) {
                          final idx = v.toInt();
                          if (idx == 0) return const Text('Revenue', style: TextStyle(fontSize: 10));
                          if (idx == 1) return const Text('Cost', style: TextStyle(fontSize: 10));
                          return const SizedBox.shrink();
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
                  barGroups: [
                    BarChartGroupData(
                      x: 0,
                      barRods: [
                        BarChartRodData(toY: totalRevenue, color: const Color(0xFF22C55E), width: 32, borderRadius: BorderRadius.circular(4)),
                      ],
                    ),
                    BarChartGroupData(
                      x: 1,
                      barRods: [
                        BarChartRodData(toY: totalCost, color: const Color(0xFFEF4444), width: 32, borderRadius: BorderRadius.circular(4)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

// ── Vaccination Chart: Cost Timeline Bar ───────────

class VaccinationChart extends StatelessWidget {
  final List<VaccinationEvent> records;

  const VaccinationChart({super.key, required this.records});

  @override
  Widget build(BuildContext context) {
    if (records.isEmpty) return const SizedBox.shrink();

    final sorted = [...records]..sort((a, b) => a.adminDate.compareTo(b.adminDate));
    final withCost = sorted.where((r) => r.costZmw != null && r.costZmw! > 0).toList();
    if (withCost.isEmpty) return const SizedBox.shrink();

    final maxY = withCost.fold<double>(0, (max, r) => (r.costZmw ?? 0) > max ? (r.costZmw ?? 0) : max);

    return _ChartCard(
      title: 'Vaccination Cost Timeline',
      subtitle: 'Cost per vaccination event (ZMW)',
      child: SizedBox(
        height: 200,
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
                    if (idx < 0 || idx >= withCost.length) return const SizedBox.shrink();
                    return Text(_fmtDate(withCost[idx].adminDate), style: const TextStyle(fontSize: 8));
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
            barGroups: withCost.asMap().entries.map((e) {
              return BarChartGroupData(
                x: e.key,
                barRods: [
                  BarChartRodData(
                    toY: e.value.costZmw ?? 0,
                    color: const Color(0xFF10B981),
                    width: 12,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ],
              );
            }).toList(),
          ),
        ),
      ),
    );
  }
}

// ── Environment Chart: Temperature & Humidity Trends ─

class EnvironmentChart extends StatelessWidget {
  final List<EnvironmentalRecord> records;

  const EnvironmentChart({super.key, required this.records});

  @override
  Widget build(BuildContext context) {
    if (records.isEmpty) return const SizedBox.shrink();

    final sorted = [...records]..sort((a, b) => a.recordDate.compareTo(b.recordDate));
    final withTemp = sorted.where((r) => r.temperatureC != null).toList();
    if (withTemp.isEmpty) return const SizedBox.shrink();

    final temps = withTemp.map((r) => r.temperatureC!).toList();

    final minTemp = temps.reduce((a, b) => a < b ? a : b);
    final maxTemp = temps.reduce((a, b) => a > b ? a : b);

    final tempSpots = <FlSpot>[];
    final humiditySpots = <FlSpot>[];

    for (int i = 0; i < withTemp.length; i++) {
      final r = withTemp[i];
      tempSpots.add(FlSpot(i.toDouble(), r.temperatureC!));
      if (r.humidityPct != null) {
        humiditySpots.add(FlSpot(i.toDouble(), r.humidityPct!));
      }
    }

    return _ChartCard(
      title: 'Temperature & Humidity',
      subtitle: 'Logged environmental readings over time',
      legend: [
        const _LegendItem(color: Color(0xFFEF4444), label: 'Temperature (°C)'),
        if (humiditySpots.isNotEmpty) const _LegendItem(color: Color(0xFF06B6D4), label: 'Humidity (%)'),
      ],
      child: SizedBox(
        height: 220,
        child: LineChart(
          LineChartData(
            minY: minTemp * 0.9,
            maxY: maxTemp * 1.1,
            gridData: const FlGridData(show: true, drawVerticalLine: false),
            titlesData: FlTitlesData(
              bottomTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 28,
                  getTitlesWidget: (v, _) {
                    final idx = v.toInt();
                    if (idx < 0 || idx >= withTemp.length) return const SizedBox.shrink();
                    return Text(_fmtDate(withTemp[idx].recordDate), style: const TextStyle(fontSize: 8));
                  },
                ),
              ),
              leftTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 36,
                  getTitlesWidget: (v, _) => Text('${v.toInt()}°C', style: const TextStyle(fontSize: 9)),
                ),
              ),
              topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              rightTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 36,
                  getTitlesWidget: (v, _) => Text('${v.toInt()}%', style: const TextStyle(fontSize: 9)),
                ),
              ),
            ),
            borderData: FlBorderData(show: false),
            lineBarsData: [
              LineChartBarData(
                spots: tempSpots,
                isCurved: true,
                color: const Color(0xFFEF4444),
                barWidth: 2,
                dotData: const FlDotData(show: true),
                belowBarData: BarAreaData(show: false),
              ),
              if (humiditySpots.isNotEmpty)
                LineChartBarData(
                  spots: humiditySpots,
                  isCurved: true,
                  color: const Color(0xFF06B6D4),
                  barWidth: 2,
                  dotData: const FlDotData(show: false),
                  belowBarData: BarAreaData(show: false),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Reusable chart card wrapper ────────────────────

class _ChartCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final Widget child;
  final List<_LegendItem> legend;

  const _ChartCard({
    required this.title,
    required this.subtitle,
    this.legend = const [],
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 2),
            Text(subtitle, style: const TextStyle(fontSize: 12, color: Colors.grey)),
            const SizedBox(height: 12),
            child,
            if (legend.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 12,
                runSpacing: 6,
                children: legend.map((l) => l.build()).toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _LegendItem {
  final Color color;
  final String label;
  final bool dashed;

  const _LegendItem({required this.color, required this.label, this.dashed = false});

  Widget build() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 16,
          height: 3,
          decoration: BoxDecoration(
            color: dashed ? Colors.transparent : color,
            border: dashed ? Border(bottom: BorderSide(color: color, width: 2)) : null,
            borderRadius: BorderRadius.circular(1),
          ),
        ),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 11)),
      ],
    );
  }
}
