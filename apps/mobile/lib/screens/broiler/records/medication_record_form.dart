import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../models/medication_record.dart';
import '../../../services/auth_service.dart';
import '../../../services/broiler_service.dart';

class MedicationRecordForm extends StatefulWidget {
  final String flockId;
  final MedicationRecord? record;

  const MedicationRecordForm({super.key, required this.flockId, this.record});

  @override
  State<MedicationRecordForm> createState() => _MedicationRecordFormState();
}

class _MedicationRecordFormState extends State<MedicationRecordForm> {
  final _formKey = GlobalKey<FormState>();
  final _productController = TextEditingController();
  final _doseController = TextEditingController();
  final _routeController = TextEditingController();
  final _withdrawalController = TextEditingController();
  final _costController = TextEditingController();
  final _vetController = TextEditingController();
  final _notesController = TextEditingController();
  DateTime _recordDate = DateTime.now();
  DateTime _startDate = DateTime.now();
  DateTime? _endDate;
  String _category = 'antibiotic';
  bool _saving = false;
  String? _error;

  final _categories = [
    'antibiotic', 'coccidiostat', 'electrolyte', 'vitamin', 'probiotic', 'acidifier', 'phytogenic', 'other',
  ];

  @override
  void initState() {
    super.initState();
    if (widget.record != null) {
      _productController.text = widget.record!.productName;
      _doseController.text = widget.record!.dose ?? '';
      _routeController.text = widget.record!.route ?? '';
      _withdrawalController.text = widget.record!.withdrawalDays?.toString() ?? '';
      _costController.text = widget.record!.costZmw?.toString() ?? '';
      _vetController.text = widget.record!.veterinarian ?? '';
      _notesController.text = widget.record!.notes ?? '';
      _recordDate = widget.record!.recordDate;
      _startDate = widget.record!.startDate;
      _endDate = widget.record!.endDate;
      _category = _categories.contains(widget.record!.category) ? widget.record!.category : 'other';
    }
  }

  @override
  void dispose() {
    _productController.dispose();
    _doseController.dispose();
    _routeController.dispose();
    _withdrawalController.dispose();
    _costController.dispose();
    _vetController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _pickDate(DateTime initial, void Function(DateTime) onPicked) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked != null) setState(() => onPicked(picked));
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _saving = true; _error = null; });
    try {
      final record = MedicationRecord(
        id: widget.record?.id ?? '',
        flockId: widget.flockId,
        recordDate: _recordDate,
        productName: _productController.text.trim(),
        category: _category,
        dose: _doseController.text.trim().isEmpty ? null : _doseController.text.trim(),
        route: _routeController.text.trim().isEmpty ? null : _routeController.text.trim(),
        startDate: _startDate,
        endDate: _endDate,
        withdrawalDays: int.tryParse(_withdrawalController.text),
        costZmw: double.tryParse(_costController.text),
        veterinarian: _vetController.text.trim().isEmpty ? null : _vetController.text.trim(),
        notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
      );
      if (widget.record == null) {
        await BroilerService.createMedicationRecord(record);
      } else {
        await BroilerService.updateMedicationRecord(widget.record!.id, record);
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
        appBar: AppBar(title: Text(widget.record == null ? 'New Medication' : 'Edit Medication')),
        body: const Center(child: Text('Viewers cannot edit records.')),
      );
    }
    return Scaffold(
      appBar: AppBar(title: Text(widget.record == null ? 'New Medication' : 'Edit Medication')),
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
                onTap: () => _pickDate(_recordDate, (d) => _recordDate = d),
              ),
              TextFormField(
                controller: _productController,
                decoration: const InputDecoration(labelText: 'Product name'),
                validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                key: ValueKey(_category),
                initialValue: _category,
                decoration: const InputDecoration(labelText: 'Category'),
                items: _categories.map((c) => DropdownMenuItem(value: c, child: Text(c.replaceAll('_', ' ')))).toList(),
                onChanged: (v) => setState(() => _category = v!),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _doseController,
                decoration: const InputDecoration(labelText: 'Dose (optional)'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _routeController,
                decoration: const InputDecoration(labelText: 'Route (optional)'),
              ),
              const SizedBox(height: 12),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Start date'),
                subtitle: Text(_startDate.toIso8601String().split('T').first),
                trailing: const Icon(Icons.calendar_today),
                onTap: () => _pickDate(_startDate, (d) => _startDate = d),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('End date (optional)'),
                subtitle: Text(_endDate?.toIso8601String().split('T').first ?? 'Not set'),
                trailing: const Icon(Icons.calendar_today),
                onTap: () => _pickDate(_endDate ?? DateTime.now(), (d) => _endDate = d),
              ),
              TextFormField(
                controller: _withdrawalController,
                decoration: const InputDecoration(labelText: 'Withdrawal days (optional)'),
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _costController,
                decoration: const InputDecoration(labelText: 'Cost (ZMW, optional)'),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _vetController,
                decoration: const InputDecoration(labelText: 'Veterinarian (optional)'),
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
