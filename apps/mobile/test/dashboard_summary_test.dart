import 'package:flutter_test/flutter_test.dart';
import 'package:nkuku_mobile/models/dashboard_summary.dart';

void main() {
  group('DashboardSummary.fromJson', () {
    test('parses full dashboard payload', () {
      final json = {
        'kpis': {
          'activeFlocks': 3,
          'pendingFlocks': 1,
          'totalFlocks': 4,
          'totalBirds': 1200,
          'mortalityRate': 2.5,
          'totalRevenue': 5000.0,
          'totalCost': 3200.0,
          'netProfit': 1800.0,
          'profitPerBird': 1.5,
          'openAlerts': 2,
        },
        'monthlyTrend': [
          {'month': 'Jan', 'revenue': 1000.0, 'cost': 600.0},
          {'month': 'Feb', 'revenue': 1200.0, 'cost': 700.0},
        ],
        'costBreakdown': [
          {'category': 'feed', 'amount': 1500.0},
          {'category': 'vaccines', 'amount': 200.0},
        ],
        'flockProfitability': [
          {
            'flockId': '1',
            'flockName': 'Flock A',
            'breedName': 'Ross 308',
            'ageDays': 21,
            'currentCount': 400,
            'mortalityRate': 1.2,
            'profit': 800.0,
            'revenue': 2000.0,
            'cost': 1200.0,
            'status': 'active',
          }
        ],
        'alertsBySeverity': {'critical': 0, 'warning': 1, 'info': 1},
        'alertsByType': [
          {'type': 'vaccination_due', 'count': 1, 'severity': 'warning'}
        ],
        'recentAlerts': [
          {
            'id': 'a1',
            'title': 'Vaccination due',
            'severity': 'warning',
            'alertType': 'vaccination_due',
            'flockName': 'Flock A',
            'createdAt': '2026-07-10T10:00:00Z',
            'dueDate': '2026-07-11T10:00:00Z',
          }
        ],
      };

      final summary = DashboardSummary.fromJson(json);
      expect(summary.kpis.activeFlocks, 3);
      expect(summary.kpis.totalBirds, 1200);
      expect(summary.kpis.profitPerBird, 1.5);
      expect(summary.monthlyTrend.length, 2);
      expect(summary.costBreakdown.first.category, 'feed');
      expect(summary.flockProfitability.first.flockName, 'Flock A');
      expect(summary.recentAlerts.first.severity, 'warning');
    });

    test('handles empty response gracefully', () {
      final json = {
        'kpis': {
          'activeFlocks': 0,
          'pendingFlocks': 0,
          'totalFlocks': 0,
          'totalBirds': 0,
          'mortalityRate': 0.0,
          'totalRevenue': 0.0,
          'totalCost': 0.0,
          'netProfit': 0.0,
          'profitPerBird': 0.0,
          'openAlerts': 0,
        },
        'monthlyTrend': [],
        'costBreakdown': [],
        'flockProfitability': [],
        'alertsBySeverity': {'critical': 0, 'warning': 0, 'info': 0},
        'alertsByType': [],
        'recentAlerts': [],
      };

      final summary = DashboardSummary.fromJson(json);
      expect(summary.monthlyTrend.isEmpty, true);
      expect(summary.recentAlerts.isEmpty, true);
      expect(summary.kpis.openAlerts, 0);
    });
  });
}
