import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Platform (staff console) API client for Nkuku Admin.
/// Base URL is the tenant API host — platform routes live under /api/v1/platform.
const String kApiBase = String.fromEnvironment(
  'APP_API_BASE_URL',
  defaultValue: 'https://nkuku.deeztechnology.solutions',
);

/// Staff roles mapped to the platform permissions used by the Wave 2
/// surfaces (catalogue.write, billing.*, flags.write, announcements.write,
/// analytics.read). Mirrors the matrix in PLAN-super-admin-console §3.
const Map<String, Set<String>> kRolePermissions = {
  'super_admin': {
    'catalogue.write',
    'billing.read',
    'billing.plans.write',
    'announcements.write',
    'flags.write',
    'analytics.read',
  },
  'support': {'billing.read'},
  'finance': {'billing.read', 'billing.plans.write', 'analytics.read'},
  'content_editor': {'catalogue.write'},
  'marketing': {'announcements.write', 'analytics.read'},
  'auditor': {'billing.read', 'analytics.read'},
};

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
    for (final k in ['accessToken', 'refreshToken', 'staffName', 'staffEmail', 'staffRole', 'staffId', 'reauthAt']) {
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

  // ── Re-auth (dangerous writes, ≤5 min freshness) ──────

  /// Reads the `reauthAt` claim out of the stored access token — no
  /// signature check needed, the API re-verifies on every call.
  static int? _tokenReauthAt(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;
      final payload =
          utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
      final claims = jsonDecode(payload) as Map<String, dynamic>;
      final v = claims['reauthAt'];
      return v is num ? v.toInt() : int.tryParse('$v');
    } catch (_) {
      return null;
    }
  }

  /// Whether the current session was re-authed within [windowMs].
  /// Mirrors the web console's isReauthFresh — a fresh password+TOTP
  /// login counts as a re-auth (see markReauth).
  static Future<bool> isReauthFresh({int windowMs = 5 * 60 * 1000}) async {
    final p = await SharedPreferences.getInstance();
    final token = p.getString('accessToken');
    final claim = token != null ? _tokenReauthAt(token) : null;
    final local = p.getInt('reauthAt');
    final at = [claim ?? 0, local ?? 0].reduce((a, b) => a > b ? a : b);
    if (at == 0) return false;
    return DateTime.now().millisecondsSinceEpoch - at <= windowMs;
  }

  /// Call after a successful login/verify — equivalent to the web
  /// client's setReauthAt(Date.now()).
  static Future<void> markReauth() async {
    final p = await SharedPreferences.getInstance();
    await p.setInt('reauthAt', DateTime.now().millisecondsSinceEpoch);
  }

  /// Fresh re-auth with password OR TOTP. Returns the server's reauthAt.
  static Future<int> reauth({String? password, String? totp}) async {
    final r = await dio.post('/api/v1/platform/auth/reauth',
        data: {
          'password': ?password,
          'totp': ?totp,
        });
    final p = await SharedPreferences.getInstance();
    if (r.data?['accessToken'] != null) {
      await p.setString('accessToken', r.data['accessToken']);
    }
    final at = (r.data?['reauthAt'] as num?)?.toInt() ??
        DateTime.now().millisecondsSinceEpoch;
    await p.setInt('reauthAt', at);
    return at;
  }

  /// Current staff role → whether it holds [permission] (client-side
  /// UX gate only — the API enforces authoritatively).
  static Future<bool> hasPermission(String permission) async {
    final p = await SharedPreferences.getInstance();
    final role = p.getString('staffRole') ?? '';
    return kRolePermissions[role]?.contains(permission) ?? false;
  }

  // ── P4: catalogue (catalogue.write) ───────────────────
  // entity ∈ diseases | breeds | performance-targets |
  //          vaccination-schedules | supplier-category-templates
  static const List<String> catalogueEntities = [
    'diseases',
    'breeds',
    'vaccination-schedules',
    'performance-targets',
    'supplier-category-templates',
  ];

  static Future<List<dynamic>> catalogue(String entity) async {
    final r = await dio.get('/api/v1/platform/catalogue/$entity');
    final d = r.data;
    return d is List ? d : (d['items'] ?? d['data'] ?? []) as List;
  }

  static Future<Map<String, dynamic>> catalogueCreate(
      String entity, Map<String, dynamic> body) async {
    final r = await dio.post('/api/v1/platform/catalogue/$entity', data: body);
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> catalogueUpdate(
      String entity, String id, Map<String, dynamic> body) async {
    final r = await dio.patch(
        '/api/v1/platform/catalogue/$entity/$id',
        data: body);
    return Map<String, dynamic>.from(r.data);
  }

  static Future<void> catalogueDelete(String entity, String id) async {
    await dio.delete('/api/v1/platform/catalogue/$entity/$id');
  }

  // ── P4: plans & pricing (billing.read / billing.plans.write) ──

  static Future<List<dynamic>> plans() async {
    final r = await dio.get('/api/v1/platform/plans');
    final d = r.data;
    return d is List ? d : (d['items'] ?? d['data'] ?? []) as List;
  }

  static Future<Map<String, dynamic>> planUpdate(
      String code, Map<String, dynamic> patch) async {
    final r = await dio.patch('/api/v1/platform/plans/$code',
        data: patch);
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> planReplacePrices(
      String code, List<Map<String, dynamic>> prices) async {
    final r = await dio.put('/api/v1/platform/plans/$code/prices',
        data: {'prices': prices});
    return Map<String, dynamic>.from(r.data);
  }

  // ── P4: feature flags (flags.write) ───────────────────

  static Future<List<dynamic>> flags() async {
    final r = await dio.get('/api/v1/platform/flags');
    final d = r.data;
    return d is List ? d : (d['items'] ?? d['data'] ?? []) as List;
  }

  static Future<Map<String, dynamic>> flagCreate(
      Map<String, dynamic> body) async {
    final r = await dio.post('/api/v1/platform/flags', data: body);
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> flagUpdate(
      String key, Map<String, dynamic> patch) async {
    final r = await dio.patch('/api/v1/platform/flags/$key', data: patch);
    return Map<String, dynamic>.from(r.data);
  }

  static Future<void> flagDelete(String key) async {
    await dio.delete('/api/v1/platform/flags/$key');
  }

  // ── P4: announcements (announcements.write) ───────────

  static Future<List<dynamic>> announcements() async {
    final r = await dio.get('/api/v1/platform/announcements');
    final d = r.data;
    return d is List ? d : (d['items'] ?? d['data'] ?? []) as List;
  }

  static Future<Map<String, dynamic>> announcementCreate(
      Map<String, dynamic> body) async {
    final r = await dio.post('/api/v1/platform/announcements', data: body);
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> announcementUpdate(
      String id, Map<String, dynamic> patch) async {
    final r = await dio.patch('/api/v1/platform/announcements/$id',
        data: patch);
    return Map<String, dynamic>.from(r.data);
  }

  static Future<void> announcementDelete(String id) async {
    await dio.delete('/api/v1/platform/announcements/$id');
  }

  // ── P5: analytics (analytics.read) ────────────────────

  static Future<Map<String, dynamic>> analyticsOverviewRange({
    String? from,
    String? to,
  }) async {
    final r = await dio.get('/api/v1/platform/analytics/overview',
        queryParameters: {
          if (from != null && from.isNotEmpty) 'from': from,
          if (to != null && to.isNotEmpty) 'to': to,
        });
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> analyticsCohorts() async {
    final r = await dio.get('/api/v1/platform/analytics/cohorts');
    return Map<String, dynamic>.from(r.data);
  }

  /// CSV export as raw text (shown in a dialog — file share isn't in
  /// the Wave 2 scope).
  static Future<String> analyticsCsv({String? from, String? to}) async {
    final r = await dio.get<String>(
      '/api/v1/platform/analytics/export.csv',
      queryParameters: {
        if (from != null && from.isNotEmpty) 'from': from,
        if (to != null && to.isNotEmpty) 'to': to,
      },
      options: Options(responseType: ResponseType.plain),
    );
    return r.data ?? '';
  }
}
