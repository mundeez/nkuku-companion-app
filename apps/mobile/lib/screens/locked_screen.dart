import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/billing_url.dart';
import 'login_screen.dart';

/// Shown when the organization's subscription has ended (P4): either
/// `GET /api/v1/organizations/me/access` reports `state: 'locked'`, or a
/// mutation returned 402 `{code: 'SUBSCRIPTION_REQUIRED'}` and
/// [ApiService.onSubscriptionRequired] routed here.
///
/// Offers a path to re-subscribe (web billing page in `link` store mode;
/// plain text in `strict` iOS-review mode), support contact, and sign
/// out — same shape as SuspendedScreen/MaintenanceScreen.
class LockedScreen extends StatelessWidget {
  const LockedScreen({super.key});

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
                Icon(Icons.lock_outline,
                    size: 64, color: Theme.of(context).colorScheme.primary),
                const SizedBox(height: 24),
                Text(
                  'Subscription ended',
                  style: Theme.of(context).textTheme.headlineSmall,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Text(
                  'Your subscription is no longer active. Subscribe to a '
                  'plan to keep using Nkuku — your data is safe.',
                  style: Theme.of(context).textTheme.bodyMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),
                if (appStoreModeStrict)
                  // Strict store mode (iOS review): plain text only — no
                  // tappable external purchase link.
                  Text(
                    'Manage your plan on the web',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color:
                              Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  )
                else
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: () => launchUrl(
                        Uri.parse(ApiService.billingUrl),
                        mode: LaunchMode.externalApplication,
                      ),
                      icon: const Icon(Icons.open_in_new),
                      label: const Text('Choose a plan'),
                    ),
                  ),
                const SizedBox(height: 8),
                TextButton.icon(
                  onPressed: () => launchUrl(
                    Uri.parse('mailto:support@deeztechnology.solutions'),
                  ),
                  icon: const Icon(Icons.mail_outline),
                  label: const Text('Contact support'),
                ),
                TextButton(
                  onPressed: () async {
                    await AuthService.logout();
                    if (context.mounted) {
                      Navigator.of(context).pushAndRemoveUntil(
                        MaterialPageRoute(
                            builder: (_) => const LoginScreen()),
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
