import 'package:dio/dio.dart';
import 'auth_service.dart';

/// Base API URL — change this before building production APK.
///
/// Development (Android emulator):  http://10.0.2.2:30001
/// Development (iOS simulator):     http://localhost:30001
/// Production:                      https://nkuku.deeztechnology.solutions/api
const String _baseUrl = 'http://10.0.2.2:30001';

class ApiService {
  static final Dio dio = Dio(BaseOptions(
    baseUrl: _baseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 10),
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
