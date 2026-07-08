import 'package:flutter/material.dart';
import '../../services/ledger_service.dart';

class JournalDetailScreen extends StatefulWidget {
  final String id;

  const JournalDetailScreen({super.key, required this.id});

  @override
  State<JournalDetailScreen> createState() => _JournalDetailScreenState();
}

class _JournalDetailScreenState extends State<JournalDetailScreen> {
  Map<String, dynamic>? _entry;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final entry = await LedgerService.getJournalEntry(widget.id);
      setState(() { _entry = entry; _loading = false; });
    } catch (e) {
      setState(() { _error = 'Failed to load entry'; _loading = false; });
    }
  }

  String _fmt(dynamic v) {
    if (v == null) return '—';
    final n = double.tryParse(v.toString());
    if (n == null || n == 0) return '—';
    return n.toStringAsFixed(2);
  }

  static const _sourceLabels = {
    'manual': 'Manual',
    'feed_record': 'Feed Record',
    'vaccination_event': 'Vaccination',
    'mortality_event': 'Mortality',
    'water_record': 'Water Record',
    'batch_expense': 'Batch Expense',
    'overhead_cost': 'Overhead Cost',
    'sales': 'Sales',
    'migration': 'Migration',
    'period_close': 'Period Close',
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Journal Entry')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
              : _entry != null
                  ? ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        // Header
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(_entry!['entryNumber'] ?? '',
                                  style: const TextStyle(fontFamily: 'monospace', fontSize: 18, fontWeight: FontWeight.bold)),
                                const SizedBox(height: 8),
                                Text(_entry!['description'] ?? '',
                                  style: const TextStyle(fontSize: 16)),
                                const SizedBox(height: 12),
                                Wrap(
                                  spacing: 8,
                                  children: [
                                    Chip(
                                      label: Text(_sourceLabels[_entry!['sourceType']] ?? _entry!['sourceType'] ?? '',
                                        style: const TextStyle(fontSize: 11)),
                                      visualDensity: VisualDensity.compact,
                                    ),
                                    if (_entry!['isReversing'] == true)
                                      Chip(
                                        label: const Text('Reversing', style: TextStyle(fontSize: 11, color: Colors.orange)),
                                        backgroundColor: Colors.orange.withAlpha(20),
                                        visualDensity: VisualDensity.compact,
                                      ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        // Metadata
                        _metaRow('Date', (_entry!['entryDate'] ?? '').substring(0, 10)),
                        _metaRow('Period', _entry!['periodLabel'] ?? '—'),
                        _metaRow('Reference', _entry!['reference'] ?? '—'),
                        _metaRow('Posted', (_entry!['postedAt'] ?? '').substring(0, 10)),
                        const SizedBox(height: 16),
                        // Lines
                        const Text('Lines', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 8),
                        Card(
                          child: Column(
                            children: [
                              Container(
                                color: Colors.grey.shade200,
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                child: Row(
                                  children: const [
                                    Expanded(flex: 3, child: Text('Account', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                                    Expanded(flex: 2, child: Text('Debit', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12), textAlign: TextAlign.right)),
                                    Expanded(flex: 2, child: Text('Credit', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12), textAlign: TextAlign.right)),
                                  ],
                                ),
                              ),
                              ...(_entry!['lines'] as List).map((line) {
                                final account = line['account'] ?? {};
                                return Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                  child: Row(
                                    children: [
                                      Expanded(
                                        flex: 3,
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text('${account['code'] ?? ''}', style: const TextStyle(fontFamily: 'monospace', fontSize: 12, fontWeight: FontWeight.bold)),
                                            Text(account['name'] ?? '', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                          ],
                                        ),
                                      ),
                                      Expanded(flex: 2, child: Text(_fmt(line['debitZmw']), style: const TextStyle(fontSize: 12, fontFamily: 'monospace'), textAlign: TextAlign.right)),
                                      Expanded(flex: 2, child: Text(_fmt(line['creditZmw']), style: const TextStyle(fontSize: 12, fontFamily: 'monospace'), textAlign: TextAlign.right)),
                                    ],
                                  ),
                                );
                              }),
                              Container(
                                color: Colors.green.shade50,
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                child: Row(
                                  children: [
                                    const Expanded(flex: 3, child: Text('TOTALS', style: TextStyle(fontWeight: FontWeight.bold))),
                                    Expanded(flex: 2, child: Text(
                                      _fmt((_entry!['lines'] as List).fold<double>(0, (s, l) =>
                                        s + double.tryParse(l['debitZmw']?.toString() ?? '0')!)),
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontFamily: 'monospace'),
                                      textAlign: TextAlign.right)),
                                    Expanded(flex: 2, child: Text(
                                      _fmt((_entry!['lines'] as List).fold<double>(0, (s, l) =>
                                        s + double.tryParse(l['creditZmw']?.toString() ?? '0')!)),
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontFamily: 'monospace'),
                                      textAlign: TextAlign.right)),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    )
                  : const Center(child: Text('Entry not found')),
    );
  }

  Widget _metaRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey, fontSize: 13)),
          Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}
