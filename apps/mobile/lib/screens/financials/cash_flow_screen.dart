import 'package:flutter/material.dart';
import '../../services/ledger_service.dart';

class CashFlowScreen extends StatefulWidget {
  const CashFlowScreen({super.key});

  @override
  State<CashFlowScreen> createState() => _CashFlowScreenState();
}

class _CashFlowScreenState extends State<CashFlowScreen> {
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
      final data = await LedgerService.getCashFlow(
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
        const SnackBar(content: Text('Failed to load cash flow')),
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
        title: const Text('Cash Flow Statement'),
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
                      'Operating Activities',
                      _data!['operatingActivities'] as List? ?? [],
                      net: _parseAmount(_data!['netOperatingCashFlow']),
                    ),
                    const SizedBox(height: 16),
                    _buildSection(
                      'Investing Activities',
                      _data!['investingActivities'] as List? ?? [],
                      net: _parseAmount(_data!['netInvestingCashFlow']),
                    ),
                    const SizedBox(height: 16),
                    _buildSection(
                      'Financing Activities',
                      _data!['financingActivities'] as List? ?? [],
                      net: _parseAmount(_data!['netFinancingCashFlow']),
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
                          const Text(
                            'Net Cash Flow',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            'ZMW ${_parseAmount(_data!['netCashFlow']).toStringAsFixed(2)}',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: _parseAmount(_data!['netCashFlow']) >= 0
                                  ? Colors.green
                                  : Colors.red,
                            ),
                          ),
                        ],
                      ),
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

  Widget _buildSection(String title, List items, {required double net}) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.green,
              ),
            ),
            const SizedBox(height: 8),
            ...items.map((item) {
              final line = item as Map<String, dynamic>;
              final amount = _parseAmount(line['amount']);
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        line['label'] ?? '',
                        style: const TextStyle(fontSize: 14),
                      ),
                    ),
                    Text(
                      'ZMW ${amount.toStringAsFixed(2)}',
                      style: TextStyle(
                        fontSize: 14,
                        color: amount >= 0 ? Colors.green : Colors.red,
                      ),
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
            const Divider(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Net',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                Text(
                  'ZMW ${net.toStringAsFixed(2)}',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: net >= 0 ? Colors.green : Colors.red,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
