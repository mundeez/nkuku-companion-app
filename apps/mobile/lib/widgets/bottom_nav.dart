import 'package:flutter/material.dart';
import '../screens/dashboard_screen.dart';
import '../screens/broiler/flocks_screen.dart';
import '../screens/alerts_screen.dart';
import '../screens/finance_hub_screen.dart';
import '../screens/more_screen.dart';

/// Primary bottom navigation. Trimmed to the 5 most-used destinations —
/// everything else (Vaccine Inventory, Suppliers, Disease Database,
/// Vaccination Schedules, Projections, Expansion Plan, Admin, Account/
/// Appearance settings) lives in the grouped "More" screen (see
/// `more_screen.dart`) to avoid label crowding/truncation on small screens.
class BottomNavShell extends StatefulWidget {
  const BottomNavShell({super.key});

  @override
  State<BottomNavShell> createState() => _BottomNavShellState();
}

class _BottomNavShellState extends State<BottomNavShell> {
  int _index = 0;

  final List<Widget> _pages = const [
    DashboardScreen(),
    FlocksScreen(),
    AlertsScreen(),
    FinanceHubScreen(),
    MoreScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: _pages,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard), label: 'Dashboard'),
          NavigationDestination(icon: Icon(Icons.egg_alt_outlined), selectedIcon: Icon(Icons.egg_alt), label: 'Flocks'),
          NavigationDestination(icon: Icon(Icons.notifications_outlined), selectedIcon: Icon(Icons.notifications), label: 'Alerts'),
          NavigationDestination(icon: Icon(Icons.account_balance_wallet_outlined), selectedIcon: Icon(Icons.account_balance_wallet), label: 'Finance'),
          NavigationDestination(icon: Icon(Icons.more_horiz_outlined), selectedIcon: Icon(Icons.more_horiz), label: 'More'),
        ],
      ),
    );
  }
}
