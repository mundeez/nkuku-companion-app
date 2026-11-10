import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/auth_service.dart';
import 'login_screen.dart';

/// Shown when the organization is platform-suspended (P2 super-admin
/// console). Every API call returns 423 ORG_SUSPENDED except billing-read
/// and auth routes, so the only escape is contacting support.
class SuspendedScreen extends StatelessWidget {
  final String message;
  const SuspendedScreen({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.block, size: 64, color: Theme.of(context).colorScheme.error),
                const SizedBox(height: 24),
                Text(
                  'Account suspended',
                  style: Theme.of(context).textTheme.headlineSmall,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Text(
                  message.isEmpty
                      ? 'This organization has been suspended. Please contact support.'
                      : message,
                  style: Theme.of(context).textTheme.bodyMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () => launchUrl(
                      Uri.parse('mailto:support@zeendeefood.solutions'),
                    ),
                    icon: const Icon(Icons.mail_outline),
                    label: const Text('Contact support@zeendeefood.solutions'),
                  ),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () async {
                    await AuthService.logout();
                    if (context.mounted) {
                      Navigator.of(context).pushAndRemoveUntil(
                        MaterialPageRoute(builder: (_) => const LoginScreen()),
                        (route) => false,
                      );
                    }
                  },
                  child: const Text('Sign out'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
