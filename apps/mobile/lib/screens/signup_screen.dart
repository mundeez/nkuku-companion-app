import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../widgets/bottom_nav.dart';
import '../widgets/social_login_buttons.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

enum _SignupMode { email, phone }
enum _PhoneStep { enterPhone, enterOtp }

class _SignupScreenState extends State<SignupScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  final _orgNameController = TextEditingController();
  String _country = 'ZM';
  String _currency = 'ZMW';
  bool _consent = false;
  bool _loading = false;
  bool _obscurePassword = true;
  String? _error;
  String? _info;
  _SignupMode _mode = _SignupMode.email;
  _PhoneStep _phoneStep = _PhoneStep.enterPhone;

  static const _countries = [
    ('ZM', 'Zambia'),
    ('BW', 'Botswana'),
    ('ZW', 'Zimbabwe'),
    ('NA', 'Namibia'),
    ('ZA', 'South Africa'),
    ('MW', 'Malawi'),
    ('MZ', 'Mozambique'),
    ('TZ', 'Tanzania'),
    ('KE', 'Kenya'),
    ('NG', 'Nigeria'),
    ('GH', 'Ghana'),
    ('UG', 'Uganda'),
  ];

  static const _currencies = [
    ('ZMW', 'Zambian Kwacha (ZMW)'),
    ('BWP', 'Botswana Pula (BWP)'),
    ('USD', 'US Dollar (USD)'),
    ('ZAR', 'South African Rand (ZAR)'),
    ('ZWL', 'Zimbabwe Gold (ZiG)'),
  ];

  // Email signup (no OTP needed)
  Future<void> _emailSignup() async {
    if (!_consent) {
      setState(() {
        _error =
            'You must accept the privacy policy and terms to create an account';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final ok = await AuthService.register(
      email: _emailController.text.trim(),
      password: _passwordController.text,
      name: _nameController.text.trim(),
      organizationName: _orgNameController.text.trim(),
      country: _country,
      currency: _currency,
    );
    setState(() {
      _loading = false;
    });
    if (ok && mounted) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const BottomNavShell()),
        (route) => false,
      );
    } else {
      setState(() {
        _error = AuthService.lastError ?? 'Signup failed';
      });
    }
  }

  // Phone signup step 1: send OTP
  Future<void> _sendPhoneOtp() async {
    if (!_consent) {
      setState(() {
        _error =
            'You must accept the privacy policy and terms to create an account';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _info = null;
    });
    final msg = await AuthService.sendOtp(_phoneController.text.trim(), 'signup');
    setState(() {
      _loading = false;
    });
    if (msg != null) {
      setState(() {
        _phoneStep = _PhoneStep.enterOtp;
        _info = msg;
      });
    } else {
      setState(() {
        _error = AuthService.lastError ?? 'Failed to send OTP';
      });
    }
  }

  // Phone signup step 2: verify OTP and create account
  Future<void> _verifyAndSignup() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final ok = await AuthService.verifyOtp(
      phone: _phoneController.text.trim(),
      otp: _otpController.text.trim(),
      purpose: 'signup',
      signupData: {
        'name': _nameController.text.trim(),
        'organizationName': _orgNameController.text.trim(),
        'country': _country,
        'currency': _currency,
        'consent': true,
      },
    );
    setState(() {
      _loading = false;
    });
    if (ok && mounted) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const BottomNavShell()),
        (route) => false,
      );
    } else {
      setState(() {
        _error = AuthService.lastError ?? 'Verification failed';
      });
    }
  }

  String get _submitLabel {
    if (_mode == _SignupMode.email) return 'Create Account';
    if (_phoneStep == _PhoneStep.enterPhone) return 'Send Verification Code';
    return 'Verify & Create Account';
  }

  Future<void> _submit() async {
    if (_mode == _SignupMode.email) {
      await _emailSignup();
    } else if (_phoneStep == _PhoneStep.enterPhone) {
      await _sendPhoneOtp();
    } else {
      await _verifyAndSignup();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create Account')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Image.asset('assets/images/logo.png',
                  height: 72, fit: BoxFit.contain),
              const SizedBox(height: 16),
              const Text(
                'Start managing your broiler production in minutes',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 24),

              // Mode toggle
              ToggleButtons(
                isSelected: [
                  _mode == _SignupMode.email,
                  _mode == _SignupMode.phone,
                ],
                onPressed: (index) {
                  setState(() {
                    _mode = index == 0 ? _SignupMode.email : _SignupMode.phone;
                    _phoneStep = _PhoneStep.enterPhone;
                    _error = null;
                    _info = null;
                  });
                },
                children: const [
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16),
                    child: Text('With Email'),
                  ),
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16),
                    child: Text('With Phone (OTP)'),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Common: name
              TextField(
                controller: _nameController,
                decoration: const InputDecoration(
                  labelText: 'Your name',
                  prefixIcon: Icon(Icons.person),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),

              // Email mode fields
              if (_mode == _SignupMode.email) ...[
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
                    labelText: 'Password (min 8 characters)',
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
              ],

              // Phone mode fields
              if (_mode == _SignupMode.phone &&
                  _phoneStep == _PhoneStep.enterPhone) ...[
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
                  'Enter your phone number with country code (260 for Zambia). You\'ll receive a verification code via SMS.',
                  style: TextStyle(color: Colors.grey, fontSize: 12),
                ),
              ],

              if (_mode == _SignupMode.phone &&
                  _phoneStep == _PhoneStep.enterOtp) ...[
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

              const SizedBox(height: 16),
              TextField(
                controller: _orgNameController,
                decoration: const InputDecoration(
                  labelText: 'Farm / organization name',
                  prefixIcon: Icon(Icons.agriculture),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: _country,
                      decoration: const InputDecoration(
                        labelText: 'Country',
                        border: OutlineInputBorder(),
                      ),
                      items: _countries
                          .map((c) => DropdownMenuItem(
                                value: c.$1,
                                child: Text(c.$2),
                              ))
                          .toList(),
                      onChanged: (v) => setState(() => _country = v ?? 'ZM'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: _currency,
                      decoration: const InputDecoration(
                        labelText: 'Currency',
                        border: OutlineInputBorder(),
                      ),
                      items: _currencies
                          .map((c) => DropdownMenuItem(
                                value: c.$1,
                                child: Text(c.$1),
                              ))
                          .toList(),
                      onChanged: (v) => setState(() => _currency = v ?? 'ZMW'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              CheckboxListTile(
                value: _consent,
                onChanged: (v) => setState(() => _consent = v ?? false),
                title: const Text(
                  'I accept the privacy policy and terms of service. My data will be processed in accordance with the Zambia Data Protection Act (No. 3 of 2021).',
                  style: TextStyle(fontSize: 13),
                ),
                contentPadding: EdgeInsets.zero,
              ),
              if (_info != null) ...[
                const SizedBox(height: 8),
                Text(_info!, style: const TextStyle(color: Colors.blue, fontSize: 13)),
              ],
              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(_error!,
                    style: const TextStyle(color: Colors.red, fontSize: 13)),
              ],
              const SizedBox(height: 16),
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
              if (_mode == _SignupMode.phone &&
                  _phoneStep == _PhoneStep.enterOtp) ...[
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () {
                    setState(() {
                      _phoneStep = _PhoneStep.enterPhone;
                      _otpController.clear();
                      _error = null;
                      _info = null;
                    });
                  },
                  child: const Text('Back'),
                ),
              ],

              const SizedBox(height: 12),
              SocialLoginButtons(
                onSuccess: () {
                  if (mounted) {
                    Navigator.of(context).pushAndRemoveUntil(
                      MaterialPageRoute(builder: (_) => const BottomNavShell()),
                      (route) => false,
                    );
                  }
                },
                onError: (err) {
                  setState(() => _error = err);
                },
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Already have an account? Sign in'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _phoneController.dispose();
    _otpController.dispose();
    _orgNameController.dispose();
    super.dispose();
  }
}
