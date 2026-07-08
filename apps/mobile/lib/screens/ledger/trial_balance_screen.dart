import 'package:flutter/material.dart';
import '../../services/ledger_service.dart';

class TrialBalanceScreen extends StatefulWidget {
  const TrialBalanceScreen({super.key});

  @override
  State<TrialBalanceScreen> createState() => _TrialBalanceScreenState();
}

class _TrialBalanceScreenState extends State<TrialBalanceScreen> {
  Map<String, dynamic>? _data;
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
      final tb = await LedgerService.getTrialBalance();
      setState(() { _data = tb; _loading = false; });
    } catch (e) {
      setState(() { _error = 'Failed to load trial balance'; _loading = false; });
    }
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
      appBar: AppBar(title: const Text('Trial Balance')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(_error!, style: const TextStyle(color: Colors.red)),
                    const SizedBox(height: 16),
                    ElevatedButton(onPressed: _load, child: const Text('Retry')),
                  ],
                ))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (_data != null) ...[
                        _buildBalanceChip(),
                        const SizedBox(height: 16),
                        _buildTable(),
                        const SizedBox(height: 16),
                        _buildTotals(),
                      ],
                    ],
                  ),
                ),
    );
  }

  Widget _buildBalanceChip() {
    final isBalanced = _data!['isBalanced'] as bool;
    return Center(
      child: Chip(
        avatar: Icon(
          isBalanced ? Icons.check_circle : Icons.error,
          color: isBalanced ? Colors.green : Colors.red,
        ),
        label: Text(
          isBalanced ? 'Balanced' : 'Out of Balance',
          style: TextStyle(
            color: isBalanced ? Colors.green : Colors.red,
            fontWeight: FontWeight.bold,
          ),
        ),
        backgroundColor: (isBalanced ? Colors.green : Colors.red).withAlpha(20),
      ),
    );
  }

  Widget _buildTable() {
    final lines = _data!['lines'] as List;
    return Card(
      child: Column(
        children: [
          Container(
            color: Colors.grey.shade200,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: const [
                Expanded(flex: 1, child: Text('Code', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                Expanded(flex: 3, child: Text('Account', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                Expanded(flex: 2, child: Text('Debit', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12), textAlign: TextAlign.right)),
                Expanded(flex: 2, child: Text('Credit', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12), textAlign: TextAlign.right)),
              ],
            ),
          ),
          ...lines.map((line) => Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: [
                Expanded(flex: 1, child: Text(line['accountCode'], style: const TextStyle(fontFamily: 'monospace', fontSize: 12))),
                Expanded(flex: 3, child: Text(line['accountName'], style: const TextStyle(fontSize: 12))),
                Expanded(flex: 2, child: Text(_fmt(line['debitBalance']), style: const TextStyle(fontSize: 12, fontFamily: 'monospace'), textAlign: TextAlign.right)),
                Expanded(flex: 2, child: Text(_fmt(line['creditBalance']), style: const TextStyle(fontSize: 12, fontFamily: 'monospace'), textAlign: TextAlign.right)),
              ],
            ),
          )),
        ],
      ),
    );
  }

  Widget _buildTotals() {
    return Card(
      color: Colors.green.shade50,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('TOTALS', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('Debit: ZMW ${_fmt(_data!['totalDebits'])}', style: const TextStyle(fontWeight: FontWeight.bold)),
                Text('Credit: ZMW ${_fmt(_data!['totalCredits'])}', style: const TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
