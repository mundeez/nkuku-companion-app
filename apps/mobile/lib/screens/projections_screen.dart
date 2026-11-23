import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../services/api_service.dart';
import '../models/supplier.dart';
import '../models/projection.dart';
import '../widgets/ad_slot.dart';

class ProjectionsScreen extends StatefulWidget {
  const ProjectionsScreen({super.key});

  @override
  State<ProjectionsScreen> createState() => _ProjectionsScreenState();
}

class _ProjectionsScreenState extends State<ProjectionsScreen> {
  List<Supplier> _suppliers = [];
  Supplier? _selectedSupplier;
  final _birdCountController = TextEditingController(text: '1000');
  final _priceController = TextEditingController(text: '140');
  // One entry per bag-size scenario (25 kg / 50 kg), or a single unfiltered
  // projection when the supplier has no explicit size split.
  List<_ProjectionScenario> _scenarios = [];
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _loadSuppliers();
  }

  Future<void> _loadSuppliers() async {
    try {
      final res = await ApiService.dio.get('/api/v1/suppliers');
      setState(() {
        _suppliers =
            (res.data as List).map((e) => Supplier.fromJson(e)).toList();
        _selectedSupplier = _suppliers.firstWhere((s) => s.isDefault,
            orElse: () => _suppliers.first);
      });
    } catch (e) {
      // ignore
    }
  }

  Future<void> _calculate() async {
    if (_selectedSupplier == null) return;
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _loading = true);
    try {
      final birdCount = int.parse(_birdCountController.text);
      final price = double.parse(_priceController.text);
      final supplier = _selectedSupplier!;

      // Feed stages exist in 25 kg and 50 kg variants — each is a complete
      // alternative scenario, never summed together (matches web behaviour).
      final feedSizes = supplier.feedStages
          .where((s) => s.stageType == 'feed')
          .map((s) => s.unitSizeKg)
          .toSet();
      final sizes =
          [25.0, 50.0].where((kg) => feedSizes.any((s) => s == kg)).toList();

      final futures = sizes.isEmpty
          ? [
              ApiService.dio.post('/api/v1/projections/calculate', data: {
                'birdCount': birdCount,
                'supplierId': supplier.id,
                'salesPricePerBird': price,
              })
            ]
          : [
              for (final kg in sizes)
                ApiService.dio.post('/api/v1/projections/calculate', data: {
                  'birdCount': birdCount,
                  'supplierId': supplier.id,
                  'salesPricePerBird': price,
                  'bagSize': kg,
                }),
            ];

      final responses = await Future.wait(futures);
      if (!mounted) return;
      setState(() {
        _scenarios = [
          for (var i = 0; i < responses.length; i++)
            _ProjectionScenario(
              bagSizeKg: sizes.isEmpty ? null : sizes[i],
              result: ProjectionResult.fromJson(responses[i].data),
            ),
        ];
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      messenger.showSnackBar(
        const SnackBar(content: Text('Calculation failed')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Projection Calculator')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    DropdownButtonFormField<Supplier?>(
                      key: ValueKey(_selectedSupplier),
                      initialValue: _selectedSupplier,
                      decoration: const InputDecoration(labelText: 'Supplier'),
                      items: _suppliers
                          .map((s) => DropdownMenuItem(
                                value: s,
                                child: Text(s.name),
                              ))
                          .toList(),
                      onChanged: (v) => setState(() => _selectedSupplier = v),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _birdCountController,
                      decoration:
                          const InputDecoration(labelText: 'Bird Count'),
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _priceController,
                      decoration: const InputDecoration(
                          labelText: 'Sale Price per Bird (ZMW)'),
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: _loading ? null : _calculate,
                      child: _loading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white))
                          : const Text('Calculate'),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            const AdSlot(page: 'projections'),
            for (final scenario in _scenarios) ...[
              const SizedBox(height: 16),
              _buildScenarioSection(scenario),
            ],
          ],
        ),
      ),
    );
  }

  /// One complete projection scenario — 25 kg bags, 50 kg bags, or a single
  /// unfiltered result when the supplier has no size split. KPIs, chart and
  /// breakdown all reflect only that scenario's stages.
  Widget _buildScenarioSection(_ProjectionScenario scenario) {
    final projection = scenario.result;
    final title = scenario.bagSizeKg == null
        ? (projection.supplierName.isNotEmpty
            ? projection.supplierName
            : 'Projection')
        : '${scenario.bagSizeKg!.toInt()} kg bags';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(title,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        _KpiCard(
            title: 'Total Expenses',
            value: 'ZMW ${projection.totalExpenses}',
            color: Colors.red),
        _KpiCard(
            title: 'Projected Revenue',
            value: 'ZMW ${projection.projectedRevenue}',
            color: Colors.blue),
        _KpiCard(
            title: 'Gross Profit',
            value: 'ZMW ${projection.grossProfit}',
            color: Colors.green),
        _KpiCard(
            title: 'Net Profit',
            value: 'ZMW ${projection.netProfit}',
            color: Colors.teal),
        const SizedBox(height: 16),
        const Text('Cost Breakdown',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        SizedBox(
          height: 220,
          child: BarChart(
            BarChartData(
              barGroups: projection.breakdown.asMap().entries.map((e) {
                return BarChartGroupData(
                  x: e.key,
                  barRods: [
                    BarChartRodData(
                      toY: double.tryParse(e.value.subtotalZmw) ?? 0,
                      color: Colors.green,
                      width: 24,
                      borderRadius:
                          const BorderRadius.vertical(top: Radius.circular(4)),
                    ),
                  ],
                );
              }).toList(),
              titlesData: FlTitlesData(
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    getTitlesWidget: (value, meta) {
                      final idx = value.toInt();
                      if (idx >= 0 && idx < projection.breakdown.length) {
                        return Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            projection.breakdown[idx].stageName
                                .split(' ')
                                .first,
                            style: const TextStyle(fontSize: 10),
                          ),
                        );
                      }
                      return const SizedBox.shrink();
                    },
                  ),
                ),
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 50,
                    getTitlesWidget: (value, meta) => Text(
                      value.toInt().toString(),
                      style: const TextStyle(fontSize: 10),
                    ),
                  ),
                ),
                topTitles:
                    const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles:
                    const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              ),
              gridData: const FlGridData(show: false),
              borderData: FlBorderData(show: false),
            ),
          ),
        ),
        const SizedBox(height: 12),
        ..._buildGroupedBreakdown(projection.breakdown),
      ],
    );
  }

  /// Groups the breakdown by feed bag size (50 kg bags, 25 kg bags, …) so
  /// each size's projected totals are shown separately, with non-feed costs
  /// (chicks, medication, …) under 'Other costs' last.
  List<Widget> _buildGroupedBreakdown(List<ProjectionBreakdown> items) {
    final groups = <String, List<ProjectionBreakdown>>{};
    for (final b in items) {
      groups.putIfAbsent(b.groupLabel, () => []).add(b);
    }
    final labels = groups.keys.toList()
      ..sort((a, b) {
        if (a == 'Other costs') return 1;
        if (b == 'Other costs') return -1;
        final aKg = double.tryParse(a.split(' ').first) ?? 0;
        final bKg = double.tryParse(b.split(' ').first) ?? 0;
        return bKg.compareTo(aKg); // larger bags first
      });

    return [
      for (final label in labels) ...[
        Padding(
          padding: const EdgeInsets.only(top: 8, bottom: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label,
                  style: const TextStyle(
                      fontSize: 15, fontWeight: FontWeight.bold)),
              Text(
                'ZMW ${groups[label]!.fold<double>(0, (s, b) => s + (double.tryParse(b.subtotalZmw) ?? 0)).toStringAsFixed(2)}',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ),
        ...groups[label]!.map((b) => ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              title: Text(b.stageName,
                  maxLines: 1, overflow: TextOverflow.ellipsis),
              subtitle: Text(
                  b.stageType == 'feed'
                      ? '${b.itemsRoundedUp ?? 0} bags @ ZMW ${b.unitPriceZmw}/bag'
                      : '${b.itemsRoundedUp ?? 0} units @ ZMW ${b.unitPriceZmw}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis),
              trailing: Text('ZMW ${b.subtotalZmw}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
      ],
    ];
  }
}

class _KpiCard extends StatelessWidget {
  final String title;
  final String value;
  final Color color;

  const _KpiCard(
      {required this.title, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(title,
                style: TextStyle(color: color, fontWeight: FontWeight.w600)),
            Text(value,
                style:
                    const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }
}

/// A single what-if projection: either filtered to one bag size (25/50 kg)
/// or unfiltered when the supplier has no explicit size split.
class _ProjectionScenario {
  final double? bagSizeKg;
  final ProjectionResult result;
  const _ProjectionScenario({this.bagSizeKg, required this.result});
}
