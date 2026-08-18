/// Lightweight session-scoped, in-memory response cache.
///
/// This is deliberately simple (no persistence, no cross-launch storage) —
/// full on-disk offline caching is a separate, larger effort (see the
/// "Offline Sync" phase of the mobile modernization plan, built on
/// `drift`/`sqlite3_flutter_libs`). This cache exists purely to avoid
/// redundant network round-trips for data that's fetched repeatedly within
/// a single app session (e.g. backing out of a flock and back into it,
/// switching bottom-nav tabs, or opening the same reference screen twice).
class ApiCache {
  ApiCache._();

  static final Map<String, _CacheEntry> _entries = {};

  /// Returns the cached value for [key] if present and not expired,
  /// otherwise calls [loader], caches the result for [ttl], and returns it.
  ///
  /// Errors from [loader] are not cached — a failed request will simply be
  /// retried on the next call.
  static Future<T> fetch<T>(
    String key,
    Future<T> Function() loader, {
    Duration ttl = const Duration(seconds: 60),
  }) async {
    final entry = _entries[key];
    if (entry != null && DateTime.now().isBefore(entry.expiresAt)) {
      return entry.value as T;
    }
    final value = await loader();
    _entries[key] = _CacheEntry(value, DateTime.now().add(ttl));
    return value;
  }

  /// Removes a single cached entry, e.g. after a mutation that makes it
  /// stale (create/update/delete).
  static void invalidate(String key) => _entries.remove(key);

  /// Removes every cached entry whose key starts with [prefix] — useful
  /// when a single mutation could affect several cached query variants
  /// (e.g. `getFlocks()` cached once per status filter).
  static void invalidatePrefix(String prefix) {
    _entries.removeWhere((key, _) => key.startsWith(prefix));
  }

  /// Clears the entire cache (e.g. on logout, so the next login never sees
  /// another account's cached data).
  static void clear() => _entries.clear();
}

class _CacheEntry {
  final dynamic value;
  final DateTime expiresAt;
  _CacheEntry(this.value, this.expiresAt);
}
