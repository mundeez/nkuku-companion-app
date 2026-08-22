class FeedPurchase {
  final String id;
  final String flockId;
  final String? feedStageId;
  final String? supplierId;
  final String? supplierName;
  final String? stageName;
  final DateTime purchaseDate;
  final double bagSizeKg;
  final int bagsPurchased;
  final double unitPriceZmw;
  final double totalCostZmw;
  final String? notes;

  FeedPurchase({
    required this.id,
    required this.flockId,
    this.feedStageId,
    this.supplierId,
    this.supplierName,
    this.stageName,
    required this.purchaseDate,
    required this.bagSizeKg,
    required this.bagsPurchased,
    required this.unitPriceZmw,
    required this.totalCostZmw,
    this.notes,
  });

  factory FeedPurchase.fromJson(Map<String, dynamic> json) {
    return FeedPurchase(
      id: json['id'] ?? '',
      flockId: json['flockId'] ?? json['flock_id'] ?? '',
      feedStageId: json['feedStageId'] ?? json['feed_stage_id'],
      supplierId: json['supplierId'] ?? json['supplier_id'],
      supplierName: json['supplier']?['name'],
      stageName: json['stageName'] ?? json['stage_name'] ?? json['feedStage']?['stageName'],
      purchaseDate: DateTime.parse(json['purchaseDate'] ?? json['purchase_date']),
      bagSizeKg: _toDouble(json['bagSizeKg'] ?? json['bag_size_kg']) ?? 0,
      bagsPurchased: json['bagsPurchased'] ?? json['bags_purchased'] ?? 0,
      unitPriceZmw: _toDouble(json['unitPriceZmw'] ?? json['unit_price_zmw']) ?? 0,
      totalCostZmw: _toDouble(json['totalCostZmw'] ?? json['total_cost_zmw']) ?? 0,
      notes: json['notes'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'flockId': flockId,
      'purchaseDate': purchaseDate.toIso8601String().split('T').first,
      'stageName': stageName,
      'bagSizeKg': bagSizeKg,
      'bagsPurchased': bagsPurchased,
      'unitPriceZmw': unitPriceZmw,
      if (feedStageId != null) 'feedStageId': feedStageId,
      if (supplierId != null) 'supplierId': supplierId,
      if (notes != null && notes!.isNotEmpty) 'notes': notes,
    };
  }

  FeedPurchase copyWith({
    String? id,
    String? flockId,
    String? feedStageId,
    String? supplierId,
    String? supplierName,
    String? stageName,
    DateTime? purchaseDate,
    double? bagSizeKg,
    int? bagsPurchased,
    double? unitPriceZmw,
    double? totalCostZmw,
    String? notes,
  }) {
    return FeedPurchase(
      id: id ?? this.id,
      flockId: flockId ?? this.flockId,
      feedStageId: feedStageId ?? this.feedStageId,
      supplierId: supplierId ?? this.supplierId,
      supplierName: supplierName ?? this.supplierName,
      stageName: stageName ?? this.stageName,
      purchaseDate: purchaseDate ?? this.purchaseDate,
      bagSizeKg: bagSizeKg ?? this.bagSizeKg,
      bagsPurchased: bagsPurchased ?? this.bagsPurchased,
      unitPriceZmw: unitPriceZmw ?? this.unitPriceZmw,
      totalCostZmw: totalCostZmw ?? this.totalCostZmw,
      notes: notes ?? this.notes,
    );
  }

  static double? _toDouble(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString());
  }
}

class FeedProjection {
  final int initialCount;
  final int currentCount;
  final String? supplierName;
  final List<FeedProjectionStage> stages;
  final FeedProjectionTotals totals;

  FeedProjection({
    required this.initialCount,
    required this.currentCount,
    this.supplierName,
    required this.stages,
    required this.totals,
  });

  factory FeedProjection.fromJson(Map<String, dynamic> json) {
    return FeedProjection(
      initialCount: json['initialCount'] ?? json['initial_count'] ?? 0,
      currentCount: json['currentCount'] ?? json['current_count'] ?? 0,
      supplierName: json['supplierName'] ?? json['supplier_name'],
      stages: (json['stages'] as List? ?? [])
          .map((e) => FeedProjectionStage.fromJson(e))
          .toList(),
      totals: FeedProjectionTotals.fromJson(json['totals'] ?? {}),
    );
  }
}

class FeedProjectionStage {
  final String feedStageId;
  final String stageName;
  final int? dayRangeStart;
  final int? dayRangeEnd;
  final double bagSizeKg;
  final double unitPriceZmw;
  final int bagsRequired;
  final int bagsPurchased;
  final int bagsRemaining;
  final double projectedCostZmw;
  final String status;

  FeedProjectionStage({
    required this.feedStageId,
    required this.stageName,
    this.dayRangeStart,
    this.dayRangeEnd,
    required this.bagSizeKg,
    required this.unitPriceZmw,
    required this.bagsRequired,
    required this.bagsPurchased,
    required this.bagsRemaining,
    required this.projectedCostZmw,
    required this.status,
  });

  factory FeedProjectionStage.fromJson(Map<String, dynamic> json) {
    return FeedProjectionStage(
      feedStageId: json['feedStageId'] ?? json['feed_stage_id'] ?? '',
      stageName: json['stageName'] ?? json['stage_name'] ?? '',
      dayRangeStart: json['dayRangeStart'] ?? json['day_range_start'],
      dayRangeEnd: json['dayRangeEnd'] ?? json['day_range_end'],
      bagSizeKg: FeedPurchase._toDouble(json['bagSizeKg'] ?? json['bag_size_kg']) ?? 0,
      unitPriceZmw: FeedPurchase._toDouble(json['unitPriceZmw'] ?? json['unit_price_zmw']) ?? 0,
      bagsRequired: json['bagsRequired'] ?? json['bags_required'] ?? 0,
      bagsPurchased: json['bagsPurchased'] ?? json['bags_purchased'] ?? 0,
      bagsRemaining: json['bagsRemaining'] ?? json['bags_remaining'] ?? 0,
      projectedCostZmw: FeedPurchase._toDouble(json['projectedCostZmw'] ?? json['projected_cost_zmw']) ?? 0,
      status: json['status'] ?? 'not_started',
    );
  }
}

class FeedProjectionTotals {
  final int bagsRequired;
  final int bagsPurchased;
  final int bagsRemaining;
  final double projectedCostZmw;

  FeedProjectionTotals({
    required this.bagsRequired,
    required this.bagsPurchased,
    required this.bagsRemaining,
    required this.projectedCostZmw,
  });

  factory FeedProjectionTotals.fromJson(Map<String, dynamic> json) {
    return FeedProjectionTotals(
      bagsRequired: json['bagsRequired'] ?? json['bags_required'] ?? 0,
      bagsPurchased: json['bagsPurchased'] ?? json['bags_purchased'] ?? 0,
      bagsRemaining: json['bagsRemaining'] ?? json['bags_remaining'] ?? 0,
      projectedCostZmw: FeedPurchase._toDouble(json['projectedCostZmw'] ?? json['projected_cost_zmw']) ?? 0,
    );
  }
}
