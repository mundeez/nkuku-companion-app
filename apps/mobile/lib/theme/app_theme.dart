import 'package:flutter/material.dart';

/// Centralized Material 3 theme definitions for Nkuku Companion.
///
/// Uses the brand green already baked into the app icon/splash
/// (`#1B5E20`, adaptive icon background) as the seed color instead of the
/// generic `Colors.green` swatch, so the in-app palette, launcher icon, and
/// splash screen all derive from the same brand color. Consolidating theme
/// definitions here (rather than inline in `main.dart`) also gives every
/// screen a single, consistent typography/component baseline instead of
/// scattered ad hoc `TextStyle`/`Card`/`Chip` overrides.
class AppTheme {
  AppTheme._();

  /// Brand seed — matches `flutter_launcher_icons`' adaptive icon background
  /// and `flutter_native_splash`'s background color in `pubspec.yaml`.
  static const Color brandSeed = Color(0xFF1B5E20);

  static ThemeData get light => _build(Brightness.light);
  static ThemeData get dark => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: brandSeed,
      brightness: brightness,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      visualDensity: VisualDensity.standard,
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 2,
        backgroundColor: colorScheme.surface,
        foregroundColor: colorScheme.onSurface,
        titleTextStyle: TextStyle(
          color: colorScheme.onSurface,
          fontSize: 20,
          fontWeight: FontWeight.w600,
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        height: 64,
      ),
      cardTheme: CardThemeData(
        elevation: 0.5,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: colorScheme.outlineVariant, width: 0.5),
        ),
        margin: EdgeInsets.zero,
      ),
      chipTheme: ChipThemeData(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
        labelStyle: TextStyle(color: colorScheme.onSurfaceVariant, fontSize: 12),
        side: BorderSide(color: colorScheme.outlineVariant, width: 0.5),
      ),
      dividerTheme: DividerThemeData(
        color: colorScheme.outlineVariant,
        thickness: 0.5,
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        isDense: true,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
          visualDensity: VisualDensity.compact,
          textStyle: WidgetStateProperty.all(const TextStyle(fontSize: 13)),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }
}
