class EnvironmentalRecord {
  final String id;
  final String flockId;
  final DateTime recordDate;
  final String? timeOfDay;
  final double? temperatureC;
  final double? humidityPct;
  final double? ammoniaPpm;
  final double? lightHours;
  final int? litterScore;
  final String? ventilationNote;
  final String? notes;

  EnvironmentalRecord({
    required this.id,
    required this.flockId,
    required this.recordDate,
    this.timeOfDay,
    this.temperatureC,
    this.humidityPct,
    this.ammoniaPpm,
    this.lightHours,
    this.litterScore,
    this.ventilationNote,
    this.notes,
  });

  factory EnvironmentalRecord.fromJson(Map<String, dynamic> json) {
    return EnvironmentalRecord(
      id: json['id'],
      flockId: json['flockId'] ?? json['flock_id'] ?? '',
      recordDate: DateTime.parse(json['recordDate'] ?? json['record_date']),
      timeOfDay: json['timeOfDay'] ?? json['time_of_day'],
      temperatureC: _toDouble(json['temperatureC'] ?? json['temperature_c']),
      humidityPct: _toDouble(json['humidityPct'] ?? json['humidity_pct']),
      ammoniaPpm: _toDouble(json['ammoniaPpm'] ?? json['ammonia_ppm']),
      lightHours: _toDouble(json['lightHours'] ?? json['light_hours']),
      litterScore: json['litterScore'] ?? json['litter_score'],
      ventilationNote: json['ventilationNote'] ?? json['ventilation_note'],
      notes: json['notes'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'flockId': flockId,
      'recordDate': recordDate.toIso8601String().split('T').first,
      if (timeOfDay != null && timeOfDay!.isNotEmpty) 'timeOfDay': timeOfDay,
      if (temperatureC != null) 'temperatureC': temperatureC,
      if (humidityPct != null) 'humidityPct': humidityPct,
      if (ammoniaPpm != null) 'ammoniaPpm': ammoniaPpm,
      if (lightHours != null) 'lightHours': lightHours,
      if (litterScore != null) 'litterScore': litterScore,
      if (ventilationNote != null && ventilationNote!.isNotEmpty) 'ventilationNote': ventilationNote,
      if (notes != null && notes!.isNotEmpty) 'notes': notes,
    };
  }

  EnvironmentalRecord copyWith({
    String? id,
    String? flockId,
    DateTime? recordDate,
    String? timeOfDay,
    double? temperatureC,
    double? humidityPct,
    double? ammoniaPpm,
    double? lightHours,
    int? litterScore,
    String? ventilationNote,
    String? notes,
  }) {
    return EnvironmentalRecord(
      id: id ?? this.id,
      flockId: flockId ?? this.flockId,
      recordDate: recordDate ?? this.recordDate,
      timeOfDay: timeOfDay ?? this.timeOfDay,
      temperatureC: temperatureC ?? this.temperatureC,
      humidityPct: humidityPct ?? this.humidityPct,
      ammoniaPpm: ammoniaPpm ?? this.ammoniaPpm,
      lightHours: lightHours ?? this.lightHours,
      litterScore: litterScore ?? this.litterScore,
      ventilationNote: ventilationNote ?? this.ventilationNote,
      notes: notes ?? this.notes,
    );
  }

  static double? _toDouble(dynamic value) {
    if (value == null) return null;
    return double.tryParse(value.toString());
  }
}
