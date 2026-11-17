import 'package:flutter/material.dart';
import '../api.dart';
import '../reauth.dart';

/// Feature flags — platform-wide defaults with per-plan (tri-state) and
/// per-org overrides. Mobile parity with admin-web P4 flags page.
class FlagsScreen extends StatefulWidget {
  const FlagsScreen({super.key});

  @override
  State<FlagsScreen> createState() => _FlagsScreenState();
}

class _FlagsScreenState extends State<FlagsScreen> {
  List<dynamic>? _flags;
  List<dynamic> _plans = [];
  bool _canWrite = false;
  String? _error;
  final _expanded = <String>{};
  final _orgInputs = <String, TextEditingController>{};
  final _orgValues = <String, bool>{};

  @override
  void initState() {
    super.initState();
    Api.hasPermission('flags.write').then((v) {
      if (mounted) setState(() => _canWrite = v);
    });
    _load();
    Api.plans().then((p) {
      p.sort((a, b) =>
          ((a['sortOrder'] as num?) ?? 0)
              .compareTo((b['sortOrder'] as num?) ?? 0));
      if (mounted) setState(() => _plans = p);
    }).catchError((_) {}); // plan list is a nicety, not fatal
  }

  @override
  void dispose() {
    for (final c in _orgInputs.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final flags = await Api.flags();
      if (mounted) setState(() => _flags = flags);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  Future<void> _mutate(
      Future<void> Function() op, String busyKey) async {
    if (!await ensureReauth(context)) return;
    try {
      await op();
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Update failed: $e')));
      }
    }
  }

  Future<void> _setDefault(Map<String, dynamic> f, bool v) =>
      _mutate(() => Api.flagUpdate('${f['key']}', {'enabledByDefault': v}),
          'default:${f['key']}');

  Future<void> _setPlanOverride(
      Map<String, dynamic> f, String code, bool? v) {
    final next = Map<String, dynamic>.from(
        (f['planOverrides'] as Map?) ?? {});
    if (v == null) {
      next.remove(code);
    } else {
      next[code] = v;
    }
    return _mutate(
        () => Api.flagUpdate('${f['key']}', {'planOverrides': next}),
        'plan:${f['key']}');
  }

  Future<void> _addOrgOverride(Map<String, dynamic> f) {
    final key = '${f['key']}';
    final orgId = (_orgInputs[key]?.text ?? '').trim();
    if (orgId.isEmpty) return Future.value();
    final next = Map<String, dynamic>.from(
        (f['orgOverrides'] as Map?) ?? {});
    next[orgId] = _orgValues[key] ?? true;
    _orgInputs[key]?.clear();
    return _mutate(
        () => Api.flagUpdate(key, {'orgOverrides': next}),
        'org:$key');
  }

  Future<void> _removeOrgOverride(Map<String, dynamic> f, String orgId) {
    final key = '${f['key']}';
    final next = Map<String, dynamic>.from(
        (f['orgOverrides'] as Map?) ?? {});
    next.remove(orgId);
    return _mutate(
        () => Api.flagUpdate(key, {'orgOverrides': next}),
        'orgrm:$key');
  }

  Future<void> _create() async {
    final key = TextEditingController();
    final desc = TextEditingController();
    var enabled = false;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setD) => AlertDialog(
          title: const Text('New feature flag'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Keys are referenced from application code — use snake_case '
                'and coordinate with the release that consumes the flag.',
                style: TextStyle(fontSize: 12),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: key,
                decoration: const InputDecoration(
                    labelText: 'Key',
                    hintText: 'e.g. new_billing_page',
                    border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: desc,
                decoration: const InputDecoration(
                    labelText: 'Description (optional)',
                    border: OutlineInputBorder()),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Enabled by default',
                    style: TextStyle(fontSize: 14)),
                value: enabled,
                onChanged: (v) => setD(() => enabled = v),
              ),
            ],
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel')),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Create'),
            ),
          ],
        ),
      ),
    );
    if (ok != true || key.text.trim().isEmpty) return;
    await _mutate(
        () => Api.flagCreate({
              'key': key.text.trim(),
              'description': desc.text.trim(),
              'enabledByDefault': enabled,
            }),
        'create');
  }

  Future<void> _delete(Map<String, dynamic> f) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Delete flag "${f['key']}"?'),
        content: const Text(
            'Tenants will fall back to code defaults for this flag.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await _mutate(() => Api.flagDelete('${f['key']}'), 'del:${f['key']}');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: _canWrite
          ? FloatingActionButton.extended(
              onPressed: _create,
              icon: const Icon(Icons.add),
              label: const Text('New flag'),
            )
          : null,
      body: _flags == null
          ? _error != null
              ? Center(child: Text('Error: $_error'))
              : const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
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
                  const Text(
                    'Platform-wide defaults with per-plan and per-org '
                    'overrides — org overrides win over plan overrides.',
                    style: TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                  const SizedBox(height: 12),
                  if (_flags!.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(32),
                      child: Center(child: Text('No flags defined yet.')),
                    )
                  else
                    for (final raw in _flags!)
                      _flagCard(raw as Map<String, dynamic>),
                ],
              ),
            ),
    );
  }

  Widget _flagCard(Map<String, dynamic> f) {
    final key = '${f['key']}';
    final open = _expanded.contains(key);
    final planOverrides =
        Map<String, dynamic>.from((f['planOverrides'] as Map?) ?? {});
    final orgOverrides =
        Map<String, dynamic>.from((f['orgOverrides'] as Map?) ?? {});
    _orgInputs[key] ??=
        TextEditingController();
    return Card(
      child: Column(
        children: [
          ListTile(
            leading: Icon(
                open ? Icons.expand_more : Icons.chevron_right,
                size: 20),
            title: Text(key,
                style: const TextStyle(
                    fontFamily: 'monospace', fontSize: 13)),
            subtitle: Text('${f['description'] ?? '—'}',
                style: const TextStyle(fontSize: 11),
                maxLines: 2,
                overflow: TextOverflow.ellipsis),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Switch(
                  value: f['enabledByDefault'] == true,
                  onChanged: _canWrite ? (v) => _setDefault(f, v) : null,
                ),
                if (_canWrite)
                  IconButton(
                    icon: const Icon(Icons.delete_outline,
                        size: 18, color: Colors.red),
                    onPressed: () => _delete(f),
                  ),
              ],
            ),
            onTap: () => setState(() {
              if (open) {
                _expanded.remove(key);
              } else {
                _expanded.add(key);
              }
            }),
          ),
          if (open) _flagOverrides(f, planOverrides, orgOverrides, key),
        ],
      ),
    );
  }

  Widget _flagOverrides(Map<String, dynamic> f,
      Map<String, dynamic> planOverrides,
      Map<String, dynamic> orgOverrides,
      String key) {
    final knownPlanCodes = _plans.map((p) => '${p['code']}').toSet();
    final unknownCodes =
        planOverrides.keys.where((c) => !knownPlanCodes.contains(c));
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Plan overrides',
              style:
                  TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          if (_plans.isEmpty)
            const Text('Plan list unavailable.',
                style: TextStyle(fontSize: 11, color: Colors.grey))
          else
            for (final p in _plans)
              _planOverrideRow(f, '${p['code']}', '${p['name']}',
                  planOverrides['${p['code']}']),
          for (final c in unknownCodes)
            _planOverrideRow(f, c, '$c (unknown plan)',
                planOverrides[c]),
          const SizedBox(height: 12),
          const Text('Org overrides',
              style:
                  TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          if (orgOverrides.isEmpty)
            const Text(
                'No org overrides — everyone inherits the plan/default value.',
                style: TextStyle(fontSize: 11, color: Colors.grey))
          else
            for (final e in orgOverrides.entries)
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(e.key,
                    style: const TextStyle(
                        fontFamily: 'monospace', fontSize: 11)),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Chip(
                      label: Text(e.value == true ? 'on' : 'off',
                          style: const TextStyle(fontSize: 10)),
                      visualDensity: VisualDensity.compact,
                    ),
                    if (_canWrite)
                      IconButton(
                        icon: const Icon(Icons.close, size: 16),
                        onPressed: () => _removeOrgOverride(f, e.key),
                      ),
                  ],
                ),
              ),
          if (_canWrite) ...[
            const SizedBox(height: 8),
            Row(children: [
              Expanded(
                child: TextField(
                  controller: _orgInputs[key],
                  decoration: const InputDecoration(
                      hintText: 'organisation id (uuid)',
                      isDense: true,
                      border: OutlineInputBorder()),
                ),
              ),
              const SizedBox(width: 8),
              DropdownButton<bool>(
                value: _orgValues[key] ?? true,
                items: const [
                  DropdownMenuItem(value: true, child: Text('On')),
                  DropdownMenuItem(value: false, child: Text('Off')),
                ],
                onChanged: (v) =>
                    setState(() => _orgValues[key] = v ?? true),
              ),
              const SizedBox(width: 8),
              FilledButton.tonal(
                onPressed: () => _addOrgOverride(f),
                child: const Text('Add'),
              ),
            ]),
          ],
        ],
      ),
    );
  }

  Widget _planOverrideRow(Map<String, dynamic> f, String code,
      String label, dynamic current) {
    // Tri-state: inherit / on / off
    Widget tri(bool? v, String t) => Padding(
          padding: const EdgeInsets.only(right: 4),
          child: ChoiceChip(
            label: Text(t, style: const TextStyle(fontSize: 11)),
            // Absent override = inherit (null); explicit true/false otherwise.
            selected: current == v,
            onSelected: _canWrite
                ? (_) => _setPlanOverride(f, code, v)
                : null,
          ),
        );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(children: [
        Expanded(
          child: Text('$label ($code)',
              style: const TextStyle(fontSize: 12),
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
        ),
        if (_canWrite) ...[
          tri(null, 'Inherit'),
          tri(true, 'On'),
          tri(false, 'Off'),
        ] else
          Text(
              current == null
                  ? 'inherit'
                  : current == true
                      ? 'on'
                      : 'off',
              style: const TextStyle(fontSize: 11)),
      ]),
    );
  }
}
