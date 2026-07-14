import 'dart:developer';
import 'package:dio/dio.dart';
import '../models/vaccine_inventory.dart';
import 'api_service.dart';

class VaccineInventoryServiceException implements Exception {
  final String message;
  VaccineInventoryServiceException(this.message);
  @override
  String toString() => message;
}

class VaccineInventoryService {
  static Future<List<VaccineInventory>> getAll({String? status}) async {
    final res = await ApiService.dio.get(
      '/api/v1/vaccine-inventory',
      queryParameters: {if (status != null) 'status': status},
    );
    _assertOk(res);
    final data = res.data;
    if (data is Map && data['error'] != null) {
      throw VaccineInventoryServiceException(data['error'].toString());
    }
    final list = data is List ? data : data['items'] ?? data['data'] ?? [];
    return (list as List).map((e) => VaccineInventory.fromJson(e)).toList();
  }

  static Future<VaccineInventory> create(Map<String, dynamic> body) async {
    final res =
        await ApiService.dio.post('/api/v1/vaccine-inventory', data: body);
    _assertOk(res);
    final data = res.data is Map && res.data['vaccine'] != null
        ? res.data['vaccine']
        : res.data;
    return VaccineInventory.fromJson(data);
  }

  static Future<VaccineInventory> update(
      String id, Map<String, dynamic> body) async {
    final res =
        await ApiService.dio.patch('/api/v1/vaccine-inventory/$id', data: body);
    _assertOk(res);
    final data = res.data is Map && res.data['vaccine'] != null
        ? res.data['vaccine']
        : res.data;
    return VaccineInventory.fromJson(data);
  }

  static Future<void> delete(String id) async {
    final res = await ApiService.dio.delete('/api/v1/vaccine-inventory/$id');
    _assertOk(res);
  }

  static void _assertOk(Response res) {
    if (res.statusCode == null ||
        res.statusCode! < 200 ||
        res.statusCode! >= 300) {
      log('VaccineInventoryService error: ${res.statusCode} ${res.data}');
      throw VaccineInventoryServiceException(
          'Request failed: ${res.statusCode}');
    }
  }
}
