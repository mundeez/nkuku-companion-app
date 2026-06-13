import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../models/cycle.dart';

class ExpansionPlanScreen extends StatefulWidget {
  const ExpansionPlanScreen({super.key});

  @override
  State<ExpansionPlanScreen> createState() => _ExpansionPlanScreenState();
}

class _ExpansionPlanScreenState extends State<ExpansionPlanScreen> {
  List<ProductionCycle> _cycles = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await ApiService.dio.get('/api/v1/expansion-plan');
      setState(() {
        _cycles = (res.data as List).map((e) => ProductionCycle.fromJson(e)).toList();
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateFmt = DateFormat('dd MMM yyyy');
    return Scaffold(
      appBar: AppBar(title: const Text('Expansion Plan')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: _cycles.length,
              itemBuilder: (context, index) {
                final cycle = _cycles[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              cycle.label ?? 'Cycle ${cycle.cycleNumber}',
                              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                            ),
                            Chip(
                              label: Text(cycle.status, style: const TextStyle(fontSize: 12)),
                              backgroundColor: cycle.status == 'active'
                                  ? Colors.green.shade100
                                  : Colors.grey.shade200,
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        ...cycle.batches.map((batch) => Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade50,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              Chip(
                                label: Text(batch.shootLabel, style: const TextStyle(fontSize: 11)),
                                padding: EdgeInsets.zero,
                                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('${batch.totalQtyAtHand.toString()} birds'),
                                    Text(
                                      'Exec: ${dateFmt.format(batch.targetExecutionDt)}',
                                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                                    ),
                                  ],
                                ),
                              ),
                              if (batch.revenueTargetZmw != null)
                                Text(
                                  'ZMW ${batch.revenueTargetZmw!.toInt()}',
                                  style: const TextStyle(fontWeight: FontWeight.bold),
                                ),
                            ],
                          ),
                        )),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}

