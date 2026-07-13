import 'package:flutter/material.dart';
import '../providers/theme_provider.dart';
import '../services/auth_service.dart';
import 'login_screen.dart';

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
          ListTile(
            leading: const Icon(Icons.person),
            title: Text(AuthService.user?['email'] ?? 'Unknown user'),
            subtitle: Text('Role: ${AuthService.role ?? 'unknown'}'),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.brightness_6),
            title: const Text('Theme'),
            subtitle: Text(themeProvider.mode.name.substring(0, 1).toUpperCase() + themeProvider.mode.name.substring(1)),
            trailing: DropdownButton<AppThemeMode>(
              value: themeProvider.mode,
              underline: const SizedBox.shrink(),
              onChanged: (m) {
                if (m != null) themeProvider.setMode(m);
              },
              items: AppThemeMode.values.map((m) {
                return DropdownMenuItem(
                  value: m,
                  child: Text(m.name.substring(0, 1).toUpperCase() + m.name.substring(1)),
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
}
