import 'dart:convert';
import 'dart:developer';
import 'dart:ui';
import 'package:shared_preferences/shared_preferences.dart';

/// Simple JSON-based offline cache and sync queue using SharedPreferences.
///
/// This provides immediate offline capability without requiring Drift code
/// generation. The Drift database files in lib/database/ define the proper
/// schema for a future upgrade — run `flutter pub run build_runner build`
/// to generate the .g.dart files and migrate to a real SQLite database.
class OfflineCache {
  static final OfflineCache _instance = OfflineCache._();
  static OfflineCache get instance => _instance;
  OfflineCache._();

  late SharedPreferences _prefs;
  bool _initialized = false;

  static const _flocksKey = 'offline_flocks';
  static const _syncQueueKey = 'offline_sync_queue';

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    _initialized = true;
  }

  // ── Flock cache ──────────────────────────────

  Future<void> cacheFlocks(List<Map<String, dynamic>> flocks) async {
    if (!_initialized) return;
    final encoded = jsonEncode(flocks);
    await _prefs.setString(_flocksKey, encoded);
  }

  List<Map<String, dynamic>> getCachedFlocks() {
    if (!_initialized) return [];
    final raw = _prefs.getString(_flocksKey);
    if (raw == null) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list.cast<Map<String, dynamic>>();
    } catch (e) {
      log('OfflineCache: failed to decode flocks: $e', name: 'OfflineCache');
      return [];
    }
  }

  Future<void> clearFlocks() async {
    if (!_initialized) return;
    await _prefs.remove(_flocksKey);
  }

  // ── Sync queue ───────────────────────────────

  Future<void> enqueueSync({
    required String entityType,
    required String operation,
    String? entityId,
    required Map<String, dynamic> payload,
  }) async {
    if (!_initialized) return;
    final queue = _getSyncQueue();
    queue.add({
      'entityType': entityType,
      'operation': operation,
      if (entityId != null) 'entityId': entityId,
      'payload': payload,
      'createdAt': DateTime.now().toIso8601String(),
      'retryCount': 0,
    });
    await _saveSyncQueue(queue);
    log('OfflineCache: enqueued $entityType/$operation', name: 'OfflineCache');
  }

  List<Map<String, dynamic>> getPendingSyncs() {
    return _getSyncQueue();
  }

  Future<void> removeSync(int index) async {
    final queue = _getSyncQueue();
    if (index < queue.length) {
      queue.removeAt(index);
      await _saveSyncQueue(queue);
    }
  }

  Future<void> incrementRetry(int index, String error) async {
    final queue = _getSyncQueue();
    if (index < queue.length) {
      queue[index]['retryCount'] = (queue[index]['retryCount'] ?? 0) + 1;
      queue[index]['lastError'] = error;
      await _saveSyncQueue(queue);
    }
  }

  int get pendingSyncCount => _getSyncQueue().length;

  Future<void> clearSyncQueue() async {
    if (!_initialized) return;
    await _prefs.remove(_syncQueueKey);
  }

  List<Map<String, dynamic>> _getSyncQueue() {
    if (!_initialized) return [];
    final raw = _prefs.getString(_syncQueueKey);
    if (raw == null) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list.cast<Map<String, dynamic>>();
    } catch (e) {
      log('OfflineCache: failed to decode sync queue: $e', name: 'OfflineCache');
      return [];
    }
  }

  Future<void> _saveSyncQueue(List<Map<String, dynamic>> queue) async {
    await _prefs.setString(_syncQueueKey, jsonEncode(queue));
  }

  // ── Full clear (on logout) ───────────────────

  Future<void> clearAll() async {
    if (!_initialized) return;
    await _prefs.remove(_flocksKey);
    await _prefs.remove(_syncQueueKey);
  }
}
