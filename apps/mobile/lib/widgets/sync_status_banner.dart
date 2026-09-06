import 'package:flutter/material.dart';
import '../services/connectivity_service.dart';
import '../services/sync_service.dart';

/// A compact banner showing sync status:
/// - Offline indicator when no connectivity
/// - Pending sync count when there are queued mutations
/// - "Syncing..." when actively processing the queue
///
/// Designed to sit at the top of screens or in a bottom nav bar.
class SyncStatusBanner extends StatefulWidget {
  const SyncStatusBanner({super.key});

  @override
  State<SyncStatusBanner> createState() => _SyncStatusBannerState();
}

class _SyncStatusBannerState extends State<SyncStatusBanner> {
  bool _isOnline = true;
  int _pendingCount = 0;

  @override
  void initState() {
    super.initState();
    _isOnline = ConnectivityService.instance.isOnline;
    _pendingCount = SyncService.instance.pendingCount;
    ConnectivityService.instance.addListener(_onChanged);
  }

  @override
  void dispose() {
    ConnectivityService.instance.removeListener(_onChanged);
    super.dispose();
  }

  void _onChanged() {
    if (mounted) {
      setState(() {
        _isOnline = ConnectivityService.instance.isOnline;
        _pendingCount = SyncService.instance.pendingCount;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isOnline && _pendingCount == 0) {
      return const SizedBox.shrink();
    }

    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    if (!_isOnline) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        color: colorScheme.errorContainer,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.cloud_off, size: 16, color: colorScheme.onErrorContainer),
            const SizedBox(width: 8),
            Text(
              _pendingCount > 0
                  ? 'Offline — $_pendingCount pending change${_pendingCount == 1 ? '' : 's'}'
                  : 'Offline — changes will sync when reconnected',
              style: theme.textTheme.bodySmall?.copyWith(
                color: colorScheme.onErrorContainer,
              ),
            ),
          ],
        ),
      );
    }

    // Online with pending syncs
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      color: colorScheme.tertiaryContainer,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.sync, size: 16, color: colorScheme.onTertiaryContainer),
          const SizedBox(width: 8),
          Text(
            'Syncing $_pendingCount change${_pendingCount == 1 ? '' : 's'}...',
            style: theme.textTheme.bodySmall?.copyWith(
              color: colorScheme.onTertiaryContainer,
            ),
          ),
        ],
      ),
    );
  }
}

/// A small badge for the bottom nav bar showing pending sync count.
class SyncBadge extends StatelessWidget {
  const SyncBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: _SyncPendingNotifier.instance,
      builder: (context, count, _) {
        if (count == 0) return const SizedBox.shrink();
        return Container(
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.error,
            borderRadius: BorderRadius.circular(10),
          ),
          constraints: const BoxConstraints(
            minWidth: 18,
            minHeight: 18,
          ),
          child: Text(
            count > 9 ? '9+' : '$count',
            style: TextStyle(
              color: Theme.of(context).colorScheme.onError,
              fontSize: 10,
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
            textScaler: const TextScaler.linear(0.9),
          ),
        );
      },
    );
  }
}

/// Simple ValueNotifier for sync pending count, updated by SyncService.
class _SyncPendingNotifier extends ValueNotifier<int> {
  static final _SyncPendingNotifier instance = _SyncPendingNotifier._();
  _SyncPendingNotifier._() : super(0);

  void update(int count) {
    value = count;
  }
}
