import 'dart:developer';
import 'api_cache.dart';
import 'api_service.dart';
import '../models/dashboard_summary.dart';

class DashboardService {
  /// Cached briefly (session-only) since the dashboard is the app's home
  /// screen and gets revisited constantly via the bottom nav. Pass
  /// [forceRefresh] (e.g. from pull-to-refresh) to bypass the cache.
  static Future<DashboardSummary> fetchSummary({bool forceRefresh = false}) async {
    try {
      if (forceRefresh) ApiCache.invalidate('dashboard:summary');
      return await ApiCache.fetch(
        'dashboard:summary',
        () async {
          final res = await ApiService.dio.get('/api/v1/dashboard/summary');
          return DashboardSummary.fromJson(res.data as Map<String, dynamic>);
        },
        ttl: const Duration(seconds: 30),
      );
    } catch (e) {
      log('Failed to fetch dashboard summary: $e', name: 'DashboardService');
      rethrow;
    }
  }
}
