class Breed {
  final String id;
  final String name;
  final String supplier;
  final bool isPrimary;
  final List<PerformanceTarget> performanceTargets;

  Breed({
    required this.id,
    required this.name,
    required this.supplier,
    required this.isPrimary,
    required this.performanceTargets,
  });

  factory Breed.fromJson(Map<String, dynamic> json) {
    return Breed(
      id: json['id'],
      name: json['name'],
      supplier: json['supplier'] ?? '',
      isPrimary: json['isPrimary'] ?? false,
      performanceTargets: (json['performanceTargets'] as List? ?? [])
          .map((e) => PerformanceTarget.fromJson(e))
          .toList(),
    );
  }
}

class PerformanceTarget {
  final String id;
  final int ageDays;
  final double? targetWeightG;
  final double? dailyWeightGainG;
  final double? feedConversionRatio;
  final double? cumulativeFeedIntakeG;
  final double? mortalityRatePct;

  PerformanceTarget({
    required this.id,
    required this.ageDays,
    this.targetWeightG,
    this.dailyWeightGainG,
    this.feedConversionRatio,
    this.cumulativeFeedIntakeG,
    this.mortalityRatePct,
  });

  factory PerformanceTarget.fromJson(Map<String, dynamic> json) {
    return PerformanceTarget(
      id: json['id'],
      ageDays: json['ageDays'] ?? json['age_days'] ?? 0,
      targetWeightG: _toDouble(json['targetWeightG'] ?? json['target_weight_g']),
      dailyWeightGainG: _toDouble(json['dailyWeightGainG'] ?? json['daily_weight_gain_g']),
      feedConversionRatio: _toDouble(json['feedConversionRatio'] ?? json['feed_conversion_ratio']),
      cumulativeFeedIntakeG: _toDouble(json['cumulativeFeedIntakeG'] ?? json['cumulative_feed_intake_g']),
      mortalityRatePct: _toDouble(json['mortalityRatePct'] ?? json['mortality_rate_pct']),
    );
  }

  static double? _toDouble(dynamic value) {
    if (value == null) return null;
    return double.tryParse(value.toString());
  }
}
