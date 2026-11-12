import 'dart:developer';
import 'package:dio/dio.dart';
import 'api_service.dart';
import '../models/announcement.dart';

/// Service for platform announcements (P4 super-admin console).
///
/// Follows the BillingService degrade pattern: fetch failures return an
/// empty list rather than throwing, because an announcement banner must
/// never block the home screen. Dismissal is best-effort — the caller
/// hides the card locally regardless of the POST result.
class AnnouncementService {
  /// GET /api/v1/announcements/active — currently-active announcements
  /// for the user's org. Returns [] on any failure (offline, 4xx such as
  /// the route not being deployed yet, malformed body).
  static Future<List<Announcement>> getActive() async {
    try {
      final res =
          await ApiService.dio.get('/api/v1/announcements/active');
      // validateStatus lets <500 through without throwing — check here.
      if (res.statusCode == null || res.statusCode! >= 400) {
        return const [];
      }
      final data = res.data;
      final list = data is List
          ? data
          : (data is Map && data['items'] is List ? data['items'] as List : null);
      if (list == null) {
        return const [];
      }
      return list
          .whereType<Map>()
          .map((e) => Announcement.fromJson(e.cast<String, dynamic>()))
          .toList();
    } on DioException catch (e) {
      log('Failed to load announcements: $e', name: 'AnnouncementService');
      return const [];
    } catch (e) {
      log('Announcement parse error: $e', name: 'AnnouncementService');
      return const [];
    }
  }

  /// POST /api/v1/announcements/:id/dismiss — record the dismissal
  /// server-side. Returns true when the server acknowledged it; callers
  /// hide the card locally either way.
  static Future<bool> dismiss(String id) async {
    try {
      final res = await ApiService.dio
          .post('/api/v1/announcements/$id/dismiss');
      return res.statusCode != null &&
          res.statusCode! >= 200 &&
          res.statusCode! < 300;
    } catch (e) {
      log('Failed to dismiss announcement $id: $e',
          name: 'AnnouncementService');
      return false;
    }
  }
}
