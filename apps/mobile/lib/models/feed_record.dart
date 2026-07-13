class FeedRecord {
  final String id;
  final String flockId;
  final String? supplierId;
  final String? supplierName;
  final DateTime recordDate;
  final String feedType;
  final String? feedBrand;
  final double quantityKg;
  final double? costZmw;
  final String? notes;

  FeedRecord({
    required this.id,
    required this.flockId,
    this.supplierId,
    this.supplierName,
    required this.recordDate,
    required this.feedType,
    this.feedBrand,
    required this.quantityKg,
    this.costZmw,
    this.notes,
  });

  factory FeedRecord.fromJson(Map<String, dynamic> json) {
    return FeedRecord(
      id: json['id'],
      flockId: json['flockId'] ?? json['flock_id'] ?? '',
      supplierId: json['supplierId'] ?? json['supplier_id'],
      supplierName: json['supplier']?['name'],
      recordDate: DateTime.parse(json['recordDate'] ?? json['record_date']),
      feedType: json['feedType'] ?? json['feed_type'] ?? '',
      feedBrand: json['feedBrand'] ?? json['feed_brand'],
      quantityKg: (json['quantityKg'] ?? json['quantity_kg'] ?? 0) is num
          ? (json['quantityKg'] ?? json['quantity_kg'] ?? 0).toDouble()
          : double.tryParse((json['quantityKg'] ?? json['quantity_kg'] ?? 0).toString()) ?? 0,
      costZmw: _toDouble(json['costZmw'] ?? json['cost_zmw']),
      notes: json['notes'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'flockId': flockId,
      'recordDate': recordDate.toIso8601String().split('T').first,
      'feedType': feedType,
      'quantityKg': quantityKg,
      if (supplierId != null) 'supplierId': supplierId,
      if (feedBrand != null && feedBrand!.isNotEmpty) 'feedBrand': feedBrand,
      if (costZmw != null) 'costZmw': costZmw,
      if (notes != null && notes!.isNotEmpty) 'notes': notes,
    };
  }

  FeedRecord copyWith({
    String? id,
    String? flockId,
    String? supplierId,
    String? supplierName,
    DateTime? recordDate,
    String? feedType,
    String? feedBrand,
    double? quantityKg,
    double? costZmw,
    String? notes,
  }) {
    return FeedRecord(
      id: id ?? this.id,
      flockId: flockId ?? this.flockId,
      supplierId: supplierId ?? this.supplierId,
      supplierName: supplierName ?? this.supplierName,
      recordDate: recordDate ?? this.recordDate,
      feedType: feedType ?? this.feedType,
      feedBrand: feedBrand ?? this.feedBrand,
      quantityKg: quantityKg ?? this.quantityKg,
      costZmw: costZmw ?? this.costZmw,
      notes: notes ?? this.notes,
    );
  }

  static double? _toDouble(dynamic value) {
    if (value == null) return null;
    return double.tryParse(value.toString());
  }
}
