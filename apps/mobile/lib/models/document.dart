class DocumentRecord {
  final String id;
  final String? flockId;
  final String recordType;
  final String? recordId;
  final String fileName;
  final String mimeType;
  final int fileSizeKb;
  final String category;
  final String? uploadedBy;
  final DateTime createdAt;

  DocumentRecord({
    required this.id,
    this.flockId,
    required this.recordType,
    this.recordId,
    required this.fileName,
    required this.mimeType,
    required this.fileSizeKb,
    required this.category,
    this.uploadedBy,
    required this.createdAt,
  });

  factory DocumentRecord.fromJson(Map<String, dynamic> json) {
    return DocumentRecord(
      id: json['id'],
      flockId: json['flockId'] ?? json['flock_id'],
      recordType: json['recordType'] ?? json['record_type'] ?? 'flock',
      recordId: json['recordId'] ?? json['record_id'],
      fileName: json['fileName'] ?? json['file_name'] ?? '',
      mimeType: json['mimeType'] ?? json['mime_type'] ?? '',
      fileSizeKb: json['fileSizeKb'] ?? json['file_size_kb'] ?? 0,
      category: json['category'] ?? 'other',
      uploadedBy: json['uploadedBy'] ?? json['uploaded_by'],
      createdAt: DateTime.parse(json['createdAt'] ?? json['created_at']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (flockId != null) 'flockId': flockId,
      'recordType': recordType,
      if (recordId != null) 'recordId': recordId,
      'fileName': fileName,
      'mimeType': mimeType,
      'fileSizeKb': fileSizeKb,
      'category': category,
      if (uploadedBy != null) 'uploadedBy': uploadedBy,
    };
  }

  DocumentRecord copyWith({
    String? id,
    String? flockId,
    String? recordType,
    String? recordId,
    String? fileName,
    String? mimeType,
    int? fileSizeKb,
    String? category,
    String? uploadedBy,
    DateTime? createdAt,
  }) {
    return DocumentRecord(
      id: id ?? this.id,
      flockId: flockId ?? this.flockId,
      recordType: recordType ?? this.recordType,
      recordId: recordId ?? this.recordId,
      fileName: fileName ?? this.fileName,
      mimeType: mimeType ?? this.mimeType,
      fileSizeKb: fileSizeKb ?? this.fileSizeKb,
      category: category ?? this.category,
      uploadedBy: uploadedBy ?? this.uploadedBy,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}
