import 'dart:developer';
import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'auth_service.dart';
import 'billing_url.dart';

/// Base API URL — set at build time via `--dart-define=APP_API_BASE_URL=...`.
///
/// Development (Android emulator):  --dart-define=APP_API_BASE_URL=http://10.0.2.2:30001
/// Development (iOS simulator):     --dart-define=APP_API_BASE_URL=http://localhost:30001
/// Production:                      --dart-define=APP_API_BASE_URL=https://nkuku.zeendeefood.solutions
///
/// NOTE: Do NOT append "/api" here — route paths already include "/api/v1/...".
const String _baseUrl = String.fromEnvironment(
  'APP_API_BASE_URL',
  defaultValue: 'https://nkuku.zeendeefood.solutions',
);

/// Parsed body of an HTTP 402 (PLAN_LIMIT_REACHED) response.
///
/// Shape (apps/api/src/core/billing/feature-gate.ts):
/// ```
/// { error: 'PLAN_LIMIT_REACHED', message, limit?, current?, max?,
///   feature?, currentPlan? }
/// ```
class PlanLimitInfo {
  /// Human-readable explanation of which limit was hit (from the server).
  final String message;

  /// Machine name of the limit, e.g. 'maxActiveFlocks' / 'maxUsers'.
  final String? limit;

  /// Current usage count, when the server reports it.
  final int? current;

  /// Plan maximum, when the server reports it.
  final int? max;

  /// Gated feature name, when the 402 came from `requireFeature`.
  final String? feature;

  /// Plan code the org is currently on, e.g. 'free'.
  final String? currentPlan;

  const PlanLimitInfo({
    required this.message,
    this.limit,
    this.current,
    this.max,
    this.feature,
    this.currentPlan,
  });

  static const _fallbackMessage =
      'You have reached a limit on your current plan.';

  factory PlanLimitInfo.fromResponse(dynamic data) {
    if (data is Map) {
      return PlanLimitInfo(
        message: data['message']?.toString() ?? _fallbackMessage,
        limit: data['limit']?.toString(),
        current: (data['current'] as num?)?.toInt(),
        max: (data['max'] as num?)?.toInt(),
        feature: data['feature']?.toString(),
        currentPlan: data['currentPlan']?.toString(),
      );
    }
    return const PlanLimitInfo(message: _fallbackMessage);
  }
}

class ApiService {
  static String get baseUrl => _baseUrl;

  /// Web app base URL, derived from [baseUrl] (see billing_url.dart).
  static String get webBaseUrl => webBaseUrlFrom(_baseUrl);

  /// URL of the web billing page (`<web base>/billing`).
  static String get billingUrl => billingUrlFrom(_baseUrl);

  /// Global navigator key — assigned to `MaterialApp.navigatorKey` in
  /// main.dart. Lets interceptors surface app-level UI (like the 402
  /// upgrade sheet) regardless of which screen issued the request.
  static final GlobalKey<NavigatorState> navigatorKey =
      GlobalKey<NavigatorState>();

  static final Dio dio = Dio(BaseOptions(
    baseUrl: _baseUrl,
    connectTimeout: const Duration(seconds: 30),
    receiveTimeout: const Duration(seconds: 30),
    sendTimeout: const Duration(seconds: 30),
    validateStatus: (status) => status != null && status < 500,
  ));

  /// Optional callback invoked when the app receives a 401 or 403 response.
  /// The caller (usually `main.dart`) should navigate to the login screen.
  static VoidCallback? onAuthFailure;

  /// Optional callback invoked when the app receives a 402 response
  /// (PLAN_LIMIT_REACHED). The caller (usually `main.dart`) should present
  /// the upgrade bottom sheet.
  static void Function(PlanLimitInfo info)? onPlanLimitReached;

  static void setupInterceptors() {
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = AuthService.token;
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onResponse: (response, handler) {
        // Check for auth failures on "successful" responses (validateStatus allows <500)
        final status = response.statusCode;
        if (status == 401 || status == 403) {
          // Only treat this as a session failure when a session exists.
          // Pre-login calls (login 401 bad credentials, login 403
          // ORGANIZATION_PENDING_DELETION, restore 401/410) must not
          // kick off logout + navigation — the caller handles them.
          if (AuthService.isLoggedIn) {
            log('Auth failure ($status) on ${response.requestOptions.path} — logging out', name: 'ApiService');
            AuthService.logout().then((_) {
              onAuthFailure?.call();
            });
          }
        } else if (status == 402) {
          log('Plan limit reached on ${response.requestOptions.path}', name: 'ApiService');
          onPlanLimitReached
              ?.call(PlanLimitInfo.fromResponse(response.data));
        }
        handler.next(response);
      },
      onError: (error, handler) {
        final status = error.response?.statusCode;
        if (status == 401 || status == 403) {
          if (AuthService.isLoggedIn) {
            log('Auth failure ($status) — logging out', name: 'ApiService');
            AuthService.logout().then((_) {
              onAuthFailure?.call();
            });
          }
        } else if (status == 402) {
          // Reached only when a call site overrides validateStatus — the
          // default path surfaces 402 via onResponse above.
          log('Plan limit reached (402) — notifying', name: 'ApiService');
          onPlanLimitReached
              ?.call(PlanLimitInfo.fromResponse(error.response?.data));
        }
        handler.next(error);
      },
    ));
  }
}
