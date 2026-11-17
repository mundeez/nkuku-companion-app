import 'package:flutter/material.dart';
import '../api.dart';
import 'tenants.dart';
import 'tickets.dart';
import 'ops.dart';
import 'manage.dart';

/// Dashboard shell — overview KPIs + health strip + nav to tenants/tickets.
class HomeScreen extends StatefulWidget {
  final VoidCallback onLoggedOut;
  const HomeScreen({super.key, required this.onLoggedOut});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [
      const _DashboardTab(),
      const TenantsScreen(),
      const TicketsScreen(),
      const ManageScreen(),
      const OpsScreen(),
    ];
    return Scaffold(
      appBar: AppBar(
        title: const Text('Nkuku Admin'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sign out',
            onPressed: () async {
              await Api.logout();
              widget.onLoggedOut();
            },
          ),
        ],
      ),
      body: IndexedStack(index: _tab, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.dashboard_outlined), label: 'Overview'),
          NavigationDestination(
              icon: Icon(Icons.business_outlined), label: 'Tenants'),
          NavigationDestination(
              icon: Icon(Icons.support_agent_outlined), label: 'Support'),
          NavigationDestination(
              icon: Icon(Icons.tune_outlined), label: 'Manage'),
          NavigationDestination(
              icon: Icon(Icons.monitor_heart_outlined), label: 'Ops'),
        ],
      ),
    );
  }
}

class _DashboardTab extends StatefulWidget {
  const _DashboardTab();

  @override
  State<_DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<_DashboardTab> {
  Map<String, dynamic>? _overview;
  Map<String, dynamic>? _health;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final results = await Future.wait([
        Api.analyticsOverview(),
        Api.opsHealth(),
      ]);
      if (mounted) {
        setState(() {
          _overview = results[0];
          _health = results[1];
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  num _n(Map<String, dynamic>? m, String k) =>
      num.tryParse('${m?[k] ?? 0}') ?? 0;

  @override
  Widget build(BuildContext context) {
    final latest = _overview?['latest'] as Map<String, dynamic>?;
    final funnel = latest?['funnel'] as Map<String, dynamic>?;
    final checks = _health?['checks'] as Map<String, dynamic>?;
    return RefreshIndicator(
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
          if (_overview == null && _error == null)
            const Padding(
              padding: EdgeInsets.all(48),
              child: Center(child: CircularProgressIndicator()),
            ),
          if (latest != null) ...[
            Text('Growth — ${latest['date'] ?? ''}',
                style:
                    const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _kpi('MRR', 'ZMW ${_n(latest, 'mrrTotal')}'),
                _kpi('Active subs', '${_n(funnel, 'active')}'),
                _kpi('Trialing', '${_n(funnel, 'trialing')}'),
                _kpi('Past due', '${_n(funnel, 'past_due')}'),
                _kpi('Signups', '${_n(latest, 'signups')}'),
                _kpi('Activations', '${_n(latest, 'activations')}'),
                _kpi('WAU', '${_n(latest, 'wau')}'),
                _kpi('MAU', '${_n(latest, 'mau')}'),
                _kpi('Failed pays', '${_n(latest, 'failedPayments')}'),
                _kpi('Recovered', '${_n(latest, 'failedPaymentRecoveries')}'),
              ],
            ),
            const SizedBox(height: 16),
          ],
          if (_health != null) ...[
            Row(
              children: [
                const Text('Platform health',
                    style:
                        TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(width: 8),
                _ragChip('${_health!['status'] ?? 'unknown'}'),
              ],
            ),
            const SizedBox(height: 8),
            if (checks != null)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final e in checks.entries)
                        if (e.key != 'cron')
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 3),
                            child: Row(
                              children: [
                                _ragDot(
                                    '${(e.value as Map)['status'] ?? 'amber'}'),
                                const SizedBox(width: 8),
                                Expanded(
                                    child: Text(e.key,
                                        style:
                                            const TextStyle(fontSize: 13))),
                                Text(
                                  (e.value as Map)['latencyMs'] != null
                                      ? '${(e.value as Map)['latencyMs']}ms'
                                      : '${(e.value as Map)['error'] ?? ''}',
                                  style: const TextStyle(
                                      fontSize: 12, color: Colors.grey),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                    ],
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }

  Widget _ragChip(String status) {
    final c = status == 'green'
        ? Colors.green
        : status == 'amber'
            ? Colors.orange
            : Colors.red;
    return Chip(
      label: Text(status.toUpperCase(),
          style: TextStyle(color: c, fontSize: 11)),
      side: BorderSide(color: c),
      visualDensity: VisualDensity.compact,
    );
  }

  Widget _ragDot(String status) {
    final c = status == 'green'
        ? Colors.green
        : status == 'amber'
            ? Colors.orange
            : Colors.red;
    return Icon(Icons.circle, size: 10, color: c);
  }

  Widget _kpi(String label, String value) {
    return SizedBox(
      width: 110,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(children: [
            Text(value,
                style:
                    const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                overflow: TextOverflow.ellipsis),
            Text(label,
                style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ]),
        ),
      ),
    );
  }
}
