import 'dart:ui';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:dio/dio.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'api_cache.dart';
import 'api_service.dart';
import 'offline_repository.dart';

class AuthService {
  static String? _token;
  static Map<String, dynamic>? _user;
  static late SharedPreferences _prefs;
  static late FlutterSecureStorage _secure;

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
    _secure = const FlutterSecureStorage();
    _token = await _secure.read(key: 'access_token');
    // Restore user object from individually stored fields
    final userEmail = _prefs.getString('user_email');
    final userRole = _prefs.getString('user_role');
    if (userEmail != null) {
      _user = {'email': userEmail, 'role': userRole ?? 'viewer'};
    }
  }

  static String? _lastError;

  static String? get lastError => _lastError;

  /// Persist tokens to secure storage (Keystore/Keychain) and user info
  /// to SharedPreferences (non-sensitive — just email/role for UI).
  static Future<void> _persistSession({
    required String accessToken,
    required String refreshToken,
    required Map<String, dynamic> user,
  }) async {
    _token = accessToken;
    _user = user;
    await _secure.write(key: 'access_token', value: accessToken);
    await _secure.write(key: 'refresh_token', value: refreshToken);
    await _prefs.setString('user_email', user['email'] ?? '');
    await _prefs.setString('user_role', user['role'] ?? 'viewer');
  }

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
      // Check if new-device verification is required
      if (data['requiresDeviceVerification'] == true) {
        _lastError = 'NEW_DEVICE_VERIFICATION_REQUIRED:${data['phone'] ?? ''}:${data['message'] ?? 'New device detected. An OTP has been sent to your phone.'}';
        return false;
      }
      await _persistSession(
        accessToken: data['accessToken'],
        refreshToken: data['refreshToken'],
        user: data['user'],
      );
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

  /// Send an OTP code to a phone number.
  /// [purpose] must be "signup", "login", or "new_device".
  /// Returns the masked phone message on success, or null on failure.
  static Future<String?> sendOtp(String phone, String purpose) async {
    _lastError = null;
    try {
      final res = await ApiService.dio.post('/api/v1/auth/send-otp', data: {
        'phone': phone,
        'purpose': purpose,
      });
      if (res.statusCode != null && res.statusCode! >= 400) {
        _lastError = _httpError(res.statusCode!, res.data);
        return null;
      }
      return res.data['message'] as String?;
    } on DioException catch (e) {
      _lastError = _dioError(e);
      return null;
    } catch (e) {
      _lastError = 'Unexpected error: $e';
      return null;
    }
  }

  /// Verify an OTP code. For login/new_device, logs the user in.
  /// For signup, creates the account (requires signupData).
  /// Returns true on success (user is logged in), false on failure.
  static Future<bool> verifyOtp({
    required String phone,
    required String otp,
    required String purpose,
    Map<String, dynamic>? signupData,
  }) async {
    _lastError = null;
    try {
      final res = await ApiService.dio.post('/api/v1/auth/verify-otp', data: {
        'phone': phone,
        'otp': otp,
        'purpose': purpose,
        if (signupData != null) 'signupData': signupData,
      });
      if (res.statusCode != null && res.statusCode! >= 400) {
        _lastError = _httpError(res.statusCode!, res.data);
        return false;
      }
      final data = res.data;
      await _persistSession(
        accessToken: data['accessToken'],
        refreshToken: data['refreshToken'],
        user: data['user'],
      );
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

  /// Login with phone + OTP (passwordless).
  /// The OTP must have been sent via [sendOtp] first.
  static Future<bool> loginWithOtp(String phone, String otp) async {
    _lastError = null;
    try {
      final res = await ApiService.dio.post('/api/v1/auth/login', data: {
        'phone': phone,
        'otp': otp,
      });
      if (res.statusCode != null && res.statusCode! >= 400) {
        _lastError = _httpError(res.statusCode!, res.data);
        return false;
      }
      final data = res.data;
      await _persistSession(
        accessToken: data['accessToken'],
        refreshToken: data['refreshToken'],
        user: data['user'],
      );
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

  /// Self-serve signup with email (no OTP needed).
  /// For phone-only signup, use [sendOtp] + [verifyOtp] instead.
  /// Returns true on success (user is logged in), false on failure.
  static Future<bool> register({
    String? email,
    String? phone,
    String? password,
    required String name,
    required String organizationName,
    required String country,
    String currency = 'ZMW',
  }) async {
    _lastError = null;
    try {
      final res = await ApiService.dio.post('/api/v1/auth/register', data: {
        if (email != null && email.isNotEmpty) 'email': email,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
        if (password != null && password.isNotEmpty) 'password': password,
        'name': name,
        'organizationName': organizationName,
        'country': country,
        'currency': currency,
        'consent': true,
      });
      // validateStatus allows <500 through without throwing, so check 4xx here
      if (res.statusCode != null && res.statusCode! >= 400) {
        if (res.statusCode == 409) {
          final errCode = res.data?['error'] ?? '';
          if (errCode == 'EMAIL_ALREADY_REGISTERED') {
            _lastError =
                'An account with this email already exists. Try signing in instead.';
          } else if (errCode == 'PHONE_ALREADY_REGISTERED') {
            _lastError =
                'An account with this phone number already exists. Try signing in instead.';
          } else {
            _lastError = _httpError(res.statusCode!, res.data);
          }
        } else {
          _lastError = _httpError(res.statusCode!, res.data);
        }
        return false;
      }
      final data = res.data;
      await _persistSession(
        accessToken: data['accessToken'],
        refreshToken: data['refreshToken'],
        user: data['user'],
      );
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
      await _persistSession(
        accessToken: data['accessToken'],
        refreshToken: data['refreshToken'],
        user: data['user'],
      );
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

  // ── Social Login ──

  /// Result of a social login attempt — either the user is logged in,
  /// or they need to complete signup (no org yet).
  static Map<String, dynamic>? _lastSocialResult;

  /// Returns the last social login result if it needs signup completion.
  static Map<String, dynamic>? get lastSocialResult => _lastSocialResult;

  /// Sign in with Google using the native SDK.
  /// Returns true if logged in, false if needs signup (check lastSocialResult),
  /// or false on error (check lastError).
  static Future<bool> signInWithGoogle() async {
    _lastError = null;
    _lastSocialResult = null;
    try {
      final googleSignIn = GoogleSignIn(scopes: ['email', 'profile']);
      final account = await googleSignIn.signIn();
      if (account == null) {
        _lastError = 'Google sign-in cancelled';
        return false;
      }
      final auth = await account.authentication;
      final idToken = auth.idToken;
      if (idToken == null) {
        _lastError = 'Failed to get Google ID token';
        return false;
      }
      return await _socialLogin('google', idToken);
    } catch (e) {
      _lastError = 'Google sign-in failed: $e';
      return false;
    }
  }

  /// Sign in with Facebook using the native SDK.
  static Future<bool> signInWithFacebook() async {
    _lastError = null;
    _lastSocialResult = null;
    try {
      final result = await FacebookAuth.instance.login(
        permissions: ['email', 'public_profile'],
      );
      if (result.status != LoginStatus.success) {
        _lastError = 'Facebook sign-in cancelled or failed: ${result.status}';
        return false;
      }
      final accessToken = result.accessToken!.token;
      return await _socialLogin('facebook', accessToken);
    } catch (e) {
      _lastError = 'Facebook sign-in failed: $e';
      return false;
    }
  }

  /// Sign in with Apple using the native SDK.
  static Future<bool> signInWithApple() async {
    _lastError = null;
    _lastSocialResult = null;
    try {
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
      );
      final idToken = credential.identityToken;
      if (idToken == null) {
        _lastError = 'Failed to get Apple ID token';
        return false;
      }
      return await _socialLogin('apple', idToken);
    } on SignInWithAppleAuthorizationException catch (e) {
      if (e.code == AuthorizationErrorCode.canceled) {
        _lastError = 'Apple sign-in cancelled';
      } else {
        _lastError = 'Apple sign-in failed: ${e.code} ${e.message}';
      }
      return false;
    } catch (e) {
      _lastError = 'Apple sign-in failed: $e';
      return false;
    }
  }

  /// Internal: send the social token to the API and handle the response.
  static Future<bool> _socialLogin(String provider, String token) async {
    try {
      final response = await ApiService.dio.post(
        '/api/v1/auth/social/login',
        data: {'provider': provider, 'token': token},
        options: Options(validateStatus: (s) => s! < 500),
      );
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        if (data['needsSignup'] == true) {
          _lastSocialResult = data;
          return false;
        }
        await _persistSession(
          accessToken: data['accessToken'],
          refreshToken: data['refreshToken'],
          user: data['user'],
        );
        _notifyAuthStateChanged();
        return true;
      } else {
        final data = response.data;
        _lastError = (data is Map && data['message'] != null)
            ? data['message'].toString()
            : 'Social login failed (${response.statusCode})';
        return false;
      }
    } on DioException catch (e) {
      _lastError = _dioError(e);
      return false;
    } catch (e) {
      _lastError = 'Unexpected error: $e';
      return false;
    }
  }

  /// Complete signup for a social user (creates org).
  static Future<bool> completeSocialSignup({
    required String tempToken,
    required String organizationName,
    required String country,
    required String currency,
  }) async {
    _lastError = null;
    try {
      final response = await ApiService.dio.post(
        '/api/v1/auth/social/complete-signup',
        data: {
          'tempToken': tempToken,
          'organizationName': organizationName,
          'country': country,
          'currency': currency,
          'consent': true,
        },
        options: Options(validateStatus: (s) => s! < 500),
      );
      if (response.statusCode == 201 || response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        await _persistSession(
          accessToken: data['accessToken'],
          refreshToken: data['refreshToken'],
          user: data['user'],
        );
        _notifyAuthStateChanged();
        return true;
      } else {
        final data = response.data;
        _lastError = (data is Map && data['message'] != null)
            ? data['message'].toString()
            : 'Signup failed (${response.statusCode})';
        return false;
      }
    } on DioException catch (e) {
      _lastError = _dioError(e);
      return false;
    } catch (e) {
      _lastError = 'Unexpected error: $e';
      return false;
    }
  }

  /// Get configured social providers from the API.
  static Future<List<Map<String, dynamic>>> getSocialProviders() async {
    try {
      final response = await ApiService.dio.get('/api/v1/auth/social/config');
      final data = response.data as Map<String, dynamic>;
      final providers = data['providers'] as List;
      return providers
          .map((p) => {'provider': p['provider'], 'configured': p['configured']})
          .where((p) => p['configured'] == true)
          .toList()
          .cast<Map<String, dynamic>>();
    } catch (e) {
      return [];
    }
  }

  // ── Account Management ──

  /// Get the current user's profile + linked accounts.
  static Future<Map<String, dynamic>?> getProfile() async {
    _lastError = null;
    try {
      final response = await ApiService.dio.get('/api/v1/account/me');
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      _lastError = _dioError(e);
      return null;
    } catch (e) {
      _lastError = 'Unexpected error: $e';
      return null;
    }
  }

  /// Update display name.
  static Future<bool> updateProfile(String name) async {
    _lastError = null;
    try {
      await ApiService.dio.patch('/api/v1/account/me', data: {'name': name});
      return true;
    } on DioException catch (e) {
      _lastError = _dioError(e);
      return false;
    } catch (e) {
      _lastError = 'Unexpected error: $e';
      return false;
    }
  }

  /// Initiate phone linking (sends OTP).
  static Future<Map<String, dynamic>?> linkPhone(String phone) async {
    _lastError = null;
    try {
      final response = await ApiService.dio.post(
        '/api/v1/account/me/phone',
        data: {'phone': phone},
        options: Options(validateStatus: (s) => s! < 500),
      );
      if (response.statusCode == 200) {
        return response.data as Map<String, dynamic>;
      } else {
        final data = response.data;
        _lastError = (data is Map && data['message'] != null)
            ? data['message'].toString()
            : 'Failed to send OTP';
        return null;
      }
    } on DioException catch (e) {
      _lastError = _dioError(e);
      return null;
    } catch (e) {
      _lastError = 'Unexpected error: $e';
      return null;
    }
  }

  /// Verify OTP and link phone.
  static Future<bool> verifyPhone(String phone, String otp) async {
    _lastError = null;
    try {
      final response = await ApiService.dio.post(
        '/api/v1/account/me/phone/verify',
        data: {'phone': phone, 'otp': otp},
        options: Options(validateStatus: (s) => s! < 500),
      );
      if (response.statusCode == 200) return true;
      final data = response.data;
      _lastError = (data is Map && data['message'] != null)
          ? data['message'].toString()
          : 'Verification failed';
      return false;
    } on DioException catch (e) {
      _lastError = _dioError(e);
      return false;
    } catch (e) {
      _lastError = 'Unexpected error: $e';
      return false;
    }
  }

  /// Unlink phone.
  static Future<bool> unlinkPhone() async {
    _lastError = null;
    try {
      await ApiService.dio.delete('/api/v1/account/me/phone');
      return true;
    } on DioException catch (e) {
      _lastError = _dioError(e);
      return false;
    } catch (e) {
      _lastError = 'Unexpected error: $e';
      return false;
    }
  }

  /// Send email verification link.
  static Future<bool> sendEmailVerification() async {
    _lastError = null;
    try {
      await ApiService.dio.post('/api/v1/account/me/email/verify', data: {});
      return true;
    } on DioException catch (e) {
      _lastError = _dioError(e);
      return false;
    } catch (e) {
      _lastError = 'Unexpected error: $e';
      return false;
    }
  }

  /// Change password (requires current password).
  static Future<bool> changePassword(
      String currentPassword, String newPassword) async {
    _lastError = null;
    try {
      final response = await ApiService.dio.post(
        '/api/v1/account/me/password',
        data: {
          'currentPassword': currentPassword,
          'newPassword': newPassword,
        },
        options: Options(validateStatus: (s) => s! < 500),
      );
      if (response.statusCode == 200) return true;
      final data = response.data;
      _lastError = (data is Map && data['message'] != null)
          ? data['message'].toString()
          : 'Password change failed';
      return false;
    } on DioException catch (e) {
      _lastError = _dioError(e);
      return false;
    } catch (e) {
      _lastError = 'Unexpected error: $e';
      return false;
    }
  }

  /// Request password reset (public — no auth needed).
  static Future<bool> requestPasswordReset(String email) async {
    _lastError = null;
    try {
      await ApiService.dio.post(
        '/api/v1/account/password/reset',
        data: {'email': email},
      );
      return true;
    } on DioException catch (e) {
      _lastError = _dioError(e);
      return false;
    } catch (e) {
      _lastError = 'Unexpected error: $e';
      return false;
    }
  }

  /// Unlink a social provider.
  static Future<bool> unlinkSocialProvider(String provider) async {
    _lastError = null;
    try {
      await ApiService.dio.delete('/api/v1/account/me/social/$provider');
      return true;
    } on DioException catch (e) {
      _lastError = _dioError(e);
      return false;
    } catch (e) {
      _lastError = 'Unexpected error: $e';
      return false;
    }
  }

  static Future<void> logout() async {
    _token = null;
    _user = null;
    await _secure.delete(key: 'access_token');
    await _secure.delete(key: 'refresh_token');
    await _prefs.remove('user_email');
    await _prefs.remove('user_role');
    // Clear the session-scoped API cache so the next login never sees
    // another account's cached data.
    ApiCache.clear();
    // Clear the offline cache and sync queue.
    await OfflineRepository.instance.clearAll();
    _notifyAuthStateChanged();
  }
}
