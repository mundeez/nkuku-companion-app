import 'package:flutter/material.dart';
import '../models/sale_record.dart';
import '../models/sales_filter.dart';
import '../services/auth_service.dart';
import '../services/broiler_service.dart';
import '../widgets/skeleton.dart';
import '../widgets/stat_card.dart';
import '../widgets/sales_filter_sheet.dart';
import 'broiler/records/sale_record_form.dart';

/// Global sales dashboard — mirrors the web app's `/sales` page.
/// Shows org-wide sales KPIs, payment breakdown, and a sortable list of
/// all sale records across flocks. Accessible from the Finance Hub.
class SalesDashboardScreen extends StatefulWidget {
  const SalesDashboardScreen({super.key});

  @override
  State<SalesDashboardScreen> createState() => _SalesDashboardScreenState();
}

class _SalesDashboardScreenState extends State<SalesDashboardScreen> {
  Map<String, dynamic>? _summary;
  List<SaleRecord> _sales = [];
  int _totalSales = 0;
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  SalesFilter _filter = const SalesFilter(limit: 20, offset: 0);
  final List<Map<String, dynamic>> _flocks = [];

  @override
  void initState() {
    super.initState();
    _load();
    _loadFlocks();
  }

  Future<void> _loadFlocks() async {
    try {
      final flocks = await BroilerService.getFlocks();
      if (mounted) {
        setState(() {
          _flocks.clear();
          for (final f in flocks) {
            _flocks.add({'id': f.id, 'name': f.name});
          }
        });
      }
    } catch (_) {
      // Non-critical
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dashboardData = await BroilerService.getSalesDashboard(filter: _filter);
      final allSalesResult = await BroilerService.getAllSales(filter: _filter);
      if (mounted) {
        setState(() {
          _summary = dashboardData;
          _sales = allSalesResult.items;
          _totalSales = allSalesResult.total;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || _sales.length >= _totalSales) return;
    setState(() => _loadingMore = true);
    try {
      final nextFilter = _filter.copyWith(offset: _sales.length);
      final result = await BroilerService.getAllSales(filter: nextFilter);
      if (mounted) {
        setState(() {
          _sales.addAll(result.items);
          _loadingMore = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  Future<void> _openFilter() async {
    final result = await SalesFilterSheet.show(
      context,
      currentFilter: _filter,
      showFlockFilter: true,
      flocks: _flocks,
    );
    if (result != null) {
      setState(() => _filter = result);
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Sales Dashboard'),
        actions: [
          IconButton(
            icon: Badge(
              isLabelVisible: _filter.activeCount > 0,
              label: Text('${_filter.activeCount}'),
              child: const Icon(Icons.filter_list),
            ),
            onPressed: _openFilter,
          ),
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _loading
          ? const SkeletonList()
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_error!, style: const TextStyle(color: Colors.red)),
                      const SizedBox(height: 16),
                      ElevatedButton(
                          onPressed: _load, child: const Text('Retry')),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (_filter.activeCount > 0) _buildActiveFilterChips(),
                      _buildKpiCards(),
                      const SizedBox(height: 16),
                      _buildPaymentBreakdown(),
                      const SizedBox(height: 16),
                      _buildSalesList(),
                    ],
                  ),
                ),
      floatingActionButton: AuthService.canManageSales
          ? FloatingActionButton(
              onPressed: _navigateToCreate,
              child: const Icon(Icons.add),
            )
          : null,
    );
  }

  Widget _buildActiveFilterChips() {
    final chips = <Widget>[];
    if (_filter.fromDate != null) {
      chips.add(_filterChip('From: ${_formatDate(_filter.fromDate!)}',
          () => setState(() {
            _filter = _filter.copyWith(clearFromDate: true);
            _load();
          })));
    }
    if (_filter.toDate != null) {
      chips.add(_filterChip('To: ${_formatDate(_filter.toDate!)}',
          () => setState(() {
            _filter = _filter.copyWith(clearToDate: true);
            _load();
          })));
    }
    if (_filter.paymentStatus != null && _filter.paymentStatus!.isNotEmpty) {
      chips.add(_filterChip(
          'Payment: ${_filter.paymentStatus![0].toUpperCase()}${_filter.paymentStatus!.substring(1)}',
          () => setState(() {
            _filter = _filter.copyWith(clearPaymentStatus: true);
            _load();
          })));
    }
    if (_filter.flockId != null && _filter.flockId!.isNotEmpty) {
      final flockName = _flocks
          .where((f) => f['id'] == _filter.flockId)
          .map((f) => f['name'] as String?)
          .firstWhere((_) => true, orElse: () => 'Flock');
      chips.add(_filterChip('Flock: $flockName', () => setState(() {
            _filter = _filter.copyWith(clearFlockId: true);
            _load();
          })));
    }
    if (_filter.customerQuery != null && _filter.customerQuery!.isNotEmpty) {
      chips.add(_filterChip('Search: "${_filter.customerQuery}"',
          () => setState(() {
            _filter = _filter.copyWith(clearCustomerQuery: true);
            _load();
          })));
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Wrap(spacing: 8, children: chips),
    );
  }

  Widget _filterChip(String label, VoidCallback onDeleted) {
    return Chip(
      label: Text(label, style: const TextStyle(fontSize: 12)),
      deleteIcon: const Icon(Icons.close, size: 16),
      onDeleted: onDeleted,
    );
  }

  Widget _buildKpiCards() {
    final s = _summary;
    final totalRevenue = _toDouble(s?['totalRevenue']);
    final totalBirds = s?['totalBirdsSold'] ?? 0;
    final totalPaid = _toDouble(s?['totalPaid']);
    final outstanding = _toDouble(s?['outstanding']);
    final salesCount = s?['salesCount'] ?? 0;

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: StatCard(
                label: 'Total Revenue',
                value: 'ZMW ${totalRevenue.toStringAsFixed(2)}',
                color: Colors.green,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: StatCard(
                label: 'Birds Sold',
                value: '$totalBirds',
                color: Colors.teal,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: StatCard(
                label: 'Paid',
                value: 'ZMW ${totalPaid.toStringAsFixed(2)}',
                color: Colors.blue,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: StatCard(
                label: 'Outstanding',
                value: 'ZMW ${outstanding.toStringAsFixed(2)}',
                color: Colors.orange,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: StatCard(
                label: 'Sales Count',
                value: '$salesCount',
                color: Colors.purple,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: StatCard(
                label: 'Avg Price/Bird',
                value: 'ZMW ${_toDouble(s?['avgPricePerBird']).toStringAsFixed(2)}',
                color: Colors.indigo,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildPaymentBreakdown() {
    final breakdown = _summary?['paymentBreakdown'] as List? ?? [];
    if (breakdown.isEmpty) return const SizedBox.shrink();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Payment Breakdown',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            ...breakdown.map((b) {
              final status = b['paymentStatus'] ?? '';
              final count = b['count'] ?? 0;
              final amount = _toDouble(b['totalAmount']);
              final color = status == 'paid'
                  ? Colors.green
                  : status == 'partial'
                      ? Colors.orange
                      : Colors.grey;
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    Chip(
                      label: Text(
                        status[0].toUpperCase() + status.substring(1),
                        style: TextStyle(fontSize: 12, color: color),
                      ),
                      backgroundColor: color.withAlpha(30),
                    ),
                    const SizedBox(width: 12),
                    Text('$count sale${count == 1 ? '' : 's'}'),
                    const Spacer(),
                    Text('ZMW ${amount.toStringAsFixed(2)}',
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _buildSalesList() {
    if (_sales.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Column(
            children: [
              Icon(Icons.point_of_sale_outlined, size: 64, color: Colors.grey),
              SizedBox(height: 12),
              Text('No sale records found for the current filters.',
                  style: TextStyle(color: Colors.grey),
                  textAlign: TextAlign.center),
            ],
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('All Sales ($_totalSales)',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        ..._sales.map(_buildSaleTile),
        if (_sales.length < _totalSales)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Center(
              child: _loadingMore
                  ? const CircularProgressIndicator()
                  : TextButton.icon(
                      onPressed: _loadMore,
                      icon: const Icon(Icons.expand_more),
                      label: const Text('Load More'),
                    ),
            ),
          ),
      ],
    );
  }

  Widget _buildSaleTile(SaleRecord r) {
    final statusColor = r.paymentStatus == 'paid'
        ? Colors.green
        : r.paymentStatus == 'partial'
            ? Colors.orange
            : Colors.grey;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        title: Text(r.saleDate.toIso8601String().split('T').first),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (r.flockName != null && r.flockName!.isNotEmpty)
              Text('Flock: ${r.flockName}',
                  style: const TextStyle(fontWeight: FontWeight.w500)),
            if (r.customerName != null && r.customerName!.isNotEmpty)
              Text('Customer: ${r.customerName}'),
            Text(
                '${r.birdCount} birds · ZMW ${r.pricePerBirdZmw.toStringAsFixed(2)}/bird · Total: ZMW ${r.totalAmountZmw.toStringAsFixed(2)}'),
            if (r.amountPaidZmw != null && r.paymentStatus != 'pending')
              Text('Paid: ZMW ${r.amountPaidZmw!.toStringAsFixed(2)}',
                  style: TextStyle(
                      fontSize: 12,
                      color: r.paymentStatus == 'paid'
                          ? Colors.green
                          : Colors.orange)),
            if (r.avgWeightKg != null)
              Text('Avg weight: ${r.avgWeightKg} kg'),
          ],
        ),
        trailing: Chip(
          label: Text(
            r.paymentStatus,
            style: TextStyle(fontSize: 10, color: statusColor),
          ),
          backgroundColor: statusColor.withAlpha(30),
        ),
        onTap: AuthService.canManageSales
            ? () async {
                final result = await Navigator.push<bool>(
                  context,
                  MaterialPageRoute(
                    builder: (_) =>
                        SaleRecordForm(flockId: r.flockId, record: r),
                  ),
                );
                if (result == true) _load();
              }
            : null,
        onLongPress: AuthService.isOwner
            ? () async {
                final confirmed = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Delete sale record?'),
                    content: Text(
                        'Delete sale on ${r.saleDate.toIso8601String().split('T').first} (${r.birdCount} birds)?'),
                    actions: [
                      TextButton(
                          onPressed: () =>
                              Navigator.pop(ctx, false),
                          child: const Text('Cancel')),
                      TextButton(
                          onPressed: () =>
                              Navigator.pop(ctx, true),
                          child: const Text('Delete',
                              style:
                                  TextStyle(color: Colors.red))),
                    ],
                  ),
                );
                if (confirmed != true) return;
                try {
                  await BroilerService.deleteSaleRecord(r.id);
                  _load();
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                          content: Text('Delete failed: $e'),
                          backgroundColor: Colors.red),
                    );
                  }
                }
              }
            : null,
      ),
    );
  }

  void _navigateToCreate() async {
    // Need a flock ID for the form. Show a flock picker first.
    try {
      final flocks = await BroilerService.getFlocks(status: 'active');
      if (!mounted) return;
      if (flocks.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('No active flocks available. Create a flock first.')),
        );
        return;
      }
      final selectedFlock = await showDialog<dynamic>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Select Flock'),
          content: SizedBox(
            width: double.maxFinite,
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: flocks.length,
              itemBuilder: (_, i) => ListTile(
                title: Text(flocks[i].name),
                subtitle: Text(
                    '${flocks[i].currentCount} birds · Day ${flocks[i].ageDays ?? 0}'),
                onTap: () => Navigator.pop(ctx, flocks[i]),
              ),
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, null),
                child: const Text('Cancel')),
          ],
        ),
      );
      if (selectedFlock == null) return;
      if (!mounted) return;
      final result = await Navigator.push<bool>(
        context,
        MaterialPageRoute(
          builder: (_) => SaleRecordForm(flockId: selectedFlock.id),
        ),
      );
      if (result == true) _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load flocks: $e')),
        );
      }
    }
  }

  double _toDouble(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  String _formatDate(DateTime d) {
    final y = d.year.toString().padLeft(4, '0');
    final m = d.month.toString().padLeft(2, '0');
    final day = d.day.toString().padLeft(2, '0');
    return '$y-$m-$day';
  }
}
