import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/supplier.dart';
import '../services/auth_service.dart';
import '../services/supplier_service.dart';

class SuppliersScreen extends StatefulWidget {
  const SuppliersScreen({super.key});

  @override
  State<SuppliersScreen> createState() => _SuppliersScreenState();
}

class _SuppliersScreenState extends State<SuppliersScreen> {
  List<Supplier> _suppliers = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final suppliers = await SupplierService.getAll();
      if (!mounted) return;
      setState(() {
        _suppliers = suppliers;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _showSupplierDialog(Supplier? supplier) async {
    await showDialog(
      context: context,
      builder: (_) => _SupplierDialog(
        supplier: supplier,
        onSaved: _load,
      ),
    );
  }

  Future<void> _showFeedStageDialog(String supplierId, FeedStage? stage) async {
    await showDialog(
      context: context,
      builder: (_) => _FeedStageDialog(
        supplierId: supplierId,
        stage: stage,
        onSaved: _load,
      ),
    );
  }

  Future<void> _confirmDeleteSupplier(Supplier supplier) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete supplier?'),
        content: Text('Are you sure you want to delete "${supplier.name}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(
                foregroundColor: Theme.of(context).colorScheme.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await SupplierService.delete(supplier.id);
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to delete supplier: $e')),
      );
    }
  }

  Future<void> _confirmDeleteFeedStage(FeedStage stage) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete feed stage?'),
        content: Text('Are you sure you want to delete "${stage.stageName}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(
                foregroundColor: Theme.of(context).colorScheme.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await SupplierService.deleteFeedStage(stage.id);
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to delete feed stage: $e')),
      );
    }
  }

  Widget _buildBody(bool canEdit, bool canDelete) {
    if (_loading && _suppliers.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null && _suppliers.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Error: $_error',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _load,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 80),
        itemCount: _suppliers.isEmpty ? 1 : _suppliers.length,
        itemBuilder: (context, index) {
          if (_suppliers.isEmpty) {
            return const ListTile(
              title: Text('No suppliers yet'),
            );
          }
          final supplier = _suppliers[index];
          return _SupplierTile(
            supplier: supplier,
            canEdit: canEdit,
            canDelete: canDelete,
            onEditSupplier: () => _showSupplierDialog(supplier),
            onDeleteSupplier: () => _confirmDeleteSupplier(supplier),
            onEditStage: (stage) => _showFeedStageDialog(supplier.id, stage),
            onDeleteStage: (stage) => _confirmDeleteFeedStage(stage),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final canEdit = AuthService.canEdit;
    final canDelete = AuthService.canDelete;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Suppliers'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: _load,
          ),
        ],
      ),
      body: _buildBody(canEdit, canDelete),
      floatingActionButton: canEdit
          ? FloatingActionButton(
              onPressed: () => _showSupplierDialog(null),
              tooltip: 'Add supplier',
              child: const Icon(Icons.add),
            )
          : null,
    );
  }
}

class _SupplierTile extends StatelessWidget {
  final Supplier supplier;
  final bool canEdit;
  final bool canDelete;
  final VoidCallback onEditSupplier;
  final VoidCallback onDeleteSupplier;
  final ValueChanged<FeedStage> onEditStage;
  final ValueChanged<FeedStage> onDeleteStage;

  const _SupplierTile({
    required this.supplier,
    required this.canEdit,
    required this.canDelete,
    required this.onEditSupplier,
    required this.onDeleteSupplier,
    required this.onEditStage,
    required this.onDeleteStage,
  });

  Color _stageTypeColor(String type) {
    switch (type) {
      case 'feed':
        return Colors.orange;
      case 'chick':
        return Colors.yellow.shade700;
      case 'medication':
        return Colors.red;
      default:
        return Colors.blueGrey;
    }
  }

  String _subtitle() {
    if (supplier.description != null && supplier.description!.isNotEmpty) {
      return supplier.description!;
    }
    if (supplier.chickenType != null && supplier.chickenType!.isNotEmpty) {
      return supplier.chickenType!;
    }
    if (supplier.contact != null && supplier.contact!.isNotEmpty) {
      return supplier.contact!;
    }
    return 'No description';
  }

  @override
  Widget build(BuildContext context) {
    final stages = supplier.feedStages.toList()
      ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));

    return ExpansionTile(
      leading: CircleAvatar(
        child: Text(
          supplier.name.isNotEmpty ? supplier.name[0].toUpperCase() : '?',
        ),
      ),
      title: Row(
        children: [
          Expanded(
            child: Text(
              supplier.name,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (supplier.isDefault)
            Padding(
              padding: const EdgeInsets.only(left: 8),
              child: Chip(
                label: const Text('Default'),
                backgroundColor: Colors.green.shade100,
                labelStyle: const TextStyle(fontSize: 12),
                padding: EdgeInsets.zero,
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            ),
        ],
      ),
      subtitle: Text(_subtitle()),
      trailing: canEdit || canDelete
          ? Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (canEdit)
                  IconButton(
                    icon: const Icon(Icons.edit),
                    tooltip: 'Edit supplier',
                    onPressed: onEditSupplier,
                  ),
                if (canDelete)
                  IconButton(
                    icon: const Icon(Icons.delete),
                    tooltip: 'Delete supplier',
                    color: Colors.red,
                    onPressed: onDeleteSupplier,
                  ),
              ],
            )
          : null,
      children: [
        if (stages.isEmpty)
          const ListTile(
            dense: true,
            title: Text('No feed stages'),
          ),
        ...stages.map((stage) {
          final dayRange = _dayRangeText(stage);
          return ListTile(
            dense: true,
            title: Row(
              children: [
                Expanded(
                  child: Text(
                    stage.stageName,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                _StageTypeBadge(
                    stageType: stage.stageType,
                    color: _stageTypeColor(stage.stageType)),
              ],
            ),
            subtitle: Text(
              '${stage.unitSizeKg}kg bag @ ZMW ${stage.unitPriceZmw.toStringAsFixed(2)} • ${stage.intakePerBirdKg}kg/bird$dayRange',
            ),
            trailing: canEdit || canDelete
                ? Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (canEdit)
                        IconButton(
                          icon: const Icon(Icons.edit),
                          tooltip: 'Edit stage',
                          onPressed: () => onEditStage(stage),
                        ),
                      if (canDelete)
                        IconButton(
                          icon: const Icon(Icons.delete),
                          tooltip: 'Delete stage',
                          color: Colors.red,
                          onPressed: () => onDeleteStage(stage),
                        ),
                    ],
                  )
                : null,
          );
        }),
        if (canEdit)
          Padding(
            padding: const EdgeInsets.all(8),
            child: Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () => onEditStage(
                  FeedStage(
                    id: '',
                    stageName: '',
                    stageType: 'feed',
                    unitSizeKg: 0,
                    unitPriceZmw: 0,
                    intakePerBirdKg: 0,
                  ),
                ),
                icon: const Icon(Icons.add),
                label: const Text('Add Stage'),
              ),
            ),
          ),
      ],
    );
  }

  String _dayRangeText(FeedStage stage) {
    if (stage.dayRangeStart == null && stage.dayRangeEnd == null) return '';
    if (stage.dayRangeStart != null && stage.dayRangeEnd != null) {
      return ' (days ${stage.dayRangeStart}-${stage.dayRangeEnd})';
    }
    return ' (day ${stage.dayRangeStart ?? stage.dayRangeEnd})';
  }
}

class _StageTypeBadge extends StatelessWidget {
  final String stageType;
  final Color color;

  const _StageTypeBadge({required this.stageType, required this.color});

  @override
  Widget build(BuildContext context) {
    return Chip(
      label: Text(
        stageType[0].toUpperCase() + stageType.substring(1),
        style: const TextStyle(fontSize: 11, color: Colors.white),
      ),
      backgroundColor: color,
      padding: EdgeInsets.zero,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      labelPadding: const EdgeInsets.symmetric(horizontal: 6),
    );
  }
}

class _SupplierDialog extends StatefulWidget {
  final Supplier? supplier;
  final VoidCallback onSaved;

  const _SupplierDialog({this.supplier, required this.onSaved});

  @override
  State<_SupplierDialog> createState() => _SupplierDialogState();
}

class _SupplierDialogState extends State<_SupplierDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _descriptionController;
  late final TextEditingController _chickenTypeController;
  late final TextEditingController _contactController;
  late bool _isDefault;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final supplier = widget.supplier;
    _nameController = TextEditingController(text: supplier?.name ?? '');
    _descriptionController =
        TextEditingController(text: supplier?.description ?? '');
    _chickenTypeController =
        TextEditingController(text: supplier?.chickenType ?? '');
    _contactController = TextEditingController(text: supplier?.contact ?? '');
    _isDefault = supplier?.isDefault ?? false;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    _chickenTypeController.dispose();
    _contactController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final body = {
        'name': _nameController.text.trim(),
        if (_descriptionController.text.trim().isNotEmpty)
          'description': _descriptionController.text.trim(),
        if (_chickenTypeController.text.trim().isNotEmpty)
          'chickenType': _chickenTypeController.text.trim(),
        if (_contactController.text.trim().isNotEmpty)
          'contact': _contactController.text.trim(),
        'isActive': widget.supplier?.isActive ?? true,
        'isDefault': _isDefault,
      };
      if (widget.supplier == null) {
        await SupplierService.create(body);
      } else {
        await SupplierService.update(widget.supplier!.id, body);
      }
      if (!mounted) return;
      widget.onSaved();
      if (!mounted) return;
      Navigator.pop(context);
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
    final isEdit = widget.supplier != null;
    return AlertDialog(
      title: Text(isEdit ? 'Edit Supplier' : 'Add Supplier'),
      content: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: 'Name *'),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                      return 'Required';
                    }
                  return null;
                },
                textCapitalization: TextCapitalization.words,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _descriptionController,
                decoration: const InputDecoration(labelText: 'Description'),
                maxLines: 2,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _chickenTypeController,
                decoration: const InputDecoration(
                  labelText: 'Chicken type',
                  hintText: 'Ross 308, Cobb 500, etc.',
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _contactController,
                decoration: const InputDecoration(
                  labelText: 'Contact',
                  hintText: 'Phone or email',
                ),
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 12),
              SwitchListTile(
                title: const Text('Default supplier'),
                value: _isDefault,
                onChanged: (value) => setState(() => _isDefault = value),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Save'),
        ),
      ],
    );
  }
}

class _FeedStageDialog extends StatefulWidget {
  final String supplierId;
  final FeedStage? stage;
  final VoidCallback onSaved;

  const _FeedStageDialog({
    required this.supplierId,
    this.stage,
    required this.onSaved,
  });

  @override
  State<_FeedStageDialog> createState() => _FeedStageDialogState();
}

class _FeedStageDialogState extends State<_FeedStageDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _dayStartController;
  late final TextEditingController _dayEndController;
  late final TextEditingController _unitSizeController;
  late final TextEditingController _unitPriceController;
  late final TextEditingController _intakeController;
  late String _stageType;
  bool _saving = false;
  String? _error;

  static const List<String> _stageTypes = [
    'feed',
    'chick',
    'medication',
    'other',
  ];

  @override
  void initState() {
    super.initState();
    final stage = widget.stage;
    _nameController = TextEditingController(text: stage?.stageName ?? '');
    _dayStartController = TextEditingController(
      text: stage?.dayRangeStart?.toString() ?? '',
    );
    _dayEndController = TextEditingController(
      text: stage?.dayRangeEnd?.toString() ?? '',
    );
    _unitSizeController =
        TextEditingController(text: stage?.unitSizeKg.toString() ?? '');
    _unitPriceController =
        TextEditingController(text: stage?.unitPriceZmw.toString() ?? '');
    _intakeController =
        TextEditingController(text: stage?.intakePerBirdKg.toString() ?? '');
    _stageType = stage?.stageType ?? 'feed';
  }

  @override
  void dispose() {
    _nameController.dispose();
    _dayStartController.dispose();
    _dayEndController.dispose();
    _unitSizeController.dispose();
    _unitPriceController.dispose();
    _intakeController.dispose();
    super.dispose();
  }

  String? _requiredDouble(String? value) {
    if (value == null || value.trim().isEmpty) {
                      return 'Required';
                    }
    final parsed = double.tryParse(value.trim());
    if (parsed == null) return 'Invalid number';
    if (parsed < 0) return 'Must be zero or greater';
    return null;
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final body = <String, dynamic>{
        if (widget.stage == null) 'supplierId': widget.supplierId,
        'stageName': _nameController.text.trim(),
        'stageType': _stageType,
        if (_dayStartController.text.trim().isNotEmpty)
          'dayRangeStart': int.parse(_dayStartController.text.trim()),
        if (_dayEndController.text.trim().isNotEmpty)
          'dayRangeEnd': int.parse(_dayEndController.text.trim()),
        'unitSizeKg': double.parse(_unitSizeController.text.trim()),
        'unitPriceZmw': double.parse(_unitPriceController.text.trim()),
        'intakePerBirdKg': double.parse(_intakeController.text.trim()),
        'sortOrder': widget.stage?.sortOrder ?? 0,
        'isActive': widget.stage?.isActive ?? true,
      };
      if (widget.stage == null) {
        await SupplierService.createFeedStage(body);
      } else {
        await SupplierService.updateFeedStage(widget.stage!.id, body);
      }
      if (!mounted) return;
      widget.onSaved();
      if (!mounted) return;
      Navigator.pop(context);
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
    final isEdit = widget.stage != null && widget.stage!.id.isNotEmpty;
    return AlertDialog(
      title: Text(isEdit ? 'Edit Feed Stage' : 'Add Feed Stage'),
      content: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: 'Stage name *'),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                      return 'Required';
                    }
                  return null;
                },
                textCapitalization: TextCapitalization.words,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _stageType,
                decoration: const InputDecoration(labelText: 'Stage type *'),
                items: _stageTypes
                    .map(
                      (type) => DropdownMenuItem(
                        value: type,
                        child: Text(
                          type[0].toUpperCase() + type.substring(1),
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (value) {
                  if (value != null) setState(() => _stageType = value);
                },
                validator: (value) => value == null ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _dayStartController,
                      decoration:
                          const InputDecoration(labelText: 'Day range start'),
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                        return null;
                      }
                        if (int.tryParse(value.trim()) == null)
                          return 'Invalid';
                        return null;
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _dayEndController,
                      decoration:
                          const InputDecoration(labelText: 'Day range end'),
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                        return null;
                      }
                        if (int.tryParse(value.trim()) == null)
                          return 'Invalid';
                        return null;
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _unitSizeController,
                decoration:
                    const InputDecoration(labelText: 'Unit size (kg) *'),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*')),
                ],
                validator: _requiredDouble,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _unitPriceController,
                decoration:
                    const InputDecoration(labelText: 'Unit price (ZMW) *'),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*')),
                ],
                validator: _requiredDouble,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _intakeController,
                decoration:
                    const InputDecoration(labelText: 'Intake per bird (kg) *'),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*')),
                ],
                validator: _requiredDouble,
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Save'),
        ),
      ],
    );
  }
}
