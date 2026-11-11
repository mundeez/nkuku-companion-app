import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/support_service.dart';

/// Ticket thread (P3 tenant support): message bubbles (staff left, user
/// right), reply box, and a 'Close ticket' action for open tickets —
/// mirrors the web /support/[id] page.
class SupportTicketScreen extends StatefulWidget {
  final String id;

  const SupportTicketScreen({super.key, required this.id});

  @override
  State<SupportTicketScreen> createState() => _SupportTicketScreenState();
}

class _SupportTicketScreenState extends State<SupportTicketScreen> {
  Map<String, dynamic>? _ticket;
  List<Map<String, dynamic>> _messages = [];
  bool _loading = true;
  String? _error;
  bool _sending = false;
  bool _closing = false;

  final _replyController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _replyController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await SupportService.getTicket(widget.id);
      if (mounted) {
        final rawMessages = data['messages'] as List? ?? const [];
        setState(() {
          _ticket = (data['ticket'] as Map?)?.cast<String, dynamic>();
          // internalNote rows are already filtered server-side; hide any
          // that slip through as a second layer of defence.
          _messages = rawMessages
              .cast<Map<String, dynamic>>()
              .where((m) => m['internalNote'] != true)
              .toList();
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

  bool get _isOpen {
    // The API accepts replies on every status except 'closed' — a reply on
    // a 'waiting_on_user'/'resolved' ticket reopens it to 'open'.
    final status = _ticket?['status']?.toString();
    return status != 'closed';
  }

  String _fmtDate(String? iso) {
    if (iso == null || iso.isEmpty) return '—';
    final d = DateTime.tryParse(iso)?.toLocal();
    if (d == null) return '—';
    return DateFormat('dd MMM yyyy, HH:mm').format(d);
  }

  Future<void> _sendReply() async {
    final body = _replyController.text.trim();
    if (body.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await SupportService.reply(widget.id, body);
      if (mounted) {
        _replyController.clear();
        await _load();
        if (mounted) setState(() => _sending = false);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _sending = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _closeTicket() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Close ticket'),
        content: const Text(
            'Close this ticket? You can still read the conversation afterwards.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Close ticket'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _closing = true);
    try {
      await SupportService.closeTicket(widget.id);
      if (mounted) {
        await _load();
        if (mounted) setState(() => _closing = false);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _closing = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = _ticket?['status']?.toString();
    final category = _ticket?['category']?.toString();
    final subject = _ticket?['subject']?.toString() ?? 'Ticket';

    return Scaffold(
      appBar: AppBar(
        title: Text(subject, maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          if (_isOpen && !_loading)
            TextButton.icon(
              onPressed: _closing ? null : _closeTicket,
              icon: const Icon(Icons.check_circle_outline, size: 18),
              label: Text(_closing ? 'Closing…' : 'Close'),
            ),
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
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
              : Column(
                  children: [
                    // Ticket meta line
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                      child: Row(
                        children: [
                          Chip(
                            label: Text(
                              (status ?? 'open').replaceAll('_', ' '),
                              style: const TextStyle(fontSize: 11),
                            ),
                            visualDensity: VisualDensity.compact,
                          ),
                          const SizedBox(width: 8),
                          if (category != null)
                            Chip(
                              label: Text(category,
                                  style: const TextStyle(fontSize: 11)),
                              visualDensity: VisualDensity.compact,
                            ),
                          const Spacer(),
                          Text(
                            _fmtDate(_ticket?['createdAt']?.toString()),
                            style: const TextStyle(
                                fontSize: 11, color: Colors.grey),
                          ),
                        ],
                      ),
                    ),
                    const Divider(height: 1),
                    // Messages
                    Expanded(
                      child: _messages.isEmpty
                          ? const Center(
                              child: Text('No messages yet',
                                  style: TextStyle(color: Colors.grey)),
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.all(12),
                              itemCount: _messages.length,
                              itemBuilder: (context, i) =>
                                  _MessageBubble(message: _messages[i], fmt: _fmtDate),
                            ),
                    ),
                    // Reply box / closed banner
                    if (_isOpen)
                      SafeArea(
                        top: false,
                        child: Container(
                          padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                          decoration: BoxDecoration(
                            color:
                                Theme.of(context).colorScheme.surfaceContainerHighest,
                            border: Border(
                              top: BorderSide(
                                  color: Theme.of(context).dividerColor),
                            ),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: _replyController,
                                  maxLines: 4,
                                  minLines: 1,
                                  maxLength: 10000,
                                  textCapitalization:
                                      TextCapitalization.sentences,
                                  decoration: const InputDecoration(
                                    hintText: 'Write a reply…',
                                    border: OutlineInputBorder(),
                                    isDense: true,
                                    counterText: '',
                                    contentPadding: EdgeInsets.symmetric(
                                        horizontal: 12, vertical: 10),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              IconButton.filled(
                                onPressed: _sending ? null : _sendReply,
                                icon: _sending
                                    ? const SizedBox(
                                        height: 18,
                                        width: 18,
                                        child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Colors.white))
                                    : const Icon(Icons.send),
                              ),
                            ],
                          ),
                        ),
                      )
                    else
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        color: Theme.of(context)
                            .colorScheme
                            .surfaceContainerHighest,
                        child: Text(
                          'This ticket is closed. Replies are no longer accepted.',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                              fontSize: 13, color: Colors.grey),
                        ),
                      ),
                  ],
                ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final Map<String, dynamic> message;
  final String Function(String?) fmt;

  const _MessageBubble({required this.message, required this.fmt});

  @override
  Widget build(BuildContext context) {
    final fromStaff = message['authorType'] == 'staff';
    final theme = Theme.of(context);
    final bubbleColor = fromStaff
        ? theme.colorScheme.surfaceContainerHighest
        : theme.colorScheme.primary;
    final textColor =
        fromStaff ? theme.colorScheme.onSurface : theme.colorScheme.onPrimary;

    return Align(
      alignment: fromStaff ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.82),
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: bubbleColor,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (fromStaff) ...[
                  const Icon(Icons.support_agent, size: 13),
                  const SizedBox(width: 4),
                ],
                Text(
                  fromStaff ? 'Support team' : 'You',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: textColor.withValues(alpha: 0.85),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  fmt(message['createdAt']?.toString()),
                  style: TextStyle(
                      fontSize: 10, color: textColor.withValues(alpha: 0.6)),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              message['body']?.toString() ?? '',
              style: TextStyle(fontSize: 14, color: textColor),
            ),
          ],
        ),
      ),
    );
  }
}
