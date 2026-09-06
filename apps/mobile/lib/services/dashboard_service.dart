import 'dart:developer';
import 'offline_repository.dart';
import '../models/dashboard_summary.dart';

class DashboardService {
  /// Fetches the dashboard summary via the OfflineRepository, which provides
  /// stale-while-revalidate caching (Drift-backed) and offline fallback.
  /// Pass [forceRefresh] (e.g. from pull-to-refresh) to bypass the cache.
  static Future<DashboardSummary> fetchSummary({bool forceRefresh = false}) async {
    try {
      final data = await OfflineRepository.instance.getDashboardSummary(forceRefresh: forceRefresh);
      if (data == null) {
        throw Exception('No dashboard data available');
      }
      return DashboardSummary.fromJson(data);
    } catch (e) {
      log('Failed to fetch dashboard summary: $e', name: 'DashboardService');
      rethrow;
    }
  }
}
