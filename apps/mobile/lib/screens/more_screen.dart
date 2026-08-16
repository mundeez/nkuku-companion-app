import 'package:flutter/material.dart';
import '../providers/theme_provider.dart';
import '../services/auth_service.dart';
import 'account_settings_screen.dart';
import 'login_screen.dart';
import 'users_screen.dart';
import 'projections_screen.dart';
import 'expansion_plan_screen.dart';
import 'suppliers_screen.dart';
import 'vaccine_inventory_screen.dart';
import 'broiler/diseases_screen.dart';
import 'broiler/vaccination_schedules_screen.dart';
import '../widgets/section_header.dart';

/// Grouped hub for everything that doesn't fit in the primary bottom
/// navigation bar. Mirrors the Production / Operations / Planning / Admin
/// grouping used on web, plus the existing account/appearance settings.
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

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
