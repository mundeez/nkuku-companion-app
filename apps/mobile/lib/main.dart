import 'package:flutter/material.dart';
import 'screens/login_screen.dart';
import 'widgets/bottom_nav.dart';
import 'widgets/upgrade_sheet.dart';
import 'services/auth_service.dart';
import 'services/api_service.dart';
import 'services/notification_service.dart';
import 'services/connectivity_service.dart';
import 'services/offline_repository.dart';
import 'services/sync_service.dart';
import 'database/app_database.dart';
import 'providers/theme_provider.dart';
import 'theme/app_theme.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

// Sentry is a no-op when APP_SENTRY_DSN is empty (dev/debug builds).
const _sentryDsn = String.fromEnvironment('APP_SENTRY_DSN', defaultValue: '');

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AuthService.init();
  await NotificationService.init();
  // Initialize Drift database and offline repository
  final db = AppDatabase();
  OfflineRepository.instance.init(db);
  // Start proactive connectivity monitoring
  ConnectivityService.instance.init();
  ApiService.setupInterceptors();
  SyncService.instance.init();
  if (_sentryDsn.isEmpty) {
    runApp(const NkukuApp());
  } else {
    await SentryFlutter.init(
      (options) => options
        ..dsn = _sentryDsn
        ..tracesSampleRate = 0.0,
      appRunner: () => runApp(const NkukuApp()),
    );
  }
}

class NkukuApp extends StatefulWidget {
  const NkukuApp({super.key});

  @override
  State<NkukuApp> createState() => _NkukuAppState();
}

class _NkukuAppState extends State<NkukuApp> {
  final _themeProvider = ThemeProvider();
  bool _isLoggedIn = AuthService.isLoggedIn;

  @override
  void initState() {
    super.initState();
    _themeProvider.addListener(_onThemeChanged);
    AuthService.addAuthStateListener(_onAuthChanged);
    ApiService.onAuthFailure = _onAuthFailure;
    ApiService.onPlanLimitReached = _onPlanLimitReached;
    if (AuthService.isLoggedIn) {
      NotificationService.startListening();
    }
  }

  void _onThemeChanged() {
    if (mounted) setState(() {});
  }

  void _onAuthChanged() {
    if (mounted) {
      setState(() => _isLoggedIn = AuthService.isLoggedIn);
      if (AuthService.isLoggedIn) {
        NotificationService.startListening();
      } else {
        NotificationService.stop();
      }
    }
  }

  void _onAuthFailure() {
    if (mounted) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  /// HTTP 402 (plan limit reached) from any API call — show the upgrade
  /// bottom sheet over whatever screen issued the request.
  void _onPlanLimitReached(PlanLimitInfo info) {
    final ctx = ApiService.navigatorKey.currentContext;
    if (ctx != null) {
      UpgradeSheet.show(ctx, info);
    }
  }

  @override
  void dispose() {
    _themeProvider.removeListener(_onThemeChanged);
    AuthService.removeAuthStateListener(_onAuthChanged);
    ApiService.onAuthFailure = null;
    ApiService.onPlanLimitReached = null;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ThemeProviderScope(
      provider: _themeProvider,
      child: MaterialApp(
        title: 'Nkuku Companion',
        navigatorKey: ApiService.navigatorKey,
        debugShowCheckedModeBanner: false,
        themeMode: _themeProvider.flutterThemeMode,
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        home: _isLoggedIn ? const BottomNavShell() : const LoginScreen(),
      ),
    );
  }
}

