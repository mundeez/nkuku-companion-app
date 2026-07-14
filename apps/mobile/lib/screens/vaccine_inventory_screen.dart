import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/vaccine_inventory.dart';
import '../services/auth_service.dart';
import '../services/vaccine_inventory_service.dart';

class VaccineInventoryScreen extends StatefulWidget {
  const VaccineInventoryScreen({super.key});

  @override
  State<VaccineInventoryScreen> createState() => _VaccineInventoryScreenState();
}

enum _FilterMode {
  all,
  available,
  inUse,
  expiringSoon,
  expired,
  depleted,
}

extension _FilterModeExt on _FilterMode {
  String get label {
    switch (this) {
      case _FilterMode.all:
        return 'All';
      case _FilterMode.available:
        return 'Available';
      case _FilterMode.inUse:
        return 'In Use';
      case _FilterMode.expiringSoon:
        return 'Expiring Soon';
      case _FilterMode.expired:
        return 'Expired';
      case _FilterMode.depleted:
        return 'Depleted';
    }
  }

  String? get apiStatus {
    switch (this) {
      case _FilterMode.available:
        return 'available';
      case _FilterMode.inUse:
        return 'in_use';
      case _FilterMode.expired:
        return 'expired';
      case _FilterMode.depleted:
        return 'depleted';
      default:
        return null;
    }
  }

  bool get isClientSide => this == _FilterMode.expiringSoon;
}

class _VaccineInventoryScreenState extends State<VaccineInventoryScreen> {
  final List<VaccineInventory> _vaccines = [];
  bool _loading = true;
  String? _error;
  _FilterMode _filter = _FilterMode.all;

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
      final status = _filter.apiStatus;
      final results = await VaccineInventoryService.getAll(status: status);
      if (!mounted) return;
      if (_filter.isClientSide) {
        setState(() {
          _vaccines
            ..clear()
            ..addAll(results.where((v) => v.isExpiringSoon));
          _loading = false;
        });
      } else {
        setState(() {
          _vaccines
            ..clear()
            ..addAll(results);
          _loading = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _setFilter(_FilterMode mode) {
    if (_filter == mode) return;
    setState(() => _filter = mode);
    _load();
  }

  Future<void> _showFormSheet(VaccineInventory? vaccine) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => _VaccineFormSheet(
        vaccine: vaccine,
        onChanged: () {
          if (mounted) _load();
        },
      ),
    );
  }

  Future<void> _showDetailSheet(VaccineInventory vaccine) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => _VaccineDetailSheet(vaccine: vaccine),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }

  String _formatStatus(String status) {
    return status
        .split('_')
        .map((s) => s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}')
        .join(' ');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Vaccine Inventory'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loading ? null : _load,
          ),
        ],
      ),
      floatingActionButton: AuthService.canEdit
          ? FloatingActionButton(
              onPressed: () => _showFormSheet(null),
              child: const Icon(Icons.add),
            )
          : null,
      body: Column(
        children: [
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              children: _FilterMode.values.map((mode) {
                final selected = _filter == mode;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(mode.label),
                    selected: selected,
                    onSelected: (_) => _setFilter(mode),
                  ),
                );
              }).toList(),
            ),
          ),
          Expanded(
            child: _buildBody(),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading && _vaccines.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 12),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }
    if (_vaccines.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.vaccines, size: 64, color: Colors.grey[400]),
              const SizedBox(height: 16),
              Text(
                'No vaccine inventory',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              if (_filter == _FilterMode.expiringSoon) ...[
                const SizedBox(height: 8),
                const Text('No vaccines expiring within 7 days.'),
              ],
            ],
          ),
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _vaccines.length,
        itemBuilder: (context, index) {
          final vaccine = _vaccines[index];
          final expired = vaccine.status == 'expired' || vaccine.isExpired;
          final card = Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: vaccine.statusColor,
                child: Text(
                  vaccine.name.isEmpty ? '' : vaccine.name[0].toUpperCase(),
                  style: const TextStyle(color: Colors.white),
                ),
              ),
              title: Text(
                vaccine.name,
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              subtitle: Text(
                'Batch: ${vaccine.batchNumber} · ${vaccine.quantityDoses} doses · Expires: ${_formatDate(vaccine.expiryDate)}',
              ),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Chip(
                    label: Text(
                      _formatStatus(vaccine.status),
                      style: const TextStyle(fontSize: 12),
                    ),
                    backgroundColor:
                        vaccine.statusColor.withValues(alpha: 0.15),
                    side: BorderSide.none,
                    padding: EdgeInsets.zero,
                  ),
                  if (vaccine.isExpiringSoon) ...[
                    const SizedBox(width: 4),
                    const Icon(Icons.warning_amber,
                        color: Colors.amber, size: 20),
                  ],
                ],
              ),
              onTap: AuthService.canEdit
                  ? () => _showFormSheet(vaccine)
                  : () => _showDetailSheet(vaccine),
            ),
          );
          return expired ? Opacity(opacity: 0.6, child: card) : card;
        },
      ),
    );
  }
}

class _VaccineDetailSheet extends StatelessWidget {
  final VaccineInventory vaccine;

  const _VaccineDetailSheet({required this.vaccine});

  String _formatDate(DateTime date) {
    return '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }

  String _formatStatus(String status) {
    return status
        .split('_')
        .map((s) => s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}')
        .join(' ');
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Row(
              children: [
                Expanded(
                  child: Text(
                    vaccine.name,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                Chip(
                  label: Text(_formatStatus(vaccine.status)),
                  backgroundColor: vaccine.statusColor.withValues(alpha: 0.15),
                  side: BorderSide.none,
                ),
              ],
            ),
            const SizedBox(height: 16),
            _DetailRow(label: 'Batch number', value: vaccine.batchNumber),
            _DetailRow(label: 'Disease', value: vaccine.disease ?? '-'),
            _DetailRow(label: 'Supplier', value: vaccine.supplier ?? '-'),
            _DetailRow(
                label: 'Quantity', value: '${vaccine.quantityDoses} doses'),
            _DetailRow(
                label: 'Expiry date', value: _formatDate(vaccine.expiryDate)),
            if (vaccine.costZmw != null)
              _DetailRow(
                  label: 'Cost',
                  value: 'ZMW ${vaccine.costZmw!.toStringAsFixed(2)}'),
            if (vaccine.notes != null && vaccine.notes!.isNotEmpty)
              _DetailRow(label: 'Notes', value: vaccine.notes!),
            if (vaccine.createdAt != null)
              _DetailRow(
                  label: 'Created', value: _formatDate(vaccine.createdAt!)),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Close'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: TextStyle(color: Colors.grey[600]),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }
}

class _VaccineFormSheet extends StatefulWidget {
  final VaccineInventory? vaccine;
  final VoidCallback onChanged;

  const _VaccineFormSheet({this.vaccine, required this.onChanged});

  @override
  State<_VaccineFormSheet> createState() => _VaccineFormSheetState();
}

class _VaccineFormSheetState extends State<_VaccineFormSheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _diseaseController = TextEditingController();
  final _supplierController = TextEditingController();
  final _batchController = TextEditingController();
  final _quantityController = TextEditingController();
  final _costController = TextEditingController();
  final _notesController = TextEditingController();

  DateTime _expiryDate = DateTime.now().add(const Duration(days: 30));
  String _status = 'available';
  bool _saving = false;

  static const _statuses = ['available', 'in_use', 'expired', 'depleted'];

  @override
  void initState() {
    super.initState();
    if (widget.vaccine != null) {
      _nameController.text = widget.vaccine!.name;
      _diseaseController.text = widget.vaccine!.disease ?? '';
      _supplierController.text = widget.vaccine!.supplier ?? '';
      _batchController.text = widget.vaccine!.batchNumber;
      _quantityController.text = '${widget.vaccine!.quantityDoses}';
      _costController.text = widget.vaccine!.costZmw?.toString() ?? '';
      _notesController.text = widget.vaccine!.notes ?? '';
      _expiryDate = widget.vaccine!.expiryDate;
      _status = widget.vaccine!.status;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _diseaseController.dispose();
    _supplierController.dispose();
    _batchController.dispose();
    _quantityController.dispose();
    _costController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _pickExpiryDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _expiryDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked != null) setState(() => _expiryDate = picked);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final body = {
        'name': _nameController.text.trim(),
        'batchNumber': _batchController.text.trim(),
        'quantityDoses': int.parse(_quantityController.text),
        'expiryDate': _expiryDate.toIso8601String().split('T').first,
        'status': _status,
        if (_diseaseController.text.trim().isNotEmpty)
          'disease': _diseaseController.text.trim(),
        if (_supplierController.text.trim().isNotEmpty)
          'supplier': _supplierController.text.trim(),
        if (_costController.text.trim().isNotEmpty)
          'costZmw': double.tryParse(_costController.text.trim()),
        if (_notesController.text.trim().isNotEmpty)
          'notes': _notesController.text.trim(),
      };

      if (widget.vaccine == null) {
        await VaccineInventoryService.create(body);
      } else {
        await VaccineInventoryService.update(widget.vaccine!.id, body);
      }
      if (!mounted) return;
      widget.onChanged();
      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Save failed: $e')),
      );
      setState(() => _saving = false);
    }
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete vaccine?'),
        content: Text(
            'Delete ${widget.vaccine!.name} from inventory? This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    if (!mounted) return;
    setState(() => _saving = true);
    try {
      await VaccineInventoryService.delete(widget.vaccine!.id);
      if (!mounted) return;
      widget.onChanged();
      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Delete failed: $e')),
      );
      setState(() => _saving = false);
    }
  }

  String _formatStatus(String status) {
    return status
        .split('_')
        .map((s) => s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}')
        .join(' ');
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.vaccine != null;

    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Text(
                isEdit ? 'Edit Vaccine' : 'Add Vaccine',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: 'Vaccine name *'),
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _diseaseController,
                decoration:
                    const InputDecoration(labelText: 'Disease (optional)'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _supplierController,
                decoration:
                    const InputDecoration(labelText: 'Supplier (optional)'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _batchController,
                decoration: const InputDecoration(labelText: 'Batch number *'),
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _quantityController,
                decoration:
                    const InputDecoration(labelText: 'Quantity (doses) *'),
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                validator: (v) {
                  final n = int.tryParse(v ?? '');
                  if (n == null || n < 0) return 'Enter 0 or more';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Expiry date *'),
                subtitle: Text(
                  '${_expiryDate.year.toString().padLeft(4, '0')}-${_expiryDate.month.toString().padLeft(2, '0')}-${_expiryDate.day.toString().padLeft(2, '0')}',
                ),
                trailing: const Icon(Icons.calendar_today),
                onTap: _pickExpiryDate,
              ),
              const SizedBox(height: 4),
              DropdownButtonFormField<String>(
                key: ValueKey(_status),
                initialValue: _status,
                decoration: const InputDecoration(labelText: 'Status'),
                items: _statuses
                    .map((s) => DropdownMenuItem(
                        value: s, child: Text(_formatStatus(s))))
                    .toList(),
                onChanged: (v) => setState(() => _status = v!),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _costController,
                decoration:
                    const InputDecoration(labelText: 'Cost (ZMW, optional)'),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _notesController,
                decoration:
                    const InputDecoration(labelText: 'Notes (optional)'),
                maxLines: 3,
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.save),
                label: Text(isEdit ? 'Update Vaccine' : 'Save Vaccine'),
              ),
              if (isEdit && AuthService.canDelete) ...[
                const SizedBox(height: 8),
                TextButton.icon(
                  onPressed: _saving ? null : _delete,
                  icon: const Icon(Icons.delete, color: Colors.red),
                  label:
                      const Text('Delete', style: TextStyle(color: Colors.red)),
                ),
              ],
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }
}
