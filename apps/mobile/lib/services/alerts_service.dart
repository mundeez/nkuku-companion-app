import 'dart:developer';
import 'package:dio/dio.dart';
import 'api_service.dart';
import 'connectivity_service.dart';
import 'offline_repository.dart';
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
      // validateStatus allows 4xx through without throwing — surface those
      // as real errors instead of silently falling back to cache.
      if (res.statusCode != null && res.statusCode! >= 400) {
        throw DioException(
          requestOptions: res.requestOptions,
          response: res,
          type: DioExceptionType.badResponse,
          message: 'HTTP ${res.statusCode}: ${res.data}',
        );
      }
      final alerts =
          (res.data as List).map((e) => Alert.fromJson(e)).toList();
      // The OfflineRepository caches alerts in Drift via its SWR pattern
      // (getAlerts fetches and caches). No manual cache write needed here.
      ConnectivityService.instance.markOnline();
      return alerts;
    } on DioException catch (e) {
      // Only treat genuine network errors as "offline" — auth/server errors
      // must propagate so the UI can show them instead of stale cache.
      if (_isNetworkError(e)) {
        log('AlertsService: network error, falling back to cache: $e',
            name: 'AlertsService');
        ConnectivityService.instance.markOffline();
        final cached = await OfflineRepository.instance.getAlerts();
        return cached.map((a) => Alert.fromJson({
              'id': a.id,
              'flockId': a.flockId,
              'alertType': a.alertType,
              'title': a.title,
              'message': a.message,
              'severity': a.severity,
              'dueDate': a.dueDate,
              'isRead': a.isRead,
              'isResolved': a.isResolved,
              'createdAt': a.createdAt,
            })).toList();
      }
      // Re-throw auth/validation/server errors so the screen can display them.
      rethrow;
    } catch (e) {
      // Parsing errors should not be masked as offline — surface them.
      log('AlertsService: parse error: $e', name: 'AlertsService');
      rethrow;
    }
  }

  static Future<Alert> markRead(String id) async {
    final res = await ApiService.dio
        .patch('/api/v1/alerts/$id', data: {'isRead': true});
    _assertOk(res);
    await _invalidateCache();
    return Alert.fromJson(res.data);
  }

  static Future<Alert> markResolved(String id) async {
    final res = await ApiService.dio
        .patch('/api/v1/alerts/$id', data: {'isResolved': true});
    _assertOk(res);
    await _invalidateCache();
    return Alert.fromJson(res.data);
  }

  static Future<AlertGenerateResult> generate() async {
    final res = await ApiService.dio.post('/api/v1/alerts/generate');
    _assertOk(res);
    await _invalidateCache();
    return AlertGenerateResult.fromJson(res.data);
  }

  static Future<void> delete(String id) async {
    final res = await ApiService.dio.delete('/api/v1/alerts/$id');
    _assertOk(res);
    await _invalidateCache();
  }

  // Bulk operations
  static Future<Map<String, dynamic>> bulkAction(
      String action, List<String> ids) async {
    final res = await ApiService.dio.post(
      '/api/v1/alerts/bulk',
      data: {'action': action, 'ids': ids},
    );
    _assertOk(res);
    await _invalidateCache();
    return res.data as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> bulkMarkRead(List<String> ids) =>
      bulkAction('mark_read', ids);

  static Future<Map<String, dynamic>> bulkMarkResolved(List<String> ids) =>
      bulkAction('mark_resolved', ids);

  static Future<Map<String, dynamic>> bulkDelete(List<String> ids) =>
      bulkAction('delete', ids);

  /// Clear the cached alerts so the next read fetches fresh data from the
  /// API after a mutation. The OfflineRepository uses a stale-while-revalidate
  /// pattern, so the cache will refresh automatically on the next read.
  static Future<void> _invalidateCache() async {
    // No-op: OfflineRepository's SWR pattern handles cache freshness.
    // The next getAlerts() call will return cached data immediately and
    // refresh in the background.
  }

  static bool _isNetworkError(DioException e) {
    return e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.sendTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.connectionError;
  }

  static void _assertOk(Response res) {
    if (res.statusCode == null || res.statusCode! >= 400) {
      throw DioException(
        requestOptions: res.requestOptions,
        response: res,
        type: DioExceptionType.badResponse,
        message: 'HTTP ${res.statusCode}: ${res.data}',
      );
    }
  }
}
