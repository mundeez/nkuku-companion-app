import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../screens/social_signup_screen.dart';

/// Social login buttons widget for mobile.
/// Shows buttons for each configured provider and handles the login flow.
class SocialLoginButtons extends StatefulWidget {
  /// Called when social login succeeds (user is logged in)
  final VoidCallback? onSuccess;

  /// Called when social login needs signup completion
  final void Function(String tempToken, Map<String, dynamic> profile)?
      onNeedsSignup;

  /// Called on error
  final void Function(String error)? onError;

  const SocialLoginButtons({
    super.key,
    this.onSuccess,
    this.onNeedsSignup,
    this.onError,
  });

  @override
  State<SocialLoginButtons> createState() => _SocialLoginButtonsState();
}

class _SocialLoginButtonsState extends State<SocialLoginButtons> {
  List<Map<String, dynamic>> _providers = [];
  String? _loadingProvider;

  @override
  void initState() {
    super.initState();
    _loadProviders();
  }

  Future<void> _loadProviders() async {
    final providers = await AuthService.getSocialProviders();
    if (mounted) {
      setState(() => _providers = providers);
    }
  }

  Future<void> _handleProvider(String provider) async {
    setState(() => _loadingProvider = provider);
    bool success = false;
    switch (provider) {
      case 'google':
        success = await AuthService.signInWithGoogle();
        break;
      case 'facebook':
        success = await AuthService.signInWithFacebook();
        break;
      case 'apple':
        success = await AuthService.signInWithApple();
        break;
    }
    setState(() => _loadingProvider = null);

    if (!mounted) return;

    if (success) {
      if (widget.onSuccess != null) widget.onSuccess!();
    } else if (AuthService.lastSocialResult != null) {
      final result = AuthService.lastSocialResult!;
      final tempToken = result['tempToken'] as String;
      final profile = result['profile'] as Map<String, dynamic>;
      if (widget.onNeedsSignup != null) {
        widget.onNeedsSignup!(tempToken, profile);
      } else {
        // Default: navigate to social signup screen
        if (!mounted) return;
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => SocialSignupScreen(
              tempToken: tempToken,
              profile: profile,
            ),
          ),
        );
      }
    } else if (AuthService.lastError != null) {
      if (widget.onError != null) widget.onError!(AuthService.lastError!);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_providers.isEmpty) return const SizedBox.shrink();

    return Column(
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 12),
          child: Row(
            children: [
              Expanded(child: Divider()),
              Padding(
                padding: EdgeInsets.symmetric(horizontal: 12),
                child: Text(
                  'or continue with',
                  style: TextStyle(color: Colors.grey, fontSize: 12),
                ),
              ),
              Expanded(child: Divider()),
            ],
          ),
        ),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          alignment: WrapAlignment.center,
          children: _providers.map((p) {
            final provider = p['provider'] as String;
            return _SocialButton(
              provider: provider,
              loading: _loadingProvider == provider,
              onPressed: () => _handleProvider(provider),
            );
          }).toList(),
        ),
      ],
    );
  }
}

class _SocialButton extends StatelessWidget {
  final String provider;
  final bool loading;
  final VoidCallback onPressed;

  const _SocialButton({
    required this.provider,
    required this.loading,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    final meta = _providerMeta[provider]!;
    return SizedBox(
      width: 56,
      height: 56,
      child: IconButton.filled(
        onPressed: loading ? null : onPressed,
        style: IconButton.styleFrom(
          backgroundColor: meta['color'] as Color,
          foregroundColor: Colors.white,
        ),
        icon: loading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white),
              )
            : Text(
                meta['icon'] as String,
                style: const TextStyle(
                    fontSize: 22, fontWeight: FontWeight.bold),
              ),
        tooltip: meta['label'] as String,
      ),
    );
  }
}

const _providerMeta = {
  'google': {
    'label': 'Google',
    'icon': 'G',
    'color': Color(0xFF4285F4),
  },
  'facebook': {
    'label': 'Facebook',
    'icon': 'f',
    'color': Color(0xFF1877F2),
  },
  'apple': {
    'label': 'Apple',
    'icon': '',
    'color': Color(0xFF000000),
  },
  'microsoft': {
    'label': 'Microsoft',
    'icon': 'M',
    'color': Color(0xFF0078D4),
  },
};
