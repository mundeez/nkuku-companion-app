import 'dart:ui';
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
  static String? get role => _user?['role'];

  static bool get isOwner => role == 'owner';
  static bool get isManager => role == 'manager';
  static bool get isViewer => role == 'viewer';
  static bool get isFlockMinder => role == 'flock_minder';
  static bool get isSalesPerson => role == 'sales_person';
  static bool get canEdit => isOwner || isManager;
  static bool get canDelete => isOwner;
  static bool get canManageSales => isOwner || isManager || isSalesPerson;
  static bool get canManageDocuments =>
      isOwner || isManager || isFlockMinder || isSalesPerson;
  static bool get canManageFlockOps => isOwner || isManager || isFlockMinder;

  static final List<VoidCallback> _authStateListeners = [];

  static void addAuthStateListener(VoidCallback listener) {
    _authStateListeners.add(listener);
  }

  static void removeAuthStateListener(VoidCallback listener) {
    _authStateListeners.remove(listener);
  }

  static void _notifyAuthStateChanged() {
    for (final listener in _authStateListeners) {
      listener();
    }
  }

  static Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    _token = _prefs.getString('access_token');
    // Restore user object from individually stored fields
    final userEmail = _prefs.getString('user_email');
    final userRole = _prefs.getString('user_role');
    if (userEmail != null) {
      _user = {'email': userEmail, 'role': userRole ?? 'viewer'};
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
      // validateStatus allows <500 through without throwing, so check 4xx here
      if (res.statusCode != null && res.statusCode! >= 400) {
        _lastError = _httpError(res.statusCode!, res.data);
        return false;
      }
      final data = res.data;
      _token = data['accessToken'];
      _user = data['user'];
      await _prefs.setString('access_token', _token!);
      await _prefs.setString('refresh_token', data['refreshToken']);
      await _prefs.setString('user_email', _user!['email']);
      await _prefs.setString('user_role', _user!['role'] ?? 'viewer');
      _notifyAuthStateChanged();
      return true;
    } on DioException catch (e) {
      _lastError = _dioError(e);
      return false;
    } catch (e) {
      _lastError = 'Unexpected error: $e';
      return false;
    }
  }

  /// Self-serve signup: creates a new Organization + owner User.
  /// Returns true on success (user is logged in), false on failure.
  static Future<bool> register({
    required String email,
    required String password,
    required String name,
    required String organizationName,
    required String country,
    String currency = 'ZMW',
  }) async {
    _lastError = null;
    try {
      final res = await ApiService.dio.post('/api/v1/auth/register', data: {
        'email': email,
        'password': password,
        'name': name,
        'organizationName': organizationName,
        'country': country,
        'currency': currency,
        'consent': true,
      });
      // validateStatus allows <500 through without throwing, so check 4xx here
      if (res.statusCode != null && res.statusCode! >= 400) {
        if (res.statusCode == 409) {
          _lastError =
              'An account with this email already exists. Try signing in instead.';
        } else {
          _lastError = _httpError(res.statusCode!, res.data);
        }
        return false;
      }
      final data = res.data;
      _token = data['accessToken'];
      _user = data['user'];
      await _prefs.setString('access_token', _token!);
      await _prefs.setString('refresh_token', data['refreshToken']);
      await _prefs.setString('user_email', _user!['email']);
      await _prefs.setString('user_role', _user!['role'] ?? 'viewer');
      _notifyAuthStateChanged();
      return true;
    } on DioException catch (e) {
      _lastError = _dioError(e);
      return false;
    } catch (e) {
      _lastError = 'Unexpected error: $e';
      return false;
    }
  }

  /// Accept an invitation to join an existing organization.
  /// [token] is the invite token from the invite link.
  /// [password] and [name] are required only if the invited email
  /// doesn't already have an account.
  /// Returns true on success (user is logged in), false on failure.
  static Future<bool> acceptInvite({
    required String token,
    String? password,
    String? name,
  }) async {
    _lastError = null;
    try {
      final res =
          await ApiService.dio.post('/api/v1/auth/accept-invite', data: {
        'token': token,
        if (password != null && password.isNotEmpty) 'password': password,
        if (name != null && name.isNotEmpty) 'name': name,
        'consent': true,
      });
      // validateStatus allows <500 through without throwing, so check 4xx here
      if (res.statusCode != null && res.statusCode! >= 400) {
        if (res.statusCode == 400) {
          final errCode = res.data?['error'] ?? '';
          if (errCode == 'INVALID_OR_EXPIRED_INVITE') {
            _lastError =
                'This invite link is invalid or has expired. Please ask your organization owner for a new invite.';
          } else if (errCode == 'NAME_AND_PASSWORD_REQUIRED_FOR_NEW_ACCOUNT') {
            _lastError = 'NAME_AND_PASSWORD_REQUIRED_FOR_NEW_ACCOUNT';
          } else {
            _lastError = _httpError(res.statusCode!, res.data);
          }
        } else {
          _lastError = _httpError(res.statusCode!, res.data);
        }
        return false;
      }
      final data = res.data;
      _token = data['accessToken'];
      _user = data['user'];
      await _prefs.setString('access_token', _token!);
      await _prefs.setString('refresh_token', data['refreshToken']);
      await _prefs.setString('user_email', _user!['email']);
      await _prefs.setString('user_role', _user!['role'] ?? 'viewer');
      _notifyAuthStateChanged();
      return true;
    } on DioException catch (e) {
      _lastError = _dioError(e);
      return false;
    } catch (e) {
      _lastError = 'Unexpected error: $e';
      return false;
    }
  }

  /// Shared DioException → human-readable message helper.
  static String _dioError(DioException e) {
    if (e.type == DioExceptionType.connectionTimeout) {
      return 'Connection timeout after 30s. The server may be unreachable from your network.';
    } else if (e.type == DioExceptionType.receiveTimeout) {
      return 'Server response timeout. The server is slow to respond.';
    } else if (e.type == DioExceptionType.connectionError) {
      return 'Cannot connect to server. ${e.error ?? e.message}';
    } else if (e.type == DioExceptionType.sendTimeout) {
      return 'Request send timeout. Check your connection.';
    } else if (e.type == DioExceptionType.badCertificate) {
      return 'SSL certificate error. The server certificate is not trusted.';
    } else if (e.response?.statusCode == 401) {
      return 'Invalid email or password.';
    } else if (e.response?.statusCode == 404) {
      return 'Server endpoint not found (404).';
    } else {
      return 'Error ${e.response?.statusCode ?? e.type}: ${e.message}';
    }
  }

  /// Shared HTTP 4xx response → human-readable message helper.
  /// Used because validateStatus allows <500 through without throwing.
  static String _httpError(int status, dynamic data) {
    if (status == 401) {
      return 'Invalid email or password.';
    } else if (status == 404) {
      return 'Server endpoint not found (404).';
    } else if (data is Map && data['message'] != null) {
      return data['message'].toString();
    } else {
      return 'Error $status. Please try again.';
    }
  }

  static Future<void> logout() async {
    _token = null;
    _user = null;
    await _prefs.remove('access_token');
    await _prefs.remove('refresh_token');
    await _prefs.remove('user_email');
    await _prefs.remove('user_role');
    _notifyAuthStateChanged();
  }
}
