import 'package:flutter/material.dart';
import '../api.dart';
import 'ticket_detail.dart';

/// Support inbox — ticket list with status filter chips.
class TicketsScreen extends StatefulWidget {
  const TicketsScreen({super.key});

  @override
  State<TicketsScreen> createState() => _TicketsScreenState();
}

class _TicketsScreenState extends State<TicketsScreen> {
  List<dynamic> _items = [];
  bool _loading = true;
  String? _error;
  String? _status;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final items = await Api.supportTickets(status: _status);
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
          child: Wrap(
            spacing: 8,
            children: [
              for (final s in [
                null,
                'open',
                'in_progress',
                'waiting_on_user',
                'resolved',
                'closed'
              ])
                FilterChip(
                  label: Text(s ?? 'all'),
                  selected: _status == s,
                  onSelected: (_) {
                    setState(() => _status = s);
                    _load();
                  },
                ),
            ],
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                  ? Center(child: Text('Error: $_error'))
                  : _items.isEmpty
                      ? const Center(child: Text('No tickets'))
                      : RefreshIndicator(
                          onRefresh: _load,
                          child: ListView.builder(
                            itemCount: _items.length,
                            itemBuilder: (_, i) {
                              final t = _items[i] as Map<String, dynamic>;
                              final status = '${t['status'] ?? ''}';
                              final org = t['organization'] as Map?;
                              final awaiting = t['awaitingStaffReply'] == true;
                              return ListTile(
                                leading: Icon(
                                  awaiting
                                      ? Icons.mark_email_unread_outlined
                                      : Icons.drafts_outlined,
                                  color: awaiting ? Colors.orange : null,
                                ),
                                title: Text('${t['subject'] ?? 'Ticket ${t['id']}'}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis),
                                subtitle: Text(
                                  '${org?['name'] ?? ''} · $status · ${t['priority'] ?? ''}',
                                  style: const TextStyle(fontSize: 12),
                                ),
                                trailing: const Icon(Icons.chevron_right, size: 18),
                                onTap: () async {
                                  await Navigator.of(context).push(
                                    MaterialPageRoute(
                                      builder: (_) =>
                                          TicketDetailScreen(ticketId: '${t['id']}'),
                                    ),
                                  );
                                  _load();
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
