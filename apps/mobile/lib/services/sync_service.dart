import 'dart:convert';
import 'dart:developer';
import 'package:dio/dio.dart';
import 'api_service.dart';
import 'connectivity_service.dart';
import 'offline_cache.dart';

/// Processes the sync queue when connectivity is restored.
///
/// Pending mutations (create/update/delete) are replayed in order.
/// Failed entries are retried up to 5 times before being auto-skipped.
/// 4xx validation errors are skipped immediately since they will never
/// succeed on retry. Skipped items can be cleared by the user.
class SyncService {
  static final SyncService _instance = SyncService._();
  static SyncService get instance => _instance;
  SyncService._();

  bool _initialized = false;
  bool _syncing = false;

  void init() {
    _initialized = true;
    ConnectivityService.instance.addListener(_onConnectivityChanged);
    // Try syncing on startup in case we have pending items.
    _trySync();
  }

  void _onConnectivityChanged() {
    if (ConnectivityService.instance.isOnline) {
      _trySync();
    }
  }

  /// Attempts to process all pending sync queue entries.
  Future<void> _trySync() async {
    if (!_initialized || !ConnectivityService.instance.isOnline) return;
    if (_syncing) return; // prevent concurrent sync runs
    _syncing = true;

    try {
      final pending = await OfflineCache.instance.getPendingSyncsAsync();
      if (pending.isEmpty) return;

      log('Sync: processing ${pending.length} pending items', name: 'SyncService');

      // Process from oldest to newest. We iterate over a copy because
      // the underlying list may change as we remove items.
      final items = List<Map<String, dynamic>>.from(pending);
      for (var i = 0; i < items.length; i++) {
        final entry = items[i];
        final status = entry['status'];
        if (status == 'skipped') continue;

        try {
          await _processEntry(entry);
          // Remove from queue on success (index 0 since we remove from front).
          await OfflineCache.instance.removeSync(0);
          log('Sync: completed ${entry['entityType']}/${entry['operation']}',
              name: 'SyncService');
        } catch (e) {
          log('Sync: failed ${entry['entityType']}/${entry['operation']}: $e',
              name: 'SyncService');

          // 4xx errors are validation failures — skip immediately
          if (e is _ApiException && e.statusCode >= 400 && e.statusCode < 500) {
            await OfflineCache.instance.skipSync(0, 'Validation error: ${e.message}');
            log('Sync: skipped ${entry['entityType']}/${entry['operation']} '
                '(4xx validation error)', name: 'SyncService');
            continue;
          }

          // Increment retry count; auto-skips after 5 retries.
          await OfflineCache.instance.incrementRetry(0, e.toString());

          // Stop processing on network errors.
          if (e is DioException && _isNetworkError(e)) {
            ConnectivityService.instance.markOffline();
            break;
          }
        }
      }
    } finally {
      _syncing = false;
    }
  }

  Future<void> _processEntry(Map<String, dynamic> entry) async {
    final entityType = entry['entityType'] as String;
    final operation = entry['operation'] as String;
    final entityId = entry['entityId'] as String?;
    final payload = entry['payload'] as Map<String, dynamic>;
    final dio = ApiService.dio;

    switch (entityType) {
      case 'flock':
        switch (operation) {
          case 'create':
            final res = await dio.post('/api/v1/broiler-flocks', data: payload);
            _assertOk(res);
            break;
          case 'update':
            final res = await dio.patch('/api/v1/broiler-flocks/$entityId', data: payload);
            _assertOk(res);
            break;
          case 'delete':
            final res = await dio.delete('/api/v1/broiler-flocks/$entityId');
            _assertOk(res);
            break;
        }
        break;

      case 'growth_record':
        if (operation == 'create') {
          final res = await dio.post('/api/v1/growth-records', data: payload);
          _assertOk(res);
        } else if (operation == 'delete') {
          final res = await dio.delete('/api/v1/growth-records/$entityId');
          _assertOk(res);
        }
        break;

      case 'feed_record':
        if (operation == 'create') {
          final res = await dio.post('/api/v1/feed-records', data: payload);
          _assertOk(res);
        } else if (operation == 'delete') {
          final res = await dio.delete('/api/v1/feed-records/$entityId');
          _assertOk(res);
        }
        break;

      case 'water_record':
        if (operation == 'create') {
          final res = await dio.post('/api/v1/water-records', data: payload);
          _assertOk(res);
        } else if (operation == 'delete') {
          final res = await dio.delete('/api/v1/water-records/$entityId');
          _assertOk(res);
        }
        break;

      case 'mortality_event':
        if (operation == 'create') {
          final res = await dio.post('/api/v1/mortality-events', data: payload);
          _assertOk(res);
        } else if (operation == 'delete') {
          final res = await dio.delete('/api/v1/mortality-events/$entityId');
          _assertOk(res);
        }
        break;

      case 'vaccination_event':
        if (operation == 'create') {
          final res = await dio.post('/api/v1/vaccination-events', data: payload);
          _assertOk(res);
        } else if (operation == 'delete') {
          final res = await dio.delete('/api/v1/vaccination-events/$entityId');
          _assertOk(res);
        }
        break;

      case 'financial_record':
        if (operation == 'create') {
          final res = await dio.post('/api/v1/financial-records', data: payload);
          _assertOk(res);
        } else if (operation == 'delete') {
          final res = await dio.delete('/api/v1/financial-records/$entityId');
          _assertOk(res);
        }
        break;

      case 'sale_record':
        if (operation == 'create') {
          final res = await dio.post('/api/v1/sale-records', data: payload);
          _assertOk(res);
        } else if (operation == 'delete') {
          final res = await dio.delete('/api/v1/sale-records/$entityId');
          _assertOk(res);
        }
        break;

      case 'medication_record':
        if (operation == 'create') {
          final res = await dio.post('/api/v1/medication-records', data: payload);
          _assertOk(res);
        } else if (operation == 'delete') {
          final res = await dio.delete('/api/v1/medication-records/$entityId');
          _assertOk(res);
        }
        break;

      case 'environmental_record':
        if (operation == 'create') {
          final res = await dio.post('/api/v1/environmental-records', data: payload);
          _assertOk(res);
        } else if (operation == 'delete') {
          final res = await dio.delete('/api/v1/environmental-records/$entityId');
          _assertOk(res);
        }
        break;

      case 'flock_task':
        if (operation == 'create') {
          final res = await dio.post('/api/v1/flock-tasks', data: payload);
          _assertOk(res);
        } else if (operation == 'delete') {
          final res = await dio.delete('/api/v1/flock-tasks/$entityId');
          _assertOk(res);
        }
        break;

      default:
        log('Sync: unknown entityType $entityType', name: 'SyncService');
    }
  }

  void _assertOk(Response res) {
    if (res.statusCode == null || res.statusCode! >= 400) {
      throw _ApiException(
        res.statusCode ?? 0,
        'API error ${res.statusCode}: ${res.data}',
      );
    }
  }

  bool _isNetworkError(DioException e) {
    return e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.sendTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.connectionError;
  }

  /// Returns the number of pending sync items.
  int get pendingCount => OfflineCache.instance.pendingSyncCount;

  /// Returns the number of skipped sync items (validation failures / max retries).
  int get skippedCount => OfflineCache.instance.skippedSyncCount;

  /// Manually trigger a sync attempt (e.g. from a UI button).
  Future<void> syncNow() async {
    await _trySync();
  }

  /// Clear skipped items from the queue.
  Future<void> clearSkipped() async {
    await OfflineCache.instance.clearSkippedSyncs();
  }

  void dispose() {
    ConnectivityService.instance.removeListener(_onConnectivityChanged);
  }
}

/// Custom exception carrying the HTTP status code for retry/skip logic.
class _ApiException implements Exception {
  final int statusCode;
  final String message;
  _ApiException(this.statusCode, this.message);
  @override
  String toString() => message;
}
