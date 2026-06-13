import 'package:shared_preferences/shared_preferences.dart';
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

  static Future<bool> login(String email, String password) async {
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
    } catch (e) {
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

