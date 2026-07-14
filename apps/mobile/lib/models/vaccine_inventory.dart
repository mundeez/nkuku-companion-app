import 'package:flutter/material.dart';

class VaccineInventory {
  final String id;
  final String name;
  final String? disease;
  final String? supplier;
  final String batchNumber;
  final int quantityDoses;
  final DateTime expiryDate;
  final String status;
  final double? costZmw;
  final String? notes;
  final DateTime? createdAt;

  VaccineInventory({
    required this.id,
    required this.name,
    this.disease,
    this.supplier,
    required this.batchNumber,
    required this.quantityDoses,
    required this.expiryDate,
    required this.status,
    this.costZmw,
    this.notes,
    this.createdAt,
  });

  factory VaccineInventory.fromJson(Map<String, dynamic> json) {
    return VaccineInventory(
      id: json['id'],
      name: json['name'] ?? '',
      disease: json['disease'],
      supplier: json['supplier'],
      batchNumber: json['batchNumber'] ?? json['batch_number'] ?? '',
      quantityDoses: json['quantityDoses'] ?? json['quantity_doses'] ?? 0,
      expiryDate: DateTime.parse(json['expiryDate'] ?? json['expiry_date']),
      status: json['status'] ?? 'available',
      costZmw: _toDouble(json['costZmw'] ?? json['cost_zmw']),
      notes: json['notes'],
      createdAt: json['createdAt'] != null || json['created_at'] != null
          ? DateTime.tryParse(json['createdAt'] ?? json['created_at'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'batchNumber': batchNumber,
      'quantityDoses': quantityDoses,
      'expiryDate': expiryDate.toIso8601String().split('T').first,
      'status': status,
      if (disease != null && disease!.isNotEmpty) 'disease': disease,
      if (supplier != null && supplier!.isNotEmpty) 'supplier': supplier,
      if (costZmw != null) 'costZmw': costZmw,
      if (notes != null && notes!.isNotEmpty) 'notes': notes,
    };
  }

  VaccineInventory copyWith({
    String? id,
    String? name,
    String? disease,
    String? supplier,
    String? batchNumber,
    int? quantityDoses,
    DateTime? expiryDate,
    String? status,
    double? costZmw,
    String? notes,
    DateTime? createdAt,
  }) {
    return VaccineInventory(
      id: id ?? this.id,
      name: name ?? this.name,
      disease: disease ?? this.disease,
      supplier: supplier ?? this.supplier,
      batchNumber: batchNumber ?? this.batchNumber,
      quantityDoses: quantityDoses ?? this.quantityDoses,
      expiryDate: expiryDate ?? this.expiryDate,
      status: status ?? this.status,
      costZmw: costZmw ?? this.costZmw,
      notes: notes ?? this.notes,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  bool get isExpired => expiryDate.isBefore(DateTime.now());

  bool get isExpiringSoon =>
      !isExpired &&
      expiryDate.isBefore(DateTime.now().add(const Duration(days: 7)));

  Color get statusColor {
    switch (status) {
      case 'available':
        return Colors.green;
      case 'in_use':
        return Colors.blue;
      case 'expired':
        return Colors.red;
      case 'depleted':
        return Colors.grey;
      default:
        return Colors.grey;
    }
  }

  static double? _toDouble(dynamic value) {
    if (value == null) return null;
    return double.tryParse(value.toString());
  }
}
