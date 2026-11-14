import 'package:flutter/material.dart';
import '../api.dart';

/// Ticket thread — messages, staff reply (public/internal), status actions.
class TicketDetailScreen extends StatefulWidget {
  final String ticketId;
  const TicketDetailScreen({super.key, required this.ticketId});

  @override
  State<TicketDetailScreen> createState() => _TicketDetailScreenState();
}

class _TicketDetailScreenState extends State<TicketDetailScreen> {
  Map<String, dynamic>? _data;
  String? _error;
  final _reply = TextEditingController();
  bool _internalNote = false;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await Api.ticketDetail(widget.ticketId);
      if (mounted) setState(() { _data = d; _error = null; });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  Future<void> _send() async {
    final body = _reply.text.trim();
    if (body.isEmpty) return;
    setState(() => _sending = true);
    try {
      final res = await Api.ticketReply(widget.ticketId, body,
          internalNote: _internalNote);
      _reply.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(_internalNote
              ? 'Internal note added'
              : res['emailSent'] == true
                  ? 'Reply sent (email delivered)'
                  : 'Reply sent (email not delivered)'),
        ));
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Reply failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _setStatus(String status) async {
    try {
      await Api.ticketStatus(widget.ticketId, status);
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Status change failed: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = _data?['ticket'] as Map<String, dynamic>?;
    final org = _data?['organization'] as Map<String, dynamic>?;
    final requester = _data?['requester'] as Map<String, dynamic>?;
    final messages = (_data?['messages'] as List?) ?? [];
    final status = '${t?['status'] ?? ''}';

    return Scaffold(
      appBar: AppBar(
        title: Text(t?['subject'] ?? 'Ticket',
            maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: _setStatus,
            itemBuilder: (_) => [
              for (final s in [
                'open',
                'in_progress',
                'waiting_on_user',
                'resolved',
                'closed'
              ])
                PopupMenuItem(
                  value: s,
                  enabled: s != status,
                  child: Text('Mark $s'),
                ),
            ],
          ),
        ],
      ),
      body: Column(children: [
        if (_error != null)
          Padding(
            padding: const EdgeInsets.all(12),
            child:
                Text('Load failed: $_error', style: const TextStyle(color: Colors.red)),
          ),
        if (t == null && _error == null)
          const Expanded(child: Center(child: CircularProgressIndicator()))
        else
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(12),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${t?['category'] ?? ''} · $status · ${t?['priority'] ?? ''}',
                            style: const TextStyle(
                                fontSize: 12, color: Colors.grey)),
                        const SizedBox(height: 4),
                        Text(
                          '${org?['name'] ?? ''} · ${requester?['name'] ?? requester?['email'] ?? ''}',
                          style: const TextStyle(fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                for (final m in messages)
                  Align(
                    alignment: m['authorType'] == 'staff'
                        ? Alignment.centerRight
                        : Alignment.centerLeft,
                    child: Container(
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      padding: const EdgeInsets.all(10),
                      constraints: BoxConstraints(
                          maxWidth: MediaQuery.of(context).size.width * 0.8),
                      decoration: BoxDecoration(
                        color: m['internalNote'] == true
                            ? Colors.amber.shade100
                            : m['authorType'] == 'staff'
                                ? Theme.of(context)
                                    .colorScheme
                                    .primaryContainer
                                : Theme.of(context)
                                    .colorScheme
                                    .surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${m['author']?['name'] ?? m['author']?['email'] ?? m['authorType']}${m['internalNote'] == true ? ' · internal' : ''}',
                            style: const TextStyle(
                                fontSize: 10, color: Colors.black54),
                          ),
                          const SizedBox(height: 2),
                          Text('${m['body'] ?? ''}',
                              style: const TextStyle(fontSize: 13)),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
            child: Column(children: [
              Row(children: [
                Expanded(
                  child: TextField(
                    controller: _reply,
                    minLines: 1,
                    maxLines: 4,
                    decoration: InputDecoration(
                      hintText: _internalNote
                          ? 'Internal note (not emailed)…'
                          : 'Reply to requester…',
                      border: const OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: _sending
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.send),
                  onPressed: _sending ? null : _send,
                ),
              ]),
              Row(children: [
                Checkbox(
                  value: _internalNote,
                  onChanged: (v) =>
                      setState(() => _internalNote = v ?? false),
                ),
                const Text('Internal note', style: TextStyle(fontSize: 12)),
              ]),
            ]),
          ),
        ),
      ]),
    );
  }
}
