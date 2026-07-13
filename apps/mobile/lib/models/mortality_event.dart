class MortalityEvent {
  final String id;
  final String flockId;
  final DateTime eventDate;
  final int count;
  final String? cause;
  final int? ageDays;
  final double? costZmw;
  final String? notes;

  MortalityEvent({
    required this.id,
    required this.flockId,
    required this.eventDate,
    required this.count,
    this.cause,
    this.ageDays,
    this.costZmw,
    this.notes,
  });

  factory MortalityEvent.fromJson(Map<String, dynamic> json) {
    return MortalityEvent(
      id: json['id'],
      flockId: json['flockId'] ?? json['flock_id'] ?? '',
      eventDate: DateTime.parse(json['eventDate'] ?? json['event_date']),
      count: json['count'] ?? 0,
      cause: json['cause'],
      ageDays: json['ageDays'] ?? json['age_days'],
      costZmw: _toDouble(json['costZmw'] ?? json['cost_zmw']),
      notes: json['notes'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'flockId': flockId,
      'eventDate': eventDate.toIso8601String().split('T').first,
      'count': count,
      if (cause != null && cause!.isNotEmpty) 'cause': cause,
      if (ageDays != null) 'ageDays': ageDays,
      if (costZmw != null) 'costZmw': costZmw,
      if (notes != null && notes!.isNotEmpty) 'notes': notes,
    };
  }

  MortalityEvent copyWith({
    String? id,
    String? flockId,
    DateTime? eventDate,
    int? count,
    String? cause,
    int? ageDays,
    double? costZmw,
    String? notes,
  }) {
    return MortalityEvent(
      id: id ?? this.id,
      flockId: flockId ?? this.flockId,
      eventDate: eventDate ?? this.eventDate,
      count: count ?? this.count,
      cause: cause ?? this.cause,
      ageDays: ageDays ?? this.ageDays,
      costZmw: costZmw ?? this.costZmw,
      notes: notes ?? this.notes,
    );
  }

  static double? _toDouble(dynamic value) {
    if (value == null) return null;
    return double.tryParse(value.toString());
  }
}
