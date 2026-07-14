import 'package:dio/dio.dart';
import '../models/supplier.dart';
import 'api_service.dart';

class SupplierServiceException implements Exception {
  final String message;
  SupplierServiceException(this.message);

  @override
  String toString() => message;
}

class SupplierService {
  static void _assertOk(Response res) {
    final status = res.statusCode;
    if (status != null && status >= 200 && status < 300) return;
    throw SupplierServiceException('Request failed with status $status');
  }

  static Future<List<Supplier>> getAll() async {
    final res = await ApiService.dio.get('/api/v1/suppliers');
    _assertOk(res);
    return (res.data as List).map((e) => Supplier.fromJson(e)).toList();
  }

  static Future<Supplier> create(Map<String, dynamic> body) async {
    final res = await ApiService.dio.post('/api/v1/suppliers', data: body);
    _assertOk(res);
    final data = res.data is Map<String, dynamic>
        ? res.data as Map<String, dynamic>
        : <String, dynamic>{'id': '${res.data}'};
    return Supplier.fromJson(data);
  }

  static Future<Supplier> update(String id, Map<String, dynamic> body) async {
    final res = await ApiService.dio.patch('/api/v1/suppliers/$id', data: body);
    _assertOk(res);
    final data = res.data is Map<String, dynamic>
        ? res.data as Map<String, dynamic>
        : <String, dynamic>{'id': id};
    return Supplier.fromJson(data);
  }

  static Future<void> delete(String id) async {
    final res = await ApiService.dio.delete('/api/v1/suppliers/$id');
    _assertOk(res);
  }

  static Future<FeedStage> createFeedStage(Map<String, dynamic> body) async {
    final res = await ApiService.dio.post('/api/v1/feed-stages', data: body);
    _assertOk(res);
    final data = res.data is Map<String, dynamic>
        ? res.data as Map<String, dynamic>
        : <String, dynamic>{};
    return FeedStage.fromJson(data);
  }

  static Future<FeedStage> updateFeedStage(
      String id, Map<String, dynamic> body) async {
    final res =
        await ApiService.dio.patch('/api/v1/feed-stages/$id', data: body);
    _assertOk(res);
    final data = res.data is Map<String, dynamic>
        ? res.data as Map<String, dynamic>
        : <String, dynamic>{'id': id};
    return FeedStage.fromJson(data);
  }

  static Future<void> deleteFeedStage(String id) async {
    final res = await ApiService.dio.delete('/api/v1/feed-stages/$id');
    _assertOk(res);
  }
}
