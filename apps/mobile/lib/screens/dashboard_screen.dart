import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../models/supplier.dart';
import '../models/cycle.dart';
import 'login_screen.dart';
import 'suppliers_screen.dart';
import 'projections_screen.dart';
import 'expansion_plan_screen.dart';
import 'financials/financial_dashboard_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _suppliers = 0;
  int _cycles = 0;
  int _batches = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    ApiService.setupInterceptors();
    _loadStats();
  }

  Future<void> _loadStats() async {
    try {
      final suppliersRes = await ApiService.dio.get('/api/v1/suppliers');
      final cyclesRes = await ApiService.dio.get('/api/v1/expansion-plan');
      final suppliers = (suppliersRes.data as List).map((e) => Supplier.fromJson(e)).toList();
      final cycles = (cyclesRes.data as List).map((e) => ProductionCycle.fromJson(e)).toList();
      setState(() {
        _suppliers = suppliers.length;
        _cycles = cycles.length;
        _batches = cycles.fold(0, (sum, c) => sum + c.batches.length);
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  void _logout() {
    AuthService.logout();
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: _logout,
            tooltip: 'Logout',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadStats,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _StatCard(
                    icon: Icons.store,
                    label: 'Suppliers',
                    value: _suppliers.toString(),
                    color: Colors.blue,
                  ),
                  _StatCard(
                    icon: Icons.repeat,
                    label: 'Cycles',
                    value: _cycles.toString(),
                    color: Colors.orange,
                  ),
                  _StatCard(
                    icon: Icons.egg_alt,
                    label: 'Batches',
                    value: _batches.toString(),
                    color: Colors.green,
                  ),
                  const SizedBox(height: 16),
                  const Text('Quick Actions', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  _ActionTile(
                    icon: Icons.calculate,
                    title: 'Run Projection',
                    subtitle: 'Calculate costs & profits',
                    onTap: () => Navigator.push(context,
                      MaterialPageRoute(builder: (_) => const ProjectionsScreen())),
                  ),
                  _ActionTile(
                    icon: Icons.store,
                    title: 'Suppliers',
                    subtitle: 'View feed suppliers',
                    onTap: () => Navigator.push(context,
                      MaterialPageRoute(builder: (_) => const SuppliersScreen())),
                  ),
                  _ActionTile(
                    icon: Icons.calendar_month,
                    title: 'Expansion Plan',
                    subtitle: 'View production cycles',
                    onTap: () => Navigator.push(context,
                      MaterialPageRoute(builder: (_) => const ExpansionPlanScreen())),
                  ),
                  _ActionTile(
                    icon: Icons.account_balance_wallet,
                    title: 'Financials',
                    subtitle: 'Statements, reports & exports',
                    onTap: () => Navigator.push(context,
                      MaterialPageRoute(builder: (_) => const FinancialDashboardScreen())),
                  ),
                ],
              ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _StatCard({required this.icon, required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: color.withAlpha(30),
              child: Icon(icon, color: color),
            ),
            const SizedBox(width: 16),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(color: Colors.grey)),
                Text(value, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _ActionTile({required this.icon, required this.title, required this.subtitle, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(icon, color: Colors.green),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}

