import 'dart:developer';
import 'api_service.dart';

/// Ad serving client — mirrors apps/web/src/lib/api/client.ts's ad
/// functions. See docs/ADVERTISING_PLAN.md.
class AdCampaign {
  final String id;
  final String advertiserName;
  final String creativeImageUrl;
  final String targetUrl;
  final String altText;
  final String placement;

  AdCampaign({
    required this.id,
    required this.advertiserName,
    required this.creativeImageUrl,
    required this.targetUrl,
    required this.altText,
    required this.placement,
  });

  factory AdCampaign.fromJson(Map<String, dynamic> json) => AdCampaign(
        id: json['id'] as String,
        advertiserName: json['advertiserName'] as String,
        creativeImageUrl: json['creativeImageUrl'] as String,
        targetUrl: json['targetUrl'] as String,
        altText: json['altText'] as String,
        placement: json['placement'] as String,
      );
}

class AdServeResult {
  final String source; // 'none' | 'house' | 'network'
  final AdCampaign? campaign;

  AdServeResult({required this.source, this.campaign});

  factory AdServeResult.fromJson(Map<String, dynamic> json) => AdServeResult(
        source: json['source'] as String,
        campaign: json['campaign'] != null
            ? AdCampaign.fromJson(json['campaign'] as Map<String, dynamic>)
            : null,
      );
}

class AdService {
  static Future<AdServeResult> serve(String page, String placement) async {
    try {
      final res =
          await ApiService.dio.get('/api/v1/ads/serve', queryParameters: {
        'page': page,
        'placement': placement,
      });
      if (res.statusCode != 200) return AdServeResult(source: 'none');
      return AdServeResult.fromJson(res.data as Map<String, dynamic>);
    } catch (e) {
      log('Failed to fetch ad: $e', name: 'AdService');
      return AdServeResult(source: 'none');
    }
  }

  static Future<void> recordImpression(String campaignId, String page) async {
    try {
      await ApiService.dio.post('/api/v1/ads/$campaignId/impression',
          queryParameters: {'page': page}, data: {});
    } catch (e) {
      log('Failed to record ad impression: $e', name: 'AdService');
    }
  }

  static String clickUrl(String campaignId, String page) {
    return '${ApiService.baseUrl}/api/v1/ads/$campaignId/click?page=$page';
  }
}
