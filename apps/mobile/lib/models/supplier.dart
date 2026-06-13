class Supplier {
  final String id;
  final String name;
  final String? description;
  final String? chickenType;
  final bool isDefault;
  final List<FeedStage> feedStages;

  Supplier({
    required this.id,
    required this.name,
    this.description,
    this.chickenType,
    required this.isDefault,
    required this.feedStages,
  });

  factory Supplier.fromJson(Map<String, dynamic> json) {
    return Supplier(
      id: json['id'],
      name: json['name'],
      description: json['description'],
      chickenType: json['chickenType'],
      isDefault: json['isDefault'] ?? false,
      feedStages: (json['feedStages'] as List? ?? [])
          .map((e) => FeedStage.fromJson(e))
          .toList(),
    );
  }
}

class FeedStage {
  final String id;
  final String stageName;
  final String stageType;
  final double unitSizeKg;
  final double unitPriceZmw;
  final double intakePerBirdKg;

  FeedStage({
    required this.id,
    required this.stageName,
    required this.stageType,
    required this.unitSizeKg,
    required this.unitPriceZmw,
    required this.intakePerBirdKg,
  });

  factory FeedStage.fromJson(Map<String, dynamic> json) {
    return FeedStage(
      id: json['id'],
      stageName: json['stageName'],
      stageType: json['stageType'],
      unitSizeKg: (json['unitSizeKg'] as num).toDouble(),
      unitPriceZmw: (json['unitPriceZmw'] as num).toDouble(),
      intakePerBirdKg: (json['intakePerBirdKg'] as num).toDouble(),
    );
  }
}

