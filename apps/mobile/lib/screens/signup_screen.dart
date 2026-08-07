import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../widgets/bottom_nav.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _orgNameController = TextEditingController();
  String _country = 'ZM';
  String _currency = 'ZMW';
  bool _consent = false;
  bool _loading = false;
  String? _error;

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

  Future<void> _signup() async {
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
              TextField(
                controller: _nameController,
                decoration: const InputDecoration(
                  labelText: 'Your name',
                  prefixIcon: Icon(Icons.person),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
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
                decoration: const InputDecoration(
                  labelText: 'Password (min 8 characters)',
                  prefixIcon: Icon(Icons.lock),
                  border: OutlineInputBorder(),
                ),
                obscureText: true,
              ),
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
              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(_error!,
                    style: const TextStyle(color: Colors.red, fontSize: 13)),
              ],
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _loading ? null : _signup,
                child: _loading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Create Account'),
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
    _orgNameController.dispose();
    super.dispose();
  }
}
