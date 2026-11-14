import 'package:flutter/material.dart';
import 'api.dart';
import 'screens/login.dart';
import 'screens/home.dart';

void main() => runApp(const NkukuAdminApp());

class NkukuAdminApp extends StatelessWidget {
  const NkukuAdminApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Nkuku Admin',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0F766E)),
        useMaterial3: true,
      ),
      builder: (context, child) => SafeArea(top: false, child: child!),
      home: const _AuthGate(),
    );
  }
}

class _AuthGate extends StatefulWidget {
  const _AuthGate();

  @override
  State<_AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<_AuthGate> {
  bool _loggedIn = false;
  bool _checked = false;

  @override
  void initState() {
    super.initState();
    Api.token().then((t) {
      if (mounted) setState(() { _loggedIn = t != null; _checked = true; });
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_checked) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (!_loggedIn) {
      return LoginScreen(onLoggedIn: () => setState(() => _loggedIn = true));
    }
    return HomeScreen(onLoggedOut: () => setState(() => _loggedIn = false));
  }
}
