/// Lightweight reference to a disease entry from the disease database.
/// Returned embedded on mortality events, vaccination schedule items and
/// disease-insight suggestions (Phase F — disease↔flock integration).
class DiseaseRef {
  final String id;
  final String name;
  final String category;

  DiseaseRef({
    required this.id,
    required this.name,
    this.category = '',
  });

  factory DiseaseRef.fromJson(Map<String, dynamic> json) {
    return DiseaseRef(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      category: json['category']?.toString() ?? '',
    );
  }

  /// Parses a `disease` field that may be a nested object or null.
  static DiseaseRef? maybeFromJson(dynamic value) {
    if (value is Map<String, dynamic>) return DiseaseRef.fromJson(value);
    if (value is Map) {
      return DiseaseRef.fromJson(Map<String, dynamic>.from(value));
    }
    return null;
  }
}
