import 'package:flutter/material.dart';
import '../../services/ledger_service.dart';
import '../../services/auth_service.dart';
import 'journal_detail_screen.dart';
import 'journal_entry_form_screen.dart';

class JournalListScreen extends StatefulWidget {
  const JournalListScreen({super.key});

  @override
  State<JournalListScreen> createState() => _JournalListScreenState();
}

class _JournalListScreenState extends State<JournalListScreen> {
  List<dynamic> _entries = [];
  bool _loading = true;
  String? _error;
  String? _sourceType;
  String? _fromDate;
  String? _toDate;

  static const _sourceLabels = {
    'manual': 'Manual',
    'feed_record': 'Feed',
    'vaccination_event': 'Vaccination',
    'mortality_event': 'Mortality',
    'sales': 'Sales',
    'migration': 'Migration',
    'period_close': 'Period Close',
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final entries = await LedgerService.getJournalEntries(
        sourceType: _sourceType,
        fromDate: _fromDate,
        toDate: _toDate,
      );
      setState(() { _entries = entries; _loading = false; });
    } catch (e) {
      setState(() { _error = 'Failed to load journal entries'; _loading = false; });
    }
  }

  String _fmt(dynamic v) {
    if (v == null) return '0.00';
    final n = double.tryParse(v.toString());
    if (n == null) return '0.00';
    return n.toStringAsFixed(2);
  }


  Future<void> _pickFromDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.tryParse(_fromDate ?? '') ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() => _fromDate = picked.toIso8601String().substring(0, 10));
      _load();
    }
  }

  Future<void> _pickToDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.tryParse(_toDate ?? '') ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() => _toDate = picked.toIso8601String().substring(0, 10));
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Journal Entries'),
        actions: [
          IconButton(
            icon: const Icon(Icons.calendar_today_outlined),
            tooltip: 'From date',
            onPressed: _pickFromDate,
          ),
          IconButton(
            icon: const Icon(Icons.event_available),
            tooltip: 'To date',
            onPressed: _pickToDate,
          ),
          PopupMenuButton<String?>(
            icon: const Icon(Icons.filter_list),
            onSelected: (val) {
              setState(() => _sourceType = val);
              _load();
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: null, child: Text('All sources')),
              ..._sourceLabels.entries.map((e) =>
                PopupMenuItem(value: e.key, child: Text(e.value))),
            ],
          ),
        ],
      ),
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
                  child: _entries.isEmpty
                      ? const Center(child: Text('No journal entries found'))
                      : ListView.builder(
                          itemCount: _entries.length,
                          itemBuilder: (context, i) {
                            final entry = _entries[i];
                            final lines = entry['lines'] as List? ?? [];
                            final totalDebit = lines.fold<double>(0, (s, l) =>
                              s + double.tryParse(l['debitZmw']?.toString() ?? '0')!);
                            return Card(
                              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                              child: ListTile(
                                title: Text(entry['entryNumber'] ?? '',
                                  maxLines: 1, overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.bold, fontSize: 13)),
                                subtitle: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(entry['description'] ?? '',
                                      maxLines: 1, overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontSize: 13)),
                                    const SizedBox(height: 4),
                                    // Wrap (not Row) so the source/reversing
                                    // chips flow to a second line on narrow
                                    // screens instead of overflowing.
                                    Wrap(
                                      spacing: 8,
                                      runSpacing: 4,
                                      crossAxisAlignment: WrapCrossAlignment.center,
                                      children: [
                                        Text((entry['entryDate'] ?? '').substring(0, 10),
                                          style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                        Chip(
                                          label: Text(
                                            _sourceLabels[entry['sourceType']] ?? entry['sourceType'] ?? '',
                                            style: const TextStyle(fontSize: 10),
                                          ),
                                          visualDensity: VisualDensity.compact,
                                          padding: EdgeInsets.zero,
                                        ),
                                        if (entry['isReversing'] == true)
                                          Chip(
                                            label: const Text('Reversing', style: TextStyle(fontSize: 10, color: Colors.orange)),
                                            visualDensity: VisualDensity.compact,
                                            padding: EdgeInsets.zero,
                                            backgroundColor: Colors.orange.withAlpha(20),
                                          ),
                                      ],
                                    ),
                                  ],
                                ),
                                trailing: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text('ZMW ${_fmt(totalDebit)}',
                                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                                    Text('${lines.length} lines',
                                      style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                  ],
                                ),
                                onTap: () => Navigator.push(context,
                                  MaterialPageRoute(builder: (_) => JournalDetailScreen(id: entry['id']))),
                              ),
                            );
                          },
                        ),
                ),
      floatingActionButton: AuthService.canEdit
          ? FloatingActionButton(
              onPressed: () async {
                final result = await Navigator.push(
                  context,
                  MaterialPageRoute(
                      builder: (_) => const JournalEntryFormScreen()),
                );
                if (result == true) _load();
              },
              child: const Icon(Icons.add),
            )
          : null,
    );
  }
}
