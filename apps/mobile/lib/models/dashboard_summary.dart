class DashboardKpis {
  final int activeFlocks;
  final int pendingFlocks;
  final int totalFlocks;
  final int totalBirds;
  final double mortalityRate;
  final double totalRevenue;
  final double totalCost;
  final double netProfit;
  final double profitPerBird;
  final int openAlerts;

  const DashboardKpis({
    required this.activeFlocks,
    required this.pendingFlocks,
    required this.totalFlocks,
    required this.totalBirds,
    required this.mortalityRate,
    required this.totalRevenue,
    required this.totalCost,
    required this.netProfit,
    required this.profitPerBird,
    required this.openAlerts,
  });

  factory DashboardKpis.fromJson(Map<String, dynamic> json) => DashboardKpis(
        activeFlocks: (json['activeFlocks'] ?? 0) as int,
        pendingFlocks: (json['pendingFlocks'] ?? 0) as int,
        totalFlocks: (json['totalFlocks'] ?? 0) as int,
        totalBirds: (json['totalBirds'] ?? 0) as int,
        mortalityRate: (json['mortalityRate'] ?? 0.0).toDouble(),
        totalRevenue: (json['totalRevenue'] ?? 0.0).toDouble(),
        totalCost: (json['totalCost'] ?? 0.0).toDouble(),
        netProfit: (json['netProfit'] ?? 0.0).toDouble(),
        profitPerBird: (json['profitPerBird'] ?? 0.0).toDouble(),
        openAlerts: (json['openAlerts'] ?? 0) as int,
      );
}

class MonthlyTrendItem {
  final String month;
  final double revenue;
  final double cost;

  const MonthlyTrendItem({
    required this.month,
    required this.revenue,
    required this.cost,
  });

  factory MonthlyTrendItem.fromJson(Map<String, dynamic> json) => MonthlyTrendItem(
        month: json['month'] as String,
        revenue: (json['revenue'] ?? 0.0).toDouble(),
        cost: (json['cost'] ?? 0.0).toDouble(),
      );
}

class CostBreakdownItem {
  final String category;
  final double amount;

  const CostBreakdownItem({required this.category, required this.amount});

  factory CostBreakdownItem.fromJson(Map<String, dynamic> json) => CostBreakdownItem(
        category: json['category'] as String,
        amount: (json['amount'] ?? 0.0).toDouble(),
      );
}

class FlockProfitabilityItem {
  final String flockId;
  final String flockName;
  final String breedName;
  final int ageDays;
  final int currentCount;
  final double mortalityRate;
  final double profit;
  final double revenue;
  final double cost;
  final String status;

  const FlockProfitabilityItem({
    required this.flockId,
    required this.flockName,
    required this.breedName,
    required this.ageDays,
    required this.currentCount,
    required this.mortalityRate,
    required this.profit,
    required this.revenue,
    required this.cost,
    required this.status,
  });

  factory FlockProfitabilityItem.fromJson(Map<String, dynamic> json) => FlockProfitabilityItem(
        flockId: json['flockId'] as String,
        flockName: json['flockName'] as String,
        breedName: json['breedName'] as String,
        ageDays: (json['ageDays'] ?? 0) as int,
        currentCount: (json['currentCount'] ?? 0) as int,
        mortalityRate: (json['mortalityRate'] ?? 0.0).toDouble(),
        profit: (json['profit'] ?? 0.0).toDouble(),
        revenue: (json['revenue'] ?? 0.0).toDouble(),
        cost: (json['cost'] ?? 0.0).toDouble(),
        status: json['status'] as String,
      );
}

class AlertsBySeverity {
  final int critical;
  final int warning;
  final int info;

  const AlertsBySeverity({required this.critical, required this.warning, required this.info});

  factory AlertsBySeverity.fromJson(Map<String, dynamic> json) => AlertsBySeverity(
        critical: (json['critical'] ?? 0) as int,
        warning: (json['warning'] ?? 0) as int,
        info: (json['info'] ?? 0) as int,
      );
}

class RecentAlertItem {
  final String id;
  final String title;
  final String severity;
  final String alertType;
  final String flockName;
  final DateTime createdAt;
  final DateTime? dueDate;

  const RecentAlertItem({
    required this.id,
    required this.title,
    required this.severity,
    required this.alertType,
    required this.flockName,
    required this.createdAt,
    this.dueDate,
  });

  factory RecentAlertItem.fromJson(Map<String, dynamic> json) => RecentAlertItem(
        id: json['id'] as String,
        title: json['title'] as String,
        severity: json['severity'] as String,
        alertType: json['alertType'] as String,
        flockName: json['flockName'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
        dueDate: json['dueDate'] != null ? DateTime.parse(json['dueDate'] as String) : null,
      );
}

class DashboardSummary {
  final DashboardKpis kpis;
  final List<MonthlyTrendItem> monthlyTrend;
  final List<CostBreakdownItem> costBreakdown;
  final List<FlockProfitabilityItem> flockProfitability;
  final AlertsBySeverity alertsBySeverity;
  final List<Map<String, dynamic>> alertsByType;
  final List<RecentAlertItem> recentAlerts;

  const DashboardSummary({
    required this.kpis,
    required this.monthlyTrend,
    required this.costBreakdown,
    required this.flockProfitability,
    required this.alertsBySeverity,
    required this.alertsByType,
    required this.recentAlerts,
  });

  factory DashboardSummary.fromJson(Map<String, dynamic> json) => DashboardSummary(
        kpis: DashboardKpis.fromJson(json['kpis'] as Map<String, dynamic>),
        monthlyTrend: ((json['monthlyTrend'] ?? []) as List)
            .map((e) => MonthlyTrendItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        costBreakdown: ((json['costBreakdown'] ?? []) as List)
            .map((e) => CostBreakdownItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        flockProfitability: ((json['flockProfitability'] ?? []) as List)
            .map((e) => FlockProfitabilityItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        alertsBySeverity: AlertsBySeverity.fromJson(json['alertsBySeverity'] as Map<String, dynamic>),
        alertsByType: ((json['alertsByType'] ?? []) as List).cast<Map<String, dynamic>>(),
        recentAlerts: ((json['recentAlerts'] ?? []) as List)
            .map((e) => RecentAlertItem.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
