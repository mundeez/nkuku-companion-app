class WaterRecord {
  final String id;
  final String flockId;
  final DateTime recordDate;
  final double quantityLiters;
  final double? ph;
  final double? temperature;
  final double? costZmw;
  final String? notes;

  WaterRecord({
    required this.id,
    required this.flockId,
    required this.recordDate,
    required this.quantityLiters,
    this.ph,
    this.temperature,
    this.costZmw,
    this.notes,
  });

  factory WaterRecord.fromJson(Map<String, dynamic> json) {
    return WaterRecord(
      id: json['id'],
      flockId: json['flockId'] ?? json['flock_id'] ?? '',
      recordDate: DateTime.parse(json['recordDate'] ?? json['record_date']),
      quantityLiters: (json['quantityLiters'] ?? json['quantity_liters'] ?? 0) is num
          ? (json['quantityLiters'] ?? json['quantity_liters'] ?? 0).toDouble()
          : double.tryParse((json['quantityLiters'] ?? json['quantity_liters'] ?? 0).toString()) ?? 0,
      ph: _toDouble(json['ph']),
      temperature: _toDouble(json['temperature']),
      costZmw: _toDouble(json['costZmw'] ?? json['cost_zmw']),
      notes: json['notes'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'flockId': flockId,
      'recordDate': recordDate.toIso8601String().split('T').first,
      'quantityLiters': quantityLiters,
      if (ph != null) 'ph': ph,
      if (temperature != null) 'temperature': temperature,
      if (costZmw != null) 'costZmw': costZmw,
      if (notes != null && notes!.isNotEmpty) 'notes': notes,
    };
  }

  WaterRecord copyWith({
    String? id,
    String? flockId,
    DateTime? recordDate,
    double? quantityLiters,
    double? ph,
    double? temperature,
    double? costZmw,
    String? notes,
  }) {
    return WaterRecord(
      id: id ?? this.id,
      flockId: flockId ?? this.flockId,
      recordDate: recordDate ?? this.recordDate,
      quantityLiters: quantityLiters ?? this.quantityLiters,
      ph: ph ?? this.ph,
      temperature: temperature ?? this.temperature,
      costZmw: costZmw ?? this.costZmw,
      notes: notes ?? this.notes,
    );
  }

  static double? _toDouble(dynamic value) {
    if (value == null) return null;
    return double.tryParse(value.toString());
  }
}
