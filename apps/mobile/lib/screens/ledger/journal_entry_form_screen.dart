import 'package:flutter/material.dart';
import '../../services/ledger_service.dart';
import '../../services/auth_service.dart';

class JournalEntryFormScreen extends StatefulWidget {
  const JournalEntryFormScreen({super.key});

  @override
  State<JournalEntryFormScreen> createState() => _JournalEntryFormScreenState();
}

class _JournalEntryFormScreenState extends State<JournalEntryFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _descriptionController = TextEditingController();
  final _referenceController = TextEditingController();

  DateTime _entryDate = DateTime.now();
  List<Map<String, dynamic>> _accounts = [];
  bool _accountsLoading = true;
  bool _saving = false;

  final List<_JournalLineState> _lines = [];

  @override
  void initState() {
    super.initState();
    _loadAccounts();
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _referenceController.dispose();
    for (final line in _lines) {
      line.dispose();
    }
    super.dispose();
  }

  Future<void> _loadAccounts() async {
    try {
      final accounts = await LedgerService.getAccounts();
      setState(() {
        _accounts = accounts.cast<Map<String, dynamic>>();
        _accountsLoading = false;
      });
    } catch (e) {
      setState(() => _accountsLoading = false);
    }
  }

  double get _totalDebits => _lines.fold(0.0, (s, l) => s + l.debit);
  double get _totalCredits => _lines.fold(0.0, (s, l) => s + l.credit);
  double get _balance => _totalDebits - _totalCredits;

  bool get _isBalanced => (_balance.abs() < 0.005) && _totalDebits > 0;

  bool get _canSave {
    if (_saving || !_isBalanced) return false;
    if (_descriptionController.text.trim().isEmpty) return false;
    if (_lines.length < 2) return false;
    for (final line in _lines) {
      if (line.accountCode == null) return false;
      if (line.debit <= 0 && line.credit <= 0) return false;
    }
    return true;
  }

  void _addLine() {
    setState(() {
      _lines.add(_JournalLineState());
    });
  }

  void _removeLine(int index) {
    setState(() {
      _lines[index].dispose();
      _lines.removeAt(index);
    });
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _entryDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null) setState(() => _entryDate = picked);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_canSave) return;

    setState(() => _saving = true);

    try {
      final linesData = _lines.map((l) {
        final map = <String, dynamic>{
          'accountCode': l.accountCode,
        };
        if (l.debit > 0) map['debitZmw'] = l.debit;
        if (l.credit > 0) map['creditZmw'] = l.credit;
        if (l.descriptionController.text.trim().isNotEmpty) {
          map['description'] = l.descriptionController.text.trim();
        }
        return map;
      }).toList();

      await LedgerService.createJournalEntry(
        entryDate: _entryDate.toIso8601String().substring(0, 10),
        description: _descriptionController.text.trim(),
        reference: _referenceController.text.trim().isEmpty
            ? null
            : _referenceController.text.trim(),
        lines: linesData,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Journal entry posted')),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!AuthService.canEdit) {
      return Scaffold(
        appBar: AppBar(title: const Text('New Journal Entry')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'You don\'t have permission to create journal entries.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16, color: Colors.grey),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('New Journal Entry'),
        actions: [
          if (_saving)
            const Padding(
              padding: EdgeInsets.all(14),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          else
            IconButton(
              icon: const Icon(Icons.check),
              tooltip: 'Post entry',
              onPressed: _canSave ? _save : null,
            ),
        ],
      ),
      body: _accountsLoading
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Entry Date
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.calendar_today, color: Colors.green),
                      title: const Text('Entry Date'),
                      subtitle: Text(_entryDate.toIso8601String().substring(0, 10)),
                      trailing: const Icon(Icons.edit, size: 18),
                      onTap: _pickDate,
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Description
                  TextFormField(
                    controller: _descriptionController,
                    decoration: const InputDecoration(
                      labelText: 'Description *',
                      border: OutlineInputBorder(),
                      hintText: 'e.g., Monthly rent payment',
                    ),
                    maxLength: 300,
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) {
                        return 'Description is required';
                      }
                      return null;
                    },
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: 12),

                  // Reference
                  TextFormField(
                    controller: _referenceController,
                    decoration: const InputDecoration(
                      labelText: 'Reference (optional)',
                      border: OutlineInputBorder(),
                      hintText: 'e.g., INV-2026-001',
                    ),
                    maxLength: 100,
                  ),
                  const SizedBox(height: 20),

                  // Journal Lines header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Lines', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      TextButton.icon(
                        icon: const Icon(Icons.add),
                        label: const Text('Add Line'),
                        onPressed: _addLine,
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Lines
                  ..._lines.asMap().entries.map((entry) {
                    final i = entry.key;
                    final line = entry.value;
                    return _JournalLineCard(
                      index: i,
                      line: line,
                      accounts: _accounts,
                      canDelete: _lines.length > 2,
                      onDelete: () => _removeLine(i),
                      onChanged: () => setState(() {}),
                    );
                  }),

                  const SizedBox(height: 16),

                  // Balance indicator
                  _BalanceCard(
                    totalDebits: _totalDebits,
                    totalCredits: _totalCredits,
                    balance: _balance,
                    isBalanced: _isBalanced,
                  ),

                  const SizedBox(height: 24),

                  // Save button
                  FilledButton.icon(
                    icon: _saving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.check),
                    label: const Text('Post Journal Entry'),
                    onPressed: _canSave && !_saving ? _save : null,
                  ),
                ],
              ),
            ),
    );
  }
}

class _JournalLineState {
  String? accountCode;
  double debit = 0;
  double credit = 0;
  final TextEditingController debitController = TextEditingController();
  final TextEditingController creditController = TextEditingController();
  final TextEditingController descriptionController = TextEditingController();

  void dispose() {
    debitController.dispose();
    creditController.dispose();
    descriptionController.dispose();
  }
}

class _JournalLineCard extends StatelessWidget {
  final int index;
  final _JournalLineState line;
  final List<Map<String, dynamic>> accounts;
  final bool canDelete;
  final VoidCallback onDelete;
  final VoidCallback onChanged;

  const _JournalLineCard({
    required this.index,
    required this.line,
    required this.accounts,
    required this.canDelete,
    required this.onDelete,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Line ${index + 1}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                if (canDelete)
                  IconButton(
                    icon: const Icon(Icons.delete_outline, size: 20),
                    onPressed: onDelete,
                    visualDensity: VisualDensity.compact,
                  ),
              ],
            ),
            const SizedBox(height: 8),

            // Account dropdown
            DropdownButtonFormField<String>(
              initialValue: line.accountCode,
              decoration: const InputDecoration(
                labelText: 'Account',
                border: OutlineInputBorder(),
                isDense: true,
              ),
              items: accounts.map((a) {
                final code = a['code'] as String?;
                final name = a['name'] as String? ?? '';
                if (code == null) return null;
                return DropdownMenuItem(
                  value: code,
                  child: Text('$code — $name', overflow: TextOverflow.ellipsis),
                );
              }).whereType<DropdownMenuItem<String>>().toList(),
              onChanged: (v) {
                line.accountCode = v;
                onChanged();
              },
            ),
            const SizedBox(height: 8),

            // Debit / Credit row
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: line.debitController,
                    decoration: const InputDecoration(
                      labelText: 'Debit (ZMW)',
                      border: OutlineInputBorder(),
                      isDense: true,
                      prefixText: 'ZMW ',
                    ),
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    onChanged: (v) {
                      line.debit = double.tryParse(v) ?? 0;
                      if (line.debit > 0 && line.creditController.text.isNotEmpty) {
                        line.creditController.clear();
                        line.credit = 0;
                      }
                      onChanged();
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextFormField(
                    controller: line.creditController,
                    decoration: const InputDecoration(
                      labelText: 'Credit (ZMW)',
                      border: OutlineInputBorder(),
                      isDense: true,
                      prefixText: 'ZMW ',
                    ),
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    onChanged: (v) {
                      line.credit = double.tryParse(v) ?? 0;
                      if (line.credit > 0 && line.debitController.text.isNotEmpty) {
                        line.debitController.clear();
                        line.debit = 0;
                      }
                      onChanged();
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Optional line description
            TextFormField(
              controller: line.descriptionController,
              decoration: const InputDecoration(
                labelText: 'Line description (optional)',
                border: OutlineInputBorder(),
                isDense: true,
              ),
              maxLength: 200,
            ),
          ],
        ),
      ),
    );
  }
}

class _BalanceCard extends StatelessWidget {
  final double totalDebits;
  final double totalCredits;
  final double balance;
  final bool isBalanced;

  const _BalanceCard({
    required this.totalDebits,
    required this.totalCredits,
    required this.balance,
    required this.isBalanced,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      color: isBalanced
          ? Colors.green.shade50
          : (totalDebits == 0 && totalCredits == 0 ? null : Colors.red.shade50),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                Column(
                  children: [
                    const Text('Total Debits', style: TextStyle(fontSize: 11, color: Colors.grey)),
                    Text('ZMW ${totalDebits.toStringAsFixed(2)}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontFamily: 'monospace')),
                  ],
                ),
                Column(
                  children: [
                    const Text('Total Credits', style: TextStyle(fontSize: 11, color: Colors.grey)),
                    Text('ZMW ${totalCredits.toStringAsFixed(2)}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontFamily: 'monospace')),
                  ],
                ),
              ],
            ),
            const Divider(),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  isBalanced ? Icons.check_circle : (balance == 0 ? Icons.remove_circle_outline : Icons.error),
                  color: isBalanced ? Colors.green : (balance == 0 ? Colors.grey : Colors.red),
                  size: 20,
                ),
                const SizedBox(width: 8),
                Text(
                  isBalanced
                      ? 'Balanced'
                      : (balance == 0
                          ? 'Enter amounts'
                          : 'Out of balance: ZMW ${balance.toStringAsFixed(2)}'),
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: isBalanced ? Colors.green : (balance == 0 ? Colors.grey : Colors.red),
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
