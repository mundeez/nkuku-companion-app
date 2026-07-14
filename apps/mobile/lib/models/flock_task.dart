class FlockTask {
  final String id;
  final String flockId;
  final DateTime taskDate;
  final int ageDays;
  final String category;
  final String title;
  final String? description;
  final bool isCompleted;
  final bool isSkipped;
  final DateTime? completedAt;
  final String? notes;

  FlockTask({
    required this.id,
    required this.flockId,
    required this.taskDate,
    required this.ageDays,
    required this.category,
    required this.title,
    this.description,
    this.isCompleted = false,
    this.isSkipped = false,
    this.completedAt,
    this.notes,
  });

  factory FlockTask.fromJson(Map<String, dynamic> json) {
    return FlockTask(
      id: json['id'],
      flockId: json['flockId'] ?? json['flock_id'] ?? '',
      taskDate: DateTime.parse(json['taskDate'] ?? json['task_date']),
      ageDays: json['ageDays'] ?? json['age_days'] ?? 0,
      category: json['category'] ?? 'management',
      title: json['title'] ?? '',
      description: json['description'],
      isCompleted: json['isCompleted'] ?? json['is_completed'] ?? false,
      isSkipped: json['isSkipped'] ?? json['is_skipped'] ?? false,
      completedAt: json['completedAt'] != null || json['completed_at'] != null
          ? DateTime.tryParse(json['completedAt'] ?? json['completed_at'])
          : null,
      notes: json['notes'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'flockId': flockId,
      'taskDate': taskDate.toIso8601String().split('T').first,
      'ageDays': ageDays,
      'category': category,
      'title': title,
      if (description != null && description!.isNotEmpty) 'description': description,
      if (notes != null && notes!.isNotEmpty) 'notes': notes,
    };
  }

  FlockTask copyWith({
    String? id,
    String? flockId,
    DateTime? taskDate,
    int? ageDays,
    String? category,
    String? title,
    String? description,
    bool? isCompleted,
    bool? isSkipped,
    DateTime? completedAt,
    String? notes,
  }) {
    return FlockTask(
      id: id ?? this.id,
      flockId: flockId ?? this.flockId,
      taskDate: taskDate ?? this.taskDate,
      ageDays: ageDays ?? this.ageDays,
      category: category ?? this.category,
      title: title ?? this.title,
      description: description ?? this.description,
      isCompleted: isCompleted ?? this.isCompleted,
      isSkipped: isSkipped ?? this.isSkipped,
      completedAt: completedAt ?? this.completedAt,
      notes: notes ?? this.notes,
    );
  }
}
