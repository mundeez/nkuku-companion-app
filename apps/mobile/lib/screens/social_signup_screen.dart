import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../widgets/bottom_nav.dart';

class SocialSignupScreen extends StatefulWidget {
  final String tempToken;
  final Map<String, dynamic> profile;

  const SocialSignupScreen({
    super.key,
    required this.tempToken,
    required this.profile,
  });

  @override
  State<SocialSignupScreen> createState() => _SocialSignupScreenState();
}

class _SocialSignupScreenState extends State<SocialSignupScreen> {
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

  Future<void> _completeSignup() async {
    if (!_consent) {
      setState(() {
        _error = 'You must accept the privacy policy and terms to create an account';
      });
      return;
    }
    if (_orgNameController.text.trim().isEmpty) {
      setState(() {
        _error = 'Please enter your farm/organization name';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final ok = await AuthService.completeSocialSignup(
      tempToken: widget.tempToken,
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
        _error = AuthService.lastError ?? 'Failed to create account';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = widget.profile['name'] as String?;
    final email = widget.profile['email'] as String?;
    final provider = widget.profile['provider'] as String? ?? 'social';

    return Scaffold(
      appBar: AppBar(title: const Text('Complete Your Account')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Image.asset('assets/images/logo.png',
                  height: 72, fit: BoxFit.contain),
              const SizedBox(height: 16),
              Text(
                'Welcome${name != null && name.isNotEmpty ? ', $name' : ''}!',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                'You\'re signed in with ${_providerLabel(provider)}.'
                '${email != null ? ' ($email)' : ''}\nTell us about your farm to get started.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 24),
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
                Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
              ],
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _loading ? null : _completeSignup,
                child: _loading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Create Account'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _providerLabel(String provider) {
    switch (provider) {
      case 'google':
        return 'Google';
      case 'facebook':
        return 'Facebook';
      case 'apple':
        return 'Apple';
      case 'microsoft':
        return 'Microsoft';
      default:
        return provider;
    }
  }

  @override
  void dispose() {
    _orgNameController.dispose();
    super.dispose();
  }
}
