class ProjectionResult {
  final String supplierName;
  final int birdCount;
  final String effectiveBirdCount;
  final String totalExpenses;
  final String projectedRevenue;
  final String grossProfit;
  final String netProfit;
  final List<ProjectionBreakdown> breakdown;

  ProjectionResult({
    required this.supplierName,
    required this.birdCount,
    required this.effectiveBirdCount,
    required this.totalExpenses,
    required this.projectedRevenue,
    required this.grossProfit,
    required this.netProfit,
    required this.breakdown,
  });

  factory ProjectionResult.fromJson(Map<String, dynamic> json) {
    return ProjectionResult(
      supplierName: json['supplierName'] ?? '',
      birdCount: json['birdCount'] ?? 0,
      effectiveBirdCount: json['effectiveBirdCount']?.toString() ?? '0',
      totalExpenses: json['totalExpenses']?.toString() ?? '0',
      projectedRevenue: json['projectedRevenue']?.toString() ?? '0',
      grossProfit: json['grossProfit']?.toString() ?? '0',
      netProfit: json['netProfit']?.toString() ?? '0',
      breakdown: (json['breakdown'] as List? ?? [])
          .map((e) => ProjectionBreakdown.fromJson(e))
          .toList(),
    );
  }
}

class ProjectionBreakdown {
  final String stageName;
  final String stageType;
  final int? itemsRoundedUp;
  final String unitPriceZmw;
  final String subtotalZmw;
  // Feed bag size in kg (e.g. 50 or 25); 0/null for non-feed stages.
  final double? unitSizeKg;
  final String? itemsRaw;

  ProjectionBreakdown({
    required this.stageName,
    required this.stageType,
    this.itemsRoundedUp,
    required this.unitPriceZmw,
    required this.subtotalZmw,
    this.unitSizeKg,
    this.itemsRaw,
  });

  /// Bag-size group label for feed stages ("50 kg bags"), or 'Other costs'
  /// for non-feed stages (chicks, medication, …).
  String get groupLabel {
    if (stageType != 'feed' || unitSizeKg == null) return 'Other costs';
    final kg = unitSizeKg == unitSizeKg!.roundToDouble()
        ? unitSizeKg!.toInt().toString()
        : unitSizeKg!.toString();
    return '$kg kg bags';
  }

  factory ProjectionBreakdown.fromJson(Map<String, dynamic> json) {
    return ProjectionBreakdown(
      stageName: json['stageName'] ?? '',
      stageType: json['stageType'] ?? '',
      itemsRoundedUp: json['itemsRoundedUp'],
      unitPriceZmw: json['unitPriceZmw']?.toString() ?? '0',
      subtotalZmw: json['subtotalZmw']?.toString() ?? '0',
      unitSizeKg: double.tryParse('${json['unitSizeKg']}'),
      itemsRaw: json['itemsRaw']?.toString(),
    );
  }
}
