import 'package:flutter/material.dart';

/// A platform announcement targeted at tenant users (P4 super-admin
/// console content management). Fetched from
/// `GET /api/v1/announcements/active`; dismissal is recorded server-side
/// via `POST /api/v1/announcements/:id/dismiss` and also hides the card
/// locally for the rest of the session.
class Announcement {
  final String id;
  final String title;
  final String body;

  /// 'info' | 'warning' | 'critical' — drives the card colour.
  final String severity;

  /// Optional call-to-action link (opened in the browser).
  final String? linkUrl;
  final String? linkLabel;

  final DateTime? startsAt;
  final DateTime? endsAt;

  /// When false the card renders without a dismiss button.
  final bool isDismissible;

  const Announcement({
    required this.id,
    required this.title,
    required this.body,
    required this.severity,
    this.linkUrl,
    this.linkLabel,
    this.startsAt,
    this.endsAt,
    required this.isDismissible,
  });

  factory Announcement.fromJson(Map<String, dynamic> json) {
    return Announcement(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      body: json['body']?.toString() ?? '',
      severity: json['severity']?.toString() ?? 'info',
      linkUrl: json['linkUrl']?.toString(),
      linkLabel: json['linkLabel']?.toString(),
      startsAt: _toDateTime(json['startsAt'] ?? json['starts_at']),
      endsAt: _toDateTime(json['endsAt'] ?? json['ends_at']),
      isDismissible: json['isDismissible'] ?? json['is_dismissible'] ?? true,
    );
  }

  Color get severityColor {
    switch (severity) {
      case 'critical':
        return Colors.red;
      case 'warning':
        return Colors.orange;
      default:
        return Colors.blue;
    }
  }

  IconData get severityIcon {
    switch (severity) {
      case 'critical':
        return Icons.error_outline;
      case 'warning':
        return Icons.warning_amber_outlined;
      default:
        return Icons.info_outline;
    }
  }

  static DateTime? _toDateTime(dynamic value) {
    if (value == null) return null;
    return DateTime.tryParse(value.toString());
  }
}
