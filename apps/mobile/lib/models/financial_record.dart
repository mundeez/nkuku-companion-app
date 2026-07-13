class FinancialRecord {
  final String id;
  final String flockId;
  final DateTime recordDate;
  final String category;
  final String description;
  final double amountZmw;
  final bool isIncome;
  final bool isSystemGenerated;
  final String? notes;

  FinancialRecord({
    required this.id,
    required this.flockId,
    required this.recordDate,
    required this.category,
    required this.description,
    required this.amountZmw,
    this.isIncome = false,
    this.isSystemGenerated = false,
    this.notes,
  });

  factory FinancialRecord.fromJson(Map<String, dynamic> json) {
    return FinancialRecord(
      id: json['id'],
      flockId: json['flockId'] ?? json['flock_id'] ?? '',
      recordDate: DateTime.parse(json['recordDate'] ?? json['record_date']),
      category: json['category'] ?? 'other',
      description: json['description'] ?? '',
      amountZmw: (json['amountZmw'] ?? json['amount_zmw'] ?? 0) is num
          ? (json['amountZmw'] ?? json['amount_zmw'] ?? 0).toDouble()
          : double.tryParse((json['amountZmw'] ?? json['amount_zmw'] ?? 0).toString()) ?? 0,
      isIncome: json['isIncome'] ?? json['is_income'] ?? false,
      isSystemGenerated: json['isSystemGenerated'] ?? json['is_system_generated'] ?? false,
      notes: json['notes'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'flockId': flockId,
      'recordDate': recordDate.toIso8601String().split('T').first,
      'category': category,
      'description': description,
      'amountZmw': amountZmw,
      'isIncome': isIncome,
      if (notes != null && notes!.isNotEmpty) 'notes': notes,
    };
  }

  FinancialRecord copyWith({
    String? id,
    String? flockId,
    DateTime? recordDate,
    String? category,
    String? description,
    double? amountZmw,
    bool? isIncome,
    bool? isSystemGenerated,
    String? notes,
  }) {
    return FinancialRecord(
      id: id ?? this.id,
      flockId: flockId ?? this.flockId,
      recordDate: recordDate ?? this.recordDate,
      category: category ?? this.category,
      description: description ?? this.description,
      amountZmw: amountZmw ?? this.amountZmw,
      isIncome: isIncome ?? this.isIncome,
      isSystemGenerated: isSystemGenerated ?? this.isSystemGenerated,
      notes: notes ?? this.notes,
    );
  }
}
