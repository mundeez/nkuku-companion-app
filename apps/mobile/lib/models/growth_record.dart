class GrowthRecord {
  final String id;
  final String flockId;
  final DateTime recordDate;
  final int sampleSize;
  final double avgWeight;
  final String? notes;

  GrowthRecord({
    required this.id,
    required this.flockId,
    required this.recordDate,
    required this.sampleSize,
    required this.avgWeight,
    this.notes,
  });

  factory GrowthRecord.fromJson(Map<String, dynamic> json) {
    return GrowthRecord(
      id: json['id'],
      flockId: json['flockId'] ?? json['flock_id'] ?? '',
      recordDate: DateTime.parse(json['recordDate'] ?? json['record_date']),
      sampleSize: json['sampleSize'] ?? json['sample_size'] ?? 0,
      avgWeight: (json['avgWeight'] ?? json['avg_weight'] ?? 0) is num
          ? (json['avgWeight'] ?? json['avg_weight'] ?? 0).toDouble()
          : double.tryParse((json['avgWeight'] ?? json['avg_weight'] ?? 0).toString()) ?? 0,
      notes: json['notes'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'flockId': flockId,
      'recordDate': recordDate.toIso8601String().split('T').first,
      'sampleSize': sampleSize,
      'avgWeight': avgWeight,
      if (notes != null && notes!.isNotEmpty) 'notes': notes,
    };
  }

  GrowthRecord copyWith({
    String? id,
    String? flockId,
    DateTime? recordDate,
    int? sampleSize,
    double? avgWeight,
    String? notes,
  }) {
    return GrowthRecord(
      id: id ?? this.id,
      flockId: flockId ?? this.flockId,
      recordDate: recordDate ?? this.recordDate,
      sampleSize: sampleSize ?? this.sampleSize,
      avgWeight: avgWeight ?? this.avgWeight,
      notes: notes ?? this.notes,
    );
  }
}
