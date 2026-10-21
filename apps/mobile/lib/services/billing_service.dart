import 'dart:developer';
import 'api_service.dart';

/// Current subscription + plan limits + usage for the user's organization,
/// as returned by `GET /api/v1/billing/subscription`.
///
/// Response shape (merged `getSubscriptionInfo` + `getPlanLimitsForOrg` —
/// see apps/api/src/modules/billing/routes.ts):
/// ```
/// {
///   planCode, planName, billingCycle, status, subscriptionStatus,
///   currentPeriodStart, currentPeriodEnd, trialEndsAt, canceledAt,
///   limits: { maxActiveFlocks, maxUsers, maxCyclesHistory,
///             maxDocumentsPerRecord, features: [...] },
///   usage:  { activeFlocks, users },
///   adsShown, addons: { remove_ads_addon }
/// }
/// ```
/// Limit values of -1 mean "unlimited".
class SubscriptionInfo {
  final String planCode;
  final String planName;
  final String status;
  final String billingCycle;
  final Map<String, dynamic> limits;
  final int activeFlocks;
  final int users;
  final bool adsShown;

  const SubscriptionInfo({
    required this.planCode,
    required this.planName,
    required this.status,
    required this.billingCycle,
    required this.limits,
    required this.activeFlocks,
    required this.users,
    required this.adsShown,
  });

  factory SubscriptionInfo.fromJson(Map<String, dynamic> json) {
    final limits = (json['limits'] as Map?)?.cast<String, dynamic>() ??
        const <String, dynamic>{};
    final usage = (json['usage'] as Map?)?.cast<String, dynamic>() ??
        const <String, dynamic>{};
    return SubscriptionInfo(
      planCode: json['planCode']?.toString() ?? 'free',
      planName: json['planName']?.toString() ?? 'Free',
      // `subscriptionStatus` comes from getPlanLimitsForOrg; `status` from
      // getSubscriptionInfo — they carry the same value.
      status: (json['subscriptionStatus'] ?? json['status'])?.toString() ??
          'unknown',
      billingCycle: json['billingCycle']?.toString() ?? 'monthly',
      limits: limits,
      activeFlocks: (usage['activeFlocks'] as num?)?.toInt() ?? 0,
      users: (usage['users'] as num?)?.toInt() ?? 0,
      adsShown: json['adsShown'] == true,
    );
  }

  /// -1 = unlimited.
  int get maxActiveFlocks => (limits['maxActiveFlocks'] as num?)?.toInt() ?? -1;
  int get maxUsers => (limits['maxUsers'] as num?)?.toInt() ?? -1;
  int get maxDocumentsPerRecord =>
      (limits['maxDocumentsPerRecord'] as num?)?.toInt() ?? -1;
}

class BillingService {
  /// Fetch the organization's current subscription. Returns null on any
  /// failure (offline, 4xx, malformed body) — callers should degrade to a
  /// "could not load" state rather than block the UI.
  static Future<SubscriptionInfo?> getSubscription() async {
    try {
      final res = await ApiService.dio.get('/api/v1/billing/subscription');
      // validateStatus lets <500 through without throwing — check 4xx here.
      if (res.statusCode == null || res.statusCode! >= 400) {
        return null;
      }
      final data = res.data;
      if (data is! Map<String, dynamic>) {
        return null;
      }
      return SubscriptionInfo.fromJson(data);
    } catch (e) {
      log('Failed to load subscription: $e', name: 'BillingService');
      return null;
    }
  }
}
