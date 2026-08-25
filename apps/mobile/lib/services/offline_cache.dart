import 'dart:convert';
import 'dart:developer';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Encrypted offline cache and sync queue using flutter_secure_storage.
///
/// Data at rest is encrypted via the platform keystore (Android Keystore /
/// iOS Keychain). This protects sensitive business and financial data
/// stored for offline use.
///
/// The Drift database files in lib/database/ define the proper schema for
/// a future upgrade to a full SQLite-backed offline database — run
/// `flutter pub run build_runner build` to generate the .g.dart files.
class OfflineCache {
  static final OfflineCache _instance = OfflineCache._();
  static OfflineCache get instance => _instance;
  OfflineCache._();

  late FlutterSecureStorage _storage;
  bool _initialized = false;

  static const _flocksKey = 'offline_flocks';
  static const _syncQueueKey = 'offline_sync_queue';
  static const _alertsKey = 'offline_alerts';
  static const _dashboardKey = 'offline_dashboard';

  /// Maximum sync queue item size — secure storage has platform limits.
  /// If the queue grows beyond this, oldest items are pruned.
  static const _maxQueueSize = 200;

  /// Maximum cached alerts (most recent kept, older pruned).
  static const _maxCachedAlerts = 100;

  /// Maximum cached flocks (the API typically returns < 50, but this
  /// bounds growth for organizations with many archived flocks).
  static const _maxCachedFlocks = 200;

  Future<void> init() async {
    // flutter_secure_storage v11 removed `encryptedSharedPreferences`.
    // The default AndroidOptions() now uses AES-GCM with RSA-OAEP key
    // wrapping (Android Keystore), which is the modern equivalent.
    _storage = const FlutterSecureStorage(
      aOptions: AndroidOptions(),
      iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
    );
    _initialized = true;
  }

  // ── Flock cache ──────────────────────────────

  Future<void> cacheFlocks(List<Map<String, dynamic>> flocks) async {
    if (!_initialized) return;
    // Cap to most recent flocks to bound storage growth.
    final capped = flocks.length > _maxCachedFlocks
        ? flocks.sublist(0, _maxCachedFlocks)
        : flocks;
    final encoded = jsonEncode(capped);
    await _storage.write(key: _flocksKey, value: encoded);
  }

  List<Map<String, dynamic>> getCachedFlocks() {
    if (!_initialized) return [];
    // Note: secure storage is async-only, so we return a cached decode
    // from the last synchronous read. For initial load, use getCachedFlocksAsync.
    return _cachedFlocks;
  }

  List<Map<String, dynamic>> _cachedFlocks = [];

  Future<List<Map<String, dynamic>>> getCachedFlocksAsync() async {
    if (!_initialized) return [];
    final raw = await _storage.read(key: _flocksKey);
    if (raw == null) {
      _cachedFlocks = [];
      return [];
    }
    try {
      final list = jsonDecode(raw) as List;
      _cachedFlocks = list.cast<Map<String, dynamic>>();
      return _cachedFlocks;
    } catch (e) {
      log('OfflineCache: failed to decode flocks: $e', name: 'OfflineCache');
      _cachedFlocks = [];
      return [];
    }
  }

  Future<void> clearFlocks() async {
    if (!_initialized) return;
    await _storage.delete(key: _flocksKey);
    _cachedFlocks = [];
  }

  // ── Alerts cache (read-only, for offline visibility) ────────

  Future<void> cacheAlerts(List<Map<String, dynamic>> alerts) async {
    if (!_initialized) return;
    // Cap to most recent _maxCachedAlerts (alerts are assumed newest-first
    // from the API; if not, the caller should sort before caching).
    final capped = alerts.length > _maxCachedAlerts
        ? alerts.sublist(0, _maxCachedAlerts)
        : alerts;
    await _storage.write(key: _alertsKey, value: jsonEncode(capped));
  }

  Future<List<Map<String, dynamic>>> getCachedAlerts() async {
    if (!_initialized) return [];
    final raw = await _storage.read(key: _alertsKey);
    if (raw == null) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list.cast<Map<String, dynamic>>();
    } catch (e) {
      log('OfflineCache: failed to decode alerts: $e', name: 'OfflineCache');
      return [];
    }
  }

  // ── Dashboard summary cache (single JSON blob) ──────────────

  Future<void> cacheDashboardSummary(Map<String, dynamic> summary) async {
    if (!_initialized) return;
    await _storage.write(key: _dashboardKey, value: jsonEncode(summary));
  }

  Future<Map<String, dynamic>?> getCachedDashboardSummary() async {
    if (!_initialized) return null;
    final raw = await _storage.read(key: _dashboardKey);
    if (raw == null) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (e) {
      log('OfflineCache: failed to decode dashboard: $e', name: 'OfflineCache');
      return null;
    }
  }

  // ── Full cache clear (excluding sync queue) ─────────────────
  /// Clears cached read data (flocks, alerts, dashboard) but does NOT
  /// clear the sync queue — pending mutations are never silently discarded
  /// (per mobile modernization plan §5.4). Used by the "Clear local cache"
  /// action in Settings.

  Future<void> clearLocalCache() async {
    if (!_initialized) return;
    await _storage.delete(key: _flocksKey);
    await _storage.delete(key: _alertsKey);
    await _storage.delete(key: _dashboardKey);
    _cachedFlocks = [];
  }

  // ── Sync queue ───────────────────────────────

  Future<void> enqueueSync({
    required String entityType,
    required String operation,
    String? entityId,
    required Map<String, dynamic> payload,
  }) async {
    if (!_initialized) return;
    final queue = await _getSyncQueueAsync();
    queue.add({
      'entityType': entityType,
      'operation': operation,
      if (entityId != null) 'entityId': entityId,
      'payload': payload,
      'createdAt': DateTime.now().toIso8601String(),
      'retryCount': 0,
      'status': 'pending',
    });
    // Prune oldest if queue exceeds max size
    while (queue.length > _maxQueueSize) {
      queue.removeAt(0);
    }
    await _saveSyncQueue(queue);
    log('OfflineCache: enqueued $entityType/$operation', name: 'OfflineCache');
  }

  List<Map<String, dynamic>> getPendingSyncs() {
    return _cachedSyncQueue.where((q) => q['status'] != 'skipped').toList();
  }

  Future<List<Map<String, dynamic>>> getPendingSyncsAsync() async {
    final queue = await _getSyncQueueAsync();
    _cachedSyncQueue = queue;
    return queue.where((q) => q['status'] != 'skipped').toList();
  }

  Future<void> removeSync(int index) async {
    final queue = await _getSyncQueueAsync();
    // Map the visible index (pending-only) to the actual queue index
    int realIndex = 0;
    int pendingIndex = 0;
    for (int i = 0; i < queue.length; i++) {
      if (queue[i]['status'] != 'skipped') {
        if (pendingIndex == index) {
          realIndex = i;
          break;
        }
        pendingIndex++;
      }
      realIndex = i;
    }
    if (realIndex < queue.length) {
      queue.removeAt(realIndex);
      await _saveSyncQueue(queue);
      _cachedSyncQueue = queue;
    }
  }

  Future<void> incrementRetry(int index, String error) async {
    final queue = await _getSyncQueueAsync();
    // Map the visible index (pending-only) to the actual queue index
    int realIndex = _resolveIndex(queue, index);
    if (realIndex < queue.length) {
      queue[realIndex]['retryCount'] = (queue[realIndex]['retryCount'] ?? 0) + 1;
      queue[realIndex]['lastError'] = error;
      // Auto-skip after 5 failed retries to prevent queue blocking
      if ((queue[realIndex]['retryCount'] ?? 0) >= 5) {
        queue[realIndex]['status'] = 'skipped';
        log('OfflineCache: auto-skipped sync item after 5 retries: '
            '${queue[realIndex]['entityType']}/${queue[realIndex]['operation']}',
            name: 'OfflineCache');
      }
      await _saveSyncQueue(queue);
      _cachedSyncQueue = queue;
    }
  }

  /// Mark a sync item as permanently skipped (e.g. 4xx validation error).
  Future<void> skipSync(int index, String reason) async {
    final queue = await _getSyncQueueAsync();
    int realIndex = _resolveIndex(queue, index);
    if (realIndex < queue.length) {
      queue[realIndex]['status'] = 'skipped';
      queue[realIndex]['lastError'] = reason;
      await _saveSyncQueue(queue);
      _cachedSyncQueue = queue;
    }
  }

  /// Get count of skipped items (for UI display).
  int get skippedSyncCount =>
      _cachedSyncQueue.where((q) => q['status'] == 'skipped').length;

  /// Returns all skipped sync items (for the Sync Issues screen).
  Future<List<Map<String, dynamic>>> getSkippedSyncs() async {
    final queue = await _getSyncQueueAsync();
    return queue.where((q) => q['status'] == 'skipped').toList();
  }

  int get pendingSyncCount =>
      _cachedSyncQueue.where((q) => q['status'] != 'skipped').length;

  Future<void> clearSyncQueue() async {
    if (!_initialized) return;
    await _storage.delete(key: _syncQueueKey);
    _cachedSyncQueue = [];
  }

  /// Clear only skipped items, keeping pending items.
  Future<void> clearSkippedSyncs() async {
    final queue = await _getSyncQueueAsync();
    final filtered = queue.where((q) => q['status'] != 'skipped').toList();
    await _saveSyncQueue(filtered);
    _cachedSyncQueue = filtered;
  }

  // ── Internal helpers ─────────────────────────

  List<Map<String, dynamic>> _cachedSyncQueue = [];

  int _resolveIndex(List<Map<String, dynamic>> queue, int visibleIndex) {
    int pendingIndex = 0;
    for (int i = 0; i < queue.length; i++) {
      if (queue[i]['status'] != 'skipped') {
        if (pendingIndex == visibleIndex) return i;
        pendingIndex++;
      }
    }
    return queue.length; // out of bounds
  }

  Future<List<Map<String, dynamic>>> _getSyncQueueAsync() async {
    if (!_initialized) return [];
    final raw = await _storage.read(key: _syncQueueKey);
    if (raw == null) {
      _cachedSyncQueue = [];
      return [];
    }
    try {
      final list = jsonDecode(raw) as List;
      _cachedSyncQueue = list.cast<Map<String, dynamic>>();
      return _cachedSyncQueue;
    } catch (e) {
      log('OfflineCache: failed to decode sync queue: $e', name: 'OfflineCache');
      _cachedSyncQueue = [];
      return [];
    }
  }

  Future<void> _saveSyncQueue(List<Map<String, dynamic>> queue) async {
    await _storage.write(key: _syncQueueKey, value: jsonEncode(queue));
  }

  // ── Full clear (on logout) ───────────────────

  Future<void> clearAll() async {
    if (!_initialized) return;
    await _storage.delete(key: _flocksKey);
    await _storage.delete(key: _alertsKey);
    await _storage.delete(key: _dashboardKey);
    await _storage.delete(key: _syncQueueKey);
    _cachedFlocks = [];
    _cachedSyncQueue = [];
  }
}
