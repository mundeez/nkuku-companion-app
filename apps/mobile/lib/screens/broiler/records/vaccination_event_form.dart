import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../models/flock.dart';
import '../../../models/vaccination_event.dart';
import '../../../services/api_service.dart';
import '../../../services/auth_service.dart';
import '../../../services/broiler_service.dart';

class VaccinationEventForm extends StatefulWidget {
  final String flockId;
  final int flockAgeDays;
  final VaccinationEvent? record;

  const VaccinationEventForm({
    super.key,
    required this.flockId,
    this.flockAgeDays = 0,
    this.record,
  });

  @override
  State<VaccinationEventForm> createState() => _VaccinationEventFormState();
}

class _VaccinationEventFormState extends State<VaccinationEventForm> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _typeController = TextEditingController();
  final _ageController = TextEditingController();
  final _costController = TextEditingController();
  final _batchController = TextEditingController();
  final _notesController = TextEditingController();
  DateTime _adminDate = DateTime.now();
  DateTime? _nextDueDate;
  DateTime? _expiryDate;
  String _adminMethod = 'drinking_water';
  bool _saving = false;
  String? _error;
  List<Disease> _diseases = [];
  String? _selectedDiseaseId;

  final _methods = [
    'drinking_water',
    'spray',
    'injection',
    'eye_drop',
    'oral',
  ];

  @override
  void initState() {
    super.initState();
    if (widget.record != null) {
      _nameController.text = widget.record!.vaccineName;
      _typeController.text = widget.record!.vaccineType ?? '';
      _ageController.text = '${widget.record!.ageDays}';
      _costController.text = widget.record!.costZmw?.toString() ?? '';
      _batchController.text = widget.record!.batchNumber ?? '';
      _notesController.text = widget.record!.notes ?? '';
      _adminDate = widget.record!.adminDate;
      _nextDueDate = widget.record!.nextDueDate;
      _expiryDate = widget.record!.expiryDate;
      _selectedDiseaseId = widget.record!.diseaseId;
      if (_methods.contains(widget.record!.adminMethod)) {
        _adminMethod = widget.record!.adminMethod;
      }
    } else {
      _ageController.text = '${widget.flockAgeDays}';
    }
    _loadDiseases();
  }

  Future<void> _loadDiseases() async {
    try {
      final res = await ApiService.dio.get('/api/v1/diseases');
      final diseases =
          (res.data as List).map((e) => Disease.fromJson(e)).toList();
      if (mounted) setState(() => _diseases = diseases);
    } catch (_) {
      // Disease list is optional — the dropdown just stays empty.
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _typeController.dispose();
    _ageController.dispose();
    _costController.dispose();
    _batchController.dispose();
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
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final event = VaccinationEvent(
        id: widget.record?.id ?? '',
        flockId: widget.flockId,
        vaccineName: _nameController.text.trim(),
        vaccineType: _typeController.text.trim().isEmpty ? null : _typeController.text.trim(),
        adminDate: _adminDate,
        adminMethod: _adminMethod,
        ageDays: int.parse(_ageController.text),
        costZmw: double.tryParse(_costController.text),
        nextDueDate: _nextDueDate,
        batchNumber: _batchController.text.trim().isEmpty ? null : _batchController.text.trim(),
        expiryDate: _expiryDate,
        notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
        diseaseId: _selectedDiseaseId,
      );

      if (widget.record == null) {
        await BroilerService.createVaccinationEvent(event);
      } else {
        await BroilerService.updateVaccinationEvent(widget.record!.id, event);
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
        appBar: AppBar(title: Text(widget.record == null ? 'New Vaccination' : 'Edit Vaccination')),
        body: const Center(child: Text('Viewers cannot edit records.')),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(widget.record == null ? 'New Vaccination' : 'Edit Vaccination')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Administration date'),
                subtitle: Text(_adminDate.toIso8601String().split('T').first),
                trailing: const Icon(Icons.calendar_today),
                onTap: () => _pickDate(_adminDate, (d) => _adminDate = d),
              ),
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: 'Vaccine name'),
                validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _typeController,
                decoration: const InputDecoration(labelText: 'Vaccine type (optional)'),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                key: ValueKey(_adminMethod),
                initialValue: _adminMethod,
                decoration: const InputDecoration(labelText: 'Method'),
                items: _methods.map((m) => DropdownMenuItem(value: m, child: Text(m.replaceAll('_', ' ')))).toList(),
                onChanged: (v) => setState(() => _adminMethod = v!),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _ageController,
                decoration: const InputDecoration(labelText: 'Flock age (days)'),
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                validator: (v) {
                  final n = int.tryParse(v ?? '');
                  if (n == null || n < 0) return 'Enter a valid age';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _costController,
                decoration: const InputDecoration(labelText: 'Cost (ZMW, optional)'),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _batchController,
                decoration: const InputDecoration(labelText: 'Batch number (optional)'),
              ),
              const SizedBox(height: 12),
              Builder(builder: (context) {
                final items = <DropdownMenuItem<String>>[
                  const DropdownMenuItem(
                    value: '',
                    child: Text('None'),
                  ),
                  ..._diseases.map((d) => DropdownMenuItem(
                        value: d.id,
                        child: Text(d.name,
                            maxLines: 1, overflow: TextOverflow.ellipsis),
                      )),
                ];
                // Keep the current selection visible even if the disease
                // list hasn't loaded yet or the entry was removed.
                if (_selectedDiseaseId != null &&
                    !_diseases.any((d) => d.id == _selectedDiseaseId)) {
                  items.add(DropdownMenuItem(
                    value: _selectedDiseaseId,
                    child: Text(
                        widget.record?.disease?.name ?? 'Selected disease',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                  ));
                }
                return DropdownButtonFormField<String>(
                  initialValue: _selectedDiseaseId,
                  decoration: const InputDecoration(
                    labelText: 'Disease prevented (optional)',
                  ),
                  items: items,
                  onChanged: (v) => setState(() {
                    _selectedDiseaseId = (v == null || v.isEmpty) ? null : v;
                  }),
                );
              }),
              const SizedBox(height: 12),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Next due date (optional)'),
                subtitle: Text(_nextDueDate?.toIso8601String().split('T').first ?? 'Not set'),
                trailing: const Icon(Icons.calendar_today),
                onTap: () => _pickDate(_nextDueDate ?? DateTime.now(), (d) => _nextDueDate = d),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Expiry date (optional)'),
                subtitle: Text(_expiryDate?.toIso8601String().split('T').first ?? 'Not set'),
                trailing: const Icon(Icons.calendar_today),
                onTap: () => _pickDate(_expiryDate ?? DateTime.now(), (d) => _expiryDate = d),
              ),
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
