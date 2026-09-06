import 'package:flutter/material.dart';
import '../database/app_database.dart';
import '../services/offline_repository.dart';
import '../services/sync_service.dart';
import '../widgets/empty_state.dart';

/// Displays sync queue entries that have failed or been auto-skipped after
//  too many retries. Users can retry individual items or discard them.
///
/// Per the mobile modernization plan §5.4: "a replayed create either
/// succeeds or surfaces a clear error in a 'Sync Issues' screen for manual
/// retry/discard."
class SyncIssuesScreen extends StatefulWidget {
  const SyncIssuesScreen({super.key});

  @override
  State<SyncIssuesScreen> createState() => _SyncIssuesScreenState();
}

class _SyncIssuesScreenState extends State<SyncIssuesScreen> {
  List<Map<String, dynamic>> _issues = [];
  bool _loading = true;
  bool _syncing = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    // Failed items (status == 'failed') — includes validation errors and
    // retryable failures that need attention.
    final failed = await OfflineRepository.instance.getFailedSyncs();
    // Skipped items (auto-skipped after 5 retries or 4xx validation errors).
    final skipped = await OfflineRepository.instance.getSkippedSyncs();
    final issues = <Map<String, dynamic>>[
      ...failed.map(_entryToMap),
      ...skipped.map(_entryToMap),
    ];
    if (mounted) {
      setState(() {
        _issues = issues;
        _loading = false;
      });
    }
  }

  /// Converts a Drift SyncQueueEntry to a Map for the UI builders that
  /// access fields by string key.
  Map<String, dynamic> _entryToMap(SyncQueueEntry e) => {
        'id': e.id,
        'status': e.status,
        'entityType': e.entityType,
        'operation': e.operation,
        'retryCount': e.retryCount,
        'lastError': e.lastError ?? 'Unknown error',
        'createdAt': e.createdAt.toIso8601String(),
      };

  Future<void> _retryAll() async {
    setState(() => _syncing = true);
    await SyncService.instance.syncNow();
    if (mounted) {
      setState(() => _syncing = false);
      _load();
    }
  }

  Future<void> _discardItem(int index) async {
    // Remove the item from the queue by its database ID
    final id = _issues[index]['id'] as int;
    await OfflineRepository.instance.removeSync(id);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sync item discarded')),
      );
      _load();
    }
  }

  Future<void> _clearAllSkipped() async {
    await SyncService.instance.clearSkipped();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cleared all skipped items')),
      );
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Sync Issues'),
        actions: [
          if (_issues.any((q) => q['status'] == 'failed'))
            IconButton(
              icon: _syncing
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.sync),
              onPressed: _syncing ? null : _retryAll,
              tooltip: 'Retry all failed',
            ),
          if (_issues.any((q) => q['status'] == 'skipped'))
            IconButton(
              icon: const Icon(Icons.delete_sweep_outlined),
              onPressed: _clearAllSkipped,
              tooltip: 'Clear all skipped',
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _issues.isEmpty
              ? EmptyState(
                  icon: Icons.cloud_done_outlined,
                  message: 'No sync issues — all offline changes have been synced successfully.',
                )
              : ListView.builder(
                  itemCount: _issues.length,
                  itemBuilder: (context, index) {
                    final item = _issues[index];
                    final status = item['status'] as String? ?? 'unknown';
                    final entityType =
                        item['entityType'] as String? ?? 'unknown';
                    final operation =
                        item['operation'] as String? ?? 'unknown';
                    final retryCount = item['retryCount'] as int? ?? 0;
                    final lastError =
                        item['lastError'] as String? ?? 'Unknown error';
                    final createdAt = item['createdAt'] as String? ?? '';

                    final isSkipped = status == 'skipped';
                    final color = isSkipped
                        ? theme.colorScheme.error
                        : Colors.orange;

                    return Card(
                      margin: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 4),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  isSkipped
                                      ? Icons.error_outline
                                      : Icons.warning_amber_outlined,
                                  color: color,
                                  size: 20,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    '$operation · $entityType',
                                    style: theme.textTheme.titleSmall
                                        ?.copyWith(fontWeight: FontWeight.w600),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                Chip(
                                  label: Text(
                                    isSkipped ? 'Skipped' : 'Failed',
                                    style: TextStyle(
                                        fontSize: 11, color: color),
                                  ),
                                  backgroundColor: color.withValues(alpha: 0.1),
                                  side: BorderSide.none,
                                  padding: EdgeInsets.zero,
                                  visualDensity: VisualDensity.compact,
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Error: $lastError',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant,
                              ),
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                Text(
                                  'Retries: $retryCount',
                                  style: theme.textTheme.labelSmall?.copyWith(
                                    color: theme.colorScheme.onSurfaceVariant,
                                  ),
                                ),
                                if (createdAt.isNotEmpty) ...[
                                  const SizedBox(width: 12),
                                  Text(
                                    'Queued: ${_formatDate(createdAt)}',
                                    style: theme.textTheme.labelSmall?.copyWith(
                                      color: theme.colorScheme.onSurfaceVariant,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 8),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                if (!isSkipped)
                                  TextButton.icon(
                                    icon: const Icon(Icons.refresh, size: 16),
                                    label: const Text('Retry'),
                                    onPressed: () async {
                                      await SyncService.instance.syncNow();
                                      _load();
                                    },
                                  ),
                                TextButton.icon(
                                  icon: const Icon(Icons.delete_outline,
                                      size: 16),
                                  label: const Text('Discard'),
                                  onPressed: () => _discardItem(index),
                                  style: TextButton.styleFrom(
                                    foregroundColor:
                                        theme.colorScheme.error,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }

  String _formatDate(String isoString) {
    try {
      final dt = DateTime.parse(isoString);
      return '${dt.day}/${dt.month} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return '';
    }
  }
}
