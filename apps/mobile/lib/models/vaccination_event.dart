class VaccinationEvent {
  final String id;
  final String flockId;
  final String vaccineName;
  final String? vaccineType;
  final DateTime adminDate;
  final String adminMethod;
  final int ageDays;
  final double? costZmw;
  final DateTime? nextDueDate;
  final String? batchNumber;
  final DateTime? expiryDate;
  final String? vaccineInventoryId;
  final String? notes;

  VaccinationEvent({
    required this.id,
    required this.flockId,
    required this.vaccineName,
    this.vaccineType,
    required this.adminDate,
    required this.adminMethod,
    required this.ageDays,
    this.costZmw,
    this.nextDueDate,
    this.batchNumber,
    this.expiryDate,
    this.vaccineInventoryId,
    this.notes,
  });

  factory VaccinationEvent.fromJson(Map<String, dynamic> json) {
    return VaccinationEvent(
      id: json['id'],
      flockId: json['flockId'] ?? json['flock_id'] ?? '',
      vaccineName: json['vaccineName'] ?? json['vaccine_name'] ?? '',
      vaccineType: json['vaccineType'] ?? json['vaccine_type'],
      adminDate: DateTime.parse(json['adminDate'] ?? json['admin_date']),
      adminMethod: json['adminMethod'] ?? json['admin_method'] ?? '',
      ageDays: json['ageDays'] ?? json['age_days'] ?? 0,
      costZmw: _toDouble(json['costZmw'] ?? json['cost_zmw']),
      nextDueDate: json['nextDueDate'] != null || json['next_due_date'] != null
          ? DateTime.tryParse(json['nextDueDate'] ?? json['next_due_date'])
          : null,
      batchNumber: json['batchNumber'] ?? json['batch_number'],
      expiryDate: json['expiryDate'] != null || json['expiry_date'] != null
          ? DateTime.tryParse(json['expiryDate'] ?? json['expiry_date'])
          : null,
      vaccineInventoryId: json['vaccineInventoryId'] ?? json['vaccine_inventory_id'],
      notes: json['notes'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'flockId': flockId,
      'vaccineName': vaccineName,
      'adminDate': adminDate.toIso8601String().split('T').first,
      'adminMethod': adminMethod,
      'ageDays': ageDays,
      if (vaccineType != null && vaccineType!.isNotEmpty) 'vaccineType': vaccineType,
      if (costZmw != null) 'costZmw': costZmw,
      if (nextDueDate != null)
        'nextDueDate': nextDueDate!.toIso8601String().split('T').first,
      if (batchNumber != null && batchNumber!.isNotEmpty) 'batchNumber': batchNumber,
      if (expiryDate != null)
        'expiryDate': expiryDate!.toIso8601String().split('T').first,
      if (vaccineInventoryId != null) 'vaccineInventoryId': vaccineInventoryId,
      if (notes != null && notes!.isNotEmpty) 'notes': notes,
    };
  }

  VaccinationEvent copyWith({
    String? id,
    String? flockId,
    String? vaccineName,
    String? vaccineType,
    DateTime? adminDate,
    String? adminMethod,
    int? ageDays,
    double? costZmw,
    DateTime? nextDueDate,
    String? batchNumber,
    DateTime? expiryDate,
    String? vaccineInventoryId,
    String? notes,
  }) {
    return VaccinationEvent(
      id: id ?? this.id,
      flockId: flockId ?? this.flockId,
      vaccineName: vaccineName ?? this.vaccineName,
      vaccineType: vaccineType ?? this.vaccineType,
      adminDate: adminDate ?? this.adminDate,
      adminMethod: adminMethod ?? this.adminMethod,
      ageDays: ageDays ?? this.ageDays,
      costZmw: costZmw ?? this.costZmw,
      nextDueDate: nextDueDate ?? this.nextDueDate,
      batchNumber: batchNumber ?? this.batchNumber,
      expiryDate: expiryDate ?? this.expiryDate,
      vaccineInventoryId: vaccineInventoryId ?? this.vaccineInventoryId,
      notes: notes ?? this.notes,
    );
  }

  static double? _toDouble(dynamic value) {
    if (value == null) return null;
    return double.tryParse(value.toString());
  }
}
