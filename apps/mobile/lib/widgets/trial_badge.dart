import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/api_service.dart';
import '../services/billing_url.dart';
import '../services/billing_service.dart';

/// "Trial — X days left" banner shown on the home screen while
/// `OrgAccess.state == 'trialing'` (P4).
///
/// Tapping opens the web billing page in `link` store mode (there is no
/// in-app billing screen — same convention as UpgradeSheet and the
/// subscription tile in MoreScreen). In `strict` iOS-review mode the
/// banner is display-only.
class TrialBadge extends StatelessWidget {
  final OrgAccess access;

  const TrialBadge({super.key, required this.access});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final days = access.daysLeftInTrial;
    final label = days == null
        ? 'Free trial active'
        : days == 1
            ? 'Trial — 1 day left'
            : 'Trial — $days days left';

    return Card(
      color: Colors.green.withValues(alpha: 0.12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.green.withValues(alpha: 0.4)),
      ),
      elevation: 0,
      margin: EdgeInsets.zero,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: appStoreModeStrict
            ? null
            : () => launchUrl(
                  Uri.parse(ApiService.billingUrl),
                  mode: LaunchMode.externalApplication,
                ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              const Icon(Icons.schedule, color: Colors.green, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  label,
                  style: theme.textTheme.bodyMedium
                      ?.copyWith(fontWeight: FontWeight.w600),
                ),
              ),
              if (!appStoreModeStrict)
                Text(
                  'Choose a plan',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
