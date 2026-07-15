import 'package:flutter/material.dart';
import '../../services/ledger_service.dart';

class IncomeStatementScreen extends StatefulWidget {
  const IncomeStatementScreen({super.key});

  @override
  State<IncomeStatementScreen> createState() => _IncomeStatementScreenState();
}

class _IncomeStatementScreenState extends State<IncomeStatementScreen> {
  Map<String, dynamic>? _data;
  bool _loading = true;

  late DateTime _fromDate;
  late DateTime _toDate;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _toDate = now;
    _fromDate = DateTime(now.year, 1, 1);
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
      final data = await LedgerService.getIncomeStatement(
        fromDate: _fmtDate(_fromDate),
        toDate: _fmtDate(_toDate),
      );
      if (!mounted) return;
      setState(() {
        _data = data;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      messenger.showSnackBar(
        const SnackBar(content: Text('Failed to load income statement')),
      );
    }
  }

  Future<void> _pickFromDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _fromDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null && picked != _fromDate) {
      setState(() => _fromDate = picked);
      _load();
    }
  }

  Future<void> _pickToDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _toDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null && picked != _toDate) {
      setState(() => _toDate = picked);
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Income Statement'),
        actions: [
          IconButton(
            icon: const Icon(Icons.calendar_today),
            onPressed: _pickFromDate,
            tooltip: 'From date',
          ),
          IconButton(
            icon: const Icon(Icons.date_range),
            onPressed: _pickToDate,
            tooltip: 'To date',
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
                    _buildPeriodHeader(),
                    const SizedBox(height: 16),
                    _buildSection(
                      'Revenue',
                      _data!['revenue'] as List? ?? [],
                      Colors.green,
                    ),
                    _buildTotalRow(
                      'Total Revenue',
                      _parseAmount(_data!['totalRevenue']),
                      Colors.green,
                    ),
                    const Divider(),
                    _buildSection(
                      'Cost of Goods Sold',
                      _data!['costOfGoodsSold'] as List? ?? [],
                      Colors.red,
                    ),
                    _buildTotalRow(
                      'Total COGS',
                      _parseAmount(_data!['totalCogs']),
                      Colors.red,
                    ),
                    const Divider(),
                    _buildTotalRow(
                      'Gross Profit',
                      _parseAmount(_data!['grossProfit']),
                      _parseAmount(_data!['grossProfit']) >= 0
                          ? Colors.green
                          : Colors.red,
                    ),
                    const Divider(),
                    _buildSection(
                      'Operating Expenses',
                      _data!['operatingExpenses'] as List? ?? [],
                      Colors.red,
                    ),
                    _buildTotalRow(
                      'Total OpEx',
                      _parseAmount(_data!['totalOperatingExpenses']),
                      Colors.red,
                    ),
                    const Divider(),
                    _buildTotalRow(
                      'Operating Profit (EBIT)',
                      _parseAmount(_data!['operatingProfit']),
                      _parseAmount(_data!['operatingProfit']) >= 0
                          ? Colors.green
                          : Colors.red,
                    ),
                    const Divider(),
                    _buildTotalRow(
                      'Net Profit',
                      _parseAmount(_data!['netProfit']),
                      _parseAmount(_data!['netProfit']) >= 0
                          ? Colors.green
                          : Colors.red,
                    ),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _buildPeriodHeader() {
    final periodFrom = _data!['periodFrom'] ?? _fmtDate(_fromDate);
    final periodTo = _data!['periodTo'] ?? _fmtDate(_toDate);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            const Icon(Icons.date_range, color: Colors.green),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Period: $periodFrom to $periodTo',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSection(String title, List items, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        ...items.map((item) {
          final line = item as Map<String, dynamic>;
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
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
                  'ZMW ${_parseAmount(line['netBalance']).toStringAsFixed(2)}',
                  style: TextStyle(fontSize: 14, color: color),
                ),
              ],
            ),
          );
        }),
        if (items.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 4),
            child: Text('No items', style: TextStyle(color: Colors.grey)),
          ),
      ],
    );
  }

  Widget _buildTotalRow(String label, double value, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          Text(
            'ZMW ${value.toStringAsFixed(2)}',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
