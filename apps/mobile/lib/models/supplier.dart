class Supplier {
  final String id;
  final String name;
  final String? description;
  final String? chickenType;
  final String? contact;
  final bool isActive;
  final bool isDefault;
  final List<FeedStage> feedStages;

  Supplier({
    required this.id,
    required this.name,
    this.description,
    this.chickenType,
    this.contact,
    this.isActive = true,
    required this.isDefault,
    required this.feedStages,
  });

  factory Supplier.fromJson(Map<String, dynamic> json) {
    return Supplier(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'],
      chickenType: json['chickenType'] ?? json['chicken_type'],
      contact: json['contact'],
      isActive: json['isActive'] ?? json['is_active'] ?? true,
      isDefault: json['isDefault'] ?? json['is_default'] ?? false,
      feedStages:
          (json['feedStages'] as List? ?? json['feed_stages'] as List? ?? [])
              .map((e) => FeedStage.fromJson(e))
              .toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      if (description != null && description!.isNotEmpty)
        'description': description,
      if (chickenType != null && chickenType!.isNotEmpty)
        'chickenType': chickenType,
      if (contact != null && contact!.isNotEmpty) 'contact': contact,
      'isActive': isActive,
      'isDefault': isDefault,
    };
  }

  Supplier copyWith({
    String? id,
    String? name,
    String? description,
    String? chickenType,
    String? contact,
    bool? isActive,
    bool? isDefault,
    List<FeedStage>? feedStages,
  }) {
    return Supplier(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      chickenType: chickenType ?? this.chickenType,
      contact: contact ?? this.contact,
      isActive: isActive ?? this.isActive,
      isDefault: isDefault ?? this.isDefault,
      feedStages: feedStages ?? this.feedStages,
    );
  }
}

class FeedStage {
  final String id;
  final String stageName;
  final String stageType;
  final int? dayRangeStart;
  final int? dayRangeEnd;
  final double unitSizeKg;
  final double unitPriceZmw;
  final double intakePerBirdKg;
  final int sortOrder;
  final bool isActive;

  FeedStage({
    required this.id,
    required this.stageName,
    required this.stageType,
    this.dayRangeStart,
    this.dayRangeEnd,
    required this.unitSizeKg,
    required this.unitPriceZmw,
    required this.intakePerBirdKg,
    this.sortOrder = 0,
    this.isActive = true,
  });

  factory FeedStage.fromJson(Map<String, dynamic> json) {
    return FeedStage(
      id: json['id'] ?? '',
      stageName: json['stageName'] ?? json['stage_name'] ?? '',
      stageType: json['stageType'] ?? json['stage_type'] ?? 'feed',
      dayRangeStart: json['dayRangeStart'] ?? json['day_range_start'],
      dayRangeEnd: json['dayRangeEnd'] ?? json['day_range_end'],
      unitSizeKg: _toDouble(json['unitSizeKg'] ?? json['unit_size_kg']) ?? 0,
      unitPriceZmw:
          _toDouble(json['unitPriceZmw'] ?? json['unit_price_zmw']) ?? 0,
      intakePerBirdKg:
          _toDouble(json['intakePerBirdKg'] ?? json['intake_per_bird_kg']) ?? 0,
      sortOrder: json['sortOrder'] ?? json['sort_order'] ?? 0,
      isActive: json['isActive'] ?? json['is_active'] ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'stageName': stageName,
      'stageType': stageType,
      if (dayRangeStart != null) 'dayRangeStart': dayRangeStart,
      if (dayRangeEnd != null) 'dayRangeEnd': dayRangeEnd,
      'unitSizeKg': unitSizeKg,
      'unitPriceZmw': unitPriceZmw,
      'intakePerBirdKg': intakePerBirdKg,
      'sortOrder': sortOrder,
      'isActive': isActive,
    };
  }

  FeedStage copyWith({
    String? id,
    String? stageName,
    String? stageType,
    int? dayRangeStart,
    int? dayRangeEnd,
    double? unitSizeKg,
    double? unitPriceZmw,
    double? intakePerBirdKg,
    int? sortOrder,
    bool? isActive,
  }) {
    return FeedStage(
      id: id ?? this.id,
      stageName: stageName ?? this.stageName,
      stageType: stageType ?? this.stageType,
      dayRangeStart: dayRangeStart ?? this.dayRangeStart,
      dayRangeEnd: dayRangeEnd ?? this.dayRangeEnd,
      unitSizeKg: unitSizeKg ?? this.unitSizeKg,
      unitPriceZmw: unitPriceZmw ?? this.unitPriceZmw,
      intakePerBirdKg: intakePerBirdKg ?? this.intakePerBirdKg,
      sortOrder: sortOrder ?? this.sortOrder,
      isActive: isActive ?? this.isActive,
    );
  }

  static double? _toDouble(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString());
  }
}
