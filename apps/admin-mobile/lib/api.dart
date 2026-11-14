import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Platform (staff console) API client for Nkuku Admin.
/// Base URL is the tenant API host — platform routes live under /api/v1/platform.
const String kApiBase = String.fromEnvironment(
  'APP_API_BASE_URL',
  defaultValue: 'https://nkuku.deeztechnology.solutions',
);

class Api {
  Api._();
  static final Dio dio = Dio(BaseOptions(
    baseUrl: kApiBase,
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 30),
  ))
    ..interceptors.add(InterceptorsWrapper(onRequest: (o, h) async {
      final token = await Api.token();
      if (token != null) o.headers['Authorization'] = 'Bearer $token';
      h.next(o);
    }, onError: (e, h) async {
      // 401 → try one refresh then retry once
      if (e.response?.statusCode == 401 &&
          e.requestOptions.extra['retried'] != true) {
        final ok = await Api.refresh();
        if (ok) {
          e.requestOptions.extra['retried'] = true;
          final token = await Api.token();
          e.requestOptions.headers['Authorization'] = 'Bearer $token';
          try {
            final r = await dio.fetch(e.requestOptions);
            return h.resolve(r);
          } catch (_) {}
        }
      }
      h.next(e);
    }));

  static Future<String?> token() async =>
      (await SharedPreferences.getInstance()).getString('accessToken');

  static Future<void> setSession(
      String accessToken, String? refreshToken, Map<String, dynamic>? user) async {
    final p = await SharedPreferences.getInstance();
    await p.setString('accessToken', accessToken);
    if (refreshToken != null) await p.setString('refreshToken', refreshToken);
    if (user != null) {
      await p.setString('staffName', '${user['firstName'] ?? user['name'] ?? ''} ${user['lastName'] ?? ''}'.trim());
      await p.setString('staffEmail', user['email'] ?? '');
      await p.setString('staffRole', user['role'] ?? '');
      if (user['id'] != null) await p.setString('staffId', '${user['id']}');
    }
  }

  static Future<void> clearSession() async {
    final p = await SharedPreferences.getInstance();
    for (final k in ['accessToken', 'refreshToken', 'staffName', 'staffEmail', 'staffRole', 'staffId']) {
      await p.remove(k);
    }
  }

  static Future<bool> refresh() async {
    try {
      final p = await SharedPreferences.getInstance();
      final rt = p.getString('refreshToken');
      if (rt == null) return false;
      final r = await Dio(BaseOptions(baseUrl: kApiBase)).post(
        '/api/v1/platform/auth/refresh',
        data: {'refreshToken': rt},
      );
      if (r.data?['accessToken'] != null) {
        await p.setString('accessToken', r.data['accessToken']);
        if (r.data['refreshToken'] != null) {
          await p.setString('refreshToken', r.data['refreshToken']);
        }
        return true;
      }
    } catch (_) {}
    return false;
  }

  // ── Staff auth ─────────────────────────────────────

  /// Returns raw response: either {accessToken,refreshToken,user} or
  /// {requiresTotp:true|requiresTotpEnrollment:true, ticket}.
  static Future<Map<String, dynamic>> login(String email, String password) async {
    final r = await dio.post('/api/v1/platform/auth/login',
        data: {'email': email, 'password': password});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> totpVerify(String ticket, String code) async {
    final r = await dio.post('/api/v1/platform/auth/totp/verify',
        data: {'ticket': ticket, 'code': code});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> totpEnroll(String ticket) async {
    final r = await dio.post('/api/v1/platform/auth/totp/enroll',
        data: {'ticket': ticket});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> totpConfirm(String ticket, String code) async {
    final r = await dio.post('/api/v1/platform/auth/totp/confirm',
        data: {'ticket': ticket, 'code': code});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<void> logout() async {
    try {
      final p = await SharedPreferences.getInstance();
      await dio.post('/api/v1/platform/auth/logout',
          data: {'refreshToken': p.getString('refreshToken')});
    } catch (_) {}
    await clearSession();
  }

  // ── Platform data ──────────────────────────────────

  static Future<Map<String, dynamic>> analyticsOverview({int days = 30}) async {
    final r = await dio.get('/api/v1/platform/analytics/overview',
        queryParameters: {'days': days});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> opsHealth() async {
    final r = await dio.get('/api/v1/platform/health');
    return Map<String, dynamic>.from(r.data);
  }

  static Future<List<dynamic>> tenants({String? search, int pageSize = 50}) async {
    final r = await dio.get('/api/v1/platform/tenants',
        queryParameters: {
          if (search != null && search.isNotEmpty) 'search': search,
          'pageSize': pageSize,
        });
    final d = r.data;
    return d is List ? d : (d['items'] ?? d['data'] ?? []) as List;
  }

  static Future<List<dynamic>> supportTickets({String? status, String? assigned, String? search}) async {
    final r = await dio.get('/api/v1/platform/tickets',
        queryParameters: {
          'status': ?status,
          'assigned': ?assigned,
          if (search != null && search.isNotEmpty) 'search': search,
        });
    final d = r.data;
    return d is List ? d : (d['items'] ?? d['data'] ?? []) as List;
  }

  static Future<Map<String, dynamic>> tenantDetail(String id) async {
    final r = await dio.get('/api/v1/platform/tenants/$id');
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> ticketDetail(String id) async {
    final r = await dio.get('/api/v1/platform/tickets/$id');
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> ticketReply(String id, String body,
      {bool internalNote = false}) async {
    final r = await dio.post('/api/v1/platform/tickets/$id/reply',
        data: {'body': body, 'internalNote': internalNote});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<void> ticketStatus(String id, String status) async {
    await dio.post('/api/v1/platform/tickets/$id/status', data: {'status': status});
  }

  static Future<void> ticketAssignMe(String id) async {
    final p = await SharedPreferences.getInstance();
    final staffId = p.getString('staffId');
    await dio.post('/api/v1/platform/tickets/$id/assign', data: {'staffId': staffId});
  }

  static Future<List<dynamic>> comms({String? status, String? channel}) async {
    final r = await dio.get('/api/v1/platform/comms',
        queryParameters: {
          'status': ?status,
          'channel': ?channel,
          'pageSize': 50,
        });
    final d = r.data;
    return d is List ? d : (d['items'] ?? d['data'] ?? []) as List;
  }

  static Future<List<dynamic>> impersonationSessions({bool? active}) async {
    final r = await dio.get('/api/v1/platform/impersonation',
        queryParameters: {if (active != null) 'active': '$active'});
    final d = r.data;
    return d is List ? d : (d['items'] ?? d['data'] ?? []) as List;
  }

  static Future<void> endImpersonation(String sessionId) async {
    await dio.post('/api/v1/platform/impersonation/$sessionId/end');
  }
}
