import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../widgets/bottom_nav.dart';

class AcceptInviteScreen extends StatefulWidget {
  /// Optional invite token — passed when navigated from a deep link.
  /// If null, the user can paste a token or full invite URL manually.
  final String? initialToken;

  const AcceptInviteScreen({super.key, this.initialToken});

  @override
  State<AcceptInviteScreen> createState() => _AcceptInviteScreenState();
}

class _AcceptInviteScreenState extends State<AcceptInviteScreen> {
  final _tokenController = TextEditingController();
  final _nameController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.initialToken != null) {
      _tokenController.text = widget.initialToken!;
    }
  }

  /// Extracts the token value from either a raw token string or a full
  /// invite URL (e.g. https://nkuku.deeztechnology.solutions/accept-invite?token=abc123).
  String _extractToken(String input) {
    if (input.contains('token=')) {
      final uri = Uri.parse(input);
      return uri.queryParameters['token'] ?? input;
    }
    return input.trim();
  }

  Future<void> _accept() async {
    final token = _extractToken(_tokenController.text);
    if (token.isEmpty) {
      setState(() {
        _error = 'Please enter the invite token or link';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final ok = await AuthService.acceptInvite(
      token: token,
      password:
          _passwordController.text.isNotEmpty ? _passwordController.text : null,
      name:
          _nameController.text.isNotEmpty ? _nameController.text.trim() : null,
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
      final err = AuthService.lastError ?? 'Failed to accept invite';
      if (err == 'NAME_AND_PASSWORD_REQUIRED_FOR_NEW_ACCOUNT') {
        setState(() {
          _error =
              'This email doesn\'t have an account yet. Please enter your name and a password to create one.';
        });
      } else {
        setState(() {
          _error = err;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Accept Invitation')),
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
                'You\'ve been invited to join an organization on Nkuku Companion',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _tokenController,
                decoration: const InputDecoration(
                  labelText: 'Invite link or token',
                  prefixIcon: Icon(Icons.link),
                  border: OutlineInputBorder(),
                  hintText: 'Paste the invite link here',
                ),
                maxLines: 2,
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _nameController,
                decoration: const InputDecoration(
                  labelText: 'Your name (required for new accounts)',
                  prefixIcon: Icon(Icons.person),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _passwordController,
                decoration: const InputDecoration(
                  labelText: 'Password (required for new accounts)',
                  prefixIcon: Icon(Icons.lock),
                  border: OutlineInputBorder(),
                ),
                obscureText: true,
              ),
              const SizedBox(height: 8),
              const Text(
                'If you already have an account with this email, just tap accept — no password needed.',
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
              const SizedBox(height: 16),
              CheckboxListTile(
                value: true,
                onChanged:
                    null, // Consent is sent automatically; shown for transparency
                title: const Text(
                  'I accept the privacy policy and terms of service (Zambia DPA No. 3 of 2021).',
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
                onPressed: _loading ? null : _accept,
                child: _loading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Join Organization'),
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
    _tokenController.dispose();
    _nameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }
}
