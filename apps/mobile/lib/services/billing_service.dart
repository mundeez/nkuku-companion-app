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
  final DateTime? trialEndsAt;

  const SubscriptionInfo({
    required this.planCode,
    required this.planName,
    required this.status,
    required this.billingCycle,
    required this.limits,
    required this.activeFlocks,
    required this.users,
    required this.adsShown,
    this.trialEndsAt,
  });

  factory SubscriptionInfo.fromJson(Map<String, dynamic> json) {
    final limits = (json['limits'] as Map?)?.cast<String, dynamic>() ??
        const <String, dynamic>{};
    final usage = (json['usage'] as Map?)?.cast<String, dynamic>() ??
        const <String, dynamic>{};
    return SubscriptionInfo(
      planCode: json['planCode']?.toString() ?? 'trial',
      planName: json['planName']?.toString() ?? 'Trial',
      // `subscriptionStatus` comes from getPlanLimitsForOrg; `status` from
      // getSubscriptionInfo — they carry the same value.
      status: (json['subscriptionStatus'] ?? json['status'])?.toString() ??
          'unknown',
      billingCycle: json['billingCycle']?.toString() ?? 'monthly',
      limits: limits,
      activeFlocks: (usage['activeFlocks'] as num?)?.toInt() ?? 0,
      users: (usage['users'] as num?)?.toInt() ?? 0,
      adsShown: json['adsShown'] == true,
      trialEndsAt: DateTime.tryParse(json['trialEndsAt']?.toString() ?? ''),
    );
  }

  /// -1 = unlimited.
  int get maxActiveFlocks => (limits['maxActiveFlocks'] as num?)?.toInt() ?? -1;
  int get maxUsers => (limits['maxUsers'] as num?)?.toInt() ?? -1;
  int get maxDocumentsPerRecord =>
      (limits['maxDocumentsPerRecord'] as num?)?.toInt() ?? -1;
}

/// Organization access state (P4), as returned by
/// `GET /api/v1/organizations/me/access`:
/// ```
/// { state: 'active'|'trialing'|'locked', planCode, planName,
///   trialEndsAt, daysLeftInTrial, showAds }
/// ```
/// `planCode` is one of 'trial'|'basic'|'grower'|'business'|'enterprise'
/// in the P4 tier model ('free' is retired).
class OrgAccess {
  /// 'active' | 'trialing' | 'locked'
  final String state;
  final String planCode;
  final String planName;
  final DateTime? trialEndsAt;
  final int? daysLeftInTrial;
  final bool showAds;

  const OrgAccess({
    required this.state,
    required this.planCode,
    required this.planName,
    this.trialEndsAt,
    this.daysLeftInTrial,
    required this.showAds,
  });

  bool get isTrialing => state == 'trialing';
  bool get isLocked => state == 'locked';

  factory OrgAccess.fromJson(Map<String, dynamic> json) {
    return OrgAccess(
      state: json['state']?.toString() ?? 'active',
      planCode: json['planCode']?.toString() ?? 'trial',
      planName: json['planName']?.toString() ?? '',
      trialEndsAt:
          DateTime.tryParse(json['trialEndsAt']?.toString() ?? ''),
      daysLeftInTrial: (json['daysLeftInTrial'] as num?)?.toInt(),
      showAds: json['showAds'] == true,
    );
  }

  /// Derive an equivalent object from the legacy
  /// `GET /api/v1/billing/subscription` payload when the P4 access route
  /// isn't deployed.
  factory OrgAccess.fromSubscription(SubscriptionInfo sub) {
    int? daysLeft;
    if (sub.status == 'trialing' && sub.trialEndsAt != null) {
      final ms = sub.trialEndsAt!.difference(DateTime.now()).inMilliseconds;
      daysLeft = ms <= 0 ? 0 : (ms / 86400000).ceil();
    }
    return OrgAccess(
      state: sub.status == 'trialing'
          ? 'trialing'
          : sub.status == 'active'
              ? 'active'
              : 'locked',
      planCode: sub.planCode,
      planName: sub.planName,
      trialEndsAt: sub.trialEndsAt,
      daysLeftInTrial: daysLeft,
      showAds: sub.adsShown,
    );
  }
}

class BillingService {
  /// Fetch the organization's access state.
  ///
  /// Primary: `GET /api/v1/organizations/me/access` (P4 contract). If that
  /// route isn't deployed yet (404), falls back to
  /// `GET /api/v1/billing/subscription` and maps its fields onto the same
  /// shape. Returns null on any other failure — callers should degrade
  /// (treat as active) rather than lock the UI on a flaky network.
  static Future<OrgAccess?> getAccess() async {
    try {
      final res =
          await ApiService.dio.get('/api/v1/organizations/me/access');
      if (res.statusCode == 404) {
        // Route not deployed yet — derive from billing subscription.
        final sub = await getSubscription();
        return sub == null ? null : OrgAccess.fromSubscription(sub);
      }
      if (res.statusCode == null || res.statusCode! >= 400) {
        return null;
      }
      final data = res.data;
      if (data is! Map<String, dynamic>) {
        return null;
      }
      return OrgAccess.fromJson(data);
    } catch (e) {
      log('Failed to load org access state: $e', name: 'BillingService');
      return null;
    }
  }

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
