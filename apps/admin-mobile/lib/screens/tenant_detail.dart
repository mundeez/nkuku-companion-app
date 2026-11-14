import 'package:flutter/material.dart';
import '../api.dart';

/// Tenant dossier — org info, plan, members, subscription, flock summary.
class TenantDetailScreen extends StatefulWidget {
  final String tenantId;
  final String? tenantName;
  const TenantDetailScreen({super.key, required this.tenantId, this.tenantName});

  @override
  State<TenantDetailScreen> createState() => _TenantDetailScreenState();
}

class _TenantDetailScreenState extends State<TenantDetailScreen> {
  Map<String, dynamic>? _data;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await Api.tenantDetail(widget.tenantId);
      if (mounted) setState(() { _data = d; _error = null; });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final org = _data?['organization'] as Map<String, dynamic>?;
    final members = (_data?['members'] as List?) ?? [];
    final subs = (_data?['subscriptions'] as List?) ?? [];
    final flocks = _data?['flocks'] as Map<String, dynamic>?;
    final support = _data?['supportTickets'] as Map<String, dynamic>?;
    final suspended = org?['suspendedAt'] != null;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.tenantName ?? org?['name'] ?? 'Tenant',
            maxLines: 1, overflow: TextOverflow.ellipsis),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text('Load failed: $_error',
                    style: const TextStyle(color: Colors.red)),
              ),
            if (org == null && _error == null)
              const Padding(
                padding: EdgeInsets.all(48),
                child: Center(child: CircularProgressIndicator()),
              ),
            if (suspended)
              Card(
                color: Colors.red.shade50,
                child: ListTile(
                  leading: const Icon(Icons.pause_circle, color: Colors.red),
                  title: const Text('SUSPENDED',
                      style: TextStyle(
                          color: Colors.red, fontWeight: FontWeight.bold)),
                  subtitle: Text('${org?['suspendedReason'] ?? ''}'),
                ),
              ),
            if (org != null) ...[
              _section('Organization', [
                _row('Name', '${org['name']}'),
                _row('Plan', '${org['effectivePlanCode'] ?? org['planCode'] ?? '-'}'),
                _row('Country', '${org['country'] ?? '-'}'),
                _row('Currency', '${org['currency'] ?? '-'}'),
                _row('Created', '${org['createdAt'] ?? '-'}'.substring(0, 10)),
                if (org['isDemo'] == true) _row('Demo org', 'yes'),
              ]),
              if (flocks != null)
                _section('Flocks', [
                  _row('Total birds', '${flocks['totalBirds'] ?? 0}'),
                  for (final e
                      in (flocks['byStatus'] as Map? ?? {}).entries)
                    _row('${e.key}', '${e.value}'),
                ]),
              _section('Members (${members.length})', [
                for (final m in members)
                  _row(
                    '${m['user']?['name'] ?? m['user']?['email'] ?? '?'}',
                    '${m['role']}${m['user']?['isActive'] == false ? ' · inactive' : ''}',
                  ),
              ]),
              if (subs.isNotEmpty)
                _section('Subscription', [
                  for (final s in subs.take(3))
                    _row(
                      '${s['planCode']} · ${s['billingCycle'] ?? ''}',
                      '${s['status']}${s['currentPeriodEnd'] != null ? ' → ${'${s['currentPeriodEnd']}'.substring(0, 10)}' : ''}',
                    ),
                ]),
              if (support != null)
                _section('Support', [
                  _row('Open tickets', '${support['open'] ?? 0}'),
                  _row('Total tickets', '${support['total'] ?? 0}'),
                ]),
            ],
          ],
        ),
      ),
    );
  }

  Widget _section(String title, List<Widget> rows) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        const SizedBox(height: 6),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(children: rows),
          ),
        ),
      ]),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
              child: Text(label,
                  style: const TextStyle(fontSize: 13),
                  overflow: TextOverflow.ellipsis)),
          Text(value,
              style: const TextStyle(fontSize: 13, color: Colors.grey)),
        ],
      ),
    );
  }
}
