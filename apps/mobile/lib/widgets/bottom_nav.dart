import 'package:flutter/material.dart';
import '../screens/dashboard_screen.dart';
import '../screens/broiler/flocks_screen.dart';
import '../screens/alerts_screen.dart';
import '../screens/finance_hub_screen.dart';
import '../screens/more_screen.dart';
import '../services/connectivity_service.dart';
import '../services/sync_service.dart';

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
  bool _isOnline = true;
  int _pendingSyncs = 0;

  final List<Widget> _pages = const [
    DashboardScreen(),
    FlocksScreen(),
    AlertsScreen(),
    FinanceHubScreen(),
    MoreScreen(),
  ];

  @override
  void initState() {
    super.initState();
    _isOnline = ConnectivityService.instance.isOnline;
    _pendingSyncs = SyncService.instance.pendingCount;
    ConnectivityService.instance.addListener(_onConnectivityChanged);
    // Preload sync queue counts from encrypted storage (async)
    _loadPendingCount();
  }

  Future<void> _loadPendingCount() async {
    if (mounted) {
      setState(() {
        _pendingSyncs = SyncService.instance.pendingCount;
      });
    }
  }

  @override
  void dispose() {
    ConnectivityService.instance.removeListener(_onConnectivityChanged);
    super.dispose();
  }

  void _onConnectivityChanged() {
    if (mounted) {
      setState(() {
        _isOnline = ConnectivityService.instance.isOnline;
        _pendingSyncs = SyncService.instance.pendingCount;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          // Offline / pending sync banner
          if (!_isOnline || _pendingSyncs > 0)
            Material(
              color: _isOnline ? Colors.amber.shade100 : Colors.red.shade100,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                child: Row(
                  children: [
                    Icon(
                      _isOnline ? Icons.sync : Icons.cloud_off,
                      size: 16,
                      color: _isOnline ? Colors.amber.shade800 : Colors.red.shade800,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _isOnline
                            ? '$_pendingSyncs pending sync${_pendingSyncs == 1 ? '' : 's'} queued'
                            : 'Offline — changes will sync when connected',
                        style: TextStyle(
                          fontSize: 12,
                          color: _isOnline ? Colors.amber.shade900 : Colors.red.shade900,
                        ),
                      ),
                    ),
                    if (_isOnline && _pendingSyncs > 0)
                      TextButton(
                        onPressed: () async {
                          await SyncService.instance.syncNow();
                          _onConnectivityChanged();
                        },
                        child: const Text('Sync now', style: TextStyle(fontSize: 12)),
                      ),
                  ],
                ),
              ),
            ),
          Expanded(
            child: IndexedStack(
              index: _index,
              children: _pages,
            ),
          ),
        ],
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
