import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../providers/theme_provider.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/billing_service.dart';
import '../services/billing_url.dart';
import '../services/offline_repository.dart';
import '../services/sync_service.dart';
import '../services/api_cache.dart';
import 'account_settings_screen.dart';
import 'login_screen.dart';
import 'users_screen.dart';
import 'projections_screen.dart';
import 'expansion_plan_screen.dart';
import 'suppliers_screen.dart';
import 'vaccine_inventory_screen.dart';
import 'sync_issues_screen.dart';
import 'broiler/diseases_screen.dart';
import 'broiler/vaccination_schedules_screen.dart';
import '../widgets/section_header.dart';

/// Grouped hub for everything that doesn't fit in the primary bottom
/// navigation bar. Mirrors the Production / Operations / Planning / Admin
/// grouping used on web, plus the existing account/appearance settings.
class MoreScreen extends StatefulWidget {
  const MoreScreen({super.key});

  @override
  State<MoreScreen> createState() => _MoreScreenState();
}

class _MoreScreenState extends State<MoreScreen> {
  int _pendingSyncs = 0;
  int _skippedSyncs = 0;
  SubscriptionInfo? _subscription;
  bool _subscriptionLoaded = false;

  @override
  void initState() {
    super.initState();
    _loadSyncCounts();
    _loadSubscription();
  }

  Future<void> _loadSubscription() async {
    final sub = await BillingService.getSubscription();
    if (mounted) {
      setState(() {
        _subscription = sub;
        _subscriptionLoaded = true;
      });
    }
  }

  /// Opens the web billing page. Only used in `link` store mode — in
  /// `strict` mode the Plan tile is not tappable at all.
  Future<void> _openBillingOnWeb() async {
    try {
      await launchUrl(
        Uri.parse(ApiService.billingUrl),
        mode: LaunchMode.externalApplication,
      );
    } catch (_) {
      // No browser available / launch failed — nothing useful to do.
    }
  }

  Future<void> _loadSyncCounts() async {
    final pending = await OfflineRepository.instance.pendingSyncCount();
    if (mounted) {
      setState(() {
        _pendingSyncs = pending;
        _skippedSyncs = SyncService.instance.skippedCount;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final themeProvider = ThemeProvider.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('More')),
      body: ListView(
        children: [
          // Account section
          SectionHeader(title: 'Account'),
          ListTile(
            leading: CircleAvatar(
              backgroundColor: theme.colorScheme.primaryContainer,
              child: Text(
                (AuthService.user?['email'] ?? '?')[0].toUpperCase(),
                style: TextStyle(color: theme.colorScheme.onPrimaryContainer),
              ),
            ),
            title: Text(
              AuthService.user?['email'] ?? 'Unknown user',
              overflow: TextOverflow.ellipsis,
            ),
            subtitle: Text('Role: ${AuthService.role ?? 'unknown'}'),
          ),
          ListTile(
            leading: const Icon(Icons.security),
            title: const Text('Account & Security'),
            subtitle: const Text('Phone, email, password, social accounts'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const AccountSettingsScreen()),
            ),
          ),
          ListTile(
            leading: Icon(Icons.person_remove_outlined,
                color: theme.colorScheme.error),
            title: Text('Delete my account',
                style: TextStyle(color: theme.colorScheme.error)),
            subtitle: const Text('Permanently remove your account'),
            trailing: const Icon(Icons.chevron_right),
            onTap: _confirmDeleteAccount,
          ),
          const Divider(),

          // Plan section — current subscription, usage vs limits, and
          // billing status. In `link` store mode the tile opens the web
          // billing page; in `strict` mode it is display-only.
          SectionHeader(title: 'Plan'),
          if (!_subscriptionLoaded)
            const ListTile(
              leading: Icon(Icons.workspace_premium_outlined),
              title: Text('Subscription'),
              subtitle: Text('Loading…'),
            )
          else if (_subscription == null)
            const ListTile(
              leading: Icon(Icons.workspace_premium_outlined),
              title: Text('Subscription'),
              subtitle: Text('Could not load plan info'),
            )
          else
            ListTile(
              leading: const Icon(Icons.workspace_premium_outlined),
              title: Text('${_subscription!.planName} plan'),
              subtitle: Text(
                'Status: ${_subscription!.status} • '
                'Flocks: ${_subscription!.activeFlocks}/'
                '${_limitLabel(_subscription!.maxActiveFlocks)} • '
                'Users: ${_subscription!.users}/'
                '${_limitLabel(_subscription!.maxUsers)}',
              ),
              trailing:
                  appStoreModeStrict ? null : const Icon(Icons.open_in_new),
              onTap: appStoreModeStrict ? null : _openBillingOnWeb,
            ),
          const Divider(),

          // Production section
          SectionHeader(title: 'Production'),
          ListTile(
            leading: const Icon(Icons.vaccines_outlined),
            title: const Text('Vaccine Inventory'),
            subtitle: const Text('Stock levels and expiry tracking'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const VaccineInventoryScreen()),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.local_shipping_outlined),
            title: const Text('Suppliers'),
            subtitle: const Text('Feed suppliers and pricing'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const SuppliersScreen()),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.local_hospital_outlined),
            title: const Text('Disease Database'),
            subtitle: const Text('Symptoms, prevention, organic treatments'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const DiseasesScreen()),
            ),
          ),
          const Divider(),

          // Operations section
          SectionHeader(title: 'Operations'),
          ListTile(
            leading: const Icon(Icons.event_note_outlined),
            title: const Text('Vaccination Schedules'),
            subtitle: const Text('Standard Broiler + Ross 308 Comprehensive'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                  builder: (_) => const VaccinationSchedulesScreen()),
            ),
          ),
          const Divider(),

          // Planning section
          SectionHeader(title: 'Planning'),
          ListTile(
            leading: const Icon(Icons.calculate_outlined),
            title: const Text('Projections'),
            subtitle: const Text('Feed cost, revenue, and profit calculator'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const ProjectionsScreen()),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.timeline_outlined),
            title: const Text('Expansion Plan'),
            subtitle: const Text('Production cycle roadmap'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const ExpansionPlanScreen()),
            ),
          ),
          const Divider(),

          // Appearance section
          SectionHeader(title: 'Appearance'),
          ListTile(
            leading: const Icon(Icons.brightness_6),
            title: const Text('Theme'),
            subtitle: Text(_themeLabel(themeProvider.mode)),
            trailing: DropdownButton<AppThemeMode>(
              value: themeProvider.mode,
              underline: const SizedBox.shrink(),
              onChanged: (m) {
                if (m != null) themeProvider.setMode(m);
              },
              items: AppThemeMode.values.map((m) {
                return DropdownMenuItem(
                  value: m,
                  child: Text(_themeLabel(m)),
                );
              }).toList(),
            ),
          ),
          const Divider(),

          // Preferences section
          SectionHeader(title: 'Preferences'),
          ListTile(
            leading: const Icon(Icons.trending_up),
            title: const Text('Primary Breed'),
            subtitle: const Text('Ross 308 (Aviagen 2022 targets)'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                    content: Text('Breed selection is configured per flock')),
              );
            },
          ),
          ListTile(
            leading: const Icon(Icons.attach_money),
            title: const Text('Currency'),
            subtitle: const Text('ZMW — Zambian Kwacha'),
            trailing: const Chip(label: Text('Default')),
          ),
          ListTile(
            leading: const Icon(Icons.notifications_outlined),
            title: const Text('Notifications'),
            subtitle: const Text('Push alerts via ntfy'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                    content: Text(
                        'Notifications are enabled. Alerts are pushed from the API.')),
              );
            },
          ),
          // Sync Issues — shows failed/skipped sync queue items
          ListTile(
            leading: Badge(
              isLabelVisible: _skippedSyncs > 0,
              label: Text('$_skippedSyncs'),
              child: const Icon(Icons.sync_problem_outlined),
            ),
            title: const Text('Sync Issues'),
            subtitle: Text(
              _skippedSyncs > 0
                  ? '$_skippedSyncs skipped item${_skippedSyncs == 1 ? '' : 's'} need attention'
                  : _pendingSyncs > 0
                      ? '$_pendingSyncs pending sync${_pendingSyncs == 1 ? '' : 's'} queued'
                      : 'All changes synced',
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () async {
              await Navigator.push(
                context,
                MaterialPageRoute(
                    builder: (_) => const SyncIssuesScreen()),
              );
              // Refresh counts when returning from Sync Issues
              _loadSyncCounts();
            },
          ),
          // Clear local cache — clears cached read data (flocks, alerts,
          // dashboard) but NOT the sync queue (pending mutations are never
          // silently discarded — see plan §5.4).
          ListTile(
            leading: const Icon(Icons.cleaning_services_outlined),
            title: const Text('Clear local cache'),
            subtitle: const Text('Remove cached data (keeps pending syncs)'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _confirmClearCache(context),
          ),
          const Divider(),

          // Admin section (owner only)
          if (AuthService.isOwner) ...[
            SectionHeader(title: 'Admin'),
            ListTile(
              leading: const Icon(Icons.people, color: Colors.green),
              title: const Text('User Management'),
              subtitle: const Text('Manage users and roles'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const UsersScreen()),
              ),
            ),
            const Divider(),
          ],

          // About section
          SectionHeader(title: 'About'),
          const ListTile(
            leading: Icon(Icons.info_outline),
            title: Text('Nkuku Companion'),
            subtitle: Text('Broiler chicken production management'),
          ),
          const Divider(),

          // Logout
          ListTile(
            leading: Icon(Icons.logout, color: theme.colorScheme.error),
            title:
                Text('Logout', style: TextStyle(color: theme.colorScheme.error)),
            onTap: () async {
              await AuthService.logout();
              if (context.mounted) {
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                  (route) => false,
                );
              }
            },
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Future<void> _confirmClearCache(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear local cache?'),
        content: const Text(
          'This removes cached flocks, alerts, and dashboard data from '
          'this device. Pending sync items are kept and will still be '
          'uploaded when connected. Cached data will be re-downloaded '
          'the next time you open each screen.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Clear'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await OfflineRepository.instance.clearAllCache();
      ApiCache.clear();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Local cache cleared')),
      );
      _loadSyncCounts();
    }
  }

  /// Delete-my-account flow: explain permanence, require typing DELETE,
  /// call the API, then sign out and return to login. Available to all
  /// roles; sole owners of an active org are blocked with a 409 and told
  /// to delete/hand over the org first.
  Future<void> _confirmDeleteAccount() async {
    // Uses the State's own `context` so every post-await use is guarded by
    // the matching `mounted` check (use_build_context_synchronously).
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => const _DeleteAccountDialog(),
    );
    if (confirmed != true || !mounted) return;

    // Progress indicator while the request is in flight.
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator()),
    );
    final ok = await AuthService.deleteAccount();
    if (!mounted) return;
    Navigator.of(context, rootNavigator: true).pop(); // close progress

    if (ok) {
      await AuthService.logout();
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (route) => false,
      );
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Your account has been deleted')),
      );
      return;
    }

    if (AuthService.lastError == AuthService.soleOwnerError) {
      final orgs = AuthService.soleOwnerOrganizations;
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Cannot delete account yet'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(AuthService.soleOwnerMessage ??
                  'You are the only owner of these organizations. Delete them or make another member an owner first.'),
              if (orgs.isNotEmpty) ...[
                const SizedBox(height: 12),
                for (final name in orgs)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Row(
                      children: [
                        const Icon(Icons.business, size: 16),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(name,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                  ),
              ],
              const SizedBox(height: 12),
              const Text(
                'Delete the organization first (Settings → Data & Privacy on the web), or make another member an owner.',
                style: TextStyle(color: Colors.grey, fontSize: 13),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('OK'),
            ),
          ],
        ),
      );
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(AuthService.lastError ??
            'Could not delete your account. Please try again.'),
      ),
    );
  }

  /// Display label for a plan limit — the API uses -1 for "unlimited".
  static String _limitLabel(int max) => max < 0 ? '∞' : '$max';

  String _themeLabel(AppThemeMode mode) {
    switch (mode) {
      case AppThemeMode.light:
        return 'Light';
      case AppThemeMode.dark:
        return 'Dark';
      case AppThemeMode.system:
        return 'System';
    }
  }
}

/// Confirmation dialog for account deletion. The destructive button is
/// disabled until the user types DELETE exactly.
class _DeleteAccountDialog extends StatefulWidget {
  const _DeleteAccountDialog();

  @override
  State<_DeleteAccountDialog> createState() => _DeleteAccountDialogState();
}

class _DeleteAccountDialogState extends State<_DeleteAccountDialog> {
  final _controller = TextEditingController();
  bool _canDelete = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() {
      final ok = _controller.text.trim() == 'DELETE';
      if (ok != _canDelete) setState(() => _canDelete = ok);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AlertDialog(
      title: const Text('Delete my account?'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'This permanently deletes your account '
            '(${AuthService.user?['email'] ?? 'this user'}). You will be '
            'removed from your organization and will no longer be able to '
            'sign in. This cannot be undone.',
          ),
          const SizedBox(height: 16),
          const Text('Type DELETE to confirm:'),
          const SizedBox(height: 8),
          TextField(
            controller: _controller,
            autofocus: true,
            autocorrect: false,
            enableSuggestions: false,
            textCapitalization: TextCapitalization.characters,
            decoration: const InputDecoration(
              hintText: 'DELETE',
              border: OutlineInputBorder(),
              isDense: true,
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: theme.colorScheme.error,
            foregroundColor: theme.colorScheme.onError,
          ),
          onPressed: _canDelete ? () => Navigator.pop(context, true) : null,
          child: const Text('Delete account'),
        ),
      ],
    );
  }
}
