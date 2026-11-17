import 'package:flutter/material.dart';
import '../api.dart';

/// Staff login: email+password → optional TOTP verify / first-time enroll.
class LoginScreen extends StatefulWidget {
  final VoidCallback onLoggedIn;
  const LoginScreen({super.key, required this.onLoggedIn});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _code = TextEditingController();
  bool _busy = false;
  String? _error;
  String? _ticket;
  bool _enrolling = false;
  String? _totpSecret;
  List<String>? _recoveryCodes;

  Future<void> _submit() async {
    setState(() { _busy = true; _error = null; });
    try {
      if (_ticket == null) {
        final res = await Api.login(_email.text.trim(), _password.text);
        if (res['accessToken'] != null) {
          await Api.setSession(res['accessToken'], res['refreshToken'],
              res['user'] as Map<String, dynamic>?);
          await Api.markReauth(); // fresh login counts as re-auth
          widget.onLoggedIn();
          return;
        }
        if (res['requiresTotp'] == true) {
          setState(() => _ticket = res['ticket']);
        } else if (res['requiresTotpEnrollment'] == true) {
          final enr = await Api.totpEnroll(res['ticket']);
          setState(() {
            _ticket = res['ticket'];
            _enrolling = true;
            _totpSecret = enr['secret']?.toString();
          });
        }
      } else {
        final code = _code.text.trim();
        final res = _enrolling
            ? await Api.totpConfirm(_ticket!, code)
            : await Api.totpVerify(_ticket!, code);
        if (res['accessToken'] != null) {
          await Api.setSession(res['accessToken'], res['refreshToken'],
              res['user'] as Map<String, dynamic>?);
          await Api.markReauth(); // fresh login counts as re-auth
          if (_enrolling && res['recoveryCodes'] is List) {
            setState(() =>
                _recoveryCodes = (res['recoveryCodes'] as List).cast<String>());
            return; // show recovery codes before entering
          }
          widget.onLoggedIn();
        }
      }
    } catch (e) {
      setState(() => _error = 'Sign-in failed. Check credentials / connectivity.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 400),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.admin_panel_settings,
                    size: 56, color: Color(0xFF0F766E)),
                const SizedBox(height: 8),
                const Text('Nkuku Admin',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                const Text('Staff console access',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.grey)),
                const SizedBox(height: 24),
                if (_recoveryCodes != null) ...[
                  const Text('Save these recovery codes — shown once:',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  for (final c in _recoveryCodes!)
                    Text(c, style: const TextStyle(fontFamily: 'monospace')),
                  const SizedBox(height: 16),
                  FilledButton(
                      onPressed: widget.onLoggedIn,
                      child: const Text('I saved them — continue')),
                ] else if (_ticket == null) ...[
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                        labelText: 'Staff email', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _password,
                    obscureText: true,
                    decoration: const InputDecoration(
                        labelText: 'Password', border: OutlineInputBorder()),
                    onSubmitted: (_) => _submit(),
                  ),
                ] else ...[
                  if (_enrolling && _totpSecret != null) ...[
                    const Text('Add this secret to your authenticator app:',
                        style: TextStyle(fontWeight: FontWeight.w500)),
                    const SizedBox(height: 8),
                    SelectableText(_totpSecret!,
                        style: const TextStyle(
                            fontFamily: 'monospace', fontSize: 16)),
                    const SizedBox(height: 16),
                  ],
                  TextField(
                    controller: _code,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    decoration: InputDecoration(
                      labelText: _enrolling
                          ? 'Confirm authenticator code'
                          : 'Authenticator code',
                      border: const OutlineInputBorder(),
                    ),
                    onSubmitted: (_) => _submit(),
                  ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: Colors.red)),
                ],
                if (_recoveryCodes == null) ...[
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: _busy ? null : _submit,
                    child: _busy
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : Text(_ticket == null
                            ? 'Sign in'
                            : _enrolling
                                ? 'Confirm & sign in'
                                : 'Verify & sign in'),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
