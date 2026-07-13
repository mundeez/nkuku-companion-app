import 'package:flutter/material.dart';
import '../../../models/financial_record.dart';
import '../../../services/auth_service.dart';
import '../../../services/broiler_service.dart';

class FinancialRecordForm extends StatefulWidget {
  final String flockId;
  final FinancialRecord? record;

  const FinancialRecordForm({super.key, required this.flockId, this.record});

  @override
  State<FinancialRecordForm> createState() => _FinancialRecordFormState();
}

class _FinancialRecordFormState extends State<FinancialRecordForm> {
  final _formKey = GlobalKey<FormState>();
  final _descriptionController = TextEditingController();
  final _amountController = TextEditingController();
  final _notesController = TextEditingController();
  DateTime _recordDate = DateTime.now();
  bool _isIncome = false;
  String _category = 'other';
  bool _saving = false;
  String? _error;

  final _categories = [
    'chick_purchase',
    'feed',
    'vaccines',
    'medication',
    'labor',
    'utilities',
    'equipment',
    'sales',
    'other',
  ];

  @override
  void initState() {
    super.initState();
    if (widget.record != null) {
      _descriptionController.text = widget.record!.description;
      _amountController.text = '${widget.record!.amountZmw}';
      _notesController.text = widget.record!.notes ?? '';
      _recordDate = widget.record!.recordDate;
      _isIncome = widget.record!.isIncome;
      _category = _categories.contains(widget.record!.category) ? widget.record!.category : 'other';
    }
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _amountController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _recordDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null) setState(() => _recordDate = picked);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final record = FinancialRecord(
        id: widget.record?.id ?? '',
        flockId: widget.flockId,
        recordDate: _recordDate,
        category: _category,
        description: _descriptionController.text.trim(),
        amountZmw: double.parse(_amountController.text),
        isIncome: _isIncome,
        notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
      );

      if (widget.record == null) {
        await BroilerService.createFinancialRecord(record);
      } else {
        await BroilerService.updateFinancialRecord(widget.record!.id, record);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _saving = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!AuthService.canEdit) {
      return Scaffold(
        appBar: AppBar(title: Text(widget.record == null ? 'New Financial' : 'Edit Financial')),
        body: const Center(child: Text('Viewers cannot edit records.')),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(widget.record == null ? 'New Financial Record' : 'Edit Financial Record')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Record date'),
                subtitle: Text(_recordDate.toIso8601String().split('T').first),
                trailing: const Icon(Icons.calendar_today),
                onTap: _pickDate,
              ),
              DropdownButtonFormField<String>(
                key: ValueKey(_category),
                initialValue: _category,
                decoration: const InputDecoration(labelText: 'Category'),
                items: _categories.map((c) => DropdownMenuItem(value: c, child: Text(c.replaceAll('_', ' ')))).toList(),
                onChanged: (v) => setState(() => _category = v!),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _descriptionController,
                decoration: const InputDecoration(labelText: 'Description'),
                validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _amountController,
                decoration: const InputDecoration(labelText: 'Amount (ZMW)'),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                validator: (v) {
                  final n = double.tryParse(v ?? '');
                  if (n == null || n < 0) return 'Enter a valid amount';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Income'),
                value: _isIncome,
                onChanged: (v) => setState(() => _isIncome = v),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _notesController,
                decoration: const InputDecoration(labelText: 'Notes'),
                maxLines: 3,
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.save),
                label: Text(widget.record == null ? 'Save' : 'Update'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
