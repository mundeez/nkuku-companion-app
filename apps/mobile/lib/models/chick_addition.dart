class ChickAddition {
  final String id;
  final String flockId;
  final String additionDate;
  final int count;
  final String reason; // 'hatchery_extra' | 'purchase' | 'correction'
  final double? unitPriceZmw;
  final String? notes;
  final String? financialRecordId;

  const ChickAddition({
    required this.id,
    required this.flockId,
    required this.additionDate,
    required this.count,
    required this.reason,
    this.unitPriceZmw,
    this.notes,
    this.financialRecordId,
  });

  factory ChickAddition.fromJson(Map<String, dynamic> json) => ChickAddition(
        id: json['id'] as String,
        flockId: json['flockId'] as String,
        additionDate: (json['additionDate'] ?? '') as String,
        count: (json['count'] ?? 0) as int,
        reason: (json['reason'] ?? 'hatchery_extra') as String,
        unitPriceZmw: json['unitPriceZmw'] == null
            ? null
            : double.tryParse(json['unitPriceZmw'].toString()),
        notes: json['notes'] as String?,
        financialRecordId: json['financialRecordId'] as String?,
      );

  static const reasonLabels = {
    'hatchery_extra': 'Hatchery extras (free)',
    'purchase': 'Purchased top-up',
    'correction': 'Count correction',
  };
}
