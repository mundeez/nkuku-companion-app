import 'package:flutter/material.dart';
import '../models/sales_filter.dart';

/// A bottom-sheet filter panel for sales queries.
///
/// Presents date range, payment status, flock selector (optional), and
/// customer search. Returns a [SalesFilter] to the caller when applied.
class SalesFilterSheet extends StatefulWidget {
  final SalesFilter currentFilter;
  final bool showFlockFilter;
  final List<Map<String, dynamic>>? flocks;

  const SalesFilterSheet({
    super.key,
    required this.currentFilter,
    this.showFlockFilter = false,
    this.flocks,
  });

  /// Opens the sheet as a modal bottom sheet and returns the selected filter.
  static Future<SalesFilter?> show(
    BuildContext context, {
    required SalesFilter currentFilter,
    bool showFlockFilter = false,
    List<Map<String, dynamic>>? flocks,
  }) {
    return showModalBottomSheet<SalesFilter>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => SalesFilterSheet(
        currentFilter: currentFilter,
        showFlockFilter: showFlockFilter,
        flocks: flocks,
      ),
    );
  }

  @override
  State<SalesFilterSheet> createState() => _SalesFilterSheetState();
}

class _SalesFilterSheetState extends State<SalesFilterSheet> {
  late DateTime? _fromDate;
  late DateTime? _toDate;
  late String? _paymentStatus;
  late String? _flockId;
  late TextEditingController _customerController;

  @override
  void initState() {
    super.initState();
    _fromDate = widget.currentFilter.fromDate;
    _toDate = widget.currentFilter.toDate;
    _paymentStatus = widget.currentFilter.paymentStatus;
    _flockId = widget.currentFilter.flockId;
    _customerController =
        TextEditingController(text: widget.currentFilter.customerQuery ?? '');
  }

  @override
  void dispose() {
    _customerController.dispose();
    super.dispose();
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
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Filter Sales',
                    style:
                        TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                TextButton(
                  onPressed: _clearAll,
                  child: const Text('Clear All'),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Date range
            const Text('Date Range',
                style: TextStyle(fontWeight: FontWeight.w500)),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _DateField(
                    label: 'From',
                    date: _fromDate,
                    onPicked: (d) => setState(() => _fromDate = d),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _DateField(
                    label: 'To',
                    date: _toDate,
                    onPicked: (d) => setState(() => _toDate = d),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Payment status chips
            const Text('Payment Status',
                style: TextStyle(fontWeight: FontWeight.w500)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                _buildStatusChip(null, 'All'),
                _buildStatusChip('pending', 'Pending'),
                _buildStatusChip('partial', 'Partial'),
                _buildStatusChip('paid', 'Paid'),
              ],
            ),
            const SizedBox(height: 16),

            // Flock selector (optional)
            if (widget.showFlockFilter && widget.flocks != null) ...[
              const Text('Flock', style: TextStyle(fontWeight: FontWeight.w500)),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: _flockId,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                items: [
                  const DropdownMenuItem(value: null, child: Text('All Flocks')),
                  ...widget.flocks!.map((f) => DropdownMenuItem(
                        value: f['id'] as String,
                        child: Text(f['name'] as String? ?? 'Unknown'),
                      )),
                ],
                onChanged: (v) => setState(() => _flockId = v),
              ),
              const SizedBox(height: 16),
            ],

            // Customer search
            const Text('Customer Search',
                style: TextStyle(fontWeight: FontWeight.w500)),
            const SizedBox(height: 8),
            TextField(
              controller: _customerController,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                hintText: 'Search by name or phone...',
                contentPadding:
                    EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                prefixIcon: Icon(Icons.search),
              ),
            ),
            const SizedBox(height: 24),

            // Action buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: _apply,
                    child: const Text('Apply'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusChip(String? value, String label) {
    final selected = _paymentStatus == value;
    return FilterChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => setState(() => _paymentStatus = value),
    );
  }

  void _clearAll() {
    setState(() {
      _fromDate = null;
      _toDate = null;
      _paymentStatus = null;
      _flockId = null;
      _customerController.clear();
    });
  }

  void _apply() {
    final filter = SalesFilter(
      fromDate: _fromDate,
      toDate: _toDate,
      paymentStatus: _paymentStatus,
      flockId: _flockId,
      customerQuery: _customerController.text.isEmpty
          ? null
          : _customerController.text,
      limit: widget.currentFilter.limit,
      offset: 0,
    );
    Navigator.pop(context, filter);
  }
}

class _DateField extends StatelessWidget {
  final String label;
  final DateTime? date;
  final ValueChanged<DateTime?> onPicked;

  const _DateField({
    required this.label,
    required this.date,
    required this.onPicked,
  });

  @override
  Widget build(BuildContext context) {
    final text = date == null
        ? label
        : '${date!.year}-${date!.month.toString().padLeft(2, '0')}-${date!.day.toString().padLeft(2, '0')}';
    return InkWell(
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: date ?? DateTime.now(),
          firstDate: DateTime(2020),
          lastDate: DateTime(2100),
        );
        if (picked != null) onPicked(picked);
      },
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        ),
        child: Text(date == null ? 'Select' : text),
      ),
    );
  }
}
