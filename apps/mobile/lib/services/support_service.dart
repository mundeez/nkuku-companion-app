import 'dart:io';
import 'package:dio/dio.dart';
import 'api_service.dart';

/// Tenant-side support tickets (P3). API base: `/api/v1/support`
/// (tenant JWT). The mobile app mirrors the web /support page.
class SupportService {
  /// App version — keep in sync with `version:` in pubspec.yaml
  /// (`1.51.1+154`). Sent as `x-app-version` on new tickets so staff know
  /// which build a report came from. package_info_plus is only a
  /// transitive dep (via sentry_flutter), so we use a constant instead of
  /// adding it as a direct dependency.
  static const String appVersion = '1.51.1+154';

  /// `x-device-info` header — OS + version, e.g. "android Linux 5.x…".
  static String get deviceInfo =>
      '${Platform.operatingSystem} ${Platform.operatingSystemVersion}';

  /// GET /tickets → `{ items: [...] }` (requester's own tickets; owners
  /// also see org tickets — items may carry `requesterEmail`).
  static Future<List<Map<String, dynamic>>> getTickets() async {
    final res = await ApiService.dio.get('/api/v1/support/tickets');
    _throwIfError(res);
    final items = res.data is Map ? res.data['items'] : res.data;
    return (items as List? ?? const []).cast<Map<String, dynamic>>();
  }

  /// GET /tickets/:id → `{ ticket: {...}, messages: [...] }`.
  static Future<Map<String, dynamic>> getTicket(String id) async {
    final res = await ApiService.dio.get('/api/v1/support/tickets/$id');
    _throwIfError(res);
    return (res.data as Map).cast<String, dynamic>();
  }

  /// POST /tickets `{subject, body, category}` → `{ticket}`.
  static Future<Map<String, dynamic>> createTicket({
    required String subject,
    required String body,
    String category = 'general',
  }) async {
    final res = await ApiService.dio.post(
      '/api/v1/support/tickets',
      data: {'subject': subject, 'body': body, 'category': category},
      options: Options(headers: {
        'x-app-version': appVersion,
        'x-device-info': deviceInfo,
      }),
    );
    _throwIfError(res);
    return (res.data as Map).cast<String, dynamic>();
  }

  /// POST /tickets/:id/reply `{body}` → `{message}`.
  static Future<Map<String, dynamic>> reply(String id, String body) async {
    final res = await ApiService.dio.post(
      '/api/v1/support/tickets/$id/reply',
      data: {'body': body},
    );
    _throwIfError(res);
    return (res.data as Map).cast<String, dynamic>();
  }

  /// POST /tickets/:id/close → `{ok}`.
  static Future<void> closeTicket(String id) async {
    final res =
        await ApiService.dio.post('/api/v1/support/tickets/$id/close');
    _throwIfError(res);
  }

  /// validateStatus lets <500 through without throwing — surface 4xx
  /// bodies as Exceptions so callers can show `e.toString()`.
  static void _throwIfError(Response res) {
    final status = res.statusCode ?? 0;
    if (status >= 200 && status < 300) return;
    final data = res.data;
    final msg = data is Map
        ? (data['message'] ?? data['error'] ?? 'HTTP $status')
        : 'HTTP $status';
    throw Exception(msg.toString());
  }
}
