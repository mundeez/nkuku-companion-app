import 'dart:developer';
import 'api_service.dart';
import 'connectivity_service.dart';
import 'offline_cache.dart';
import '../models/alert.dart';

class AlertsService {
  static Future<List<Alert>> getAlerts(
      {String? status, String? severity}) async {
    final params = <String, String>{};
    if (status != null) params['status'] = status;
    if (severity != null) params['severity'] = severity;
    try {
      final res = await ApiService.dio.get(
        '/api/v1/alerts',
        queryParameters: params.isNotEmpty ? params : null,
      );
      final alerts =
          (res.data as List).map((e) => Alert.fromJson(e)).toList();
      // Cache alerts for offline visibility (only when no filters are
      // applied — filtered sets would give an incomplete offline view).
      if (status == null && severity == null) {
        final rawList = (res.data as List)
            .map((e) => e is Map<String, dynamic> ? e : Map<String, dynamic>.from(e as Map))
            .toList();
        await OfflineCache.instance.cacheAlerts(rawList);
      }
      ConnectivityService.instance.markOnline();
      return alerts;
    } catch (e) {
      log('AlertsService: network error, falling back to cache: $e',
          name: 'AlertsService');
      ConnectivityService.instance.markOffline();
      // Fall back to cached alerts (unfiltered cache only)
      final cached = await OfflineCache.instance.getCachedAlerts();
      return cached.map((e) => Alert.fromJson(e)).toList();
    }
  }

  static Future<Alert> markRead(String id) async {
    final res = await ApiService.dio
        .patch('/api/v1/alerts/$id', data: {'isRead': true});
    return Alert.fromJson(res.data);
  }

  static Future<Alert> markResolved(String id) async {
    final res = await ApiService.dio
        .patch('/api/v1/alerts/$id', data: {'isResolved': true});
    return Alert.fromJson(res.data);
  }

  static Future<AlertGenerateResult> generate() async {
    final res = await ApiService.dio.post('/api/v1/alerts/generate');
    return AlertGenerateResult.fromJson(res.data);
  }

  static Future<void> delete(String id) async {
    await ApiService.dio.delete('/api/v1/alerts/$id');
  }

  // Bulk operations
  static Future<Map<String, dynamic>> bulkAction(
      String action, List<String> ids) async {
    final res = await ApiService.dio.post(
      '/api/v1/alerts/bulk',
      data: {'action': action, 'ids': ids},
    );
    return res.data as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> bulkMarkRead(List<String> ids) =>
      bulkAction('mark_read', ids);

  static Future<Map<String, dynamic>> bulkMarkResolved(List<String> ids) =>
      bulkAction('mark_resolved', ids);

  static Future<Map<String, dynamic>> bulkDelete(List<String> ids) =>
      bulkAction('delete', ids);
}
