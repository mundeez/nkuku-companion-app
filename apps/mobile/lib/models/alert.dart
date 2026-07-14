import 'package:flutter/material.dart';

class Alert {
  final String id;
  final String flockId;
  final Map<String, dynamic>? flock;
  final String alertType;
  final String title;
  final String message;
  final String severity;
  final DateTime dueDate;
  final bool isRead;
  final bool isResolved;
  final DateTime? createdAt;

  Alert({
    required this.id,
    required this.flockId,
    this.flock,
    required this.alertType,
    required this.title,
    required this.message,
    required this.severity,
    required this.dueDate,
    required this.isRead,
    required this.isResolved,
    this.createdAt,
  });

  factory Alert.fromJson(Map<String, dynamic> json) {
    return Alert(
      id: json['id'] ?? '',
      flockId: json['flockId'] ?? json['flock_id'] ?? '',
      flock: json['flock'] is Map ? Map<String, dynamic>.from(json['flock']) : null,
      alertType: json['alertType'] ?? json['alert_type'] ?? '',
      title: json['title'] ?? '',
      message: json['message'] ?? '',
      severity: json['severity'] ?? 'info',
      dueDate: _toDateTime(json['dueDate'] ?? json['due_date']) ?? DateTime.now(),
      isRead: json['isRead'] ?? json['is_read'] ?? false,
      isResolved: json['isResolved'] ?? json['is_resolved'] ?? false,
      createdAt: _toDateTime(json['createdAt'] ?? json['created_at']),
    );
  }

  Map<String, dynamic> toJson() => {
        'isRead': isRead,
        'isResolved': isResolved,
      };

  Alert copyWith({
    String? id,
    String? flockId,
    Map<String, dynamic>? flock,
    String? alertType,
    String? title,
    String? message,
    String? severity,
    DateTime? dueDate,
    bool? isRead,
    bool? isResolved,
    DateTime? createdAt,
  }) {
    return Alert(
      id: id ?? this.id,
      flockId: flockId ?? this.flockId,
      flock: flock ?? this.flock,
      alertType: alertType ?? this.alertType,
      title: title ?? this.title,
      message: message ?? this.message,
      severity: severity ?? this.severity,
      dueDate: dueDate ?? this.dueDate,
      isRead: isRead ?? this.isRead,
      isResolved: isResolved ?? this.isResolved,
      createdAt: createdAt ?? this.createdAt,
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

  IconData get alertIcon {
    switch (alertType) {
      case 'temperature_adjustment':
      case 'environmental_threshold':
        return Icons.thermostat;
      case 'vaccination_due':
      case 'vaccine_expiry':
        return Icons.vaccines;
      case 'feed_transition':
        return Icons.grass;
      case 'weight_check':
        return Icons.monitor_weight;
      case 'mortality_threshold':
        return Icons.warning;
      case 'financial':
        return Icons.attach_money;
      case 'medication_due':
      case 'withdrawal_due':
        return Icons.medication;
      case 'task_due':
        return Icons.task_alt;
      default:
        return Icons.notifications;
    }
  }

  String get flockName => flock?['name'] as String? ?? '';

  static DateTime? _toDateTime(dynamic value) {
    if (value == null) return null;
    return DateTime.tryParse(value.toString());
  }
}

class AlertGenerateResult {
  final int generated;
  final List<Alert> alerts;

  AlertGenerateResult({required this.generated, required this.alerts});

  factory AlertGenerateResult.fromJson(Map<String, dynamic> json) {
    return AlertGenerateResult(
      generated: json['generated'] ?? 0,
      alerts: (json['alerts'] as List? ?? []).map((e) => Alert.fromJson(e)).toList(),
    );
  }
}
