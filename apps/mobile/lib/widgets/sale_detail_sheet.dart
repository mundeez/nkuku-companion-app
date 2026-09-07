import 'package:flutter/material.dart';
import '../models/sale_record.dart';
import '../services/auth_service.dart';
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
            child: LinearProgressIndicator(
              value: pct,
              backgroundColor: Colors.grey.shade200,
              color: color,
              minHeight: 8,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('ZMW ${_fmt(paid)} paid', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
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
