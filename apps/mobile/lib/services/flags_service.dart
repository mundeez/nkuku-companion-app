import 'dart:developer';
import 'package:dio/dio.dart';
import 'api_service.dart';

/// Per-user feature flags (P4): `GET /api/v1/me/flags` → `{key: bool}`.
///
/// Fetch once per session (e.g. on home-screen load) and consult via
/// [isEnabled]. The endpoint is optional — any failure leaves the cache
/// empty and every flag reads as disabled, so future UI can gate behind
/// `FlagsService.isEnabled('flag_key')` without extra error handling.
class FlagsService {
  static Map<String, bool> _cache = const {};

  /// Fetch flags from the API and refresh the in-memory cache.
  /// Returns the cached map (empty on failure).
  static Future<Map<String, bool>> refresh() async {
    try {
      final res = await ApiService.dio.get('/api/v1/me/flags');
      if (res.statusCode != null &&
          res.statusCode! >= 200 &&
          res.statusCode! < 300 &&
          res.data is Map) {
        final data = res.data as Map;
        final map = data['flags'] is Map ? data['flags'] as Map : data;
        _cache = map.map(
          (key, value) => MapEntry(key.toString(), value == true),
        );
      }
    } on DioException catch (e) {
      log('Failed to load feature flags: $e', name: 'FlagsService');
    } catch (e) {
      log('Feature flags parse error: $e', name: 'FlagsService');
    }
    return _cache;
  }

  /// Last fetched flags (empty until [refresh] succeeds).
  static Map<String, bool> get flags => _cache;

  /// True when the flag was reported enabled by the last fetch.
  /// Missing/unknown keys default to false.
  static bool isEnabled(String key) => _cache[key] == true;

  /// Drop the cached flags (call on logout).
  static void clear() {
    _cache = const {};
  }
}
