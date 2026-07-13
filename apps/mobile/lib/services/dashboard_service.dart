import 'dart:developer';
import 'api_service.dart';
import '../models/dashboard_summary.dart';

class DashboardService {
  static Future<DashboardSummary> fetchSummary() async {
    try {
      final res = await ApiService.dio.get('/api/v1/dashboard/summary');
      return DashboardSummary.fromJson(res.data as Map<String, dynamic>);
    } catch (e) {
      log('Failed to fetch dashboard summary: $e', name: 'DashboardService');
      rethrow;
    }
  }
}
