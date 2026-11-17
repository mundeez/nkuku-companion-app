import 'package:flutter/material.dart';
import '../api.dart';
import '../reauth.dart';

/// Announcements — in-app banners shown to tenant users. Mobile parity
/// with admin-web P4 announcements page.
class AnnouncementsScreen extends StatefulWidget {
  const AnnouncementsScreen({super.key});

  @override
  State<AnnouncementsScreen> createState() => _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  List<dynamic>? _items;
  List<dynamic> _plans = [];
  bool _canWrite = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    Api.hasPermission('announcements.write').then((v) {
      if (mounted) setState(() => _canWrite = v);
    });
    _load();
    // Plan chips are a nicety for audience=plans — tolerate failure
    // (marketing role lacks billing.read).
    Api.plans().then((p) {
      p.sort((a, b) =>
          ((a['sortOrder'] as num?) ?? 0)
              .compareTo((b['sortOrder'] as num?) ?? 0));
      if (mounted) setState(() => _plans = p);
    }).catchError((_) {});
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final items = await Api.announcements();
      if (mounted) setState(() => _items = items);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  bool _isActiveNow(Map<String, dynamic> a) {
    final now = DateTime.now().millisecondsSinceEpoch;
    final start = DateTime.tryParse('${a['startsAt']}')
        ?.millisecondsSinceEpoch;
    final end = DateTime.tryParse('${a['endsAt']}')
        ?.millisecondsSinceEpoch;
    if (start != null && start > now) return false;
    if (end != null && end < now) return false;
    return true;
  }

  String _audienceSummary(Map<String, dynamic> a) {
    if (a['audience'] == 'plans') {
      final codes = (a['planCodes'] as List?) ?? const [];
      return codes.isEmpty ? 'Plans (none selected)' : 'Plans: ${codes.join(', ')}';
    }
    if (a['audience'] == 'orgs') {
      final ids = (a['orgIds'] as List?) ?? const [];
      return '${ids.length} org${ids.length == 1 ? '' : 's'}';
    }
    return 'All tenants';
  }

  Future<void> _edit([Map<String, dynamic>? item]) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => _AnnouncementEditor(
            item: item, plans: _plans),
      ),
    );
    if (changed == true) _load();
  }

  Future<void> _delete(Map<String, dynamic> a) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete announcement?'),
        content: Text('"${a['title']}" will be removed for all tenants.'),
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
      await Api.announcementDelete('${a['id']}');
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
      body: _items == null
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
                    'In-app banners shown to tenant users — includes scheduled '
                    'and expired entries.',
                    style: TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                  const SizedBox(height: 12),
                  if (_items!.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(32),
                      child: Center(child: Text('No announcements yet.')),
                    )
                  else
                    for (final raw in _items!)
                      _announcementCard(raw as Map<String, dynamic>),
                ],
              ),
            ),
    );
  }

  Widget _announcementCard(Map<String, dynamic> a) {
    final active = _isActiveNow(a);
    final upcoming = DateTime.tryParse('${a['startsAt']}')
            ?.isAfter(DateTime.now()) ??
        false;
    final dot = active
        ? Colors.green
        : upcoming
            ? Colors.blue
            : Colors.grey;
    return Card(
      child: ListTile(
        leading: Icon(Icons.circle, size: 10, color: dot),
        title: Text('${a['title']}',
            style: const TextStyle(fontSize: 14),
            maxLines: 1,
            overflow: TextOverflow.ellipsis),
        subtitle: Text(
          '${a['severity']} · ${_audienceSummary(a)} · '
          '${a['dismissalCount'] ?? 0} dismissals'
          '${a['isDismissible'] == false ? ' (sticky)' : ''}',
          style: const TextStyle(fontSize: 11),
        ),
        trailing: _canWrite
            ? Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: const Icon(Icons.edit_outlined, size: 18),
                    onPressed: () => _edit(a),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline,
                        size: 18, color: Colors.red),
                    onPressed: () => _delete(a),
                  ),
                ],
              )
            : null,
        onTap: _canWrite ? () => _edit(a) : null,
      ),
    );
  }
}

// ══════════════ Announcement editor ══════════════

class _AnnouncementEditor extends StatefulWidget {
  final Map<String, dynamic>? item;
  final List<dynamic> plans;
  const _AnnouncementEditor({this.item, required this.plans});

  @override
  State<_AnnouncementEditor> createState() => _AnnouncementEditorState();
}

class _AnnouncementEditorState extends State<_AnnouncementEditor> {
  final _form = GlobalKey<FormState>();
  bool _busy = false;
  String? _error;

  late final TextEditingController _title;
  late final TextEditingController _body;
  late final TextEditingController _linkUrl;
  late final TextEditingController _linkLabel;
  late final TextEditingController _startsAt;
  late final TextEditingController _endsAt;
  late final TextEditingController _orgInput;
  late String _severity;
  late String _audience;
  late bool _isDismissible;
  late List<String> _planCodes;
  late List<String> _orgIds;

  @override
  void initState() {
    super.initState();
    final a = widget.item ?? {};
    _title = TextEditingController(text: '${a['title'] ?? ''}');
    _body = TextEditingController(text: '${a['body'] ?? ''}');
    _linkUrl = TextEditingController(text: '${a['linkUrl'] ?? ''}');
    _linkLabel =
        TextEditingController(text: '${a['linkLabel'] ?? ''}');
    _startsAt = TextEditingController(text: _toLocal(a['startsAt']));
    _endsAt = TextEditingController(text: _toLocal(a['endsAt']));
    _orgInput = TextEditingController();
    _severity = '${a['severity'] ?? 'info'}';
    _audience = '${a['audience'] ?? 'all'}';
    _isDismissible = a['isDismissible'] != false;
    _planCodes = [
      for (final c in (a['planCodes'] as List? ?? const [])) '$c',
    ];
    _orgIds = [
      for (final c in (a['orgIds'] as List? ?? const [])) '$c',
    ];
  }

  static String _toLocal(dynamic iso) {
    if (iso == null) return '';
    final d = DateTime.tryParse('$iso');
    if (d == null) return '';
    String p(int n) => n.toString().padLeft(2, '0');
    return '${d.year}-${p(d.month)}-${p(d.day)}T${p(d.hour)}:${p(d.minute)}';
  }

  static String? _fromLocal(String v) {
    if (v.trim().isEmpty) return null;
    final d = DateTime.tryParse(v.trim());
    return d?.toUtc().toIso8601String();
  }

  @override
  void dispose() {
    for (final c in [
      _title, _body, _linkUrl, _linkLabel, _startsAt, _endsAt, _orgInput,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    if (_audience == 'plans' && _planCodes.isEmpty) {
      setState(() => _error = 'Select at least one plan for audience=plans.');
      return;
    }
    if (_audience == 'orgs' && _orgIds.isEmpty) {
      setState(() => _error = 'Add at least one organisation for audience=orgs.');
      return;
    }
    setState(() { _busy = true; _error = null; });
    try {
      if (!await ensureReauth(context)) {
        setState(() => _busy = false);
        return;
      }
      final body = <String, dynamic>{
        'title': _title.text.trim(),
        'body': _body.text,
        'severity': _severity,
        'audience': _audience,
        'planCodes': _audience == 'plans' ? _planCodes : null,
        'orgIds': _audience == 'orgs' ? _orgIds : null,
        'linkUrl': _linkUrl.text.trim().isEmpty ? null : _linkUrl.text.trim(),
        'linkLabel':
            _linkLabel.text.trim().isEmpty ? null : _linkLabel.text.trim(),
        'startsAt': _fromLocal(_startsAt.text),
        'endsAt': _fromLocal(_endsAt.text),
        'isDismissible': _isDismissible,
      };
      final editing = widget.item != null;
      if (editing) {
        await Api.announcementUpdate('${widget.item!['id']}', body);
      } else {
        await Api.announcementCreate(body);
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
          title: Text(widget.item == null
              ? 'New announcement'
              : 'Edit announcement')),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _title,
              decoration: const InputDecoration(
                  labelText: 'Title', border: OutlineInputBorder()),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _body,
              maxLines: 4,
              decoration: const InputDecoration(
                  labelText: 'Body', border: OutlineInputBorder()),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _severity,
              decoration: const InputDecoration(
                  labelText: 'Severity', border: OutlineInputBorder()),
              items: const [
                DropdownMenuItem(value: 'info', child: Text('Info')),
                DropdownMenuItem(
                    value: 'warning', child: Text('Warning')),
                DropdownMenuItem(
                    value: 'critical', child: Text('Critical')),
              ],
              onChanged: (v) =>
                  setState(() => _severity = v ?? 'info'),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _audience,
              decoration: const InputDecoration(
                  labelText: 'Audience', border: OutlineInputBorder()),
              items: const [
                DropdownMenuItem(
                    value: 'all', child: Text('All tenants')),
                DropdownMenuItem(
                    value: 'plans', child: Text('Specific plans')),
                DropdownMenuItem(
                    value: 'orgs',
                    child: Text('Specific organisations')),
              ],
              onChanged: (v) =>
                  setState(() => _audience = v ?? 'all'),
            ),
            const SizedBox(height: 12),
            if (_audience == 'plans') ...[
              const Text('Plan codes',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              if (widget.plans.isEmpty)
                const Text(
                    'Plan list unavailable — you can still save; re-open later.',
                    style: TextStyle(fontSize: 12, color: Colors.grey))
              else
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  children: [
                    for (final p in widget.plans)
                      FilterChip(
                        label: Text('${p['name']} (${p['code']})',
                            style: const TextStyle(fontSize: 11)),
                        selected: _planCodes.contains('${p['code']}'),
                        onSelected: (v) => setState(() {
                          final code = '${p['code']}';
                          if (v) {
                            _planCodes.add(code);
                          } else {
                            _planCodes.remove(code);
                          }
                        }),
                      ),
                  ],
                ),
            ],
            if (_audience == 'orgs') ...[
              const SizedBox(height: 12),
              const Text('Organisation IDs',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(
                  child: TextField(
                    controller: _orgInput,
                    decoration: const InputDecoration(
                        hintText: 'organisation id (uuid)',
                        isDense: true,
                        border: OutlineInputBorder()),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton.tonal(
                  onPressed: () {
                    final id = _orgInput.text.trim();
                    if (id.isNotEmpty && !_orgIds.contains(id)) {
                      setState(() {
                        _orgIds.add(id);
                        _orgInput.clear();
                      });
                    }
                  },
                  child: const Text('Add'),
                ),
              ]),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  for (final id in _orgIds)
                    Chip(
                      label: Text(id,
                          style: const TextStyle(
                              fontFamily: 'monospace', fontSize: 10)),
                      onDeleted: () =>
                          setState(() => _orgIds.remove(id)),
                    ),
                ],
              ),
            ],
            const SizedBox(height: 12),
            TextFormField(
              controller: _linkUrl,
              keyboardType: TextInputType.url,
              decoration: const InputDecoration(
                  labelText: 'Link URL (optional)',
                  hintText: 'https://…',
                  border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _linkLabel,
              decoration: const InputDecoration(
                  labelText: 'Link label',
                  border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _startsAt,
              decoration: const InputDecoration(
                  labelText: 'Starts at (blank = now)',
                  hintText: 'YYYY-MM-DDTHH:MM',
                  border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _endsAt,
              decoration: const InputDecoration(
                  labelText: 'Ends at (blank = open-ended)',
                  hintText: 'YYYY-MM-DDTHH:MM',
                  border: OutlineInputBorder()),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Dismissible',
                  style: TextStyle(fontSize: 14)),
              value: _isDismissible,
              onChanged: (v) => setState(() => _isDismissible = v),
            ),
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
                  : Text(widget.item == null
                      ? 'Create announcement'
                      : 'Save changes'),
            ),
          ],
        ),
      ),
    );
  }
}
