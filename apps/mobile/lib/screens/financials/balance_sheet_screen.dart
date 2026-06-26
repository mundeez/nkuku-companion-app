import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class BalanceSheetScreen extends StatefulWidget {
  const BalanceSheetScreen({super.key});

  @override
  State<BalanceSheetScreen> createState() => _BalanceSheetScreenState();
}

class _BalanceSheetScreenState extends State<BalanceSheetScreen> {
  Map<String, dynamic>? _data;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await ApiService.dio.get('/api/v1/financial-engine/balance-sheet');
      setState(() {
        _data = res.data;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to load balance sheet')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final assets = _data?['assets'];
    final liabilities = _data?['liabilities'];
    final equity = _data?['equity'];

    return Scaffold(
      appBar: AppBar(title: const Text('Balance Sheet')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_data != null) ...[
                    _buildSectionTitle('Assets'),
                    _buildSubSection('Current Assets', [
                      _RowItem('Cash', (assets?['current']?['cash'] ?? 0).toDouble()),
                      _RowItem('Receivables', (assets?['current']?['receivables'] ?? 0).toDouble()),
                      _RowItem('Inventory', (assets?['current']?['inventory'] ?? 0).toDouble()),
                    ]),
                    _buildTotalRow('Total Current Assets', (assets?['current']?['total'] ?? 0).toDouble()),
                    const Divider(),
                    _buildSubSection('Fixed Assets', [
                      _RowItem('Equipment', (assets?['fixed']?['equipment'] ?? 0).toDouble()),
                      _RowItem('Facilities', (assets?['fixed']?['facilities'] ?? 0).toDouble()),
                    ]),
                    _buildTotalRow('Total Fixed Assets', (assets?['fixed']?['total'] ?? 0).toDouble()),
                    const Divider(height: 32),
                    _buildGrandTotalRow('Total Assets', (assets?['total'] ?? 0).toDouble()),
                    const SizedBox(height: 24),
                    _buildSectionTitle('Liabilities'),
                    _buildSubSection('Current Liabilities', [
                      _RowItem('Payables', (liabilities?['current']?['payables'] ?? 0).toDouble()),
                      _RowItem('Short-term Debt', (liabilities?['current']?['shortTermDebt'] ?? 0).toDouble()),
                    ]),
                    _buildTotalRow('Total Current Liabilities', (liabilities?['current']?['total'] ?? 0).toDouble()),
                    const Divider(),
                    _buildSubSection('Long-term Liabilities', [
                      _RowItem('Loans', (liabilities?['longTerm']?['loans'] ?? 0).toDouble()),
                    ]),
                    _buildTotalRow('Total Long-term Liabilities', (liabilities?['longTerm']?['total'] ?? 0).toDouble()),
                    const Divider(height: 32),
                    _buildGrandTotalRow('Total Liabilities', (liabilities?['total'] ?? 0).toDouble()),
                    const SizedBox(height: 24),
                    _buildSectionTitle('Equity'),
                    _buildSubSection('', [
                      _RowItem('Owner Capital', (equity?['ownerCapital'] ?? 0).toDouble()),
                      _RowItem('Retained Earnings', (equity?['retainedEarnings'] ?? 0).toDouble()),
                    ]),
                    _buildGrandTotalRow('Total Equity', (equity?['total'] ?? 0).toDouble()),
                    const SizedBox(height: 24),
                    _buildGrandTotalRow('Total Liabilities + Equity', (_data?['totalLiabilitiesAndEquity'] ?? 0).toDouble()),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.green)),
    );
  }

  Widget _buildSubSection(String title, List<_RowItem> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (title.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 4),
            child: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
          ),
        ...items.map((item) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(item.label, style: const TextStyle(fontSize: 14)),
              Text('ZMW ${item.value.toStringAsFixed(2)}', style: const TextStyle(fontSize: 14)),
            ],
          ),
        )),
      ],
    );
  }

  Widget _buildTotalRow(String label, double value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
          Text('ZMW ${value.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildGrandTotalRow(String label, double value) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.green.shade50,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          Text('ZMW ${value.toStringAsFixed(2)}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.green)),
        ],
      ),
    );
  }
}

class _RowItem {
  final String label;
  final double value;
  _RowItem(this.label, this.value);
}
