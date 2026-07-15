import 'package:flutter/material.dart';
import '../../services/ledger_service.dart';

class BalanceSheetScreen extends StatefulWidget {
  const BalanceSheetScreen({super.key});

  @override
  State<BalanceSheetScreen> createState() => _BalanceSheetScreenState();
}

class _BalanceSheetScreenState extends State<BalanceSheetScreen> {
  Map<String, dynamic>? _data;
  bool _loading = true;

  late DateTime _asOfDate;

  @override
  void initState() {
    super.initState();
    _asOfDate = DateTime.now();
    _load();
  }

  String _fmtDate(DateTime d) => d.toIso8601String().substring(0, 10);

  double _parseAmount(dynamic v) {
    if (v == null) return 0;
    return double.tryParse(v.toString()) ?? 0;
  }

  Future<void> _load() async {
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _loading = true);
    try {
      final data = await LedgerService.getBalanceSheet(asOf: _fmtDate(_asOfDate));
      if (!mounted) return;
      setState(() {
        _data = data;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      messenger.showSnackBar(
        const SnackBar(content: Text('Failed to load balance sheet')),
      );
    }
  }

  Future<void> _pickAsOfDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _asOfDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null && picked != _asOfDate) {
      setState(() => _asOfDate = picked);
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isBalanced = _data?['isBalanced'] == true;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Balance Sheet'),
        actions: [
          IconButton(
            icon: const Icon(Icons.calendar_today),
            onPressed: _pickAsOfDate,
            tooltip: 'As of date',
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_data != null) ...[
                    _buildHeader(isBalanced),
                    const SizedBox(height: 16),
                    _buildSectionTitle('Assets'),
                    ..._buildAccountRows(_data!['assets'] as List? ?? []),
                    _buildTotalRow(
                      'Total Assets',
                      _parseAmount(_data!['totalAssets']),
                    ),
                    const Divider(height: 32),
                    _buildSectionTitle('Liabilities'),
                    ..._buildAccountRows(_data!['liabilities'] as List? ?? []),
                    _buildTotalRow(
                      'Total Liabilities',
                      _parseAmount(_data!['totalLiabilities']),
                    ),
                    const Divider(height: 32),
                    _buildSectionTitle('Equity'),
                    ..._buildAccountRows(_data!['equity'] as List? ?? []),
                    _buildTotalRow(
                      'Total Equity',
                      _parseAmount(_data!['totalEquity']),
                    ),
                    const SizedBox(height: 24),
                    _buildGrandTotalRow(
                      'Total Liabilities + Equity',
                      _parseAmount(_data!['totalLiabilitiesAndEquity']),
                    ),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _buildHeader(bool isBalanced) {
    final asOfDate = _data!['asOfDate'] ?? _fmtDate(_asOfDate);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            const Icon(Icons.date_range, color: Colors.green),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'As of: $asOfDate',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
            Icon(
              isBalanced ? Icons.check_circle : Icons.warning,
              color: isBalanced ? Colors.green : Colors.red,
            ),
            const SizedBox(width: 4),
            Text(
              isBalanced ? 'Balanced' : 'Unbalanced',
              style: TextStyle(
                color: isBalanced ? Colors.green : Colors.red,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildAccountRows(List items) {
    if (items.isEmpty) {
      return const [
        Padding(
          padding: EdgeInsets.symmetric(vertical: 4, horizontal: 12),
          child: Text('No items', style: TextStyle(color: Colors.grey)),
        ),
      ];
    }
    return items.map((item) {
      final line = item as Map<String, dynamic>;
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 12),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                '${line['accountCode'] ?? ''} — ${line['accountName'] ?? ''}',
                style: const TextStyle(fontSize: 14),
              ),
            ),
            Text(
              'ZMW ${_parseAmount(line['balance']).toStringAsFixed(2)}',
              style: const TextStyle(fontSize: 14),
            ),
          ],
        ),
      );
    }).toList();
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.bold,
          color: Colors.green,
        ),
      ),
    );
  }

  Widget _buildTotalRow(String label, double value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          Text(
            'ZMW ${value.toStringAsFixed(2)}',
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
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
          Text(
            label,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          Text(
            'ZMW ${value.toStringAsFixed(2)}',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Colors.green,
            ),
          ),
        ],
      ),
    );
  }
}
