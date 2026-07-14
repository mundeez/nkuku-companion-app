import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../models/environmental_record.dart';
import '../../../services/auth_service.dart';
import '../../../services/broiler_service.dart';

class EnvironmentalRecordForm extends StatefulWidget {
  final String flockId;
  final EnvironmentalRecord? record;

  const EnvironmentalRecordForm({super.key, required this.flockId, this.record});

  @override
  State<EnvironmentalRecordForm> createState() => _EnvironmentalRecordFormState();
}

class _EnvironmentalRecordFormState extends State<EnvironmentalRecordForm> {
  final _formKey = GlobalKey<FormState>();
  final _timeController = TextEditingController();
  final _tempController = TextEditingController();
  final _humidityController = TextEditingController();
  final _ammoniaController = TextEditingController();
  final _lightController = TextEditingController();
  final _litterController = TextEditingController();
  final _ventilationController = TextEditingController();
  final _notesController = TextEditingController();
  DateTime _recordDate = DateTime.now();
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.record != null) {
      _timeController.text = widget.record!.timeOfDay ?? '';
      _tempController.text = widget.record!.temperatureC?.toString() ?? '';
      _humidityController.text = widget.record!.humidityPct?.toString() ?? '';
      _ammoniaController.text = widget.record!.ammoniaPpm?.toString() ?? '';
      _lightController.text = widget.record!.lightHours?.toString() ?? '';
      _litterController.text = widget.record!.litterScore?.toString() ?? '';
      _ventilationController.text = widget.record!.ventilationNote ?? '';
      _notesController.text = widget.record!.notes ?? '';
      _recordDate = widget.record!.recordDate;
    }
  }

  @override
  void dispose() {
    _timeController.dispose();
    _tempController.dispose();
    _humidityController.dispose();
    _ammoniaController.dispose();
    _lightController.dispose();
    _litterController.dispose();
    _ventilationController.dispose();
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
    setState(() { _saving = true; _error = null; });
    try {
      final record = EnvironmentalRecord(
        id: widget.record?.id ?? '',
        flockId: widget.flockId,
        recordDate: _recordDate,
        timeOfDay: _timeController.text.trim().isEmpty ? null : _timeController.text.trim(),
        temperatureC: double.tryParse(_tempController.text),
        humidityPct: double.tryParse(_humidityController.text),
        ammoniaPpm: double.tryParse(_ammoniaController.text),
        lightHours: double.tryParse(_lightController.text),
        litterScore: int.tryParse(_litterController.text),
        ventilationNote: _ventilationController.text.trim().isEmpty ? null : _ventilationController.text.trim(),
        notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
      );
      if (widget.record == null) {
        await BroilerService.createEnvironmentalRecord(record);
      } else {
        await BroilerService.updateEnvironmentalRecord(widget.record!.id, record);
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
        appBar: AppBar(title: Text(widget.record == null ? 'New Environment' : 'Edit Environment')),
        body: const Center(child: Text('Viewers cannot edit records.')),
      );
    }
    return Scaffold(
      appBar: AppBar(title: Text(widget.record == null ? 'New Environment Record' : 'Edit Environment Record')),
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
                controller: _timeController,
                decoration: const InputDecoration(labelText: 'Time of day (optional)'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _tempController,
                decoration: const InputDecoration(labelText: 'Temperature (°C, optional)'),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _humidityController,
                decoration: const InputDecoration(labelText: 'Humidity (% optional)'),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                validator: (v) {
                  if (v == null || v.isEmpty) return null;
                  final n = double.tryParse(v);
                  if (n == null || n < 0 || n > 100) return 'Enter 0-100';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _ammoniaController,
                decoration: const InputDecoration(labelText: 'Ammonia (ppm, optional)'),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _lightController,
                decoration: const InputDecoration(labelText: 'Light hours (optional)'),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                validator: (v) {
                  if (v == null || v.isEmpty) return null;
                  final n = double.tryParse(v);
                  if (n == null || n < 0 || n > 24) return 'Enter 0-24';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _litterController,
                decoration: const InputDecoration(labelText: 'Litter score 1-5 (optional)'),
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                validator: (v) {
                  if (v == null || v.isEmpty) return null;
                  final n = int.tryParse(v);
                  if (n == null || n < 1 || n > 5) return 'Enter 1-5';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _ventilationController,
                decoration: const InputDecoration(labelText: 'Ventilation note (optional)'),
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
