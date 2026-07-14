class MedicationRecord {
  final String id;
  final String flockId;
  final DateTime recordDate;
  final String productName;
  final String category;
  final String? dose;
  final String? route;
  final DateTime startDate;
  final DateTime? endDate;
  final int? withdrawalDays;
  final DateTime? withdrawalDate;
  final double? costZmw;
  final String? veterinarian;
  final String? notes;

  MedicationRecord({
    required this.id,
    required this.flockId,
    required this.recordDate,
    required this.productName,
    required this.category,
    this.dose,
    this.route,
    required this.startDate,
    this.endDate,
    this.withdrawalDays,
    this.withdrawalDate,
    this.costZmw,
    this.veterinarian,
    this.notes,
  });

  factory MedicationRecord.fromJson(Map<String, dynamic> json) {
    return MedicationRecord(
      id: json['id'],
      flockId: json['flockId'] ?? json['flock_id'] ?? '',
      recordDate: DateTime.parse(json['recordDate'] ?? json['record_date']),
      productName: json['productName'] ?? json['product_name'] ?? '',
      category: json['category'] ?? 'other',
      dose: json['dose'],
      route: json['route'],
      startDate: DateTime.parse(json['startDate'] ?? json['start_date']),
      endDate: json['endDate'] != null || json['end_date'] != null
          ? DateTime.tryParse(json['endDate'] ?? json['end_date'])
          : null,
      withdrawalDays: json['withdrawalDays'] ?? json['withdrawal_days'],
      withdrawalDate: json['withdrawalDate'] != null || json['withdrawal_date'] != null
          ? DateTime.tryParse(json['withdrawalDate'] ?? json['withdrawal_date'])
          : null,
      costZmw: _toDouble(json['costZmw'] ?? json['cost_zmw']),
      veterinarian: json['veterinarian'],
      notes: json['notes'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'flockId': flockId,
      'recordDate': recordDate.toIso8601String().split('T').first,
      'productName': productName,
      'category': category,
      'startDate': startDate.toIso8601String().split('T').first,
      if (dose != null && dose!.isNotEmpty) 'dose': dose,
      if (route != null && route!.isNotEmpty) 'route': route,
      if (endDate != null) 'endDate': endDate!.toIso8601String().split('T').first,
      if (withdrawalDays != null) 'withdrawalDays': withdrawalDays,
      if (costZmw != null) 'costZmw': costZmw,
      if (veterinarian != null && veterinarian!.isNotEmpty) 'veterinarian': veterinarian,
      if (notes != null && notes!.isNotEmpty) 'notes': notes,
    };
  }

  MedicationRecord copyWith({
    String? id,
    String? flockId,
    DateTime? recordDate,
    String? productName,
    String? category,
    String? dose,
    String? route,
    DateTime? startDate,
    DateTime? endDate,
    int? withdrawalDays,
    DateTime? withdrawalDate,
    double? costZmw,
    String? veterinarian,
    String? notes,
  }) {
    return MedicationRecord(
      id: id ?? this.id,
      flockId: flockId ?? this.flockId,
      recordDate: recordDate ?? this.recordDate,
      productName: productName ?? this.productName,
      category: category ?? this.category,
      dose: dose ?? this.dose,
      route: route ?? this.route,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      withdrawalDays: withdrawalDays ?? this.withdrawalDays,
      withdrawalDate: withdrawalDate ?? this.withdrawalDate,
      costZmw: costZmw ?? this.costZmw,
      veterinarian: veterinarian ?? this.veterinarian,
      notes: notes ?? this.notes,
    );
  }

  static double? _toDouble(dynamic value) {
    if (value == null) return null;
    return double.tryParse(value.toString());
  }
}
