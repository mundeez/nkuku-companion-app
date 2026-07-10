import 'package:dio/dio.dart';
import 'auth_service.dart';

/// Base API URL — change this before building production APK.
///
/// Development (Android emulator):  http://10.0.2.2:30001
/// Development (iOS simulator):     http://localhost:30001
/// Production:                      https://nkuku.deeztechnology.solutions
///
/// NOTE: Do NOT append "/api" here — route paths already include "/api/v1/...".
const String _baseUrl = 'https://nkuku.deeztechnology.solutions';

class ApiService {
  static String get baseUrl => _baseUrl;

  static final Dio dio = Dio(BaseOptions(
    baseUrl: _baseUrl,
    connectTimeout: const Duration(seconds: 30),
    receiveTimeout: const Duration(seconds: 30),
    sendTimeout: const Duration(seconds: 30),
    validateStatus: (status) => status != null && status < 500,
  ));

  static void setupInterceptors() {
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = AuthService.token;
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) {
        handler.next(error);
      },
    ));
  }
}
