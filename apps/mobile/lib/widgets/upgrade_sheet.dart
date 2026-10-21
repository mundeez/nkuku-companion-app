import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/api_service.dart';
import '../services/billing_url.dart';

/// Bottom sheet shown when the API responds with HTTP 402
/// (PLAN_LIMIT_REACHED). Explains which plan limit was hit and offers a
/// path to upgrade.
///
/// Store posture (compile-time `--dart-define=APP_STORE_MODE=strict|link`,
/// see services/billing_url.dart):
///  * `link` (default, Android) — shows a tappable "Upgrade on the web"
///    button that opens `<web base>/billing` via url_launcher.
///  * `strict` (iOS review) — shows "Manage your plan on the web" as plain
///    text only: no tappable link and no url_launcher call.
class UpgradeSheet extends StatelessWidget {
  final PlanLimitInfo info;

  const UpgradeSheet({super.key, required this.info});

  /// Guards against stacking multiple sheets when several in-flight
  /// requests hit a plan limit at the same time.
  static bool _isShowing = false;

  /// Present the sheet over the given [context] (typically the global
  /// navigator context — see ApiService.navigatorKey).
  static Future<void> show(BuildContext context, PlanLimitInfo info) {
    if (_isShowing) {
      return Future.value();
    }
    _isShowing = true;
    return showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (_) => UpgradeSheet(info: info),
    ).whenComplete(() {
      _isShowing = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(
                  Icons.workspace_premium_outlined,
                  color: theme.colorScheme.primary,
                  size: 28,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Plan limit reached',
                    style: theme.textTheme.titleLarge,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(info.message, style: theme.textTheme.bodyMedium),
            if (info.current != null && info.max != null) ...[
              const SizedBox(height: 16),
              LinearProgressIndicator(
                value: info.max! > 0
                    ? (info.current! / info.max!).clamp(0.0, 1.0)
                    : 1.0,
              ),
              const SizedBox(height: 4),
              Text(
                '${info.current} of ${info.max} used',
                style: theme.textTheme.bodySmall,
              ),
            ],
            const SizedBox(height: 20),
            if (appStoreModeStrict)
              // Strict store mode (iOS review): plain text only — no
              // tappable link, no url_launcher call.
              Text(
                'Manage your plan on the web',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              )
            else
              FilledButton.icon(
                onPressed: () {
                  launchUrl(
                    Uri.parse(ApiService.billingUrl),
                    mode: LaunchMode.externalApplication,
                  );
                },
                icon: const Icon(Icons.open_in_new),
                label: const Text('Upgrade on the web'),
              ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Not now'),
            ),
          ],
        ),
      ),
    );
  }
}
