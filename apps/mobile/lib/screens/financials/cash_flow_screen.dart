import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class CashFlowScreen extends StatefulWidget {
  const CashFlowScreen({super.key});

  @override
  State<CashFlowScreen> createState() => _CashFlowScreenState();
}

class _CashFlowScreenState extends State<CashFlowScreen> {
  Map<String, dynamic>? _data;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await ApiService.dio.get('/api/v1/financial-engine/cash-flow');
      setState(() {
        _data = res.data;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to load cash flow')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final operating = _data?['operating'];
    final investing = _data?['investing'];
    final financing = _data?['financing'];

    return Scaffold(
      appBar: AppBar(title: const Text('Cash Flow Statement')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_data != null) ...[
                    _buildSection(
                      'Operating Activities',
                      [
                        _RowItem('Inflows', (operating?['inflows'] ?? 0).toDouble(), Colors.green),
                        _RowItem('Outflows', (operating?['outflows'] ?? 0).toDouble(), Colors.red),
                      ],
                      net: (operating?['net'] ?? 0).toDouble(),
                    ),
                    const SizedBox(height: 16),
                    _buildSection(
                      'Investing Activities',
                      [
                        _RowItem('Inflows', (investing?['inflows'] ?? 0).toDouble(), Colors.green),
                        _RowItem('Outflows', (investing?['outflows'] ?? 0).toDouble(), Colors.red),
                      ],
                      net: (investing?['net'] ?? 0).toDouble(),
                    ),
                    const SizedBox(height: 16),
                    _buildSection(
                      'Financing Activities',
                      [
                        _RowItem('Inflows', (financing?['inflows'] ?? 0).toDouble(), Colors.green),
                        _RowItem('Outflows', (financing?['outflows'] ?? 0).toDouble(), Colors.red),
                      ],
                      net: (financing?['net'] ?? 0).toDouble(),
                    ),
                    const SizedBox(height: 24),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.green.shade50,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Net Change', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                          Text(
                            'ZMW ${(_data?['netChange'] ?? 0).toDouble().toStringAsFixed(2)}',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: (_data?['netChange'] ?? 0) >= 0 ? Colors.green : Colors.red,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    _buildSimpleRow('Opening Balance', (_data?['openingBalance'] ?? 0).toDouble()),
                    const Divider(),
                    _buildSimpleRow('Closing Balance', (_data?['closingBalance'] ?? 0).toDouble(), bold: true),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _buildSection(String title, List<_RowItem> items, {required double net}) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.green)),
            const SizedBox(height: 8),
            ...items.map((item) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(item.label, style: const TextStyle(fontSize: 14)),
                  Text(
                    'ZMW ${item.value.toStringAsFixed(2)}',
                    style: TextStyle(fontSize: 14, color: item.color),
                  ),
                ],
              ),
            )),
            const Divider(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Net', style: TextStyle(fontWeight: FontWeight.bold)),
                Text(
                  'ZMW ${net.toStringAsFixed(2)}',
                  style: TextStyle(fontWeight: FontWeight.bold, color: net >= 0 ? Colors.green : Colors.red),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSimpleRow(String label, double value, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
          Text(
            'ZMW ${value.toStringAsFixed(2)}',
            style: TextStyle(fontWeight: bold ? FontWeight.bold : FontWeight.normal),
          ),
        ],
      ),
    );
  }
}

class _RowItem {
  final String label;
  final double value;
  final Color color;
  _RowItem(this.label, this.value, this.color);
}
