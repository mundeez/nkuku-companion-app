import 'package:flutter/material.dart';
import '../api.dart';
import '../reauth.dart';

/// Plans & pricing — subscription tiers, limits, features and the
/// per-currency price matrix. Mobile parity with admin-web P4 plans page.
class PlansScreen extends StatefulWidget {
  const PlansScreen({super.key});

  @override
  State<PlansScreen> createState() => _PlansScreenState();
}

class _PlansScreenState extends State<PlansScreen> {
  List<dynamic>? _plans;
  bool _canWrite = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    Api.hasPermission('billing.plans.write').then((v) {
      if (mounted) setState(() => _canWrite = v);
    });
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final plans = await Api.plans();
      plans.sort((a, b) =>
          ((a['sortOrder'] as num?) ?? 0)
              .compareTo((b['sortOrder'] as num?) ?? 0));
      if (mounted) setState(() => _plans = plans);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  Future<void> _toggleActive(Map<String, dynamic> plan) async {
    if (!await ensureReauth(context)) return;
    try {
      await Api.planUpdate('${plan['code']}',
          {'isActive': !(plan['isActive'] == true)});
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Update failed: $e')));
      }
    }
  }

  Future<void> _edit(Map<String, dynamic> plan) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => _PlanEditor(plan: plan)),
    );
    if (changed == true) _load();
  }

  static String _limitLabel(dynamic v) =>
      v is num && v == -1 ? 'Unlimited' : '$v';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _plans == null
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
                    'Subscription tiers — limits, features and the per-currency '
                    'price matrix. -1 limits mean unlimited; "enterprise" is '
                    'custom-quoted (keep prices at 0).',
                    style: TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                  const SizedBox(height: 12),
                  for (final p in _plans!) _planCard(p as Map<String, dynamic>),
                ],
              ),
            ),
    );
  }

  Widget _planCard(Map<String, dynamic> p) {
    final limits = (p['limits'] as Map?) ?? {};
    final features = (p['features'] as List?) ?? const [];
    final prices = (p['prices'] as List?) ?? const [];
    final active = p['isActive'] == true;
    final isTrial = p['isTrial'] == true;
    return Card(
      child: InkWell(
        onTap: _canWrite ? () => _edit(p) : null,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Expanded(
                  child: Text('${p['name']}',
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 15)),
                ),
                if (isTrial)
                  Chip(
                    label: Text(
                        'trial${p['trialDays'] != null ? ' ${p['trialDays']}d' : ''}',
                        style: const TextStyle(fontSize: 10)),
                    visualDensity: VisualDensity.compact,
                  ),
                Switch(
                  value: active,
                  onChanged:
                      _canWrite ? (_) => _toggleActive(p) : null,
                ),
              ]),
              Text('${p['code']}',
                  style: const TextStyle(
                      fontFamily: 'monospace', fontSize: 11)),
              const SizedBox(height: 6),
              Wrap(spacing: 12, runSpacing: 4, children: [
                Text('Flocks: ${_limitLabel(limits['maxActiveFlocks'])}',
                    style: const TextStyle(fontSize: 12)),
                Text('Users: ${_limitLabel(limits['maxUsers'])}',
                    style: const TextStyle(fontSize: 12)),
                Text('${features.length} features',
                    style: const TextStyle(fontSize: 12)),
                Text(
                    p['isSelfServe'] == true
                        ? 'self-serve'
                        : 'sales-assisted',
                    style: const TextStyle(fontSize: 12)),
              ]),
              if (prices.isNotEmpty) ...[
                const SizedBox(height: 6),
                Wrap(spacing: 8, runSpacing: 4, children: [
                  for (final pr in prices)
                    Chip(
                      label: Text(
                          '${pr['billingCycle']} ${pr['currency']} ${pr['amount']}',
                          style: const TextStyle(fontSize: 10)),
                      visualDensity: VisualDensity.compact,
                    ),
                ]),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ══════════════ Plan editor ══════════════

class _PlanEditor extends StatefulWidget {
  final Map<String, dynamic> plan;
  const _PlanEditor({required this.plan});

  @override
  State<_PlanEditor> createState() => _PlanEditorState();
}

class _PlanEditorState extends State<_PlanEditor> {
  final _form = GlobalKey<FormState>();
  bool _busy = false;
  String? _error;

  late final TextEditingController _name;
  late final TextEditingController _desc;
  late final TextEditingController _trialDays;
  late final Map<String, TextEditingController> _limits;
  late final Map<String, Map<String, TextEditingController>> _prices;
  late bool _isTrial;
  late bool _isSelfServe;
  late bool _isActive;
  late Set<String> _features;

  static const _cycles = ['monthly', 'cycle_3mo', 'annual'];
  static const _cycleLabels = {
    'monthly': 'Monthly',
    'cycle_3mo': '3-mo cycle',
    'annual': 'Annual',
  };
  static const _currencies = ['ZMW', 'BWP', 'USD'];
  static const _limitFields = {
    'maxActiveFlocks': 'Max active flocks',
    'maxUsers': 'Max users',
    'maxCyclesHistory': 'Max cycles history',
    'maxDocumentsPerRecord': 'Max documents / record',
  };

  /// Feature keys known to the console — mirrors admin-web's
  /// FEATURE_KEYS (apps/admin-web/src/lib/feature-keys.ts).
  /// Unknown keys already on the plan are preserved (shown separately).
  static const _featureKeys = {
    'core_tracking': 'Core tracking',
    'disease_db': 'Disease database',
    'basic_alerts': 'Basic alerts',
    'full_alerts': 'Full alerts',
    'financial_dashboard': 'Financial dashboard',
    'double_entry_ledger': 'Double-entry ledger',
    'document_attachments': 'Document attachments',
    'multi_site': 'Multi-site',
    'gaap_statements': 'GAAP statements',
    'csv_pdf_export': 'CSV/PDF export',
    'api_access': 'API access',
    'priority_support': 'Priority support',
    'white_label': 'White-label',
    'dedicated_onboarding': 'Dedicated onboarding',
    'sla': 'SLA',
    'self_hosted': 'Self-hosted',
  };

  @override
  void initState() {
    super.initState();
    final p = widget.plan;
    _name = TextEditingController(text: '${p['name'] ?? ''}');
    _desc = TextEditingController(text: '${p['description'] ?? ''}');
    _trialDays = TextEditingController(
        text: p['trialDays'] != null ? '${p['trialDays']}' : '');
    _isTrial = p['isTrial'] == true;
    _isSelfServe = p['isSelfServe'] == true;
    _isActive = p['isActive'] == true;
    final limits = (p['limits'] as Map?) ?? {};
    _limits = {
      for (final k in _limitFields.keys)
        k: TextEditingController(text: '${limits[k] ?? 0}'),
    };
    _features = {
      for (final f in (p['features'] as List? ?? const [])) '$f',
    };
    _prices = {};
    for (final c in _cycles) {
      _prices[c] = {};
      for (final cur in _currencies) {
        _prices[c]![cur] = TextEditingController(text: '0');
      }
    }
    for (final pr in (p['prices'] as List? ?? const [])) {
      final cycle = '${pr['billingCycle']}';
      final cur = '${pr['currency']}';
      if (_prices.containsKey(cycle) &&
          _prices[cycle]!.containsKey(cur)) {
        _prices[cycle]![cur]!.text = '${pr['amount']}';
      }
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _desc.dispose();
    _trialDays.dispose();
    for (final c in _limits.values) {
      c.dispose();
    }
    for (final m in _prices.values) {
      for (final c in m.values) {
        c.dispose();
      }
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() { _busy = true; _error = null; });
    try {
      if (!await ensureReauth(context)) {
        setState(() => _busy = false);
        return;
      }
      final code = '${widget.plan['code']}';
      await Api.planUpdate(code, {
        'name': _name.text.trim(),
        'description': _desc.text.trim(),
        'isTrial': _isTrial,
        'trialDays':
            _isTrial && _trialDays.text.trim().isNotEmpty
                ? int.tryParse(_trialDays.text.trim())
                : null,
        'isSelfServe': _isSelfServe,
        'isActive': _isActive,
        'limits': {
          for (final e in _limits.entries)
            e.key: int.tryParse(e.value.text.trim()) ?? 0,
        },
        'features': _features.toList(),
      });
      await Api.planReplacePrices(code, [
        for (final c in _cycles)
          for (final cur in _currencies)
            {
              'billingCycle': c,
              'currency': cur,
              'amount': double.tryParse(
                      _prices[c]![cur]!.text.trim()) ??
                  0,
            },
      ]);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = e.toString();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEnterprise = '${widget.plan['code']}' == 'enterprise';
    return Scaffold(
      appBar: AppBar(
          title: Text('Edit plan — ${widget.plan['name']}')),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _name,
              decoration: const InputDecoration(
                  labelText: 'Name', border: OutlineInputBorder()),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _desc,
              maxLines: 2,
              decoration: const InputDecoration(
                  labelText: 'Description', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 16),
            const Text('Limits (-1 = unlimited)',
                style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            for (final e in _limitFields.entries)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: TextFormField(
                  controller: _limits[e.key],
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                      labelText: e.value,
                      border: const OutlineInputBorder()),
                ),
              ),
            const SizedBox(height: 8),
            Text('Features (${_features.length} selected)',
                style: const TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            for (final key in _featureKeys.keys)
              CheckboxListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                title: Text(_featureKeys[key]!,
                    style: const TextStyle(fontSize: 13)),
                subtitle: Text(key,
                    style: const TextStyle(
                        fontFamily: 'monospace', fontSize: 10)),
                value: _features.contains(key),
                onChanged: (v) => setState(() {
                  if (v == true) {
                    _features.add(key);
                  } else {
                    _features.remove(key);
                  }
                }),
              ),
            // Unknown keys already on the plan — keep them so a save
            // doesn't silently drop them (web parity).
            for (final key in _features.where(
                (k) => !_featureKeys.containsKey(k)))
              CheckboxListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                title: Text('$key (unlisted key)',
                    style: const TextStyle(fontSize: 13)),
                value: true,
                onChanged: (v) =>
                    setState(() => _features.remove(key)),
              ),
            const SizedBox(height: 8),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title:
                  const Text('Self-serve (signup without sales)',
                      style: TextStyle(fontSize: 14)),
              value: _isSelfServe,
              onChanged: (v) => setState(() => _isSelfServe = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Active',
                  style: TextStyle(fontSize: 14)),
              value: _isActive,
              onChanged: (v) => setState(() => _isActive = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Trial plan',
                  style: TextStyle(fontSize: 14)),
              value: _isTrial,
              onChanged: (v) => setState(() => _isTrial = v),
            ),
            if (_isTrial)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: TextFormField(
                  controller: _trialDays,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                      labelText: 'Trial days',
                      border: OutlineInputBorder()),
                ),
              ),
            const SizedBox(height: 8),
            Row(children: [
              const Text('Price matrix',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              if (isEnterprise) ...[
                const SizedBox(width: 8),
                const Text('custom-quoted — keep amounts at 0',
                    style: TextStyle(fontSize: 11, color: Colors.orange)),
              ],
            ]),
            const SizedBox(height: 8),
            for (final c in _cycles) ...[
              Text(_cycleLabels[c]!,
                  style: const TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              for (final cur in _currencies)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: TextFormField(
                    controller: _prices[c]![cur],
                    keyboardType: const TextInputType.numberWithOptions(
                        decimal: true),
                    decoration: InputDecoration(
                        labelText: '$cur amount',
                        border: const OutlineInputBorder()),
                  ),
                ),
            ],
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(_error!,
                    style: const TextStyle(color: Colors.red)),
              ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _busy ? null : _save,
              child: _busy
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Save plan'),
            ),
          ],
        ),
      ),
    );
  }
}
