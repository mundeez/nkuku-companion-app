import 'package:flutter/material.dart';
import '../../../models/water_record.dart';
import '../../../services/auth_service.dart';
import '../../../services/broiler_service.dart';

class WaterRecordForm extends StatefulWidget {
  final String flockId;
  final WaterRecord? record;

  const WaterRecordForm({super.key, required this.flockId, this.record});

  @override
  State<WaterRecordForm> createState() => _WaterRecordFormState();
}

class _WaterRecordFormState extends State<WaterRecordForm> {
  final _formKey = GlobalKey<FormState>();
  final _quantityController = TextEditingController();
  final _phController = TextEditingController();
  final _tempController = TextEditingController();
  final _costController = TextEditingController();
  final _notesController = TextEditingController();
  DateTime _recordDate = DateTime.now();
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.record != null) {
      _quantityController.text = '${widget.record!.quantityLiters}';
      _phController.text = widget.record!.ph?.toString() ?? '';
      _tempController.text = widget.record!.temperature?.toString() ?? '';
      _costController.text = widget.record!.costZmw?.toString() ?? '';
      _notesController.text = widget.record!.notes ?? '';
      _recordDate = widget.record!.recordDate;
    }
  }

  @override
  void dispose() {
    _quantityController.dispose();
    _phController.dispose();
    _tempController.dispose();
    _costController.dispose();
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
      final record = WaterRecord(
        id: widget.record?.id ?? '',
        flockId: widget.flockId,
        recordDate: _recordDate,
        quantityLiters: double.parse(_quantityController.text),
        ph: double.tryParse(_phController.text),
        temperature: double.tryParse(_tempController.text),
        costZmw: double.tryParse(_costController.text),
        notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
      );

      if (widget.record == null) {
        await BroilerService.createWaterRecord(record);
      } else {
        await BroilerService.updateWaterRecord(widget.record!.id, record);
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
        appBar: AppBar(title: Text(widget.record == null ? 'New Water' : 'Edit Water')),
        body: const Center(child: Text('Viewers cannot edit records.')),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(widget.record == null ? 'New Water Record' : 'Edit Water Record')),
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
              TextFormField(
                controller: _quantityController,
                decoration: const InputDecoration(labelText: 'Quantity (liters)'),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                validator: (v) {
                  final n = double.tryParse(v ?? '');
                  if (n == null || n <= 0) return 'Enter a positive quantity';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _phController,
                decoration: const InputDecoration(labelText: 'pH (optional, 0-14)'),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                validator: (v) {
                  if (v == null || v.isEmpty) return null;
                  final n = double.tryParse(v);
                  if (n == null || n < 0 || n > 14) return 'Enter 0-14';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _tempController,
                decoration: const InputDecoration(labelText: 'Temperature (°C, optional)'),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _costController,
                decoration: const InputDecoration(labelText: 'Cost (ZMW, optional)'),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
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
