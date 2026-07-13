import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../models/growth_record.dart';
import '../../../services/auth_service.dart';
import '../../../services/broiler_service.dart';

class GrowthRecordForm extends StatefulWidget {
  final String flockId;
  final GrowthRecord? record;

  const GrowthRecordForm({super.key, required this.flockId, this.record});

  @override
  State<GrowthRecordForm> createState() => _GrowthRecordFormState();
}

class _GrowthRecordFormState extends State<GrowthRecordForm> {
  final _formKey = GlobalKey<FormState>();
  final _sampleController = TextEditingController();
  final _weightController = TextEditingController();
  final _notesController = TextEditingController();
  DateTime _recordDate = DateTime.now();
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.record != null) {
      _sampleController.text = '${widget.record!.sampleSize}';
      _weightController.text = '${widget.record!.avgWeight}';
      _notesController.text = widget.record!.notes ?? '';
      _recordDate = widget.record!.recordDate;
    }
  }

  @override
  void dispose() {
    _sampleController.dispose();
    _weightController.dispose();
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
      final record = GrowthRecord(
        id: widget.record?.id ?? '',
        flockId: widget.flockId,
        recordDate: _recordDate,
        sampleSize: int.parse(_sampleController.text),
        avgWeight: double.parse(_weightController.text),
        notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
      );

      if (widget.record == null) {
        await BroilerService.createGrowthRecord(record);
      } else {
        await BroilerService.updateGrowthRecord(widget.record!.id, record);
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
        appBar: AppBar(title: Text(widget.record == null ? 'New Growth' : 'Edit Growth')),
        body: const Center(child: Text('Viewers cannot edit records.')),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(widget.record == null ? 'New Growth Record' : 'Edit Growth Record')),
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
                controller: _sampleController,
                decoration: const InputDecoration(labelText: 'Sample size'),
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                validator: (v) {
                  final n = int.tryParse(v ?? '');
                  if (n == null || n < 1) return 'Enter at least 1';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _weightController,
                decoration: const InputDecoration(labelText: 'Average weight (kg)'),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                validator: (v) {
                  final n = double.tryParse(v ?? '');
                  if (n == null || n <= 0) return 'Enter a positive weight';
                  return null;
                },
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
