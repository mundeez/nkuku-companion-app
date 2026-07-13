import 'package:flutter/material.dart';
import '../../../models/feed_record.dart';
import '../../../models/supplier.dart';
import '../../../services/auth_service.dart';
import '../../../services/broiler_service.dart';

class FeedRecordForm extends StatefulWidget {
  final String flockId;
  final FeedRecord? record;

  const FeedRecordForm({super.key, required this.flockId, this.record});

  @override
  State<FeedRecordForm> createState() => _FeedRecordFormState();
}

class _FeedRecordFormState extends State<FeedRecordForm> {
  final _formKey = GlobalKey<FormState>();
  final _typeController = TextEditingController();
  final _brandController = TextEditingController();
  final _quantityController = TextEditingController();
  final _costController = TextEditingController();
  final _notesController = TextEditingController();
  DateTime _recordDate = DateTime.now();
  String? _selectedSupplierId;
  List<Supplier> _suppliers = [];
  bool _loadingSuppliers = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadSuppliers();
    if (widget.record != null) {
      _typeController.text = widget.record!.feedType;
      _brandController.text = widget.record!.feedBrand ?? '';
      _quantityController.text = '${widget.record!.quantityKg}';
      _costController.text = widget.record!.costZmw?.toString() ?? '';
      _notesController.text = widget.record!.notes ?? '';
      _recordDate = widget.record!.recordDate;
      _selectedSupplierId = widget.record!.supplierId;
    }
  }

  @override
  void dispose() {
    _typeController.dispose();
    _brandController.dispose();
    _quantityController.dispose();
    _costController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadSuppliers() async {
    try {
      final suppliers = await BroilerService.getSuppliers();
      if (!mounted) return;
      setState(() {
        _suppliers = suppliers;
        _loadingSuppliers = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _loadingSuppliers = false; });
    }
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
      final record = FeedRecord(
        id: widget.record?.id ?? '',
        flockId: widget.flockId,
        supplierId: _selectedSupplierId,
        recordDate: _recordDate,
        feedType: _typeController.text.trim(),
        feedBrand: _brandController.text.trim().isEmpty ? null : _brandController.text.trim(),
        quantityKg: double.parse(_quantityController.text),
        costZmw: double.tryParse(_costController.text),
        notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
      );

      if (widget.record == null) {
        await BroilerService.createFeedRecord(record);
      } else {
        await BroilerService.updateFeedRecord(widget.record!.id, record);
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
        appBar: AppBar(title: Text(widget.record == null ? 'New Feed' : 'Edit Feed')),
        body: const Center(child: Text('Viewers cannot edit records.')),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(widget.record == null ? 'New Feed Record' : 'Edit Feed Record')),
      body: _loadingSuppliers
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
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
                      controller: _typeController,
                      decoration: const InputDecoration(labelText: 'Feed type'),
                      validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _brandController,
                      decoration: const InputDecoration(labelText: 'Feed brand (optional)'),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String?>(
                      key: ValueKey(_selectedSupplierId),
                      initialValue: _selectedSupplierId,
                      decoration: const InputDecoration(labelText: 'Supplier (optional)'),
                      items: [
                        const DropdownMenuItem(value: null, child: Text('None')),
                        ..._suppliers.map((s) => DropdownMenuItem(value: s.id, child: Text(s.name))),
                      ],
                      onChanged: (v) => setState(() => _selectedSupplierId = v),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _quantityController,
                      decoration: const InputDecoration(labelText: 'Quantity (kg)'),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      validator: (v) {
                        final n = double.tryParse(v ?? '');
                        if (n == null || n <= 0) return 'Enter a positive quantity';
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
