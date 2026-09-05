class SaleRecord {
  final String id;
  final String flockId;
  final DateTime saleDate;
  final String? customerName;
  final String? customerPhone;
  final int birdCount;
  final double? avgWeightKg;
  final double pricePerBirdZmw;
  final double totalAmountZmw;
  final String paymentStatus;
  final double? amountPaidZmw;
  final String? notes;
  final String? flockName;

  SaleRecord({
    required this.id,
    required this.flockId,
    required this.saleDate,
    this.customerName,
    this.customerPhone,
    required this.birdCount,
    this.avgWeightKg,
    required this.pricePerBirdZmw,
    required this.totalAmountZmw,
    this.paymentStatus = 'pending',
    this.amountPaidZmw,
    this.notes,
    this.flockName,
  });

  factory SaleRecord.fromJson(Map<String, dynamic> json) {
    return SaleRecord(
      id: json['id'],
      flockId: json['flockId'] ?? json['flock_id'] ?? '',
      saleDate: DateTime.parse(json['saleDate'] ?? json['sale_date']),
      customerName: json['customerName'] ?? json['customer_name'],
      customerPhone: json['customerPhone'] ?? json['customer_phone'],
      birdCount: json['birdCount'] ?? json['bird_count'] ?? 0,
      avgWeightKg: (json['avgWeightKg'] ?? json['avg_weight_kg']) != null
          ? double.tryParse((json['avgWeightKg'] ?? json['avg_weight_kg']).toString())
          : null,
      pricePerBirdZmw:
          double.tryParse((json['pricePerBirdZmw'] ?? json['price_per_bird_zmw'] ?? 0).toString()) ?? 0,
      totalAmountZmw:
          double.tryParse((json['totalAmountZmw'] ?? json['total_amount_zmw'] ?? 0).toString()) ?? 0,
      paymentStatus: json['paymentStatus'] ?? json['payment_status'] ?? 'pending',
      amountPaidZmw: (json['amountPaidZmw'] ?? json['amount_paid_zmw']) != null
          ? double.tryParse((json['amountPaidZmw'] ?? json['amount_paid_zmw']).toString())
          : null,
      notes: _stripFrPrefix(json['notes']),
      flockName: json['flock'] is Map ? json['flock']['name'] : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'flockId': flockId,
      'saleDate': saleDate.toIso8601String().split('T').first,
      if (customerName != null && customerName!.isNotEmpty) 'customerName': customerName,
      if (customerPhone != null && customerPhone!.isNotEmpty) 'customerPhone': customerPhone,
      'birdCount': birdCount,
      if (avgWeightKg != null) 'avgWeightKg': avgWeightKg,
      'pricePerBirdZmw': pricePerBirdZmw,
      'totalAmountZmw': totalAmountZmw,
      'paymentStatus': paymentStatus,
      if (amountPaidZmw != null) 'amountPaidZmw': amountPaidZmw,
      if (notes != null && notes!.isNotEmpty) 'notes': notes,
    };
  }

  SaleRecord copyWith({
    String? id,
    String? flockId,
    DateTime? saleDate,
    String? customerName,
    String? customerPhone,
    int? birdCount,
    double? avgWeightKg,
    double? pricePerBirdZmw,
    double? totalAmountZmw,
    String? paymentStatus,
    double? amountPaidZmw,
    String? notes,
    String? flockName,
  }) {
    return SaleRecord(
      id: id ?? this.id,
      flockId: flockId ?? this.flockId,
      saleDate: saleDate ?? this.saleDate,
      customerName: customerName ?? this.customerName,
      customerPhone: customerPhone ?? this.customerPhone,
      birdCount: birdCount ?? this.birdCount,
      avgWeightKg: avgWeightKg ?? this.avgWeightKg,
      pricePerBirdZmw: pricePerBirdZmw ?? this.pricePerBirdZmw,
      totalAmountZmw: totalAmountZmw ?? this.totalAmountZmw,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      amountPaidZmw: amountPaidZmw ?? this.amountPaidZmw,
      notes: notes ?? this.notes,
      flockName: flockName ?? this.flockName,
    );
  }
}

/// Strip the internal `[FR:<uuid>]` prefix that the API prepends to sale
/// record notes for linking to FinancialRecords. Users should never see it.
String? _stripFrPrefix(dynamic notes) {
  if (notes == null) return null;
  final s = notes.toString();
  // Match [FR:<uuid>] at the start of the string, optionally followed by whitespace
  final match = RegExp(r'^\[FR:[0-9a-fA-F-]{36}\]\s*').firstMatch(s);
  if (match != null) {
    final stripped = s.substring(match.end);
    return stripped.isEmpty ? null : stripped;
  }
  return s;
}
