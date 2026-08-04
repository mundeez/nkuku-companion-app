class DocumentRecord {
  final String id;
  final String? flockId;
  final String recordType;
  final String? recordId;
  final String? financialRecordId;
  final String? journalEntryId;
  final String? saleRecordId;
  final String fileName;
  final String mimeType;
  final int fileSizeKb;
  final String category;
  final String scanStatus;
  final String extractionStatus;
  final String? uploadedBy;
  final DateTime createdAt;
  final String? downloadUrl;

  DocumentRecord({
    required this.id,
    this.flockId,
    required this.recordType,
    this.recordId,
    this.financialRecordId,
    this.journalEntryId,
    this.saleRecordId,
    required this.fileName,
    required this.mimeType,
    required this.fileSizeKb,
    required this.category,
    this.scanStatus = 'pending',
    this.extractionStatus = 'pending',
    this.uploadedBy,
    required this.createdAt,
    this.downloadUrl,
  });

  factory DocumentRecord.fromJson(Map<String, dynamic> json) {
    return DocumentRecord(
      id: json['id'],
      flockId: json['flockId'] ?? json['flock_id'],
      recordType: json['recordType'] ?? json['record_type'] ?? 'flock',
      recordId: json['recordId'] ?? json['record_id'],
      financialRecordId: json['financialRecordId'] ?? json['financial_record_id'],
      journalEntryId: json['journalEntryId'] ?? json['journal_entry_id'],
      saleRecordId: json['saleRecordId'] ?? json['sale_record_id'],
      fileName: json['fileName'] ?? json['file_name'] ?? '',
      mimeType: json['mimeType'] ?? json['mime_type'] ?? '',
      fileSizeKb: json['fileSizeKb'] ?? json['file_size_kb'] ?? 0,
      category: json['category'] ?? 'other',
      scanStatus: json['scanStatus'] ?? json['scan_status'] ?? 'pending',
      extractionStatus: json['extractionStatus'] ?? json['extraction_status'] ?? 'pending',
      uploadedBy: json['uploadedBy'] ?? json['uploaded_by'],
      createdAt: DateTime.parse(json['createdAt'] ?? json['created_at']),
      downloadUrl: json['downloadUrl'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (flockId != null) 'flockId': flockId,
      'recordType': recordType,
      if (recordId != null) 'recordId': recordId,
      if (financialRecordId != null) 'financialRecordId': financialRecordId,
      if (journalEntryId != null) 'journalEntryId': journalEntryId,
      if (saleRecordId != null) 'saleRecordId': saleRecordId,
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
    String? financialRecordId,
    String? journalEntryId,
    String? saleRecordId,
    String? fileName,
    String? mimeType,
    int? fileSizeKb,
    String? category,
    String? scanStatus,
    String? extractionStatus,
    String? uploadedBy,
    DateTime? createdAt,
    String? downloadUrl,
  }) {
    return DocumentRecord(
      id: id ?? this.id,
      flockId: flockId ?? this.flockId,
      recordType: recordType ?? this.recordType,
      recordId: recordId ?? this.recordId,
      financialRecordId: financialRecordId ?? this.financialRecordId,
      journalEntryId: journalEntryId ?? this.journalEntryId,
      saleRecordId: saleRecordId ?? this.saleRecordId,
      fileName: fileName ?? this.fileName,
      mimeType: mimeType ?? this.mimeType,
      fileSizeKb: fileSizeKb ?? this.fileSizeKb,
      category: category ?? this.category,
      scanStatus: scanStatus ?? this.scanStatus,
      extractionStatus: extractionStatus ?? this.extractionStatus,
      uploadedBy: uploadedBy ?? this.uploadedBy,
      createdAt: createdAt ?? this.createdAt,
      downloadUrl: downloadUrl ?? this.downloadUrl,
    );
  }
}
