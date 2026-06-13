import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../services/api_service.dart';
import '../models/supplier.dart';
import '../models/projection.dart';

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
  ProjectionResult? _projection;
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
        _suppliers = (res.data as List).map((e) => Supplier.fromJson(e)).toList();
        _selectedSupplier = _suppliers.firstWhere((s) => s.isDefault, orElse: () => _suppliers.first);
      });
    } catch (e) {
      // ignore
    }
  }

  Future<void> _calculate() async {
    if (_selectedSupplier == null) return;
    setState(() => _loading = true);
    try {
      final res = await ApiService.dio.post('/api/v1/projections/calculate', data: {
        'birdCount': int.parse(_birdCountController.text),
        'supplierId': _selectedSupplier!.id,
        'salesPricePerBird': double.parse(_priceController.text),
      });
      setState(() {
        _projection = ProjectionResult.fromJson(res.data);
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
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
                    DropdownButtonFormField<Supplier>(
                      value: _selectedSupplier,
                      decoration: const InputDecoration(labelText: 'Supplier'),
                      items: _suppliers.map((s) => DropdownMenuItem(
                        value: s,
                        child: Text(s.name),
                      )).toList(),
                      onChanged: (v) => setState(() => _selectedSupplier = v),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _birdCountController,
                      decoration: const InputDecoration(labelText: 'Bird Count'),
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _priceController,
                      decoration: const InputDecoration(labelText: 'Sale Price per Bird (ZMW)'),
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: _loading ? null : _calculate,
                      child: _loading
                          ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Text('Calculate'),
                    ),
                  ],
                ),
              ),
            ),
            if (_projection != null) ...[
              const SizedBox(height: 16),
              _KpiCard(title: 'Total Expenses', value: 'ZMW ${_projection!.totalExpenses}', color: Colors.red),
              _KpiCard(title: 'Projected Revenue', value: 'ZMW ${_projection!.projectedRevenue}', color: Colors.blue),
              _KpiCard(title: 'Gross Profit', value: 'ZMW ${_projection!.grossProfit}', color: Colors.green),
              _KpiCard(title: 'Net Profit', value: 'ZMW ${_projection!.netProfit}', color: Colors.teal),
              const SizedBox(height: 16),
              const Text('Cost Breakdown', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              SizedBox(
                height: 220,
                child: BarChart(
                  BarChartData(
                    barGroups: _projection!.breakdown.asMap().entries.map((e) {
                      return BarChartGroupData(
                        x: e.key,
                        barRods: [
                          BarChartRodData(
                            toY: double.tryParse(e.value.subtotalZmw) ?? 0,
                            color: Colors.green,
                            width: 24,
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
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
                            if (idx >= 0 && idx < _projection!.breakdown.length) {
                              return Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(
                                  _projection!.breakdown[idx].stageName.split(' ').first,
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
                      topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                      rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    ),
                    gridData: const FlGridData(show: false),
                    borderData: FlBorderData(show: false),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              ..._projection!.breakdown.map((b) => ListTile(
                dense: true,
                title: Text(b.stageName),
                subtitle: Text('${b.itemsRoundedUp} items @ ZMW ${b.unitPriceZmw}'),
                trailing: Text('ZMW ${b.subtotalZmw}', style: const TextStyle(fontWeight: FontWeight.bold)),
              )),
            ],
          ],
        ),
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  final String title;
  final String value;
  final Color color;

  const _KpiCard({required this.title, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(title, style: TextStyle(color: color, fontWeight: FontWeight.w600)),
            Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }
}

