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

  /// Maximum sync queue item size — secure storage has platform limits.
  /// If the queue grows beyond this, oldest items are pruned.
  static const _maxQueueSize = 200;

  Future<void> init() async {
    _storage = const FlutterSecureStorage(
      aOptions: AndroidOptions(encryptedSharedPreferences: true),
      iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
    );
    _initialized = true;
  }

  // ── Flock cache ──────────────────────────────

  Future<void> cacheFlocks(List<Map<String, dynamic>> flocks) async {
    if (!_initialized) return;
    final encoded = jsonEncode(flocks);
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
    await _storage.delete(key: _syncQueueKey);
    _cachedFlocks = [];
    _cachedSyncQueue = [];
  }
}
