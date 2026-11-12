import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/announcement.dart';

/// Severity-coloured card for a platform announcement (P4). Rendered on
/// the dashboard/home screen for each active announcement returned by
/// `GET /api/v1/announcements/active`.
///
/// [onDismissed] is invoked after the close button is tapped — the
/// caller should POST the dismissal and remove the card from the list.
/// Announcements with `isDismissible: false` render without a close
/// button.
class AnnouncementCard extends StatelessWidget {
  final Announcement announcement;
  final VoidCallback? onDismissed;

  const AnnouncementCard({
    super.key,
    required this.announcement,
    this.onDismissed,
  });

  @override
  Widget build(BuildContext context) {
    final color = announcement.severityColor;
    final theme = Theme.of(context);

    return Card(
      color: color.withValues(alpha: 0.12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: color.withValues(alpha: 0.4)),
      ),
      elevation: 0,
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(announcement.severityIcon, color: color, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    announcement.title,
                    style: theme.textTheme.titleSmall
                        ?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  if (announcement.body.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      announcement.body,
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                  if (announcement.linkUrl != null &&
                      announcement.linkUrl!.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: InkWell(
                        onTap: () => launchUrl(
                          Uri.parse(announcement.linkUrl!),
                          mode: LaunchMode.externalApplication,
                        ),
                        child: Text(
                          announcement.linkLabel?.isNotEmpty == true
                              ? announcement.linkLabel!
                              : 'Learn more',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.primary,
                            fontWeight: FontWeight.w600,
                            decoration: TextDecoration.underline,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            if (announcement.isDismissible)
              IconButton(
                icon: const Icon(Icons.close, size: 18),
                visualDensity: VisualDensity.compact,
                tooltip: 'Dismiss',
                onPressed: onDismissed,
              ),
          ],
        ),
      ),
    );
  }
}
