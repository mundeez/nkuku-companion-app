import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum AppThemeMode { system, light, dark }

class ThemeProvider extends ChangeNotifier {
  ThemeProvider() {
    _load();
  }

  static ThemeProvider of(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<ThemeProviderScope>()!.provider;
  }

  AppThemeMode _mode = AppThemeMode.system;

  AppThemeMode get mode => _mode;

  ThemeMode get flutterThemeMode {
    switch (_mode) {
      case AppThemeMode.light:
        return ThemeMode.light;
      case AppThemeMode.dark:
        return ThemeMode.dark;
      case AppThemeMode.system:
        return ThemeMode.system;
    }
  }

  bool get isDarkMode => _mode == AppThemeMode.dark;

  void setMode(AppThemeMode mode) {
    if (_mode == mode) return;
    _mode = mode;
    _save();
    notifyListeners();
  }

  void toggle() {
    setMode(_mode == AppThemeMode.dark ? AppThemeMode.light : AppThemeMode.dark);
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('theme_mode');
    if (saved != null) {
      _mode = AppThemeMode.values.firstWhere(
        (e) => e.name == saved,
        orElse: () => AppThemeMode.system,
      );
      notifyListeners();
    }
  }

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('theme_mode', _mode.name);
  }
}

class ThemeProviderScope extends InheritedWidget {
  final ThemeProvider provider;

  const ThemeProviderScope({super.key, required this.provider, required super.child});

  @override
  bool updateShouldNotify(covariant ThemeProviderScope oldWidget) =>
      oldWidget.provider != provider;
}
