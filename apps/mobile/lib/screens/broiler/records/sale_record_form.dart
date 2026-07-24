import 'package:flutter/material.dart';
import '../../../models/sale_record.dart';
import '../../../services/auth_service.dart';
import '../../../services/broiler_service.dart';

class SaleRecordForm extends StatefulWidget {
  final String flockId;
  final SaleRecord? record;

  const SaleRecordForm({super.key, required this.flockId, this.record});

  @override
  State<SaleRecordForm> createState() => _SaleRecordFormState();
}

class _SaleRecordFormState extends State<SaleRecordForm> {
  final _formKey = GlobalKey<FormState>();
  final _customerNameController = TextEditingController();
  final _customerPhoneController = TextEditingController();
  final _birdCountController = TextEditingController();
  final _avgWeightController = TextEditingController();
  final _pricePerBirdController = TextEditingController();
  final _amountPaidController = TextEditingController();
  final _notesController = TextEditingController();
  DateTime _saleDate = DateTime.now();
  String _paymentStatus = 'pending';
  bool _saving = false;
  String? _error;

  final _paymentStatuses = ['pending', 'partial', 'paid'];

  @override
  void initState() {
    super.initState();
    if (widget.record != null) {
      final r = widget.record!;
      _customerNameController.text = r.customerName ?? '';
      _customerPhoneController.text = r.customerPhone ?? '';
      _birdCountController.text = '${r.birdCount}';
      _avgWeightController.text = r.avgWeightKg?.toString() ?? '';
      _pricePerBirdController.text = '${r.pricePerBirdZmw}';
      _amountPaidController.text = r.amountPaidZmw?.toString() ?? '';
      _notesController.text = r.notes ?? '';
      _saleDate = r.saleDate;
      _paymentStatus = _paymentStatuses.contains(r.paymentStatus) ? r.paymentStatus : 'pending';
    }
  }

  @override
  void dispose() {
    _customerNameController.dispose();
    _customerPhoneController.dispose();
    _birdCountController.dispose();
    _avgWeightController.dispose();
    _pricePerBirdController.dispose();
    _amountPaidController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _saleDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null) setState(() => _saleDate = picked);
  }

  double get _computedTotal {
    final birdCount = int.tryParse(_birdCountController.text) ?? 0;
    final price = double.tryParse(_pricePerBirdController.text) ?? 0;
    return birdCount * price;
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final record = SaleRecord(
        id: widget.record?.id ?? '',
        flockId: widget.flockId,
        saleDate: _saleDate,
        customerName: _customerNameController.text.trim().isEmpty ? null : _customerNameController.text.trim(),
        customerPhone: _customerPhoneController.text.trim().isEmpty ? null : _customerPhoneController.text.trim(),
        birdCount: int.parse(_birdCountController.text),
        avgWeightKg: double.tryParse(_avgWeightController.text),
        pricePerBirdZmw: double.parse(_pricePerBirdController.text),
        totalAmountZmw: _computedTotal,
        paymentStatus: _paymentStatus,
        amountPaidZmw: _paymentStatus == 'partial'
            ? (double.tryParse(_amountPaidController.text) ?? 0)
            : null,
        notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
      );

      if (widget.record == null) {
        await BroilerService.createSaleRecord(record);
      } else {
        await BroilerService.updateSaleRecord(widget.record!.id, record);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() {
        _error = e.toString();
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!AuthService.canManageSales) {
      return Scaffold(
        appBar: AppBar(title: Text(widget.record == null ? 'New Sale' : 'Edit Sale')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'You do not have permission to manage sales records.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16, color: Colors.grey),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(widget.record == null ? 'New Sale Record' : 'Edit Sale Record')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Sale date'),
                subtitle: Text(_saleDate.toIso8601String().split('T').first),
                trailing: const Icon(Icons.calendar_today),
                onTap: _pickDate,
              ),
              TextFormField(
                controller: _customerNameController,
                decoration: const InputDecoration(labelText: 'Customer name (optional)'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _customerPhoneController,
                decoration: const InputDecoration(labelText: 'Customer phone (optional)'),
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _birdCountController,
                decoration: const InputDecoration(labelText: 'Bird count'),
                keyboardType: TextInputType.number,
                validator: (v) {
                  final n = int.tryParse(v ?? '');
                  if (n == null || n <= 0) return 'Enter a number greater than 0';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _avgWeightController,
                decoration: const InputDecoration(labelText: 'Avg weight (kg, optional)'),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _pricePerBirdController,
                decoration: const InputDecoration(labelText: 'Price per bird (ZMW)'),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                validator: (v) {
                  final n = double.tryParse(v ?? '');
                  if (n == null || n < 0) return 'Enter a valid price';
                  return null;
                },
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total amount', style: TextStyle(fontWeight: FontWeight.bold)),
                      Text(
                        'ZMW ${_computedTotal.toStringAsFixed(2)}',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.green),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                key: ValueKey(_paymentStatus),
                initialValue: _paymentStatus,
                decoration: const InputDecoration(labelText: 'Payment status'),
                items: _paymentStatuses
                    .map((s) => DropdownMenuItem(value: s, child: Text(s[0].toUpperCase() + s.substring(1))))
                    .toList(),
                onChanged: (v) => setState(() => _paymentStatus = v!),
              ),
              if (_paymentStatus == 'partial') ...[
                const SizedBox(height: 12),
                TextFormField(
                  controller: _amountPaidController,
                  decoration: const InputDecoration(labelText: 'Amount paid (ZMW)'),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  validator: (v) {
                    final n = double.tryParse(v ?? '');
                    if (n == null || n < 0) return 'Enter a valid amount';
                    return null;
                  },
                ),
              ],
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
