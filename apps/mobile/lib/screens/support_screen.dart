import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/support_service.dart';
import 'support_ticket_screen.dart';

/// 'My tickets' list (P3 tenant support). Mirrors the web /support page:
/// subject, status badge, category, last activity + a "New ticket" flow.
/// Owners also see org tickets — those items carry `requesterEmail`.
class SupportScreen extends StatefulWidget {
  const SupportScreen({super.key});

  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen> {
  List<Map<String, dynamic>> _tickets = [];
  bool _loading = true;
  String? _error;

  static const _categoryLabels = {
    'general': 'General',
    'billing': 'Billing',
    'bug': 'Bug report',
    'account': 'Account',
    'other': 'Other',
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final tickets = await SupportService.getTickets();
      if (mounted) {
        setState(() {
          _tickets = tickets;
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

  Color _statusColor(String? status) {
    switch (status) {
      case 'open':
        return Colors.green;
      case 'in_progress':
      case 'pending':
        return Colors.amber.shade800;
      case 'waiting_on_user':
        return Colors.blue;
      case 'resolved':
      case 'closed':
        return Colors.grey;
      default:
        return Colors.grey;
    }
  }

  String _statusLabel(String? status) {
    switch (status) {
      case 'in_progress':
      case 'pending':
        return 'In progress';
      case 'waiting_on_user':
        return 'Waiting on you';
      default:
        final s = status ?? 'open';
        return s[0].toUpperCase() + s.substring(1).replaceAll('_', ' ');
    }
  }

  String _fmtDate(String? iso) {
    if (iso == null || iso.isEmpty) return '—';
    final d = DateTime.tryParse(iso)?.toLocal();
    if (d == null) return '—';
    return DateFormat('dd MMM yyyy, HH:mm').format(d);
  }

  Future<void> _openNewTicket() async {
    final created = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => const _NewTicketSheet(),
    );
    if (created != null && mounted) {
      _load();
      final id = created['ticket']?['id'] ?? created['id'];
      if (id != null) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => SupportTicketScreen(id: id.toString()),
          ),
        );
      }
    }
  }

  Future<void> _openTicket(Map<String, dynamic> ticket) async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => SupportTicketScreen(id: ticket['id'].toString()),
      ),
    );
    _load(); // status/messageCount may have changed (reply/close)
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Support'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openNewTicket,
        icon: const Icon(Icons.add),
        label: const Text('New ticket'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!,
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Colors.red.shade700)),
                        const SizedBox(height: 12),
                        FilledButton.tonal(
                            onPressed: _load, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : _tickets.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(32),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.support_agent,
                                size: 64, color: Colors.grey.shade400),
                            const SizedBox(height: 16),
                            const Text('No support tickets yet',
                                style: TextStyle(fontSize: 16)),
                            const SizedBox(height: 8),
                            Text(
                              'Tap "New ticket" to contact our team.',
                              style: TextStyle(color: Colors.grey.shade600),
                            ),
                          ],
                        ),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(12),
                        itemCount: _tickets.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, i) {
                          final t = _tickets[i];
                          final status = t['status']?.toString();
                          final category = t['category']?.toString();
                          final lastActivity = (t['lastMessageAt'] ??
                                  t['createdAt'])
                              ?.toString();
                          final messageCount =
                              (t['messageCount'] as num?)?.toInt() ?? 0;
                          final requesterEmail =
                              t['requesterEmail']?.toString();
                          return Card(
                            margin: EdgeInsets.zero,
                            child: ListTile(
                              onTap: () => _openTicket(t),
                              title: Text(
                                t['subject']?.toString() ?? 'Ticket',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const SizedBox(height: 4),
                                  Text(
                                    '${_categoryLabels[category] ?? category ?? 'General'} · '
                                    '$messageCount message${messageCount == 1 ? '' : 's'} · '
                                    '${_fmtDate(lastActivity)}',
                                    style: const TextStyle(fontSize: 12),
                                  ),
                                  if (requesterEmail != null &&
                                      requesterEmail.isNotEmpty)
                                    Text(
                                      'by $requesterEmail',
                                      style: const TextStyle(
                                          fontSize: 12, color: Colors.grey),
                                    ),
                                ],
                              ),
                              trailing: Chip(
                                label: Text(
                                  _statusLabel(status),
                                  style: const TextStyle(fontSize: 11),
                                ),
                                backgroundColor:
                                    _statusColor(status).withValues(alpha: 0.15),
                                side: BorderSide.none,
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}

/// New-ticket form shown as a scrollable modal sheet.
class _NewTicketSheet extends StatefulWidget {
  const _NewTicketSheet();

  @override
  State<_NewTicketSheet> createState() => _NewTicketSheetState();
}

class _NewTicketSheetState extends State<_NewTicketSheet> {
  final _subjectController = TextEditingController();
  final _bodyController = TextEditingController();
  String _category = 'general';
  bool _submitting = false;
  String? _error;

  static const _categories = {
    'general': 'General',
    'billing': 'Billing',
    'bug': 'Bug report',
    'account': 'Account',
    'other': 'Other',
  };

  @override
  void dispose() {
    _subjectController.dispose();
    _bodyController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final subject = _subjectController.text.trim();
    final body = _bodyController.text.trim();
    if (subject.length < 3 || subject.length > 200) {
      setState(
          () => _error = 'Subject must be between 3 and 200 characters.');
      return;
    }
    if (body.isEmpty || body.length > 10000) {
      setState(
          () => _error = 'Message must be between 1 and 10,000 characters.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final res = await SupportService.createTicket(
        subject: subject,
        body: body,
        category: _category,
      );
      if (mounted) Navigator.pop(context, res);
    } catch (e) {
      if (mounted) {
        setState(() {
          _submitting = false;
          _error = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      // Keep the sheet above the soft keyboard.
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text('Contact support',
                      style:
                          TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              initialValue: _category,
              decoration: const InputDecoration(
                labelText: 'Category',
                border: OutlineInputBorder(),
              ),
              items: _categories.entries
                  .map((e) =>
                      DropdownMenuItem(value: e.key, child: Text(e.value)))
                  .toList(),
              onChanged: (v) => setState(() => _category = v ?? 'general'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _subjectController,
              maxLength: 200,
              decoration: const InputDecoration(
                labelText: 'Subject',
                hintText: 'Short summary of your issue',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 4),
            TextField(
              controller: _bodyController,
              maxLength: 10000,
              maxLines: 6,
              decoration: const InputDecoration(
                labelText: 'Message',
                hintText:
                    'Describe the problem, what you expected, and any steps to reproduce…',
                border: OutlineInputBorder(),
                alignLabelWithHint: true,
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!,
                  style: TextStyle(color: Colors.red.shade700, fontSize: 13)),
            ],
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: _submitting ? null : _submit,
              icon: _submitting
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.send),
              label: Text(_submitting ? 'Sending…' : 'Send ticket'),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}
