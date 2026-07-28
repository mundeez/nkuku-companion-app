import 'dart:developer';
import 'dart:ui';
import 'package:dio/dio.dart';
import 'auth_service.dart';

/// Base API URL — set at build time via `--dart-define=APP_API_BASE_URL=...`.
///
/// Development (Android emulator):  --dart-define=APP_API_BASE_URL=http://10.0.2.2:30001
/// Development (iOS simulator):     --dart-define=APP_API_BASE_URL=http://localhost:30001
/// Production:                      --dart-define=APP_API_BASE_URL=https://nkuku.deeztechnology.solutions
///
/// NOTE: Do NOT append "/api" here — route paths already include "/api/v1/...".
const String _baseUrl = String.fromEnvironment(
  'APP_API_BASE_URL',
  defaultValue: 'https://nkuku.deeztechnology.solutions',
);

class ApiService {
  static String get baseUrl => _baseUrl;

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
          log('Auth failure ($status) on ${response.requestOptions.path} — logging out', name: 'ApiService');
          AuthService.logout().then((_) {
            onAuthFailure?.call();
          });
        }
        handler.next(response);
      },
      onError: (error, handler) {
        final status = error.response?.statusCode;
        if (status == 401 || status == 403) {
          log('Auth failure ($status) — logging out', name: 'ApiService');
          AuthService.logout().then((_) {
            onAuthFailure?.call();
          });
        }
        handler.next(error);
      },
    ));
  }
}
