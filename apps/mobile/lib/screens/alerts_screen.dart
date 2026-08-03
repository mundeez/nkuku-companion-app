import 'package:flutter/material.dart';
import '../models/alert.dart';
import '../services/alerts_service.dart';
import '../services/auth_service.dart';

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  List<Alert> _alerts = [];
  bool _loading = true;
  String? _error;
  String? _statusFilter;   // null=all, 'open', 'resolved'
  String? _severityFilter; // null=all, 'info', 'warning', 'critical'
  bool _generating = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final alerts = await AlertsService.getAlerts(
        status: _statusFilter,
        severity: _severityFilter,
      );
      setState(() { _alerts = alerts; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _generate() async {
    setState(() => _generating = true);
    try {
      final result = await AlertsService.generate();
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Generated ${result.generated} new alert(s)')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error generating alerts: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  Future<void> _markRead(Alert alert) async {
    try {
      final updated = await AlertsService.markRead(alert.id);
      setState(() {
        final idx = _alerts.indexWhere((a) => a.id == alert.id);
        if (idx != -1) _alerts[idx] = updated;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _markResolved(Alert alert) async {
    try {
      final updated = await AlertsService.markResolved(alert.id);
      setState(() {
        final idx = _alerts.indexWhere((a) => a.id == alert.id);
        if (idx != -1) _alerts[idx] = updated;
      });
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _deleteAlert(Alert alert) async {
    if (!AuthService.canDelete) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete alert?'),
        content: Text('Delete "${alert.title}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await AlertsService.delete(alert.id);
      setState(() => _alerts.removeWhere((a) => a.id == alert.id));
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Delete failed: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  void _showDetail(Alert alert) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _AlertDetailSheet(
        alert: alert,
        onMarkRead: !alert.isRead && AuthService.canEdit ? () => _markRead(alert) : null,
        onResolve: !alert.isResolved && AuthService.canEdit ? () => _markResolved(alert) : null,
        onDelete: AuthService.canDelete ? () => _deleteAlert(alert) : null,
      ),
    );
  }

  Widget _buildFilterChips() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Row(
        children: [
          // Status filters
          _filterChip(
            label: 'All',
            selected: _statusFilter == null && _severityFilter == null,
            onSelected: (_) => setState(() { _statusFilter = null; _severityFilter = null; _load(); }),
          ),
          const SizedBox(width: 6),
          _filterChip(
            label: 'Open',
            selected: _statusFilter == 'open',
            onSelected: (_) => setState(() { _statusFilter = _statusFilter == 'open' ? null : 'open'; _load(); }),
          ),
          const SizedBox(width: 6),
          _filterChip(
            label: 'Resolved',
            selected: _statusFilter == 'resolved',
            onSelected: (_) => setState(() { _statusFilter = _statusFilter == 'resolved' ? null : 'resolved'; _load(); }),
          ),
          const SizedBox(width: 12),
          Container(width: 1, height: 20, color: Colors.grey.shade300),
          const SizedBox(width: 12),
          // Severity filters
          _filterChip(
            label: 'Info',
            selected: _severityFilter == 'info',
            color: Colors.blue,
            onSelected: (_) => setState(() { _severityFilter = _severityFilter == 'info' ? null : 'info'; _load(); }),
          ),
          const SizedBox(width: 6),
          _filterChip(
            label: 'Warning',
            selected: _severityFilter == 'warning',
            color: Colors.orange,
            onSelected: (_) => setState(() { _severityFilter = _severityFilter == 'warning' ? null : 'warning'; _load(); }),
          ),
          const SizedBox(width: 6),
          _filterChip(
            label: 'Critical',
            selected: _severityFilter == 'critical',
            color: Colors.red,
            onSelected: (_) => setState(() { _severityFilter = _severityFilter == 'critical' ? null : 'critical'; _load(); }),
          ),
        ],
      ),
    );
  }

  Widget _filterChip({
    required String label,
    required bool selected,
    Color? color,
    required void Function(bool) onSelected,
  }) {
    final effectiveColor = color ?? Theme.of(context).colorScheme.primary;
    return FilterChip(
      label: Text(label),
      selected: selected,
      onSelected: onSelected,
      selectedColor: effectiveColor.withAlpha(40),
      checkmarkColor: effectiveColor,
      labelStyle: TextStyle(
        color: selected ? effectiveColor : null,
        fontWeight: selected ? FontWeight.bold : null,
      ),
    );
  }

  Widget _buildAlertCard(Alert alert) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: alert.severityColor.withAlpha(30),
          child: Icon(alert.alertIcon, color: alert.severityColor, size: 20),
        ),
        title: Text(
          alert.title,
          style: TextStyle(
            fontWeight: alert.isRead ? FontWeight.normal : FontWeight.bold,
          ),
        ),
        subtitle: Text(
          '${alert.flockName.isNotEmpty ? '${alert.flockName} · ' : ''}${alert.dueDate.toIso8601String().split('T').first}\n${alert.message}',
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        isThreeLine: true,
        trailing: alert.isResolved
            ? const Icon(Icons.check_circle, color: Colors.grey)
            : (!alert.isRead
                ? Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: Colors.green,
                      shape: BoxShape.circle,
                    ),
                  )
                : null),
        onTap: () => _showDetail(alert),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Alerts'),
        actions: [
          if (AuthService.canEdit)
            _generating
                ? const Padding(
                    padding: EdgeInsets.all(12),
                    child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                  )
                : IconButton(
                    icon: const Icon(Icons.auto_awesome),
                    tooltip: 'Generate alerts',
                    onPressed: _generate,
                  ),
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: Column(
        children: [
          _buildFilterChips(),
          const Divider(height: 1),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(_error!, style: const TextStyle(color: Colors.red)),
                            const SizedBox(height: 16),
                            ElevatedButton(onPressed: _load, child: const Text('Retry')),
                          ],
                        ),
                      )
                    : _alerts.isEmpty
                        ? const Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.notifications_none, size: 64, color: Colors.grey),
                                SizedBox(height: 12),
                                Text('No alerts', style: TextStyle(color: Colors.grey)),
                              ],
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _load,
                            child: ListView.builder(
                              padding: const EdgeInsets.only(bottom: 16),
                              itemCount: _alerts.length,
                              itemBuilder: (_, i) => _buildAlertCard(_alerts[i]),
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

class _AlertDetailSheet extends StatelessWidget {
  final Alert alert;
  final VoidCallback? onMarkRead;
  final VoidCallback? onResolve;
  final VoidCallback? onDelete;

  const _AlertDetailSheet({
    required this.alert,
    this.onMarkRead,
    this.onResolve,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.55,
      minChildSize: 0.35,
      maxChildSize: 0.85,
      builder: (ctx, scrollController) => SingleChildScrollView(
        controller: scrollController,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40, height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Row(
                children: [
                  CircleAvatar(
                    backgroundColor: alert.severityColor.withAlpha(30),
                    child: Icon(alert.alertIcon, color: alert.severityColor),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      alert.title,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _detailRow('Flock', alert.flockName.isNotEmpty ? alert.flockName : '—'),
              _detailRow('Type', alert.alertType.replaceAll('_', ' ')),
              _detailRow('Severity', alert.severity.toUpperCase()),
              _detailRow('Due Date', alert.dueDate.toIso8601String().split('T').first),
              _detailRow('Status', alert.isResolved ? 'Resolved' : (alert.isRead ? 'Read' : 'Unread')),
              const SizedBox(height: 12),
              const Text('Message', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text(alert.message),
              const SizedBox(height: 24),
              if (onMarkRead != null || onResolve != null || onDelete != null)
                Row(
                  children: [
                    if (onMarkRead != null) ...[
                      Expanded(
                        child: OutlinedButton.icon(
                          icon: const Icon(Icons.mark_email_read),
                          label: const Text('Mark Read'),
                          onPressed: () {
                            Navigator.of(context).pop();
                            onMarkRead!();
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                    ],
                    if (onResolve != null)
                      Expanded(
                        child: ElevatedButton.icon(
                          icon: const Icon(Icons.check_circle),
                          label: const Text('Resolve'),
                          onPressed: onResolve,
                        ),
                      ),
                  ],
                ),
              if (onDelete != null) ...[
                const SizedBox(height: 8),
                TextButton.icon(
                  icon: const Icon(Icons.delete, color: Colors.red),
                  label: const Text('Delete', style: TextStyle(color: Colors.red)),
                  onPressed: () {
                    Navigator.of(context).pop();
                    onDelete!();
                  },
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 90,
            child: Text(label, style: const TextStyle(color: Colors.grey)),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
