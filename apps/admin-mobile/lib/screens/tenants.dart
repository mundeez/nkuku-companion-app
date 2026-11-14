import 'package:flutter/material.dart';
import '../api.dart';
import 'tenant_detail.dart';

/// Tenant list — search, plan/status display, suspend-state badge.
class TenantsScreen extends StatefulWidget {
  const TenantsScreen({super.key});

  @override
  State<TenantsScreen> createState() => _TenantsScreenState();
}

class _TenantsScreenState extends State<TenantsScreen> {
  final _search = TextEditingController();
  List<dynamic> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final items = await Api.tenants(search: _search.text.trim());
      if (mounted) setState(() { _items = items; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            controller: _search,
            decoration: InputDecoration(
              hintText: 'Search tenants…',
              prefixIcon: const Icon(Icons.search),
              border: const OutlineInputBorder(),
              suffixIcon: IconButton(
                  icon: const Icon(Icons.arrow_forward), onPressed: _load),
            ),
            onSubmitted: (_) => _load(),
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                  ? Center(child: Text('Error: $_error'))
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.builder(
                        itemCount: _items.length,
                        itemBuilder: (_, i) {
                          final t = _items[i] as Map<String, dynamic>;
                          final suspended = t['suspended'] == true;
                          final plan = t['effectivePlanCode'] ?? t['planCode'] ?? '-';
                          return ListTile(
                            leading: Icon(
                              suspended ? Icons.pause_circle : Icons.business,
                              color: suspended ? Colors.red : null,
                            ),
                            title: Text('${t['name'] ?? t['id']}'),
                            subtitle: Text(
                              'plan: $plan · users: ${t['userCount'] ?? '-'} · ${t['country'] ?? ''}',
                              style: const TextStyle(fontSize: 12),
                            ),
                            trailing: suspended
                                ? const Text('SUSPENDED',
                                    style: TextStyle(
                                        color: Colors.red, fontSize: 11))
                                : const Icon(Icons.chevron_right, size: 18),
                            onTap: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => TenantDetailScreen(
                                    tenantId: '${t['id']}',
                                    tenantName: '${t['name'] ?? ''}',
                                  ),
                                ),
                              );
                            },
                          );
                        },
                      ),
                    ),
        ),
      ],
    );
  }
}
