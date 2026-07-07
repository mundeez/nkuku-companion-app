import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';
import 'api_service.dart';

class AuthService {
  static String? _token;
  static Map<String, dynamic>? _user;
  static late SharedPreferences _prefs;

  static bool get isLoggedIn => _token != null && _token!.isNotEmpty;
  static String? get token => _token;
  static Map<String, dynamic>? get user => _user;

  static Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    _token = _prefs.getString('access_token');
    final userJson = _prefs.getString('user');
    if (userJson != null) {
      _user = {'email': _prefs.getString('user_email'), 'role': _prefs.getString('user_role')};
    }
  }

  static String? _lastError;

  static String? get lastError => _lastError;

  static Future<bool> login(String email, String password) async {
    _lastError = null;
    try {
      final res = await ApiService.dio.post('/api/v1/auth/login', data: {
        'email': email,
        'password': password,
      });
      final data = res.data;
      _token = data['accessToken'];
      _user = data['user'];
      await _prefs.setString('access_token', _token!);
      await _prefs.setString('refresh_token', data['refreshToken']);
      await _prefs.setString('user_email', _user!['email']);
      await _prefs.setString('user_role', _user!['role']);
      return true;
    } on DioException catch (e) {
      if (e.type == DioExceptionType.connectionTimeout || e.type == DioExceptionType.receiveTimeout) {
        _lastError = 'Connection timeout. Check your internet connection.';
      } else if (e.type == DioExceptionType.connectionError) {
        _lastError = 'Cannot connect to server. Check your internet connection.';
      } else if (e.response?.statusCode == 401) {
        _lastError = 'Invalid email or password.';
      } else if (e.response?.statusCode == 404) {
        _lastError = 'Server endpoint not found (404).';
      } else {
        _lastError = 'Server error: ${e.response?.statusCode ?? e.message}';
      }
      return false;
    } catch (e) {
      _lastError = 'Unexpected error: $e';
      return false;
    }
  }

  static Future<void> logout() async {
    _token = null;
    _user = null;
    await _prefs.remove('access_token');
    await _prefs.remove('refresh_token');
    await _prefs.remove('user_email');
    await _prefs.remove('user_role');
  }
}

