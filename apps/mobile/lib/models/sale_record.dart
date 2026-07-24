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
      notes: json['notes'],
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
    );
  }
}
