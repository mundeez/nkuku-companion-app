import 'package:flutter/material.dart';
import '../services/auth_service.dart';

class AccountSettingsScreen extends StatefulWidget {
  const AccountSettingsScreen({super.key});

  @override
  State<AccountSettingsScreen> createState() => _AccountSettingsScreenState();
}

class _AccountSettingsScreenState extends State<AccountSettingsScreen> {
  Map<String, dynamic>? _profile;
  bool _loading = true;
  String? _error;
  String? _success;

  // Profile edit
  final _nameController = TextEditingController();
  bool _savingName = false;

  // Phone linking
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  bool _phoneStepOtp = false;
  String _maskedPhone = '';

  // Password change
  final _currentPwController = TextEditingController();
  final _newPwController = TextEditingController();
  bool _savingPw = false;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    setState(() {
      _loading = true;
      _error = null;
      _success = null;
    });
    final p = await AuthService.getProfile();
    setState(() {
      _profile = p;
      _loading = false;
      if (p != null) {
        _nameController.text = p['name'] ?? '';
      }
    });
  }

  Future<void> _saveName() async {
    setState(() {
      _savingName = true;
      _error = null;
      _success = null;
    });
    final ok = await AuthService.updateProfile(_nameController.text.trim());
    setState(() {
      _savingName = false;
      if (ok) {
        _success = 'Name updated';
      } else {
        _error = AuthService.lastError ?? 'Failed to update name';
      }
    });
  }

  Future<void> _sendOtp() async {
    setState(() {
      _error = null;
      _success = null;
    });
    final result = await AuthService.linkPhone(_phoneController.text.trim());
    if (result != null) {
      setState(() {
        _phoneStepOtp = true;
        _maskedPhone = result['maskedPhone'] ?? '';
        _success = result['message'] ?? 'OTP sent';
      });
    } else {
      setState(() {
        _error = AuthService.lastError ?? 'Failed to send OTP';
      });
    }
  }

  Future<void> _verifyOtp() async {
    setState(() {
      _error = null;
      _success = null;
    });
    final ok = await AuthService.verifyPhone(
      _phoneController.text.trim(),
      _otpController.text.trim(),
    );
    if (ok) {
      setState(() {
        _phoneStepOtp = false;
        _phoneController.clear();
        _otpController.clear();
        _success = 'Phone linked successfully';
      });
      _loadProfile();
    } else {
      setState(() {
        _error = AuthService.lastError ?? 'Verification failed';
      });
    }
  }

  Future<void> _unlinkPhone() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Unlink Phone'),
        content: const Text('Are you sure you want to unlink your phone number?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Unlink')),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() {
      _error = null;
      _success = null;
    });
    final ok = await AuthService.unlinkPhone();
    setState(() {
      if (ok) {
        _success = 'Phone unlinked';
      } else {
        _error = AuthService.lastError ?? 'Failed to unlink phone';
      }
    });
    _loadProfile();
  }

  Future<void> _sendEmailVerification() async {
    setState(() {
      _error = null;
      _success = null;
    });
    final ok = await AuthService.sendEmailVerification();
    setState(() {
      if (ok) {
        _success = 'Verification email sent. Check your inbox.';
      } else {
        _error = AuthService.lastError ?? 'Failed to send verification email';
      }
    });
  }

  Future<void> _changePassword() async {
    setState(() {
      _savingPw = true;
      _error = null;
      _success = null;
    });
    final ok = await AuthService.changePassword(
      _currentPwController.text,
      _newPwController.text,
    );
    setState(() {
      _savingPw = false;
      if (ok) {
        _success = 'Password changed';
        _currentPwController.clear();
        _newPwController.clear();
      } else {
        _error = AuthService.lastError ?? 'Failed to change password';
      }
    });
  }

  Future<void> _unlinkSocial(String provider) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Unlink ${_providerLabel(provider)}'),
        content: Text('Are you sure you want to unlink your ${_providerLabel(provider)} account?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Unlink')),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() {
      _error = null;
      _success = null;
    });
    final ok = await AuthService.unlinkSocialProvider(provider);
    setState(() {
      if (ok) {
        _success = '${_providerLabel(provider)} unlinked';
      } else {
        _error = AuthService.lastError ?? 'Failed to unlink';
      }
    });
    _loadProfile();
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
    _nameController.dispose();
    _phoneController.dispose();
    _otpController.dispose();
    _currentPwController.dispose();
    _newPwController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Account & Security')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final email = _profile?['email'] as String?;
    final phone = _profile?['phone'] as String?;
    final emailVerified = _profile?['emailVerified'] as bool? ?? false;
    final phoneVerified = _profile?['phoneVerified'] as bool? ?? false;
    final socialAccounts =
        (_profile?['socialAccounts'] as List?)?.cast<Map<String, dynamic>>() ?? [];

    return Scaffold(
      appBar: AppBar(title: const Text('Account & Security')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_error != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(_error!, style: TextStyle(color: Colors.red.shade700, fontSize: 13)),
                ),
              if (_success != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(_success!, style: TextStyle(color: Colors.green.shade700, fontSize: 13)),
                ),

              // Profile section
              _sectionCard(
                title: 'Profile',
                children: [
                  Row(
                    children: [
                      const Text('Role: ', style: TextStyle(color: Colors.grey)),
                      Chip(label: Text(_profile?['role'] ?? '')),
                    ],
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _nameController,
                    decoration: const InputDecoration(
                      labelText: 'Display Name',
                      prefixIcon: Icon(Icons.person),
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: _savingName ? null : _saveName,
                    child: _savingName
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Save Name'),
                  ),
                ],
              ),

              // Email section
              _sectionCard(
                title: 'Email',
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(child: Text(email ?? 'No email set')),
                      Chip(
                        label: Text(emailVerified ? 'Verified' : 'Unverified'),
                        backgroundColor: emailVerified ? Colors.green.shade100 : Colors.orange.shade100,
                      ),
                    ],
                  ),
                  if (email != null && !emailVerified) ...[
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: _sendEmailVerification,
                      icon: const Icon(Icons.mark_email_read),
                      label: const Text('Send Verification Email'),
                    ),
                  ],
                ],
              ),

              // Phone section
              _sectionCard(
                title: 'Phone',
                children: [
                  if (phone != null) ...[
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(phone),
                        Chip(
                          label: Text(phoneVerified ? 'Verified' : 'Unverified'),
                          backgroundColor: phoneVerified ? Colors.green.shade100 : Colors.orange.shade100,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: _unlinkPhone,
                      icon: const Icon(Icons.phone_disabled),
                      label: const Text('Unlink Phone'),
                      style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                    ),
                  ] else if (_phoneStepOtp) ...[
                    Text('Enter the OTP sent to $_maskedPhone',
                        style: const TextStyle(color: Colors.grey, fontSize: 13)),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _otpController,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      decoration: const InputDecoration(
                        labelText: '6-digit code',
                        prefixIcon: Icon(Icons.lock_clock),
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(child: FilledButton(onPressed: _verifyOtp, child: const Text('Verify'))),
                        const SizedBox(width: 8),
                        TextButton(
                          onPressed: () => setState(() {
                            _phoneStepOtp = false;
                            _otpController.clear();
                          }),
                          child: const Text('Cancel'),
                        ),
                      ],
                    ),
                  ] else ...[
                    TextField(
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                        labelText: 'Phone number',
                        prefixIcon: Icon(Icons.phone),
                        hintText: 'e.g. 260970000000',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 8),
                    FilledButton.tonal(
                      onPressed: _sendOtp,
                      child: const Text('Send OTP'),
                    ),
                  ],
                ],
              ),

              // Password section
              _sectionCard(
                title: 'Password',
                children: [
                  TextField(
                    controller: _currentPwController,
                    obscureText: true,
                    decoration: InputDecoration(
                      labelText: 'Current Password',
                      prefixIcon: const Icon(Icons.lock),
                      border: const OutlineInputBorder(),
                      hintText: email == null ? 'Set a password (social account)' : null,
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _newPwController,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'New Password',
                      prefixIcon: Icon(Icons.lock_outline),
                      helperText: 'At least 8 characters',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: _savingPw || _newPwController.text.isEmpty ? null : _changePassword,
                    child: _savingPw
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Update Password'),
                  ),
                ],
              ),

              // Social accounts section
              if (socialAccounts.isNotEmpty)
                _sectionCard(
                  title: 'Linked Social Accounts',
                  children: socialAccounts.map((acc) {
                    final provider = acc['provider'] as String;
                    final providerEmail = acc['providerEmail'] as String?;
                    return ListTile(
                      leading: const Icon(Icons.link),
                      title: Text(_providerLabel(provider)),
                      subtitle: providerEmail != null ? Text(providerEmail) : null,
                      trailing: IconButton(
                        icon: const Icon(Icons.link_off, color: Colors.red),
                        onPressed: () => _unlinkSocial(provider),
                      ),
                    );
                  }).toList(),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _sectionCard({required String title, required List<Widget> children}) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            ...children,
          ],
        ),
      ),
    );
  }
}
