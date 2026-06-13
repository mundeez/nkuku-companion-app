class ProductionCycle {
  final String id;
  final int cycleNumber;
  final String? label;
  final String status;
  final List<Batch> batches;

  ProductionCycle({
    required this.id,
    required this.cycleNumber,
    this.label,
    required this.status,
    required this.batches,
  });

  factory ProductionCycle.fromJson(Map<String, dynamic> json) {
    return ProductionCycle(
      id: json['id'],
      cycleNumber: json['cycleNumber'],
      label: json['label'],
      status: json['status'],
      batches: (json['batches'] as List? ?? [])
          .map((e) => Batch.fromJson(e))
          .toList(),
    );
  }
}

class Batch {
  final String id;
  final String shootLabel;
  final DateTime targetExecutionDt;
  final DateTime salesDate;
  final int growthQtyAdded;
  final int totalQtyAtHand;
  final double? revenueTargetZmw;

  Batch({
    required this.id,
    required this.shootLabel,
    required this.targetExecutionDt,
    required this.salesDate,
    required this.growthQtyAdded,
    required this.totalQtyAtHand,
    this.revenueTargetZmw,
  });

  factory Batch.fromJson(Map<String, dynamic> json) {
    return Batch(
      id: json['id'],
      shootLabel: json['shootLabel'],
      targetExecutionDt: DateTime.parse(json['targetExecutionDt']),
      salesDate: DateTime.parse(json['salesDate']),
      growthQtyAdded: json['growthQtyAdded'] ?? 0,
      totalQtyAtHand: json['totalQtyAtHand'],
      revenueTargetZmw: json['revenueTargetZmw'] != null
          ? (json['revenueTargetZmw'] as num).toDouble()
          : null,
    );
  }
}

