import 'package:flutter/material.dart';
import '../providers/theme_provider.dart';
import '../services/auth_service.dart';
import 'account_settings_screen.dart';
import 'login_screen.dart';
import 'users_screen.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final themeProvider = ThemeProvider.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          // Account section
          _SectionHeader(title: 'Account'),
          ListTile(
            leading: CircleAvatar(
              backgroundColor: theme.colorScheme.primaryContainer,
              child: Text(
                (AuthService.user?['email'] ?? '?')[0].toUpperCase(),
                style: TextStyle(color: theme.colorScheme.onPrimaryContainer),
              ),
            ),
            title: Text(AuthService.user?['email'] ?? 'Unknown user'),
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

          // Appearance section
          _SectionHeader(title: 'Appearance'),
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
          ListTile(
            leading: Icon(themeProvider.isDarkMode ? Icons.light_mode : Icons.dark_mode),
            title: Text(themeProvider.isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'),
            onTap: themeProvider.toggle,
          ),
          const Divider(),

          // Preferences section
          _SectionHeader(title: 'Preferences'),
          ListTile(
            leading: const Icon(Icons.trending_up),
            title: const Text('Primary Breed'),
            subtitle: const Text('Ross 308 (Aviagen 2022 targets)'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Breed selection is configured per flock')),
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
                const SnackBar(content: Text('Notifications are enabled. Alerts are pushed from the API.')),
              );
            },
          ),
          const Divider(),

          // Admin section (owner only)
          if (AuthService.isOwner) ...[
            _SectionHeader(title: 'Administration'),
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
          _SectionHeader(title: 'About'),
          ListTile(
            leading: const Icon(Icons.info_outline),
            title: const Text('Nkuku Companion'),
            subtitle: const Text('Broiler chicken production management\nv1.0.0'),
            isThreeLine: true,
          ),
          ListTile(
            leading: const Icon(Icons.vaccines_outlined),
            title: const Text('Vaccination Schedules'),
            subtitle: const Text('Standard Broiler + Ross 308 Comprehensive'),
          ),
          ListTile(
            leading: const Icon(Icons.local_hospital_outlined),
            title: const Text('Disease Database'),
            subtitle: const Text('10 diseases with organic treatments'),
          ),
          const Divider(),

          // Logout
          ListTile(
            leading: Icon(Icons.logout, color: theme.colorScheme.error),
            title: Text('Logout', style: TextStyle(color: theme.colorScheme.error)),
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

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.bold,
          color: Theme.of(context).colorScheme.primary,
        ),
      ),
    );
  }
}
