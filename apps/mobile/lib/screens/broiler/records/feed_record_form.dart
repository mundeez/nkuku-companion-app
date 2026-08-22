import 'package:flutter/material.dart';
import '../../../models/feed_purchase.dart';
import '../../../models/flock.dart';
import '../../../models/supplier.dart';
import '../../../services/auth_service.dart';
import '../../../services/broiler_service.dart';

/// Feed purchase form — mirrors the web app's feed procurement flow.
///
/// Flow:
/// 1. The flock's supplier is pre-selected (if the flock has one).
/// 2. The user picks a feed stage from that supplier's configured stages.
/// 3. Bag size and unit price auto-populate from the selected stage.
/// 4. All auto-populated values can be overridden.
/// 5. Total cost = bagsPurchased × unitPriceZmw (auto-calculated, live).
/// 6. Saving posts to /api/v1/feed-purchases, which auto-creates a
///    FinancialRecord and a double-entry journal entry on the backend.
class FeedRecordForm extends StatefulWidget {
  final String flockId;
  final FeedPurchase? record;

  const FeedRecordForm({super.key, required this.flockId, this.record});

  @override
  State<FeedRecordForm> createState() => _FeedRecordFormState();
}

class _FeedRecordFormState extends State<FeedRecordForm> {
  final _formKey = GlobalKey<FormState>();
  final _stageNameController = TextEditingController();
  final _bagSizeController = TextEditingController();
  final _bagsPurchasedController = TextEditingController();
  final _unitPriceController = TextEditingController();
  final _notesController = TextEditingController();
  DateTime _purchaseDate = DateTime.now();

  String? _selectedSupplierId;
  String? _selectedFeedStageId;
  List<Supplier> _suppliers = [];
  List<FeedStage> _feedStages = [];
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
    if (widget.record != null) {
      final r = widget.record!;
      _stageNameController.text = r.stageName ?? '';
      _bagSizeController.text = r.bagSizeKg.toString();
      _bagsPurchasedController.text = r.bagsPurchased.toString();
      _unitPriceController.text = r.unitPriceZmw.toString();
      _notesController.text = r.notes ?? '';
      _purchaseDate = r.purchaseDate;
      _selectedSupplierId = r.supplierId;
      _selectedFeedStageId = r.feedStageId;
    }
  }

  @override
  void dispose() {
    _stageNameController.dispose();
    _bagSizeController.dispose();
    _bagsPurchasedController.dispose();
    _unitPriceController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    try {
      final results = await Future.wait([
        BroilerService.getSuppliers(),
        BroilerService.getFlock(widget.flockId),
      ]);
      if (!mounted) return;
      final suppliers = results[0] as List<Supplier>;
      final flock = results[1] as BroilerFlock;

      // Pre-select the flock's supplier if one is assigned.
      String? initialSupplier = _selectedSupplierId ?? flock.supplierId;
      if (initialSupplier != null &&
          !suppliers.any((s) => s.id == initialSupplier)) {
        initialSupplier = null;
      }

      List<FeedStage> stages = [];
      if (initialSupplier != null) {
        final supplier = suppliers.firstWhere((s) => s.id == initialSupplier);
        stages = supplier.feedStages
            .where((s) =>
                s.stageType == 'feed' || s.stageType == 'chick')
            .toList()
          ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
      }

      setState(() {
        _suppliers = suppliers;
        _selectedSupplierId = initialSupplier;
        _feedStages = stages;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load data: $e';
        _loading = false;
      });
    }
  }

  void _onSupplierChanged(String? supplierId) {
    setState(() {
      _selectedSupplierId = supplierId;
      _selectedFeedStageId = null;
      _feedStages = [];
      if (supplierId != null) {
        final supplier = _suppliers.firstWhere((s) => s.id == supplierId);
        _feedStages = supplier.feedStages
            .where((s) =>
                s.stageType == 'feed' || s.stageType == 'chick')
            .toList()
          ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
      }
      // Clear stage-derived fields when supplier changes.
      _stageNameController.clear();
      _bagSizeController.clear();
      _unitPriceController.clear();
    });
  }

  void _onFeedStageChanged(String? stageId) {
    setState(() {
      _selectedFeedStageId = stageId;
      if (stageId != null) {
        final stage = _feedStages.firstWhere((s) => s.id == stageId);
        // Auto-populate from the feed stage — user can override afterwards.
        _stageNameController.text = stage.stageName;
        _bagSizeController.text = stage.unitSizeKg.toString();
        _unitPriceController.text = stage.unitPriceZmw.toString();
      } else {
        _stageNameController.clear();
        _bagSizeController.clear();
        _unitPriceController.clear();
      }
    });
  }

  double get _totalCost {
    final bags = int.tryParse(_bagsPurchasedController.text) ?? 0;
    final price = double.tryParse(_unitPriceController.text) ?? 0;
    return bags * price;
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _purchaseDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null) setState(() => _purchaseDate = picked);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final purchase = FeedPurchase(
        id: widget.record?.id ?? '',
        flockId: widget.flockId,
        feedStageId: _selectedFeedStageId,
        supplierId: _selectedSupplierId,
        stageName: _stageNameController.text.trim(),
        purchaseDate: _purchaseDate,
        bagSizeKg: double.parse(_bagSizeController.text),
        bagsPurchased: int.parse(_bagsPurchasedController.text),
        unitPriceZmw: double.parse(_unitPriceController.text),
        totalCostZmw: _totalCost,
        notes: _notesController.text.trim().isEmpty
            ? null
            : _notesController.text.trim(),
      );

      if (widget.record == null) {
        await BroilerService.createFeedPurchase(purchase);
      } else {
        await BroilerService.updateFeedPurchase(widget.record!.id, purchase);
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
        appBar: AppBar(
            title: Text(widget.record == null ? 'New Feed' : 'Edit Feed')),
        body: const Center(child: Text('Viewers cannot edit records.')),
      );
    }

    return Scaffold(
      appBar: AppBar(
          title: Text(
              widget.record == null ? 'New Feed Purchase' : 'Edit Feed Purchase')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // ── Supplier ──────────────────────────────
                    DropdownButtonFormField<String?>(
                      value: _selectedSupplierId,
                      decoration: const InputDecoration(
                        labelText: 'Supplier',
                        helperText: 'Feed stages load from the selected supplier',
                      ),
                      items: [
                        const DropdownMenuItem(
                            value: null, child: Text('No supplier')),
                        ..._suppliers.map((s) => DropdownMenuItem(
                              value: s.id,
                              child: Text(s.name),
                            )),
                      ],
                      onChanged: _onSupplierChanged,
                    ),
                    const SizedBox(height: 12),

                    // ── Feed stage (from supplier) ───────────
                    DropdownButtonFormField<String?>(
                      value: _selectedFeedStageId,
                      decoration: InputDecoration(
                        labelText: 'Feed stage',
                        helperText: _feedStages.isEmpty
                            ? 'Select a supplier with configured feed stages'
                            : 'Auto-fills bag size & price — editable below',
                      ),
                      items: [
                        const DropdownMenuItem(
                            value: null, child: Text('Custom (manual entry)')),
                        ..._feedStages.map((s) => DropdownMenuItem(
                              value: s.id,
                              child: Text(
                                  '${s.stageName} (${s.unitSizeKg}kg · ZMW ${s.unitPriceZmw})'),
                            )),
                      ],
                      onChanged: _onFeedStageChanged,
                    ),
                    const SizedBox(height: 12),

                    // ── Stage name (auto-filled, overridable) ─
                    TextFormField(
                      controller: _stageNameController,
                      decoration: const InputDecoration(
                        labelText: 'Feed type / stage name',
                        helperText: 'Auto-filled from stage — edit if needed',
                      ),
                      validator: (v) =>
                          v == null || v.trim().isEmpty ? 'Required' : null,
                    ),
                    const SizedBox(height: 12),

                    // ── Bag size + Bags purchased ────────────
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _bagSizeController,
                            decoration: const InputDecoration(
                                labelText: 'Bag size (kg)'),
                            keyboardType: const TextInputType
                                .numberWithOptions(decimal: true),
                            validator: (v) {
                              final n = double.tryParse(v ?? '');
                              if (n == null || n <= 0)
                                return 'Enter a positive value';
                              return null;
                            },
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextFormField(
                            controller: _bagsPurchasedController,
                            decoration: const InputDecoration(
                                labelText: 'Bags purchased'),
                            keyboardType: TextInputType.number,
                            validator: (v) {
                              final n = int.tryParse(v ?? '');
                              if (n == null || n <= 0)
                                return 'Enter ≥ 1';
                              return null;
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // ── Unit price + Purchase date ───────────
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _unitPriceController,
                            decoration: const InputDecoration(
                                labelText: 'Unit price (ZMW / bag)',
                                helperText: 'Auto-filled — override if needed'),
                            keyboardType: const TextInputType
                                .numberWithOptions(decimal: true),
                            validator: (v) {
                              final n = double.tryParse(v ?? '');
                              if (n == null || n < 0)
                                return 'Enter a valid price';
                              return null;
                            },
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: const Text('Purchase date'),
                            subtitle: Text(_purchaseDate
                                .toIso8601String()
                                .split('T')
                                .first),
                            trailing: const Icon(Icons.calendar_today),
                            onTap: _pickDate,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),

                    // ── Live total cost ──────────────────────
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Total cost:',
                              style: TextStyle(fontWeight: FontWeight.w500)),
                          Text(
                            'ZMW ${_totalCost.toStringAsFixed(2)}',
                            style: const TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 16),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    // ── Notes ────────────────────────────────
                    TextFormField(
                      controller: _notesController,
                      decoration: const InputDecoration(labelText: 'Notes'),
                      maxLines: 3,
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(_error!,
                          style: TextStyle(
                              color: Theme.of(context).colorScheme.error)),
                    ],
                    const SizedBox(height: 24),
                    ElevatedButton.icon(
                      onPressed: _saving ? null : _save,
                      icon: _saving
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2))
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
