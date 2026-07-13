import 'package:flutter/material.dart';
import 'screens/login_screen.dart';
import 'widgets/bottom_nav.dart';
import 'services/auth_service.dart';
import 'services/api_service.dart';
import 'providers/theme_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AuthService.init();
  ApiService.setupInterceptors();
  runApp(const NkukuApp());
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
  }

  void _onThemeChanged() {
    if (mounted) setState(() {});
  }

  void _onAuthChanged() {
    if (mounted) setState(() => _isLoggedIn = AuthService.isLoggedIn);
  }

  void _onAuthFailure() {
    if (mounted) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  @override
  void dispose() {
    _themeProvider.removeListener(_onThemeChanged);
    AuthService.removeAuthStateListener(_onAuthChanged);
    ApiService.onAuthFailure = null;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ThemeProviderScope(
      provider: _themeProvider,
      child: MaterialApp(
        title: 'Nkuku Companion',
        debugShowCheckedModeBanner: false,
        themeMode: _themeProvider.flutterThemeMode,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: Colors.green, brightness: Brightness.light),
          useMaterial3: true,
        ),
        darkTheme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: Colors.green, brightness: Brightness.dark),
          useMaterial3: true,
        ),
        home: _isLoggedIn ? const BottomNavShell() : const LoginScreen(),
      ),
    );
  }
}

