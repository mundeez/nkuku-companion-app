import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../models/breed.dart';
import '../../models/flock.dart';
import '../../models/supplier.dart';
import '../../services/auth_service.dart';
import '../../services/broiler_service.dart';

class FlockFormScreen extends StatefulWidget {
  final BroilerFlock? flock;

  const FlockFormScreen({super.key, this.flock});

  @override
  State<FlockFormScreen> createState() => _FlockFormScreenState();
}

class _FlockFormScreenState extends State<FlockFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _initialCountController = TextEditingController();
  final _targetWeightController = TextEditingController();
  final _targetAgeController = TextEditingController();
  final _feedTransitionController = TextEditingController();
  final _finisherController = TextEditingController();
  final _chickPriceController = TextEditingController();
  final _salePriceController = TextEditingController();
  final _qualityNotesController = TextEditingController();

  DateTime _startDate = DateTime.now();
  DateTime? _collectionDate;
  String? _selectedBreedId;
  String? _selectedSupplierId;
  String _housingType = 'whole_house';
  bool _chicksCollected = false;
  bool _loadingBreeds = true;
  bool _loadingSuppliers = true;
  bool _saving = false;
  String? _error;

  List<Breed> _breeds = [];
  List<Supplier> _suppliers = [];

  @override
  void initState() {
    super.initState();
    _loadLookups();
    if (widget.flock != null) {
      _populate(widget.flock!);
    } else {
      _feedTransitionController.text = '18';
      _finisherController.text = '29';
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _initialCountController.dispose();
    _targetWeightController.dispose();
    _targetAgeController.dispose();
    _feedTransitionController.dispose();
    _finisherController.dispose();
    _chickPriceController.dispose();
    _salePriceController.dispose();
    _qualityNotesController.dispose();
    super.dispose();
  }

  Future<void> _loadLookups() async {
    try {
      final breeds = await BroilerService.getBreeds();
      final suppliers = await BroilerService.getSuppliers();
      if (!mounted) return;
      setState(() {
        _breeds = breeds;
        _suppliers = suppliers;
        _loadingBreeds = false;
        _loadingSuppliers = false;
        if (_selectedBreedId == null && breeds.isNotEmpty && widget.flock == null) {
          _selectedBreedId = breeds.firstWhere((b) => b.isPrimary, orElse: () => breeds.first).id;
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingBreeds = false;
        _loadingSuppliers = false;
        _error = 'Failed to load breeds or suppliers';
      });
    }
  }

  void _populate(BroilerFlock flock) {
    _nameController.text = flock.name;
    _initialCountController.text = '${flock.initialCount}';
    _targetWeightController.text = flock.targetWeight?.toString() ?? '';
    _targetAgeController.text = flock.targetAge?.toString() ?? '';
    _feedTransitionController.text = '${flock.feedTransitionDay ?? 18}';
    _finisherController.text = '${flock.finisherDay ?? 29}';
    _chickPriceController.text = flock.chickPriceZmw?.toString() ?? '';
    _salePriceController.text = flock.salePriceZmw?.toString() ?? '';
    _qualityNotesController.text = flock.chickQualityNotes ?? '';
    _selectedBreedId = flock.breedId;
    _selectedSupplierId = flock.supplierId;
    _housingType = flock.housingType;
    _chicksCollected = flock.chicksCollected ?? false;
    _startDate = DateTime.parse(flock.startDate ?? DateTime.now().toIso8601String());
    if (flock.collectionDate != null) {
      _collectionDate = DateTime.tryParse(flock.collectionDate!);
    }
  }

  Future<void> _pickStartDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _startDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null) setState(() => _startDate = picked);
  }

  Future<void> _pickCollectionDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _collectionDate ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null) setState(() => _collectionDate = picked);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final flock = BroilerFlock(
        id: widget.flock?.id ?? '',
        name: _nameController.text.trim(),
        breedId: _selectedBreedId!,
        startDate: _startDate.toIso8601String().split('T').first,
        initialCount: int.parse(_initialCountController.text),
        currentCount: widget.flock?.currentCount ?? int.parse(_initialCountController.text),
        targetWeight: double.tryParse(_targetWeightController.text),
        targetAge: int.tryParse(_targetAgeController.text),
        feedTransitionDay: int.tryParse(_feedTransitionController.text) ?? 18,
        finisherDay: int.tryParse(_finisherController.text) ?? 29,
        chickPriceZmw: double.tryParse(_chickPriceController.text),
        salePriceZmw: double.tryParse(_salePriceController.text),
        housingType: _housingType,
        status: widget.flock?.status ?? 'active',
        supplierId: _selectedSupplierId,
        chicksCollected: _chicksCollected,
        collectionDate: _collectionDate?.toIso8601String().split('T').first,
        chickQualityNotes: _qualityNotesController.text.trim().isEmpty ? null : _qualityNotesController.text.trim(),
      );

      final saved = widget.flock == null
          ? await BroilerService.createFlock(flock)
          : await BroilerService.updateFlock(widget.flock!.id, flock.toJson());

      if (!mounted) return;
      Navigator.pop(context, saved);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.flock != null;
    final canEdit = AuthService.canEdit;
    if (!canEdit) {
      return Scaffold(
        appBar: AppBar(title: Text(isEdit ? 'View Flock' : 'New Flock')),
        body: const Center(child: Text('Viewers cannot create or edit flocks.')),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(isEdit ? 'Edit Flock' : 'New Flock'),
      ),
      body: _loadingBreeds || _loadingSuppliers
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      controller: _nameController,
                      decoration: const InputDecoration(labelText: 'Flock name'),
                      validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      key: ValueKey(_selectedBreedId),
                      initialValue: _selectedBreedId,
                      decoration: const InputDecoration(labelText: 'Breed'),
                      items: _breeds.map((b) => DropdownMenuItem(value: b.id, child: Text(b.name))).toList(),
                      onChanged: (v) => setState(() => _selectedBreedId = v),
                      validator: (v) => v == null ? 'Select a breed' : null,
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
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Start date'),
                      subtitle: Text(_startDate.toIso8601String().split('T').first),
                      trailing: const Icon(Icons.calendar_today),
                      onTap: _pickStartDate,
                    ),
                    TextFormField(
                      controller: _initialCountController,
                      decoration: const InputDecoration(labelText: 'Initial bird count'),
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
                      controller: _chickPriceController,
                      decoration: const InputDecoration(labelText: 'Chick price (ZMW)'),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _targetWeightController,
                      decoration: const InputDecoration(labelText: 'Target weight (kg, optional)'),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _targetAgeController,
                      decoration: const InputDecoration(labelText: 'Target age (days, optional)'),
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _feedTransitionController,
                            decoration: const InputDecoration(labelText: 'Transition day'),
                            keyboardType: TextInputType.number,
                            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                            validator: (v) {
                              final n = int.tryParse(v ?? '');
                              if (n == null || n < 1 || n > 28) return '1-28';
                              return null;
                            },
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextFormField(
                            controller: _finisherController,
                            decoration: const InputDecoration(labelText: 'Finisher day'),
                            keyboardType: TextInputType.number,
                            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                            validator: (v) {
                              final n = int.tryParse(v ?? '');
                              if (n == null || n < 20 || n > 42) return '20-42';
                              return null;
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: _housingType,
                      decoration: const InputDecoration(labelText: 'Housing type'),
                      items: const [
                        DropdownMenuItem(value: 'whole_house', child: Text('Whole house')),
                        DropdownMenuItem(value: 'spot_brooding', child: Text('Spot brooding')),
                      ],
                      onChanged: (v) => setState(() => _housingType = v!),
                    ),
                    const SizedBox(height: 12),
                    if (isEdit) ...[
                      TextFormField(
                        controller: _salePriceController,
                        decoration: const InputDecoration(labelText: 'Sale price per bird (ZMW, optional)'),
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      ),
                      const SizedBox(height: 12),
                    ],
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Chicks collected'),
                      value: _chicksCollected,
                      onChanged: (v) => setState(() => _chicksCollected = v),
                    ),
                    if (_chicksCollected) ...[
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Collection date'),
                        subtitle: Text(_collectionDate?.toIso8601String().split('T').first ?? 'Not set'),
                        trailing: const Icon(Icons.calendar_today),
                        onTap: _pickCollectionDate,
                      ),
                      TextFormField(
                        controller: _qualityNotesController,
                        decoration: const InputDecoration(labelText: 'Chick quality notes'),
                        maxLines: 2,
                      ),
                    ],
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                    ],
                    const SizedBox(height: 24),
                    ElevatedButton.icon(
                      onPressed: _saving ? null : _save,
                      icon: _saving ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.save),
                      label: Text(isEdit ? 'Update Flock' : 'Create Flock'),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
