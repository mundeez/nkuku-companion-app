import 'package:flutter/material.dart';
import '../api.dart';
import '../reauth.dart';

/// Catalogue hub — global reference data shared by all tenants.
/// Mobile parity with admin-web P4 catalogue tabs; CSV import/export
/// stays web-only (no bulk path on mobile).
class CatalogueScreen extends StatelessWidget {
  const CatalogueScreen({super.key});

  static const _tabs = [
    ('diseases', 'Diseases'),
    ('breeds', 'Breeds'),
    ('vaccination-schedules', 'Schedules'),
    ('performance-targets', 'Targets'),
    ('supplier-category-templates', 'Templates'),
  ];

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: _tabs.length,
      child: Column(
        children: [
          const TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            tabs: [
              Tab(text: 'Diseases'),
              Tab(text: 'Breeds'),
              Tab(text: 'Schedules'),
              Tab(text: 'Targets'),
              Tab(text: 'Templates'),
            ],
          ),
          Expanded(
            child: TabBarView(
              children: [
                for (final (entity, _) in _tabs)
                  _EntityTab(entity: entity),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EntityTab extends StatefulWidget {
  final String entity;
  const _EntityTab({required this.entity});

  @override
  State<_EntityTab> createState() => _EntityTabState();
}

class _EntityTabState extends State<_EntityTab> {
  final _search = TextEditingController();
  List<dynamic> _items = [];
  List<dynamic> _breeds = [];
  bool _loading = true;
  bool _canWrite = false;
  String? _error;

  String get _entity => widget.entity;

  @override
  void initState() {
    super.initState();
    Api.hasPermission('catalogue.write').then((v) {
      if (mounted) setState(() => _canWrite = v);
    });
    _load();
    // Breeds are needed as a foreign key by targets/schedules — fetch once.
    if (_entity == 'performance-targets' ||
        _entity == 'vaccination-schedules') {
      Api.catalogue('breeds').then((b) {
        if (mounted) setState(() => _breeds = b);
      }).catchError((_) {});
    }
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final items = await Api.catalogue(_entity);
      if (mounted) setState(() { _items = items; _loading = false; });
    } catch (e) {
      if (mounted) {
        setState(() { _error = e.toString(); _loading = false; });
      }
    }
  }

  List<dynamic> get _filtered {
    final q = _search.text.trim().toLowerCase();
    if (q.isEmpty) return _items;
    return _items.where((i) => _haystack(i).toLowerCase().contains(q)).toList();
  }

  String _breedName(String? id) =>
      _breeds.firstWhere((b) => b['id'] == id,
          orElse: () => {'name': id == null ? 'All breeds' : '${id.substring(0, 8)}…'})['name'] ??
      '';

  String _haystack(dynamic i) => switch (_entity) {
        'diseases' => '${i['name']} ${i['category']} ${i['symptoms'] ?? ''}',
        'breeds' => '${i['name']} ${i['supplier']}',
        'vaccination-schedules' =>
          '${i['name']} ${i['description'] ?? ''}',
        'performance-targets' =>
          '${_breedName(i['breedId'])} day ${i['ageDays']}',
        'supplier-category-templates' =>
          '${i['name']} ${i['category']} ${i['description'] ?? ''}',
        _ => '${i['name'] ?? ''}',
      };

  String _title(dynamic i) => switch (_entity) {
        'diseases' => '${i['name']}',
        'breeds' => '${i['name']}',
        'vaccination-schedules' => '${i['name']}',
        'performance-targets' =>
          'Day ${i['ageDays']} — ${_breedName(i['breedId'])}',
        'supplier-category-templates' => '${i['name']}',
        _ => '${i['name'] ?? i['id']}',
      };

  String _subtitle(dynamic i) => switch (_entity) {
        'diseases' =>
          '${i['category']} · ${i['mortalityRate'] ?? 'no mortality data'}',
        'breeds' =>
          '${i['supplier']} · ${(i['performanceTargets'] as List?)?.length ?? 0} targets${i['isPrimary'] == true ? ' · primary' : ''}',
        'vaccination-schedules' =>
          '${i['items'] is List ? (i['items'] as List).length : 0} items · ${i['isDefault'] == true ? 'default' : _breedName(i['breedId'])}',
        'performance-targets' =>
          'wt ${i['targetWeight']}g · feed ${i['targetFeed']}g · FCR ${i['targetFcr']}${i['targetWater'] != null ? ' · water ${i['targetWater']}ml' : ''}',
        'supplier-category-templates' =>
          '${i['category']} · ${(i['items'] as List?)?.length ?? 0} items · ${i['isActive'] == false ? 'inactive' : 'active'}',
        _ => '',
      };

  Future<void> _edit([Map<String, dynamic>? item]) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => _EntityEditor(
          entity: _entity,
          item: item,
          breeds: _breeds,
        ),
      ),
    );
    if (changed == true) _load();
  }

  Future<void> _delete(dynamic item) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete this entry?'),
        content: const Text(
            'This is global reference data shared by every tenant. This cannot be undone.'),
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
    if (!mounted) return;
    if (!await ensureReauth(context)) return;
    try {
      await Api.catalogueDelete(_entity, '${item['id']}');
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Delete failed: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: _canWrite
          ? FloatingActionButton.extended(
              onPressed: () => _edit(),
              icon: const Icon(Icons.add),
              label: const Text('New'),
            )
          : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: TextField(
              controller: _search,
              decoration: InputDecoration(
                hintText: 'Search…',
                prefixIcon: const Icon(Icons.search),
                border: const OutlineInputBorder(),
                suffixIcon: IconButton(
                    icon: const Icon(Icons.arrow_forward), onPressed: _load),
              ),
              onSubmitted: (_) => setState(() {}),
              onChanged: (_) => setState(() {}),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(child: Text('Error: $_error'))
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: _filtered.isEmpty
                            ? ListView(children: const [
                                SizedBox(height: 120),
                                Center(child: Text('Nothing here yet.')),
                              ])
                            : ListView.builder(
                                itemCount: _filtered.length,
                                itemBuilder: (_, i) {
                                  final item = _filtered[i];
                                  return ListTile(
                                    title: Text(_title(item),
                                        style: const TextStyle(fontSize: 14)),
                                    subtitle: Text(_subtitle(item),
                                        style: const TextStyle(fontSize: 11),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis),
                                    trailing: _canWrite
                                        ? Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              IconButton(
                                                icon: const Icon(
                                                    Icons.edit_outlined,
                                                    size: 18),
                                                onPressed: () => _edit(item),
                                              ),
                                              IconButton(
                                                icon: const Icon(
                                                    Icons.delete_outline,
                                                    size: 18,
                                                    color: Colors.red),
                                                onPressed: () => _delete(item),
                                              ),
                                            ],
                                          )
                                        : const Icon(Icons.chevron_right,
                                            size: 18),
                                    onTap: _canWrite ? () => _edit(item) : null,
                                  );
                                },
                              ),
                      ),
          ),
        ],
      ),
    );
  }
}

// ══════════════ Entity editor ══════════════

class _EntityEditor extends StatefulWidget {
  final String entity;
  final Map<String, dynamic>? item;
  final List<dynamic> breeds;
  const _EntityEditor({
    required this.entity,
    required this.item,
    required this.breeds,
  });

  @override
  State<_EntityEditor> createState() => _EntityEditorState();
}

class _EntityEditorState extends State<_EntityEditor> {
  final _form = GlobalKey<FormState>();
  bool _busy = false;
  String? _error;

  late final Map<String, TextEditingController> _c;
  bool _isPrimary = false;
  bool _isDefault = false;
  bool _isActive = true;
  String? _breedId; // '' / null → all breeds
  List<Map<String, dynamic>> _scheduleItems = [];
  List<Map<String, dynamic>> _templateItems = [];

  bool get _isEdit => widget.item != null;

  @override
  void initState() {
    super.initState();
    final it = widget.item ?? {};
    _c = {
      for (final k in [
        'name', 'category', 'supplier', 'description', 'incubation',
        'mortalityRate', 'symptoms', 'prevention', 'treatment',
        'organicTreatments', 'ageDays', 'targetWeight', 'targetFeed',
        'targetFcr', 'targetWater', 'sortOrder',
      ])
        k: TextEditingController(text: _str(it[k])),
    };
    _isPrimary = it['isPrimary'] == true;
    _isDefault = it['isDefault'] == true;
    _isActive = it['isActive'] != false;
    _breedId = it['breedId'] as String?;
    _scheduleItems = [
      for (final i in (it['items'] as List? ?? const []))
        {
          'vaccineName': TextEditingController(text: _str(i['vaccineName'])),
          'vaccineType': TextEditingController(text: _str(i['vaccineType'])),
          'ageDays': TextEditingController(text: _str(i['ageDays'])),
          'adminMethod': TextEditingController(text: _str(i['adminMethod'])),
          'notes': TextEditingController(text: _str(i['notes'])),
        },
    ];
    _templateItems = [
      for (final i in (it['items'] as List? ?? const []))
        {
          'itemName': TextEditingController(text: _str(i['itemName'])),
          'itemType': i['itemType']?.toString() ?? 'feed',
          'isRequired': i['isRequired'] != false,
        },
    ];
  }

  static String _str(dynamic v) => v == null ? '' : '$v';

  @override
  void dispose() {
    for (final c in _c.values) {
      c.dispose();
    }
    for (final i in _scheduleItems) {
      for (final v in i.values) {
        if (v is TextEditingController) v.dispose();
      }
    }
    super.dispose();
  }

  String? _req(String? v) => (v == null || v.trim().isEmpty) ? 'Required' : null;

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() { _busy = true; _error = null; });
    try {
      if (!await ensureReauth(context)) {
        setState(() => _busy = false);
        return;
      }
      final body = _payload();
      if (_isEdit) {
        await Api.catalogueUpdate(widget.entity, '${widget.item!['id']}', body);
      } else {
        await Api.catalogueCreate(widget.entity, body);
      }
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

  Map<String, dynamic> _payload() {
    String? opt(String key) {
      final v = _c[key]!.text.trim();
      return v.isEmpty ? null : v;
    }

    switch (widget.entity) {
      case 'diseases':
        return {
          'name': _c['name']!.text.trim(),
          'category': _c['category']!.text.trim(),
          if (opt('incubation') != null) 'incubation': opt('incubation'),
          if (opt('mortalityRate') != null) 'mortalityRate': opt('mortalityRate'),
          if (opt('symptoms') != null) 'symptoms': opt('symptoms'),
          if (opt('prevention') != null) 'prevention': opt('prevention'),
          if (opt('treatment') != null) 'treatment': opt('treatment'),
          if (opt('organicTreatments') != null)
            'organicTreatments': opt('organicTreatments'),
        };
      case 'breeds':
        return {
          'name': _c['name']!.text.trim(),
          'supplier': _c['supplier']!.text.trim(),
          'isPrimary': _isPrimary,
        };
      case 'performance-targets':
        return {
          'breedId': _breedId,
          'ageDays': int.tryParse(_c['ageDays']!.text.trim()) ?? 0,
          'targetWeight': double.tryParse(_c['targetWeight']!.text.trim()) ?? 0,
          'targetFeed': double.tryParse(_c['targetFeed']!.text.trim()) ?? 0,
          'targetFcr': double.tryParse(_c['targetFcr']!.text.trim()) ?? 0,
          if (_c['targetWater']!.text.trim().isNotEmpty)
            'targetWater':
                double.tryParse(_c['targetWater']!.text.trim()),
        };
      case 'vaccination-schedules':
        return {
          'name': _c['name']!.text.trim(),
          'breedId': _breedId,
          'isDefault': _isDefault,
          'description': opt('description'),
          'items': [
            for (var idx = 0; idx < _scheduleItems.length; idx++)
              if (_scheduleItems[idx]['vaccineName']!.text.trim().isNotEmpty)
                {
                  'vaccineName':
                      _scheduleItems[idx]['vaccineName']!.text.trim(),
                  'vaccineType':
                      _scheduleItems[idx]['vaccineType']!.text.trim().isEmpty
                          ? 'other'
                          : _scheduleItems[idx]['vaccineType']!.text.trim(),
                  'ageDays': int.tryParse(
                          _scheduleItems[idx]['ageDays']!.text.trim()) ??
                      0,
                  'adminMethod':
                      _scheduleItems[idx]['adminMethod']!.text.trim().isEmpty
                          ? 'other'
                          : _scheduleItems[idx]['adminMethod']!.text.trim(),
                  'sortOrder': idx,
                  'notes': _scheduleItems[idx]['notes']!.text.trim().isEmpty
                      ? null
                      : _scheduleItems[idx]['notes']!.text.trim(),
                },
          ],
        };
      case 'supplier-category-templates':
        return {
          if (!_isEdit) 'category': _c['category']!.text.trim(),
          'name': _c['name']!.text.trim(),
          'description': opt('description'),
          'sortOrder': int.tryParse(_c['sortOrder']!.text.trim()) ?? 0,
          'isActive': _isActive,
          'items': [
            for (var idx = 0; idx < _templateItems.length; idx++)
              if (_templateItems[idx]['itemName']!.text.trim().isNotEmpty)
                {
                  'itemName': _templateItems[idx]['itemName']!.text.trim(),
                  'itemType': _templateItems[idx]['itemType'],
                  'sortOrder': idx,
                  'isRequired': _templateItems[idx]['isRequired'],
                  'isActive': true,
                },
          ],
        };
    }
    return {};
  }

  @override
  Widget build(BuildContext context) {
    final titles = {
      'diseases': 'Disease',
      'breeds': 'Breed',
      'vaccination-schedules': 'Vaccination schedule',
      'performance-targets': 'Performance target',
      'supplier-category-templates': 'Category template',
    };
    return Scaffold(
      appBar: AppBar(
        title: Text('${_isEdit ? 'Edit' : 'New'} ${titles[widget.entity]}'),
      ),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            ..._fields(),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(_error!,
                    style: const TextStyle(color: Colors.red)),
              ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _busy ? null : _save,
              child: _busy
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : Text(_isEdit ? 'Save changes' : 'Create'),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _fields() {
    Widget tf(String key, String label,
            {bool required = false, int maxLines = 1, TextInputType? kb,
            String? hint}) =>
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: TextFormField(
            controller: _c[key],
            maxLines: maxLines,
            keyboardType: kb,
            decoration: InputDecoration(
                labelText: label,
                hintText: hint,
                border: const OutlineInputBorder()),
            validator: required ? _req : null,
          ),
        );

    Widget sw(String label, bool value, ValueChanged<bool> set) =>
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(label, style: const TextStyle(fontSize: 14)),
          value: value,
          onChanged: set,
        );

    const noBreed = '__all__';
    Widget breedPicker({bool nullable = true}) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: DropdownButtonFormField<String>(
            initialValue: _breedId ?? (nullable ? noBreed : null),
            decoration: const InputDecoration(
                labelText: 'Breed', border: OutlineInputBorder()),
            items: [
              if (nullable)
                const DropdownMenuItem(
                    value: noBreed, child: Text('All breeds (generic)')),
              for (final b in widget.breeds)
                DropdownMenuItem(
                    value: b['id'] as String, child: Text('${b['name']}')),
            ],
            onChanged: (v) =>
                setState(() => _breedId = v == noBreed ? null : v),
          ),
        );

    switch (widget.entity) {
      case 'diseases':
        return [
          tf('name', 'Name', required: true),
          tf('category', 'Category', required: true,
              hint: 'e.g. Viral, Bacterial, Parasitic'),
          tf('incubation', 'Incubation period'),
          tf('mortalityRate', 'Mortality rate'),
          tf('symptoms', 'Symptoms', maxLines: 2),
          tf('prevention', 'Prevention', maxLines: 2),
          tf('treatment', 'Treatment', maxLines: 2),
          tf('organicTreatments', 'Organic treatments', maxLines: 2),
        ];
      case 'breeds':
        return [
          tf('name', 'Name', required: true, hint: 'e.g. Ross 308'),
          tf('supplier', 'Supplier', required: true, hint: 'e.g. Aviagen'),
          sw('Primary breed (pre-selected for new flocks)', _isPrimary,
              (v) => setState(() => _isPrimary = v)),
        ];
      case 'performance-targets':
        return [
          breedPicker(nullable: false),
          tf('ageDays', 'Day of age', required: true,
              kb: TextInputType.number),
          tf('targetWeight', 'Target weight (g)', required: true,
              kb: const TextInputType.numberWithOptions(decimal: true)),
          tf('targetFeed', 'Target cumulative feed (g)', required: true,
              kb: const TextInputType.numberWithOptions(decimal: true)),
          tf('targetFcr', 'Target FCR', required: true,
              kb: const TextInputType.numberWithOptions(decimal: true)),
          tf('targetWater', 'Target water (ml, optional)',
              kb: const TextInputType.numberWithOptions(decimal: true)),
          const Text(
            'One row per breed per day-of-age — the (breed, day) pair must be unique.',
            style: TextStyle(fontSize: 12, color: Colors.grey),
          ),
        ];
      case 'vaccination-schedules':
        return [
          tf('name', 'Name', required: true,
              hint: 'e.g. Standard Botswana'),
          breedPicker(),
          tf('description', 'Description', maxLines: 2),
          sw('Default schedule for new flocks', _isDefault,
              (v) => setState(() => _isDefault = v)),
          _itemsHeader('Schedule items', _scheduleItems.length, () {
            setState(() => _scheduleItems.add({
                  'vaccineName': TextEditingController(),
                  'vaccineType': TextEditingController(),
                  'ageDays': TextEditingController(text: '1'),
                  'adminMethod': TextEditingController(),
                  'notes': TextEditingController(),
                }));
          }),
          for (var idx = 0; idx < _scheduleItems.length; idx++)
            _scheduleItemCard(idx),
          const Text(
            'Items replace the whole list on save — remove rows to delete them.',
            style: TextStyle(fontSize: 12, color: Colors.grey),
          ),
        ];
      case 'supplier-category-templates':
        return [
          if (!_isEdit)
            tf('category', 'Category key', required: true,
                hint: 'e.g. feed, chicks, vet'),
          tf('name', 'Name', required: true),
          tf('description', 'Description', maxLines: 2),
          tf('sortOrder', 'Sort order', kb: TextInputType.number),
          sw('Active', _isActive, (v) => setState(() => _isActive = v)),
          _itemsHeader('Line items', _templateItems.length, () {
            setState(() => _templateItems.add({
                  'itemName': TextEditingController(),
                  'itemType': 'feed',
                  'isRequired': true,
                }));
          }),
          for (var idx = 0; idx < _templateItems.length; idx++)
            _templateItemCard(idx),
          const Text(
            'Items replace the whole list on save — remove rows to delete them.',
            style: TextStyle(fontSize: 12, color: Colors.grey),
          ),
        ];
    }
    return const [];
  }

  Widget _itemsHeader(String label, int count, VoidCallback add) => Padding(
        padding: const EdgeInsets.only(bottom: 8, top: 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('$label ($count)',
                style: const TextStyle(fontWeight: FontWeight.bold)),
            TextButton.icon(
              onPressed: add,
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Add'),
            ),
          ],
        ),
      );

  Widget _scheduleItemCard(int idx) {
    final item = _scheduleItems[idx];
    Widget f(String key, String hint,
            {TextInputType? kb, int maxLines = 1}) =>
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: TextField(
            controller: item[key] as TextEditingController,
            keyboardType: kb,
            maxLines: maxLines,
            decoration: InputDecoration(
                hintText: hint,
                isDense: true,
                border: const OutlineInputBorder()),
            onChanged: (_) => setState(() {}),
          ),
        );
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(children: [
          Row(children: [
            Expanded(
                child: Text('Item ${idx + 1}',
                    style: const TextStyle(fontSize: 12))),
            IconButton(
              icon: const Icon(Icons.close, size: 16),
              onPressed: () => setState(() {
                for (final v in item.values) {
                  if (v is TextEditingController) v.dispose();
                }
                _scheduleItems.removeAt(idx);
              }),
            ),
          ]),
          f('vaccineName', 'Vaccine name'),
          f('vaccineType', 'Type (e.g. live)'),
          f('ageDays', 'Day of age', kb: TextInputType.number),
          f('adminMethod', 'Method (e.g. eye drop)'),
          f('notes', 'Notes (optional)'),
        ]),
      ),
    );
  }

  Widget _templateItemCard(int idx) {
    final item = _templateItems[idx];
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(children: [
          Row(children: [
            Expanded(
                child: Text('Item ${idx + 1}',
                    style: const TextStyle(fontSize: 12))),
            IconButton(
              icon: const Icon(Icons.close, size: 16),
              onPressed: () =>
                  setState(() => _templateItems.removeAt(idx)),
            ),
          ]),
          TextField(
            controller: item['itemName'] as TextEditingController,
            decoration: const InputDecoration(
                hintText: 'Item name (e.g. Starter Crumble)',
                isDense: true,
                border: OutlineInputBorder()),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(
              child: DropdownButtonFormField<String>(
                initialValue: item['itemType'] as String,
                decoration: const InputDecoration(
                    isDense: true, border: OutlineInputBorder()),
                items: const [
                  DropdownMenuItem(value: 'feed', child: Text('Feed')),
                  DropdownMenuItem(value: 'chick', child: Text('Chick')),
                  DropdownMenuItem(
                      value: 'medication', child: Text('Medication')),
                  DropdownMenuItem(value: 'other', child: Text('Other')),
                ],
                onChanged: (v) =>
                    setState(() => item['itemType'] = v ?? 'feed'),
              ),
            ),
            const SizedBox(width: 12),
            FilterChip(
              label: const Text('Required', style: TextStyle(fontSize: 12)),
              selected: item['isRequired'] == true,
              onSelected: (v) =>
                  setState(() => item['isRequired'] = v),
            ),
          ]),
        ]),
      ),
    );
  }
}
