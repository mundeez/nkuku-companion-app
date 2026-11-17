import 'package:flutter/material.dart';
import '../api.dart';
import 'catalogue.dart';
import 'plans.dart';
import 'announcements.dart';
import 'flags.dart';
import 'analytics.dart';

/// Manage hub — P4+P5 surfaces: catalogue, plans, announcements,
/// feature flags, analytics. Entries are gated by staff permissions.
class ManageScreen extends StatefulWidget {
  const ManageScreen({super.key});

  @override
  State<ManageScreen> createState() => _ManageScreenState();
}

class _ManageScreenState extends State<ManageScreen> {
  final _perms = <String, bool>{};

  static const _entries = [
    (
      'Catalogue',
      'Global reference data — diseases, breeds, schedules, targets',
      Icons.science_outlined,
      'catalogue.write',
      CatalogueScreen.new,
    ),
    (
      'Plans & Pricing',
      'Subscription tiers, limits, features, price matrix',
      Icons.sell_outlined,
      'billing.read',
      PlansScreen.new,
    ),
    (
      'Announcements',
      'In-app banners for tenant users',
      Icons.campaign_outlined,
      'announcements.write',
      AnnouncementsScreen.new,
    ),
    (
      'Feature Flags',
      'Platform defaults + plan/org overrides',
      Icons.flag_outlined,
      'flags.write',
      FlagsScreen.new,
    ),
    (
      'Analytics',
      'Growth & finance — signups, MRR, cohorts',
      Icons.insights_outlined,
      'analytics.read',
      AnalyticsScreen.new,
    ),
  ];

  @override
  void initState() {
    super.initState();
    for (final e in _entries) {
      Api.hasPermission(e.$4).then((v) {
        if (mounted) setState(() => _perms[e.$4] = v);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final visible =
        _entries.where((e) => _perms[e.$4] ?? false).toList();
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (visible.isEmpty && _perms.isNotEmpty)
          const Padding(
            padding: EdgeInsets.all(24),
            child: Center(
                child: Text('No manage permissions for your role.')),
          )
        else
          for (final e in visible)
            Card(
              child: ListTile(
                leading: Icon(e.$3),
                title: Text(e.$1),
                subtitle: Text(e.$2,
                    style: const TextStyle(fontSize: 12)),
                trailing: const Icon(Icons.chevron_right, size: 18),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => e.$5()),
                ),
              ),
            ),
      ],
    );
  }
}
