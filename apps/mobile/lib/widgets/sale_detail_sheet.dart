import 'package:flutter/material.dart';
import '../models/sale_record.dart';
import '../services/auth_service.dart';
import '../services/broiler_service.dart';
import 'attachment_section.dart';

/// A bottom sheet that shows full sale record details:
/// - Payment breakdown with progress bar
/// - Customer info (name, phone with tap-to-call)
/// - Notes
/// - Attachments
/// - Edit / Delete actions
class SaleDetailSheet extends StatelessWidget {
  final SaleRecord sale;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;

  const SaleDetailSheet({
    super.key,
    required this.sale,
    this.onEdit,
    this.onDelete,
  });

  /// Opens the sheet as a modal bottom sheet.
  static Future<void> show(
    BuildContext context, {
    required SaleRecord sale,
    VoidCallback? onEdit,
    VoidCallback? onDelete,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (ctx, controller) => SaleDetailSheet(
          sale: sale,
          onEdit: onEdit,
          onDelete: onDelete,
        ),
      ),
    );
  }

  String _fmt(double n) => n.toStringAsFixed(2);

  @override
  Widget build(BuildContext context) {
    final total = sale.totalAmountZmw;
    final paid = sale.amountPaidZmw ?? 0;
    final remaining = total - paid;
    final pct = total > 0 ? (paid / total).clamp(0.0, 1.0) : 0.0;

    final color = sale.paymentStatus == 'paid'
        ? Colors.green
        : sale.paymentStatus == 'partial'
            ? Colors.amber
            : Colors.red;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            margin: const EdgeInsets.only(top: 8, bottom: 4),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                Icon(Icons.attach_money, color: Colors.grey.shade600),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Sale Details',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      Text(
                        '${sale.saleDate.toIso8601String().split('T').first} — ${sale.flockName ?? 'Flock'}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          // Content
          Flexible(
            child: ListView(
              padding: const EdgeInsets.all(16),
              shrinkWrap: true,
              children: [
                // Payment Breakdown
                _sectionTitle(context, 'Payment Breakdown'),
                const SizedBox(height: 8),
                _paymentCard(total, paid, remaining, pct, color),
                const SizedBox(height: 16),

                // Sale Info
                _sectionTitle(context, 'Sale Information'),
                const SizedBox(height: 8),
                _infoCard([
                  _infoRow('Birds sold', '${sale.birdCount}'),
                  _infoRow('Avg weight', sale.avgWeightKg != null ? '${sale.avgWeightKg!.toStringAsFixed(2)} kg' : '—'),
                  _infoRow('Price per bird', 'ZMW ${_fmt(sale.pricePerBirdZmw)}'),
                  _infoRow('Total amount', 'ZMW ${_fmt(total)}'),
                ]),
                const SizedBox(height: 16),

                // Customer Info
                _sectionTitle(context, 'Customer'),
                const SizedBox(height: 8),
                _infoCard([
                  _infoRow('Name', sale.customerName ?? 'Walk-in'),
                  if (sale.customerPhone != null && sale.customerPhone!.isNotEmpty)
                    _infoRow('Phone', sale.customerPhone!),
                ]),
                if (sale.customerPhone != null && sale.customerPhone!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.phone, size: 16),
                      label: Text(sale.customerPhone!),
                      onPressed: () {
                        // Phone dialing would require url_launcher
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Call: ${sale.customerPhone}')),
                        );
                      },
                    ),
                  ),
                ],
                const SizedBox(height: 16),

                // Notes
                _sectionTitle(context, 'Notes'),
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey.shade300),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: sale.notes != null && sale.notes!.isNotEmpty
                      ? Text(sale.notes!, style: const TextStyle(fontSize: 14))
                      : Text('No notes', style: TextStyle(fontSize: 14, color: Colors.grey.shade500, fontStyle: FontStyle.italic)),
                ),
                const SizedBox(height: 16),

                // Payment history
                _sectionTitle(context, 'Payments'),
                const SizedBox(height: 8),
                SalePaymentsSection(sale: sale, onChanged: () => Navigator.pop(context)),
                const SizedBox(height: 16),

                // Attachments
                _sectionTitle(context, 'Attachments'),
                const SizedBox(height: 8),
                AttachmentSection(
                  saleRecordId: sale.id,
                  title: 'Documents',
                ),
                const SizedBox(height: 16),

                // Actions
                if (AuthService.canManageSales || AuthService.isOwner) ...[
                  Row(
                    children: [
                      if (AuthService.canManageSales)
                        Expanded(
                          child: OutlinedButton.icon(
                            icon: const Icon(Icons.edit, size: 16),
                            label: const Text('Edit'),
                            onPressed: () {
                              Navigator.pop(context);
                              onEdit?.call();
                            },
                          ),
                        ),
                      if (AuthService.canManageSales && AuthService.isOwner)
                        const SizedBox(width: 8),
                      if (AuthService.isOwner)
                        Expanded(
                          child: OutlinedButton.icon(
                            icon: const Icon(Icons.delete, size: 16, color: Colors.red),
                            label: const Text('Delete', style: TextStyle(color: Colors.red)),
                            onPressed: () {
                              Navigator.pop(context);
                              onDelete?.call();
                            },
                          ),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(BuildContext context, String title) {
    return Text(
      title,
      style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
    );
  }

  Widget _paymentCard(double total, double paid, double remaining, double pct, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.circle, size: 8, color: color),
              const SizedBox(width: 6),
              Text(
                sale.paymentStatus[0].toUpperCase() + sale.paymentStatus.substring(1),
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: Stack(
              alignment: Alignment.center,
              children: [
                LinearProgressIndicator(
                  value: pct,
                  backgroundColor: Colors.grey.shade200,
                  color: color,
                  minHeight: 14,
                ),
                Text('${(pct * 100).round()}%',
                    style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text.rich(
                TextSpan(children: [
                  TextSpan(text: 'Paid ZMW ${_fmt(paid)} · '),
                  TextSpan(
                    text: 'Due ZMW ${_fmt(remaining)}',
                    style: TextStyle(color: remaining > 0 ? Colors.orange.shade700 : Colors.grey.shade600),
                  ),
                ]),
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
              ),
              Text('ZMW ${_fmt(total)} total', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            ],
          ),
          if (sale.paymentStatus == 'partial')
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'ZMW ${_fmt(remaining)} remaining',
                style: TextStyle(fontSize: 13, color: color, fontWeight: FontWeight.w500),
              ),
            ),
          if (sale.paymentStatus == 'paid')
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'Fully paid',
                style: TextStyle(fontSize: 13, color: color, fontWeight: FontWeight.w500),
              ),
            ),
          if (sale.paymentStatus == 'pending')
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'ZMW ${_fmt(total)} unpaid',
                style: TextStyle(fontSize: 13, color: color, fontWeight: FontWeight.w500),
              ),
            ),
        ],
      ),
    );
  }

  Widget _infoCard(List<Widget> rows) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(children: rows),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 14, color: Colors.grey.shade600)),
          Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

/// Payment history for a sale: list of entries, "Record payment" form,
/// owner-only delete. Calls [onChanged] after a successful mutation so the
/// host screen can reload its sale lists.
class SalePaymentsSection extends StatefulWidget {
  final SaleRecord sale;
  final VoidCallback? onChanged;

  const SalePaymentsSection({super.key, required this.sale, this.onChanged});

  @override
  State<SalePaymentsSection> createState() => _SalePaymentsSectionState();
}

class _SalePaymentsSectionState extends State<SalePaymentsSection> {
  List<SalePayment> _payments = [];
  bool _loading = true;

  static const _methodLabels = {
    'cash': 'Cash',
    'mobile_money_airtel': 'Mobile Money — Airtel',
    'mobile_money_mtn': 'Mobile Money — MTN',
    'mobile_money_zamtel': 'Mobile Money — Zamtel',
    'bank_transfer': 'Bank Transfer',
    'other': 'Other',
    'adjustment': 'Adjustment',
    'opening_balance': 'Opening balance',
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final payments = await BroilerService.getSalePayments(widget.sale.id);
      if (!mounted) return;
      setState(() {
        _payments = payments;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  double get _due =>
      (widget.sale.totalAmountZmw - (widget.sale.amountPaidZmw ?? 0))
          .clamp(0.0, double.infinity);

  Future<void> _recordPayment() async {
    final amountCtrl =
        TextEditingController(text: _due > 0 ? _due.toStringAsFixed(2) : '');
    final refCtrl = TextEditingController();
    final noteCtrl = TextEditingController();
    String method = 'cash';
    DateTime paidAt = DateTime.now();
    String? error;
    bool saving = false;

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Record payment',
                  style: Theme.of(ctx).textTheme.titleMedium),
              const SizedBox(height: 12),
              TextField(
                controller: amountCtrl,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration:
                    const InputDecoration(labelText: 'Amount (ZMW)'),
              ),
              const SizedBox(height: 8),
              InkWell(
                onTap: () async {
                  final d = await showDatePicker(
                    context: ctx,
                    initialDate: paidAt,
                    firstDate: DateTime(2020),
                    lastDate: DateTime.now().add(const Duration(days: 1)),
                  );
                  if (d != null) setSheet(() => paidAt = d);
                },
                child: InputDecorator(
                  decoration: const InputDecoration(labelText: 'Date'),
                  child:
                      Text(paidAt.toIso8601String().split('T').first),
                ),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: method,
                decoration: const InputDecoration(labelText: 'Method'),
                items: const [
                  DropdownMenuItem(value: 'cash', child: Text('Cash')),
                  DropdownMenuItem(
                      value: 'mobile_money_airtel',
                      child: Text('Mobile Money — Airtel')),
                  DropdownMenuItem(
                      value: 'mobile_money_mtn',
                      child: Text('Mobile Money — MTN')),
                  DropdownMenuItem(
                      value: 'mobile_money_zamtel',
                      child: Text('Mobile Money — Zamtel')),
                  DropdownMenuItem(
                      value: 'bank_transfer',
                      child: Text('Bank Transfer')),
                  DropdownMenuItem(value: 'other', child: Text('Other')),
                ],
                onChanged: (v) => setSheet(() => method = v ?? 'cash'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: refCtrl,
                decoration:
                    const InputDecoration(labelText: 'Reference (optional)'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: noteCtrl,
                decoration:
                    const InputDecoration(labelText: 'Note (optional)'),
              ),
              if (error != null) ...[
                const SizedBox(height: 8),
                Text(error!,
                    style: TextStyle(
                        color: Theme.of(ctx).colorScheme.error,
                        fontSize: 12)),
              ],
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: saving
                      ? null
                      : () async {
                          final amount =
                              double.tryParse(amountCtrl.text.trim()) ?? 0;
                          if (amount <= 0) {
                            setSheet(() =>
                                error = 'Enter an amount greater than zero');
                            return;
                          }
                          setSheet(() {
                            saving = true;
                            error = null;
                          });
                          try {
                            await BroilerService.recordSalePayment(
                              widget.sale.id,
                              {
                                'amountZmw': amount,
                                'paidAt':
                                    paidAt.toIso8601String().split('T').first,
                                'method': method,
                                if (refCtrl.text.trim().isNotEmpty)
                                  'reference': refCtrl.text.trim(),
                                if (noteCtrl.text.trim().isNotEmpty)
                                  'note': noteCtrl.text.trim(),
                              },
                            );
                            if (ctx.mounted) Navigator.pop(ctx, true);
                          } on BroilerServiceException catch (e) {
                            setSheet(() {
                              saving = false;
                              error = e.message;
                            });
                          }
                        },
                  child: Text(saving ? 'Saving…' : 'Save payment'),
                ),
              ),
            ],
          ),
        ),
      ),
    );

    if (saved == true) {
      await _load();
      widget.onChanged?.call();
    }
  }

  Future<void> _deletePayment(SalePayment p) async {
    try {
      await BroilerService.deleteSalePayment(widget.sale.id, p.id);
      await _load();
      widget.onChanged?.call();
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final canRecord = AuthService.canManageSales && _due > 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_loading)
          const Padding(
            padding: EdgeInsets.all(8),
            child: Center(
                child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2))),
          )
        else if (_payments.isEmpty)
          Padding(
            padding: const EdgeInsets.all(8),
            child: Text('No payments recorded',
                style: TextStyle(
                    fontSize: 13,
                    color: Colors.grey.shade500,
                    fontStyle: FontStyle.italic)),
          )
        else
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey.shade300),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              children: [
                for (var i = 0; i < _payments.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  Builder(builder: (context) {
                    final p = _payments[i];
                    final muted = p.method == 'adjustment' ||
                        p.method == 'opening_balance';
                    return Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      p.amountZmw < 0
                                          ? '− ZMW ${(-p.amountZmw).toStringAsFixed(2)}'
                                          : 'ZMW ${p.amountZmw.toStringAsFixed(2)}',
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: muted
                                            ? FontWeight.normal
                                            : FontWeight.w500,
                                        color: muted
                                            ? Colors.grey.shade600
                                            : null,
                                      ),
                                    ),
                                    Text(
                                      p.paidAt
                                          .toIso8601String()
                                          .split('T')
                                          .first,
                                      style: TextStyle(
                                          fontSize: 11,
                                          color: Colors.grey.shade600),
                                    ),
                                  ],
                                ),
                                Text(
                                  [
                                    _methodLabels[p.method] ?? p.method,
                                    if (p.reference != null &&
                                        p.reference!.isNotEmpty)
                                      p.reference!,
                                    if (p.note != null && p.note!.isNotEmpty)
                                      p.note!,
                                  ].join(' · '),
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.grey.shade600,
                                    fontStyle: muted
                                        ? FontStyle.italic
                                        : FontStyle.normal,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (AuthService.isOwner && !muted)
                            IconButton(
                              icon: const Icon(Icons.delete_outline, size: 18),
                              color: Theme.of(context).colorScheme.error,
                              onPressed: () => _deletePayment(p),
                            ),
                        ],
                      ),
                    );
                  }),
                ],
              ],
            ),
          ),
        if (canRecord) ...[
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _recordPayment,
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Record payment'),
            ),
          ),
        ],
      ],
    );
  }
}
