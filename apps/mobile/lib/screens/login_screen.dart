import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/auth_service.dart';
import '../widgets/bottom_nav.dart';
import '../widgets/social_login_buttons.dart';
import 'forgot_password_screen.dart';
import 'signup_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

enum _LoginMode { email, phone }
enum _OtpStep { enterPhone, enterOtp }

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  bool _loading = false;
  bool _obscurePassword = true;
  String? _error;
  String? _info;
  _LoginMode _mode = _LoginMode.email;
  _OtpStep _otpStep = _OtpStep.enterPhone;
  // For new-device verification triggered by email login
  bool _isNewDeviceFlow = false;
  // Set when login was refused because the org is soft-deleted (30-day grace)
  OrganizationPendingDeletion? _pendingDeletion;
  bool _restoring = false;
  String? _restoreError;

  /// If the last AuthService call failed with ORGANIZATION_PENDING_DELETION,
  /// switch to the pending-deletion panel and return true.
  bool _handlePendingDeletion(String? err) {
    if (err != AuthService.orgPendingDeletionError) return false;
    final pending = AuthService.pendingDeletion;
    if (pending == null) return false;
    setState(() {
      _pendingDeletion = pending;
      _restoreError = null;
      _error = null;
      _info = null;
    });
    return true;
  }

  Future<void> _restoreOrganization() async {
    final token = _pendingDeletion?.restoreToken;
    if (token == null) return;
    setState(() {
      _restoring = true;
      _restoreError = null;
    });
    final ok = await AuthService.restoreOrganization(token);
    if (!mounted) return;
    if (ok) {
      setState(() {
        _restoring = false;
        _pendingDeletion = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Restored — sign in again')),
      );
    } else {
      setState(() {
        _restoring = false;
        _restoreError =
            AuthService.lastError ?? 'Could not restore the organization.';
      });
    }
  }

  Future<void> _emailLogin() async {
    setState(() {
      _loading = true;
      _error = null;
      _info = null;
    });
    final ok = await AuthService.login(
      _emailController.text,
      _passwordController.text,
    );
    setState(() {
      _loading = false;
    });
    if (ok && mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const BottomNavShell()),
      );
    } else if (mounted) {
      final err = AuthService.lastError ?? 'Invalid credentials';
      if (_handlePendingDeletion(err)) return;
      // Check for new-device verification challenge
      if (err.startsWith('NEW_DEVICE_VERIFICATION_REQUIRED:')) {
        final parts = err.split(':');
        final message = parts.length > 2 ? parts.sublist(2).join(':') : 'New device detected. An OTP has been sent to your phone.';
        setState(() {
          _isNewDeviceFlow = true;
          _mode = _LoginMode.phone;
          _otpStep = _OtpStep.enterOtp;
          _info = message;
          _error = null;
        });
      } else {
        setState(() {
          _error = err;
        });
      }
    }
  }

  Future<void> _sendOtp() async {
    setState(() {
      _loading = true;
      _error = null;
      _info = null;
    });
    final msg = await AuthService.sendOtp(_phoneController.text, 'login');
    setState(() {
      _loading = false;
    });
    if (msg != null) {
      setState(() {
        _otpStep = _OtpStep.enterOtp;
        _info = msg;
      });
    } else {
      setState(() {
        _error = AuthService.lastError ?? 'Failed to send OTP';
      });
    }
  }

  Future<void> _verifyOtpLogin() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final ok = await AuthService.loginWithOtp(
      _phoneController.text,
      _otpController.text,
    );
    setState(() {
      _loading = false;
    });
    if (ok && mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const BottomNavShell()),
      );
    } else {
      if (_handlePendingDeletion(AuthService.lastError)) return;
      setState(() {
        _error = AuthService.lastError ?? 'OTP verification failed';
      });
    }
  }

  Future<void> _verifyNewDevice() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final ok = await AuthService.verifyOtp(
      phone: _phoneController.text,
      otp: _otpController.text,
      purpose: 'new_device',
    );
    setState(() {
      _loading = false;
    });
    if (ok && mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const BottomNavShell()),
      );
    } else {
      if (_handlePendingDeletion(AuthService.lastError)) return;
      setState(() {
        _error = AuthService.lastError ?? 'OTP verification failed';
      });
    }
  }

  /// Panel shown instead of the login form when the user's organization is
  /// scheduled for deletion. Owners get a Restore button.
  Widget _buildPendingDeletionPanel(BuildContext context) {
    final pending = _pendingDeletion!;
    final theme = Theme.of(context);
    final dateLabel = pending.purgeAfter != null
        ? DateFormat.yMMMMd().format(pending.purgeAfter!)
        : 'an upcoming date';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: theme.colorScheme.errorContainer.withValues(alpha: 0.3),
            border: Border.all(color: theme.colorScheme.error),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.warning_amber_rounded,
                      color: theme.colorScheme.error),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Organization scheduled for deletion',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: theme.colorScheme.error,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: pending.organizationName,
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const TextSpan(
                        text: ' is scheduled for permanent deletion on '),
                    TextSpan(
                      text: dateLabel,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const TextSpan(text: '.'),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Text(
                pending.canRestore
                    ? 'As an owner you can cancel the deletion and restore the organization and all of its data.'
                    : 'Ask the organization owner to restore it before that date.',
                style: const TextStyle(color: Colors.grey),
              ),
              if (_restoreError != null) ...[
                const SizedBox(height: 8),
                Text(_restoreError!,
                    style: TextStyle(color: theme.colorScheme.error)),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (pending.canRestore && pending.restoreToken != null)
          FilledButton.icon(
            onPressed: _restoring ? null : _restoreOrganization,
            icon: _restoring
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.restore),
            label: Text(_restoring ? 'Restoring…' : 'Restore organization'),
          ),
        const SizedBox(height: 8),
        TextButton(
          onPressed: _restoring
              ? null
              : () => setState(() {
                    _pendingDeletion = null;
                    _restoreError = null;
                  }),
          child: const Text('Back to sign in'),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 48),
                Image.asset('assets/images/logo.png',
                    height: 96, fit: BoxFit.contain),
                const SizedBox(height: 16),
                const Text(
                  'Nkuku Companion',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Broiler Production Management',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey),
                ),
                const SizedBox(height: 32),

                // Organization pending deletion — replaces the login form
                if (_pendingDeletion != null)
                  _buildPendingDeletionPanel(context)
                else ...[
                // Mode toggle (only show if not in new-device flow)
                if (!_isNewDeviceFlow) ...[
                  ToggleButtons(
                    isSelected: [
                      _mode == _LoginMode.email,
                      _mode == _LoginMode.phone,
                    ],
                    onPressed: (index) {
                      setState(() {
                        _mode = index == 0 ? _LoginMode.email : _LoginMode.phone;
                        _otpStep = _OtpStep.enterPhone;
                        _error = null;
                        _info = null;
                      });
                    },
                    children: const [
                      Padding(
                        padding: EdgeInsets.symmetric(horizontal: 16),
                        child: Text('Email + Password'),
                      ),
                      Padding(
                        padding: EdgeInsets.symmetric(horizontal: 16),
                        child: Text('Phone + OTP'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                ],

                // Email + Password form
                if (_mode == _LoginMode.email) ...[
                  TextField(
                    controller: _emailController,
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      prefixIcon: Icon(Icons.email),
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.emailAddress,
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _passwordController,
                    decoration: InputDecoration(
                      labelText: 'Password',
                      prefixIcon: const Icon(Icons.lock),
                      border: const OutlineInputBorder(),
                      suffixIcon: IconButton(
                        icon: Icon(_obscurePassword
                            ? Icons.visibility
                            : Icons.visibility_off),
                        onPressed: () {
                          setState(() {
                            _obscurePassword = !_obscurePassword;
                          });
                        },
                        tooltip: _obscurePassword
                            ? 'Show password'
                            : 'Hide password',
                      ),
                    ),
                    obscureText: _obscurePassword,
                  ),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const ForgotPasswordScreen(),
                          ),
                        );
                      },
                      child: const Text('Forgot password?'),
                    ),
                  ),
                ],

                // Phone OTP form — enter phone
                if (_mode == _LoginMode.phone && _otpStep == _OtpStep.enterPhone) ...[
                  TextField(
                    controller: _phoneController,
                    decoration: const InputDecoration(
                      labelText: 'Phone Number',
                      prefixIcon: Icon(Icons.phone),
                      border: OutlineInputBorder(),
                      hintText: 'e.g. 260970000000',
                    ),
                    keyboardType: TextInputType.phone,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Enter your phone number with country code (260 for Zambia)',
                    style: TextStyle(color: Colors.grey, fontSize: 12),
                  ),
                ],

                // Phone OTP form — enter OTP
                if (_mode == _LoginMode.phone && _otpStep == _OtpStep.enterOtp) ...[
                  if (!_isNewDeviceFlow) ...[
                    TextField(
                      controller: _phoneController,
                      decoration: const InputDecoration(
                        labelText: 'Phone Number',
                        prefixIcon: Icon(Icons.phone),
                        border: OutlineInputBorder(),
                      ),
                      keyboardType: TextInputType.phone,
                    ),
                    const SizedBox(height: 16),
                  ],
                  TextField(
                    controller: _otpController,
                    decoration: const InputDecoration(
                      labelText: 'Verification Code',
                      prefixIcon: Icon(Icons.sms),
                      border: OutlineInputBorder(),
                      hintText: '6-digit code',
                    ),
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                  ),
                ],

                if (_info != null) ...[
                  const SizedBox(height: 12),
                  Text(_info!, style: const TextStyle(color: Colors.blue)),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: Colors.red)),
                ],
                const SizedBox(height: 24),

                // Submit button
                FilledButton(
                  onPressed: _loading ? null : _submit,
                  child: _loading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : Text(_submitLabel),
                ),

                // Back button for OTP step
                if (_mode == _LoginMode.phone && _otpStep == _OtpStep.enterOtp) ...[
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: () {
                      setState(() {
                        _otpStep = _OtpStep.enterPhone;
                        _otpController.clear();
                        _error = null;
                        _info = null;
                        _isNewDeviceFlow = false;
                      });
                    },
                    child: const Text('Back'),
                  ),
                ],

                const SizedBox(height: 12),
                if (!_isNewDeviceFlow) ...[
                  SocialLoginButtons(
                    onSuccess: () {
                      if (mounted) {
                        Navigator.of(context).pushReplacement(
                          MaterialPageRoute(builder: (_) => const BottomNavShell()),
                        );
                      }
                    },
                    onError: (err) {
                      if (_handlePendingDeletion(err)) return;
                      setState(() => _error = err);
                    },
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const SignupScreen()),
                      );
                    },
                    child: const Text('Don\'t have an account? Create one'),
                  ),
                ],
                ], // end: login form (shown when no pending deletion)
              ],
            ),
          ),
        ),
      ),
    );
  }

  String get _submitLabel {
    if (_mode == _LoginMode.email) return 'Sign In';
    if (_otpStep == _OtpStep.enterPhone) return 'Send OTP';
    return 'Verify & Sign In';
  }

  Future<void> _submit() async {
    if (_mode == _LoginMode.email) {
      await _emailLogin();
    } else if (_otpStep == _OtpStep.enterPhone) {
      await _sendOtp();
    } else if (_isNewDeviceFlow) {
      await _verifyNewDevice();
    } else {
      await _verifyOtpLogin();
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _phoneController.dispose();
    _otpController.dispose();
    super.dispose();
  }
}
