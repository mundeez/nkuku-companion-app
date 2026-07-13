import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nkuku_mobile/providers/theme_provider.dart';
import 'test_helpers.dart';

void main() {
  group('ThemeProvider', () {
    setUpAll(() async {
      await setupSharedPreferences();
    });

    test('default mode is system', () {
      final provider = ThemeProvider();
      expect(provider.mode, AppThemeMode.system);
      expect(provider.flutterThemeMode, ThemeMode.system);
    });

    test('setMode updates theme and toggles', () {
      final provider = ThemeProvider();
      provider.setMode(AppThemeMode.dark);
      expect(provider.mode, AppThemeMode.dark);
      expect(provider.flutterThemeMode, ThemeMode.dark);
      expect(provider.isDarkMode, true);

      provider.toggle();
      expect(provider.mode, AppThemeMode.light);
      expect(provider.isDarkMode, false);
    });

    test('notifies listeners when mode changes', () {
      final provider = ThemeProvider();
      var called = false;
      provider.addListener(() => called = true);
      provider.setMode(AppThemeMode.dark);
      expect(called, true);
    });
  });
}
