import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../models/mortality_event.dart';
import '../../../services/auth_service.dart';
import '../../../services/broiler_service.dart';

class MortalityEventForm extends StatefulWidget {
  final String flockId;
  final int currentCount;
  final MortalityEvent? record;

  const MortalityEventForm({
    super.key,
    required this.flockId,
    this.currentCount = 0,
    this.record,
  });

  @override
  State<MortalityEventForm> createState() => _MortalityEventFormState();
}

class _MortalityEventFormState extends State<MortalityEventForm> {
  final _formKey = GlobalKey<FormState>();
  final _countController = TextEditingController();
  final _causeController = TextEditingController();
  final _ageController = TextEditingController();
  final _costController = TextEditingController();
  final _notesController = TextEditingController();
  DateTime _eventDate = DateTime.now();
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.record != null) {
      _countController.text = '${widget.record!.count}';
      _causeController.text = widget.record!.cause ?? '';
      _ageController.text = widget.record!.ageDays?.toString() ?? '';
      _costController.text = widget.record!.costZmw?.toString() ?? '';
      _notesController.text = widget.record!.notes ?? '';
      _eventDate = widget.record!.eventDate;
    }
  }

  @override
  void dispose() {
    _countController.dispose();
    _causeController.dispose();
    _ageController.dispose();
    _costController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _eventDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null) setState(() => _eventDate = picked);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final event = MortalityEvent(
        id: widget.record?.id ?? '',
        flockId: widget.flockId,
        eventDate: _eventDate,
        count: int.parse(_countController.text),
        cause: _causeController.text.trim().isEmpty ? null : _causeController.text.trim(),
        ageDays: int.tryParse(_ageController.text),
        costZmw: double.tryParse(_costController.text),
        notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
      );

      if (widget.record == null) {
        await BroilerService.createMortalityEvent(event);
      } else {
        await BroilerService.updateMortalityEvent(widget.record!.id, event);
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
        appBar: AppBar(title: Text(widget.record == null ? 'New Mortality' : 'Edit Mortality')),
        body: const Center(child: Text('Viewers cannot edit records.')),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(widget.record == null ? 'New Mortality Event' : 'Edit Mortality Event')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Event date'),
                subtitle: Text(_eventDate.toIso8601String().split('T').first),
                trailing: const Icon(Icons.calendar_today),
                onTap: _pickDate,
              ),
              TextFormField(
                controller: _countController,
                decoration: const InputDecoration(labelText: 'Number of birds'),
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
                controller: _causeController,
                decoration: const InputDecoration(labelText: 'Cause (optional)'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _ageController,
                decoration: const InputDecoration(labelText: 'Age in days (optional)'),
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _costController,
                decoration: const InputDecoration(labelText: 'Disposal cost (ZMW, optional)'),
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
