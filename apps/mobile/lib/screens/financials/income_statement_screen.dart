import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class IncomeStatementScreen extends StatefulWidget {
  const IncomeStatementScreen({super.key});

  @override
  State<IncomeStatementScreen> createState() => _IncomeStatementScreenState();
}

class _IncomeStatementScreenState extends State<IncomeStatementScreen> {
  Map<String, dynamic>? _data;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await ApiService.dio.get('/api/v1/financial-engine/income-statement');
      setState(() {
        _data = res.data;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to load income statement')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Income Statement')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_data != null) ...[
                    _buildSection('Revenue', _data!['revenue']['byCategory'] ?? {}, Colors.green),
                    _buildTotalRow('Total Revenue', (_data!['revenue']['total'] ?? 0).toDouble(), Colors.green),
                    const Divider(),
                    _buildSection('Cost of Goods Sold', _data!['cogs']['byCategory'] ?? {}, Colors.red),
                    _buildTotalRow('Total COGS', (_data!['cogs']['total'] ?? 0).toDouble(), Colors.red),
                    const Divider(),
                    _buildTotalRow('Gross Profit', (_data!['grossProfit'] ?? 0).toDouble(), (_data!['grossProfit'] ?? 0) >= 0 ? Colors.green : Colors.red),
                    Text('Gross Margin: ${(_data!['grossMargin'] ?? 0).toStringAsFixed(1)}%', style: const TextStyle(color: Colors.grey)),
                    const Divider(),
                    _buildSection('Operating Expenses', _data!['operatingExpenses']['byCategory'] ?? {}, Colors.red),
                    _buildTotalRow('Total OpEx', (_data!['operatingExpenses']['total'] ?? 0).toDouble(), Colors.red),
                    const Divider(),
                    _buildTotalRow('Net Profit', (_data!['netProfit'] ?? 0).toDouble(), (_data!['netProfit'] ?? 0) >= 0 ? Colors.green : Colors.red),
                    Text('Net Margin: ${(_data!['netMargin'] ?? 0).toStringAsFixed(1)}%', style: const TextStyle(color: Colors.grey)),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _buildSection(String title, Map<String, dynamic> items, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        ...items.entries.map((e) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(e.key.replaceAll('_', ' ').capitalize(), style: const TextStyle(fontSize: 14)),
              Text('ZMW ${(e.value as num).toDouble().toStringAsFixed(2)}', style: TextStyle(fontSize: 14, color: color)),
            ],
          ),
        )),
      ],
    );
  }

  Widget _buildTotalRow(String label, double value, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          Text('ZMW ${value.toStringAsFixed(2)}', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }
}

extension StringExtension on String {
  String get capitalize => isEmpty ? '' : '${this[0].toUpperCase()}${substring(1)}';
}
