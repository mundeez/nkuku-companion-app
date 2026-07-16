import 'package:flutter/material.dart';
import '../../services/ledger_service.dart';

class AccountLedgerScreen extends StatefulWidget {
  final String code;
  final String name;

  const AccountLedgerScreen({super.key, required this.code, required this.name});

  @override
  State<AccountLedgerScreen> createState() => _AccountLedgerScreenState();
}

class _AccountLedgerScreenState extends State<AccountLedgerScreen> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;

  late String _fromDate;
  late String _toDate;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _toDate = now.toIso8601String().substring(0, 10);
    _fromDate = '${now.year}-01-01';
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final ledger = await LedgerService.getAccountLedger(
        widget.code,
        fromDate: _fromDate,
        toDate: _toDate,
      );
      setState(() { _data = ledger; _loading = false; });
    } catch (e) {
      setState(() { _error = 'Failed to load ledger'; _loading = false; });
    }
  }

  Future<void> _pickDate({required bool isFrom}) async {
    final initial = isFrom
        ? DateTime.tryParse(_fromDate) ?? DateTime.now()
        : DateTime.tryParse(_toDate) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked == null) return;
    final str = picked.toIso8601String().substring(0, 10);
    setState(() {
      if (isFrom) {
        _fromDate = str;
      } else {
        _toDate = str;
      }
    });
    _load();
  }

  String _fmt(dynamic v) {
    if (v == null) return '—';
    final n = double.tryParse(v.toString());
    if (n == null || n == 0) return '—';
    return n.toStringAsFixed(2);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.code} — ${widget.name}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.calendar_today_outlined),
            tooltip: 'From date',
            onPressed: () => _pickDate(isFrom: true),
          ),
          IconButton(
            icon: const Icon(Icons.event_available),
            tooltip: 'To date',
            onPressed: () => _pickDate(isFrom: false),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Date range chip row
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          children: [
                            Chip(
                              label: Text('From: $_fromDate',
                                  style: const TextStyle(fontSize: 12)),
                              visualDensity: VisualDensity.compact,
                            ),
                            const SizedBox(width: 8),
                            Chip(
                              label: Text('To: $_toDate',
                                  style: const TextStyle(fontSize: 12)),
                              visualDensity: VisualDensity.compact,
                            ),
                          ],
                        ),
                      ),
                      // Summary cards
                      Row(
                        children: [
                          Expanded(child: _summaryCard('Opening', _fmt(_data!['openingBalance']))),
                          Expanded(child: _summaryCard('Debits', _fmt(_data!['totalDebits']), color: Colors.green)),
                          Expanded(child: _summaryCard('Credits', _fmt(_data!['totalCredits']), color: Colors.red)),
                          Expanded(child: _summaryCard('Closing', _fmt(_data!['closingBalance']))),
                        ],
                      ),
                      const SizedBox(height: 16),
                      // Entries
                      const Text('Entries', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      ...(_data!['entries'] as List).map((e) => Card(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(e['journalNumber'] ?? '', style: const TextStyle(fontFamily: 'monospace', fontSize: 12, color: Colors.grey)),
                                  Text((e['date'] ?? '').substring(0, 10), style: const TextStyle(fontSize: 12, color: Colors.grey)),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(e['description'] ?? '', style: const TextStyle(fontSize: 14)),
                              const SizedBox(height: 4),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text('Debit: ${_fmt(e['debitZmw'])}', style: const TextStyle(fontSize: 12, color: Colors.green)),
                                  Text('Credit: ${_fmt(e['creditZmw'])}', style: const TextStyle(fontSize: 12, color: Colors.red)),
                                  Text('Bal: ${_fmt(e['runningBalance'])}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                ],
                              ),
                            ],
                          ),
                        ),
                      )),
                      if ((_data!['entries'] as List).isEmpty)
                        const Padding(
                          padding: EdgeInsets.all(32),
                          child: Center(child: Text('No entries in this period', style: TextStyle(color: Colors.grey))),
                        ),
                    ],
                  ),
                ),
    );
  }

  Widget _summaryCard(String label, String value, {Color? color}) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 2),
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          children: [
            Text(label, style: const TextStyle(fontSize: 10, color: Colors.grey)),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, fontFamily: 'monospace', color: color)),
          ],
        ),
      ),
    );
  }
}
