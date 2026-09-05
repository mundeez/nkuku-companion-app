import 'dart:developer';
import 'package:dio/dio.dart';
import '../models/breed.dart';
import '../models/document.dart';
import '../models/environmental_record.dart';
import '../models/financial_record.dart';
import '../models/feed_record.dart';
import '../models/feed_purchase.dart';
import '../models/flock.dart';
import '../models/flock_task.dart';
import '../models/growth_record.dart';
import '../models/medication_record.dart';
import '../models/mortality_event.dart';
import '../models/sale_record.dart';
import '../models/sales_filter.dart';
import '../models/supplier.dart';
import '../models/vaccination_event.dart';
import '../models/water_record.dart';
import 'api_cache.dart';
import 'api_service.dart';
import 'connectivity_service.dart';
import 'offline_cache.dart';

class BroilerServiceException implements Exception {
  final String message;
  BroilerServiceException(this.message);
  @override
  String toString() => message;
}

class BroilerService {
  // Flocks
  //
  // Cached briefly (session-only, see ApiCache) since the flock list is
  // fetched on every visit to the Flocks tab and the Dashboard — a 30s TTL
  // means switching tabs back and forth doesn't always re-hit the network,
  // while still staying fresh enough after a create/edit/delete (which also
  // explicitly invalidates this cache below).
  //
  // When offline, falls back to the persisted offline cache.
  static Future<List<BroilerFlock>> getFlocks({
    String? status,
    bool forceRefresh = false,
  }) async {
    final cacheKey = 'flocks:${status ?? 'all'}';
    if (forceRefresh) ApiCache.invalidate(cacheKey);
    try {
      final flocks = await ApiCache.fetch(
        cacheKey,
        () async {
          final res = await ApiService.dio.get(
            '/api/v1/broiler-flocks',
            queryParameters: {if (status != null) 'status': status},
          );
          _assertOk(res);
          return (res.data as List).map((e) => BroilerFlock.fromJson(e)).toList();
        },
        ttl: const Duration(seconds: 30),
      );
      // Persist to offline cache for offline access.
      ConnectivityService.instance.markOnline();
      await OfflineCache.instance.cacheFlocks(
        flocks.map((f) => f.toJson()).toList(),
      );
      return flocks;
    } catch (e) {
      if (e is DioException && _isNetworkError(e)) {
        ConnectivityService.instance.markOffline();
        // Fall back to offline cache.
        final cached = await OfflineCache.instance.getCachedFlocksAsync();
        if (cached.isNotEmpty) {
          var flocks = cached.map((e) => BroilerFlock.fromJson(e)).toList();
          if (status != null) {
            flocks = flocks.where((f) => f.status == status).toList();
          }
          return flocks;
        }
      }
      rethrow;
    }
  }

  static Future<BroilerFlock> getFlock(String id) async {
    final res = await ApiService.dio.get('/api/v1/broiler-flocks/$id');
    _assertOk(res);
    final payload = res.data['flock'] ?? res.data;
    return BroilerFlock.fromJson(payload);
  }

  static Future<BroilerFlock> createFlock(BroilerFlock flock) async {
    if (!ConnectivityService.instance.isOnline) {
      // Queue for later sync.
      await OfflineCache.instance.enqueueSync(
        entityType: 'flock',
        operation: 'create',
        payload: flock.toJson(),
      );
      // Return a temporary local copy so the UI can proceed.
      return flock.copyWith(id: 'pending_${DateTime.now().millisecondsSinceEpoch}');
    }
    final res = await ApiService.dio
        .post('/api/v1/broiler-flocks', data: flock.toJson());
    _assertOk(res);
    ConnectivityService.instance.markOnline();
    ApiCache.invalidatePrefix('flocks:');
    return BroilerFlock.fromJson(res.data);
  }

  static Future<BroilerFlock> updateFlock(
      String id, Map<String, dynamic> data) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'flock',
        operation: 'update',
        entityId: id,
        payload: data,
      );
      return BroilerFlock.fromJson({'id': id, ...data});
    }
    final res =
        await ApiService.dio.patch('/api/v1/broiler-flocks/$id', data: data);
    _assertOk(res);
    ConnectivityService.instance.markOnline();
    ApiCache.invalidatePrefix('flocks:');
    return BroilerFlock.fromJson(res.data);
  }

  static Future<void> deleteFlock(String id) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'flock',
        operation: 'delete',
        entityId: id,
        payload: {},
      );
      ApiCache.invalidatePrefix('flocks:');
      return;
    }
    final res = await ApiService.dio.delete('/api/v1/broiler-flocks/$id');
    _assertOk(res);
    ConnectivityService.instance.markOnline();
    ApiCache.invalidatePrefix('flocks:');
  }

  // Breeds / Suppliers
  //
  // Breeds are close to static reference data (Ross 308, Cobb 500, etc.) —
  // safe to cache for the whole session.
  static Future<List<Breed>> getBreeds() async {
    return ApiCache.fetch(
      'breeds',
      () async {
        final res = await ApiService.dio.get('/api/v1/breeds');
        _assertOk(res);
        return (res.data as List).map((e) => Breed.fromJson(e)).toList();
      },
      ttl: const Duration(minutes: 30),
    );
  }

  static Future<List<Supplier>> getSuppliers() async {
    final res = await ApiService.dio.get('/api/v1/suppliers');
    _assertOk(res);
    return (res.data as List).map((e) => Supplier.fromJson(e)).toList();
  }

  // Growth records
  static Future<List<GrowthRecord>> getGrowthRecords(String flockId) async {
    final res = await ApiService.dio.get(
      '/api/v1/growth-records',
      queryParameters: {'flockId': flockId},
    );
    _assertOk(res);
    if (res.data is Map && res.data['error'] != null)
      throw BroilerServiceException(res.data['error']);
    return (res.data as List).map((e) => GrowthRecord.fromJson(e)).toList();
  }

  static Future<GrowthRecordAnalysis> getGrowthAnalysis(String flockId) async {
    final res = await ApiService.dio.get(
      '/api/v1/growth-records/analysis',
      queryParameters: {'flockId': flockId},
    );
    _assertOk(res);
    return GrowthRecordAnalysis.fromJson(res.data);
  }

  static Future<GrowthRecord> createGrowthRecord(GrowthRecord record) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'growth_record',
        operation: 'create',
        payload: record.toJson(),
      );
      return record;
    }
    final res = await ApiService.dio
        .post('/api/v1/growth-records', data: record.toJson());
    _assertOk(res);
    ConnectivityService.instance.markOnline();
    return GrowthRecord.fromJson(res.data);
  }

  static Future<GrowthRecord> updateGrowthRecord(
      String id, GrowthRecord record) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'growth_record',
        operation: 'update',
        entityId: id,
        payload: record.toJson(),
      );
      return record;
    }
    final res = await ApiService.dio
        .patch('/api/v1/growth-records/$id', data: record.toJson());
    _assertOk(res);
    return GrowthRecord.fromJson(res.data);
  }

  static Future<void> deleteGrowthRecord(String id) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'growth_record',
        operation: 'delete',
        entityId: id,
        payload: {},
      );
      return;
    }
    final res = await ApiService.dio.delete('/api/v1/growth-records/$id');
    _assertOk(res);
  }

  // Feed records
  static Future<List<FeedRecord>> getFeedRecords(String flockId) async {
    final res = await ApiService.dio.get(
      '/api/v1/feed-records',
      queryParameters: {'flockId': flockId},
    );
    _assertOk(res);
    if (res.data is Map && res.data['error'] != null)
      throw BroilerServiceException(res.data['error']);
    return (res.data as List).map((e) => FeedRecord.fromJson(e)).toList();
  }

  static Future<FeedSummary> getFeedSummary(String flockId) async {
    final res = await ApiService.dio.get(
      '/api/v1/feed-records/summary',
      queryParameters: {'flockId': flockId},
    );
    _assertOk(res);
    return FeedSummary.fromJson(res.data);
  }

  static Future<FeedRecord> createFeedRecord(FeedRecord record) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'feed_record',
        operation: 'create',
        payload: record.toJson(),
      );
      return record;
    }
    final res = await ApiService.dio
        .post('/api/v1/feed-records', data: record.toJson());
    _assertOk(res);
    ConnectivityService.instance.markOnline();
    return FeedRecord.fromJson(res.data);
  }

  static Future<FeedRecord> updateFeedRecord(
      String id, FeedRecord record) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'feed_record',
        operation: 'update',
        entityId: id,
        payload: record.toJson(),
      );
      return record;
    }
    final res = await ApiService.dio
        .patch('/api/v1/feed-records/$id', data: record.toJson());
    _assertOk(res);
    return FeedRecord.fromJson(res.data);
  }

  static Future<void> deleteFeedRecord(String id) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'feed_record',
        operation: 'delete',
        entityId: id,
        payload: {},
      );
      return;
    }
    final res = await ApiService.dio.delete('/api/v1/feed-records/$id');
    _assertOk(res);
  }

  // Feed purchases (procurement — matches web app flow)
  static Future<List<FeedPurchase>> getFeedPurchases(String flockId) async {
    final res = await ApiService.dio.get(
      '/api/v1/feed-purchases',
      queryParameters: {'flockId': flockId},
    );
    _assertOk(res);
    if (res.data is Map && res.data['error'] != null)
      throw BroilerServiceException(res.data['error']);
    return (res.data as List).map((e) => FeedPurchase.fromJson(e)).toList();
  }

  static Future<FeedProjection> getFeedProjection(String flockId) async {
    final res = await ApiService.dio.get(
      '/api/v1/broiler-flocks/$flockId/feed-projection',
    );
    _assertOk(res);
    return FeedProjection.fromJson(res.data);
  }

  static Future<FeedPurchase> createFeedPurchase(FeedPurchase purchase) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'feed_purchase',
        operation: 'create',
        payload: purchase.toJson(),
      );
      return purchase;
    }
    final res = await ApiService.dio
        .post('/api/v1/feed-purchases', data: purchase.toJson());
    _assertOk(res);
    ConnectivityService.instance.markOnline();
    return FeedPurchase.fromJson(res.data);
  }

  static Future<FeedPurchase> updateFeedPurchase(
      String id, FeedPurchase purchase) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'feed_purchase',
        operation: 'update',
        entityId: id,
        payload: purchase.toJson(),
      );
      return purchase;
    }
    final res = await ApiService.dio
        .patch('/api/v1/feed-purchases/$id', data: purchase.toJson());
    _assertOk(res);
    return FeedPurchase.fromJson(res.data);
  }

  static Future<void> deleteFeedPurchase(String id) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'feed_purchase',
        operation: 'delete',
        entityId: id,
        payload: {},
      );
      return;
    }
    final res = await ApiService.dio.delete('/api/v1/feed-purchases/$id');
    _assertOk(res);
  }

  // Water records
  static Future<List<WaterRecord>> getWaterRecords(String flockId) async {
    final res = await ApiService.dio.get(
      '/api/v1/water-records',
      queryParameters: {'flockId': flockId},
    );
    _assertOk(res);
    if (res.data is Map && res.data['error'] != null)
      throw BroilerServiceException(res.data['error']);
    return (res.data as List).map((e) => WaterRecord.fromJson(e)).toList();
  }

  static Future<WaterRatio> getWaterRatio(String flockId) async {
    final res = await ApiService.dio.get(
      '/api/v1/water-records/ratio',
      queryParameters: {'flockId': flockId},
    );
    _assertOk(res);
    return WaterRatio.fromJson(res.data);
  }

  static Future<WaterRecord> createWaterRecord(WaterRecord record) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'water_record',
        operation: 'create',
        payload: record.toJson(),
      );
      return record;
    }
    final res = await ApiService.dio
        .post('/api/v1/water-records', data: record.toJson());
    _assertOk(res);
    ConnectivityService.instance.markOnline();
    return WaterRecord.fromJson(res.data);
  }

  static Future<WaterRecord> updateWaterRecord(
      String id, WaterRecord record) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'water_record',
        operation: 'update',
        entityId: id,
        payload: record.toJson(),
      );
      return record;
    }
    final res = await ApiService.dio
        .patch('/api/v1/water-records/$id', data: record.toJson());
    _assertOk(res);
    return WaterRecord.fromJson(res.data);
  }

  static Future<void> deleteWaterRecord(String id) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'water_record',
        operation: 'delete',
        entityId: id,
        payload: {},
      );
      return;
    }
    final res = await ApiService.dio.delete('/api/v1/water-records/$id');
    _assertOk(res);
  }

  // Mortality events
  static Future<List<MortalityEvent>> getMortalityEvents(String flockId) async {
    final res = await ApiService.dio.get(
      '/api/v1/mortality-events',
      queryParameters: {'flockId': flockId},
    );
    _assertOk(res);
    if (res.data is Map && res.data['error'] != null)
      throw BroilerServiceException(res.data['error']);
    return (res.data as List).map((e) => MortalityEvent.fromJson(e)).toList();
  }

  static Future<MortalitySummary> getMortalitySummary(String flockId) async {
    final res = await ApiService.dio.get(
      '/api/v1/mortality-events/summary',
      queryParameters: {'flockId': flockId},
    );
    _assertOk(res);
    return MortalitySummary.fromJson(res.data);
  }

  static Future<MortalityEvent> createMortalityEvent(
      MortalityEvent event) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'mortality_event',
        operation: 'create',
        payload: event.toJson(),
      );
      return event;
    }
    final res = await ApiService.dio
        .post('/api/v1/mortality-events', data: event.toJson());
    _assertOk(res);
    ConnectivityService.instance.markOnline();
    return MortalityEvent.fromJson(res.data);
  }

  static Future<MortalityEvent> updateMortalityEvent(
      String id, MortalityEvent event) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'mortality_event',
        operation: 'update',
        entityId: id,
        payload: event.toJson(),
      );
      return event;
    }
    final res = await ApiService.dio
        .patch('/api/v1/mortality-events/$id', data: event.toJson());
    _assertOk(res);
    return MortalityEvent.fromJson(res.data);
  }

  static Future<void> deleteMortalityEvent(String id) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'mortality_event',
        operation: 'delete',
        entityId: id,
        payload: {},
      );
      return;
    }
    final res = await ApiService.dio.delete('/api/v1/mortality-events/$id');
    _assertOk(res);
  }

  // Vaccination events
  static Future<List<VaccinationEvent>> getVaccinationEvents(
      String flockId) async {
    final res = await ApiService.dio.get(
      '/api/v1/vaccination-events',
      queryParameters: {'flockId': flockId},
    );
    _assertOk(res);
    if (res.data is Map && res.data['error'] != null)
      throw BroilerServiceException(res.data['error']);
    return (res.data as List).map((e) => VaccinationEvent.fromJson(e)).toList();
  }

  static Future<VaccinationScheduleStatus> getVaccinationScheduleStatus(
      String flockId) async {
    final res = await ApiService.dio.get(
      '/api/v1/vaccination-events/schedule',
      queryParameters: {'flockId': flockId},
    );
    _assertOk(res);
    return VaccinationScheduleStatus.fromJson(res.data);
  }

  static Future<VaccinationEvent> createVaccinationEvent(
      VaccinationEvent event) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'vaccination_event',
        operation: 'create',
        payload: event.toJson(),
      );
      return event;
    }
    final res = await ApiService.dio
        .post('/api/v1/vaccination-events', data: event.toJson());
    _assertOk(res);
    ConnectivityService.instance.markOnline();
    return VaccinationEvent.fromJson(res.data);
  }

  static Future<VaccinationEvent> updateVaccinationEvent(
      String id, VaccinationEvent event) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'vaccination_event',
        operation: 'update',
        entityId: id,
        payload: event.toJson(),
      );
      return event;
    }
    final res = await ApiService.dio
        .patch('/api/v1/vaccination-events/$id', data: event.toJson());
    _assertOk(res);
    return VaccinationEvent.fromJson(res.data);
  }

  static Future<void> deleteVaccinationEvent(String id) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'vaccination_event',
        operation: 'delete',
        entityId: id,
        payload: {},
      );
      return;
    }
    final res = await ApiService.dio.delete('/api/v1/vaccination-events/$id');
    _assertOk(res);
  }

  // Financial records
  static Future<List<FinancialRecord>> getFinancialRecords(
      String flockId) async {
    final res = await ApiService.dio.get(
      '/api/v1/financial-records',
      queryParameters: {'flockId': flockId},
    );
    _assertOk(res);
    if (res.data is Map && res.data['error'] != null)
      throw BroilerServiceException(res.data['error']);
    return (res.data as List).map((e) => FinancialRecord.fromJson(e)).toList();
  }

  static Future<FinancialSummary> getFinancialSummary(String flockId) async {
    final res = await ApiService.dio.get(
      '/api/v1/financial-records/summary',
      queryParameters: {'flockId': flockId},
    );
    _assertOk(res);
    return FinancialSummary.fromJson(res.data);
  }

  static Future<FinancialRecord> createFinancialRecord(
      FinancialRecord record) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'financial_record',
        operation: 'create',
        payload: record.toJson(),
      );
      return record;
    }
    final res = await ApiService.dio
        .post('/api/v1/financial-records', data: record.toJson());
    _assertOk(res);
    ConnectivityService.instance.markOnline();
    return FinancialRecord.fromJson(res.data);
  }

  static Future<FinancialRecord> updateFinancialRecord(
      String id, FinancialRecord record) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'financial_record',
        operation: 'update',
        entityId: id,
        payload: record.toJson(),
      );
      return record;
    }
    final res = await ApiService.dio
        .patch('/api/v1/financial-records/$id', data: record.toJson());
    _assertOk(res);
    return FinancialRecord.fromJson(res.data);
  }

  static Future<void> deleteFinancialRecord(String id) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'financial_record',
        operation: 'delete',
        entityId: id,
        payload: {},
      );
      return;
    }
    final res = await ApiService.dio.delete('/api/v1/financial-records/$id');
    _assertOk(res);
  }

  // Bulk delete records
  static Future<Map<String, dynamic>> bulkDeleteRecords(
      String type, List<String> ids) async {
    // Feed purchases don't have a bulk endpoint — delete individually.
    if (type == 'feed') {
      int deleted = 0;
      for (final id in ids) {
        try {
          await ApiService.dio.delete('/api/v1/feed-purchases/$id');
          deleted++;
        } catch (_) {}
      }
      return {'deleted': deleted, 'requested': ids.length};
    }
    final endpoints = {
      'growth': '/api/v1/growth-records/bulk',
      'water': '/api/v1/water-records/bulk',
      'mortality': '/api/v1/mortality-events/bulk',
      'vaccination': '/api/v1/vaccination-events/bulk',
      'financial': '/api/v1/financial-records/bulk',
    };
    final endpoint = endpoints[type];
    if (endpoint == null)
      throw BroilerServiceException('Unknown record type: $type');
    final res = await ApiService.dio
        .post(endpoint, data: {'action': 'delete', 'ids': ids});
    _assertOk(res);
    return res.data as Map<String, dynamic>;
  }

  // Bulk create records (accepts JSON list since each type has different fields)
  static Future<Map<String, dynamic>> bulkCreateRecords(
      String type, List<Map<String, dynamic>> records) async {
    final endpoints = {
      'growth': '/api/v1/growth-records/bulk',
      'water': '/api/v1/water-records/bulk',
      'mortality': '/api/v1/mortality-events/bulk',
      'vaccination': '/api/v1/vaccination-events/bulk',
      'financial': '/api/v1/financial-records/bulk',
    };
    final endpoint = endpoints[type];
    if (endpoint == null)
      throw BroilerServiceException('Unknown record type: $type');
    final res = await ApiService.dio
        .post(endpoint, data: {'action': 'create', 'records': records});
    _assertOk(res);
    return res.data as Map<String, dynamic>;
  }

  // Medication records
  static Future<List<MedicationRecord>> getMedicationRecords(
      String flockId) async {
    final res = await ApiService.dio.get(
      '/api/v1/medication-records',
      queryParameters: {'flockId': flockId},
    );
    _assertOk(res);
    if (res.data is Map && res.data['error'] != null)
      throw BroilerServiceException(res.data['error']);
    return (res.data as List).map((e) => MedicationRecord.fromJson(e)).toList();
  }

  static Future<MedicationRecord> createMedicationRecord(
      MedicationRecord record) async {
    final res = await ApiService.dio
        .post('/api/v1/medication-records', data: record.toJson());
    _assertOk(res);
    return MedicationRecord.fromJson(res.data);
  }

  static Future<MedicationRecord> updateMedicationRecord(
      String id, MedicationRecord record) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'medication_record',
        operation: 'update',
        entityId: id,
        payload: record.toJson(),
      );
      return record;
    }
    final res = await ApiService.dio
        .patch('/api/v1/medication-records/$id', data: record.toJson());
    _assertOk(res);
    return MedicationRecord.fromJson(res.data);
  }

  static Future<void> deleteMedicationRecord(String id) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'medication_record',
        operation: 'delete',
        entityId: id,
        payload: {},
      );
      return;
    }
    final res = await ApiService.dio.delete('/api/v1/medication-records/$id');
    _assertOk(res);
  }

  // Environmental records
  static Future<List<EnvironmentalRecord>> getEnvironmentalRecords(
      String flockId) async {
    final res = await ApiService.dio.get(
      '/api/v1/environmental-records',
      queryParameters: {'flockId': flockId},
    );
    _assertOk(res);
    if (res.data is Map && res.data['error'] != null)
      throw BroilerServiceException(res.data['error']);
    return (res.data as List)
        .map((e) => EnvironmentalRecord.fromJson(e))
        .toList();
  }

  static Future<EnvironmentalRecord> createEnvironmentalRecord(
      EnvironmentalRecord record) async {
    final res = await ApiService.dio
        .post('/api/v1/environmental-records', data: record.toJson());
    _assertOk(res);
    return EnvironmentalRecord.fromJson(res.data);
  }

  static Future<EnvironmentalRecord> updateEnvironmentalRecord(
      String id, EnvironmentalRecord record) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'environmental_record',
        operation: 'update',
        entityId: id,
        payload: record.toJson(),
      );
      return record;
    }
    final res = await ApiService.dio
        .patch('/api/v1/environmental-records/$id', data: record.toJson());
    _assertOk(res);
    return EnvironmentalRecord.fromJson(res.data);
  }

  static Future<void> deleteEnvironmentalRecord(String id) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'environmental_record',
        operation: 'delete',
        entityId: id,
        payload: {},
      );
      return;
    }
    final res =
        await ApiService.dio.delete('/api/v1/environmental-records/$id');
    _assertOk(res);
  }

  // Flock tasks
  static Future<List<FlockTask>> getFlockTasks(String flockId,
      {String? status}) async {
    final res = await ApiService.dio.get(
      '/api/v1/flock-tasks',
      queryParameters: {
        'flockId': flockId,
        if (status != null) 'status': status
      },
    );
    _assertOk(res);
    if (res.data is Map && res.data['error'] != null)
      throw BroilerServiceException(res.data['error']);
    return (res.data as List).map((e) => FlockTask.fromJson(e)).toList();
  }

  static Future<FlockTaskGenerateResult> generateFlockTasks(
      String flockId) async {
    final res = await ApiService.dio
        .post('/api/v1/flock-tasks/generate', data: {'flockId': flockId});
    _assertOk(res);
    return FlockTaskGenerateResult.fromJson(res.data);
  }

  static Future<FlockTask> createFlockTask(FlockTask task) async {
    final res =
        await ApiService.dio.post('/api/v1/flock-tasks', data: task.toJson());
    _assertOk(res);
    return FlockTask.fromJson(res.data);
  }

  static Future<FlockTask> updateFlockTask(String id,
      {bool? isCompleted, bool? isSkipped, String? notes}) async {
    final res = await ApiService.dio.patch('/api/v1/flock-tasks/$id', data: {
      if (isCompleted != null) 'isCompleted': isCompleted,
      if (isSkipped != null) 'isSkipped': isSkipped,
      if (notes != null) 'notes': notes,
    });
    _assertOk(res);
    return FlockTask.fromJson(res.data);
  }

  static Future<void> deleteFlockTask(String id) async {
    final res = await ApiService.dio.delete('/api/v1/flock-tasks/$id');
    _assertOk(res);
  }

  // Calendar (flock summary)
  static Future<FlockCalendarSummary> getFlockCalendarSummary(
      String flockId) async {
    final res =
        await ApiService.dio.get('/api/v1/broiler-flocks/$flockId/summary');
    _assertOk(res);
    return FlockCalendarSummary.fromJson(res.data);
  }

  // Sale records
  static Future<({List<SaleRecord> items, int total})> getSaleRecords(
      String flockId, {SalesFilter? filter}) async {
    final params = <String, dynamic>{'flockId': flockId};
    if (filter != null) params.addAll(filter.toQueryParams());
    final res = await ApiService.dio.get(
      '/api/v1/sale-records',
      queryParameters: params,
    );
    _assertOk(res);
    // Handle paginated response shape { data, total, limit, offset }
    if (res.data is Map && res.data['data'] is List) {
      final items = (res.data['data'] as List)
          .map((e) => SaleRecord.fromJson(e as Map<String, dynamic>))
          .toList();
      final total = (res.data['total'] as num?)?.toInt() ?? items.length;
      return (items: items, total: total);
    }
    // Backward compat: bare array
    if (res.data is List) {
      final items = (res.data as List)
          .map((e) => SaleRecord.fromJson(e as Map<String, dynamic>))
          .toList();
      return (items: items, total: items.length);
    }
    if (res.data is Map && res.data['error'] != null)
      throw BroilerServiceException(res.data['error']);
    throw BroilerServiceException('Unexpected sale-records response');
  }

  static Future<Map<String, dynamic>> getSaleRecordSummary(
      String flockId, {SalesFilter? filter}) async {
    final params = <String, dynamic>{'flockId': flockId};
    if (filter != null) params.addAll(filter.toFilterParams());
    final res = await ApiService.dio.get(
      '/api/v1/sale-records/summary',
      queryParameters: params,
    );
    _assertOk(res);
    return res.data as Map<String, dynamic>;
  }

  /// Global sales dashboard — accepts optional filter.
  static Future<Map<String, dynamic>> getSalesDashboard(
      {SalesFilter? filter}) async {
    final params = <String, dynamic>{};
    if (filter != null) params.addAll(filter.toFilterParams());
    final res = await ApiService.dio.get(
      '/api/v1/sale-records/dashboard',
      queryParameters: params,
    );
    _assertOk(res);
    return res.data as Map<String, dynamic>;
  }

  /// All sales (paginated) — accepts optional filter.
  static Future<({List<SaleRecord> items, int total})> getAllSales(
      {SalesFilter? filter}) async {
    final params = <String, dynamic>{};
    if (filter != null) params.addAll(filter.toQueryParams());
    final res = await ApiService.dio.get(
      '/api/v1/sale-records/all',
      queryParameters: params,
    );
    _assertOk(res);
    if (res.data is Map && res.data['data'] is List) {
      final items = (res.data['data'] as List)
          .map((e) => SaleRecord.fromJson(e as Map<String, dynamic>))
          .toList();
      final total = (res.data['total'] as num?)?.toInt() ?? items.length;
      return (items: items, total: total);
    }
    if (res.data is List) {
      final items = (res.data as List)
          .map((e) => SaleRecord.fromJson(e as Map<String, dynamic>))
          .toList();
      return (items: items, total: items.length);
    }
    throw BroilerServiceException('Unexpected sale-records/all response');
  }

  static Future<SaleRecord> createSaleRecord(SaleRecord record) async {
    final res = await ApiService.dio
        .post('/api/v1/sale-records', data: record.toJson());
    _assertOk(res);
    return SaleRecord.fromJson(res.data);
  }

  static Future<SaleRecord> updateSaleRecord(
      String id, SaleRecord record) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'sale_record',
        operation: 'update',
        entityId: id,
        payload: record.toJson(),
      );
      return record;
    }
    final res = await ApiService.dio
        .patch('/api/v1/sale-records/$id', data: record.toJson());
    _assertOk(res);
    return SaleRecord.fromJson(res.data);
  }

  static Future<void> deleteSaleRecord(String id) async {
    if (!ConnectivityService.instance.isOnline) {
      await OfflineCache.instance.enqueueSync(
        entityType: 'sale_record',
        operation: 'delete',
        entityId: id,
        payload: {},
      );
      return;
    }
    final res = await ApiService.dio.delete('/api/v1/sale-records/$id');
    _assertOk(res);
  }

  // Documents
  static Future<List<DocumentRecord>> getDocuments(String flockId) async {
    final res = await ApiService.dio.get(
      '/api/v1/documents',
      queryParameters: {'flockId': flockId},
    );
    _assertOk(res);
    if (res.data is Map && res.data['error'] != null)
      throw BroilerServiceException(res.data['error']);
    return (res.data as List).map((e) => DocumentRecord.fromJson(e)).toList();
  }

  /// Get documents for a specific financial transaction.
  /// Pass one of: financialRecordId, journalEntryId, saleRecordId, or flockId.
  static Future<List<DocumentRecord>> getDocumentsFor({
    String? flockId,
    String? financialRecordId,
    String? journalEntryId,
    String? saleRecordId,
  }) async {
    final params = <String, dynamic>{};
    if (financialRecordId != null)
      params['financialRecordId'] = financialRecordId;
    if (journalEntryId != null) params['journalEntryId'] = journalEntryId;
    if (saleRecordId != null) params['saleRecordId'] = saleRecordId;
    if (flockId != null && financialRecordId == null && saleRecordId == null) {
      params['flockId'] = flockId;
    }
    final res =
        await ApiService.dio.get('/api/v1/documents', queryParameters: params);
    _assertOk(res);
    if (res.data is Map && res.data['error'] != null)
      throw BroilerServiceException(res.data['error']);
    return (res.data as List).map((e) => DocumentRecord.fromJson(e)).toList();
  }

  static Future<DocumentRecord> uploadDocument({
    required String flockId,
    required String filePath,
    required String category,
    String recordType = 'flock',
  }) async {
    final formData = FormData.fromMap({
      'flockId': flockId,
      'category': category,
      'recordType': recordType,
      'file': await MultipartFile.fromFile(filePath),
    });
    final res = await ApiService.dio.post('/api/v1/documents', data: formData);
    _assertOk(res);
    return DocumentRecord.fromJson(res.data);
  }

  /// Upload a document for a specific financial transaction.
  /// Pass one of: flockId, financialRecordId, journalEntryId, or saleRecordId.
  static Future<DocumentRecord> uploadDocumentFor({
    String? flockId,
    String? financialRecordId,
    String? journalEntryId,
    String? saleRecordId,
    required String filePath,
    required String category,
  }) async {
    final fields = <String, dynamic>{
      'category': category,
    };
    if (financialRecordId != null)
      fields['financialRecordId'] = financialRecordId;
    if (journalEntryId != null) fields['journalEntryId'] = journalEntryId;
    if (saleRecordId != null) fields['saleRecordId'] = saleRecordId;
    if (flockId != null &&
        financialRecordId == null &&
        saleRecordId == null &&
        journalEntryId == null) {
      fields['flockId'] = flockId;
    }
    fields['file'] = await MultipartFile.fromFile(filePath);
    final formData = FormData.fromMap(fields);
    final res = await ApiService.dio.post('/api/v1/documents', data: formData);
    _assertOk(res);
    return DocumentRecord.fromJson(res.data);
  }

  static Future<void> deleteDocument(String id) async {
    final res = await ApiService.dio.delete('/api/v1/documents/$id');
    _assertOk(res);
  }

  static Future<DocumentRecord> updateDocument(String id,
      {String? category, String? recordType}) async {
    final data = <String, dynamic>{};
    if (category != null) data['category'] = category;
    if (recordType != null) data['recordType'] = recordType;
    final res = await ApiService.dio.patch('/api/v1/documents/$id', data: data);
    _assertOk(res);
    return DocumentRecord.fromJson(res.data);
  }

  static void _assertOk(Response<dynamic> res) {
    if (res.statusCode == null || res.statusCode! >= 400) {
      final message = res.data is Map
          ? (res.data['error'] ?? res.data['message'] ?? 'Request failed')
          : 'Request failed';
      log('BroilerService error: $message', name: 'BroilerService');
      throw BroilerServiceException(message.toString());
    }
  }

  static bool _isNetworkError(DioException e) {
    return e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.sendTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.connectionError;
  }
}

class GrowthRecordAnalysis {
  final List<GrowthRecord> records;
  final int ageDays;
  final List<PerformanceTarget> targets;
  final double? fcr;
  final int currentCount;

  GrowthRecordAnalysis({
    required this.records,
    required this.ageDays,
    required this.targets,
    this.fcr,
    required this.currentCount,
  });

  factory GrowthRecordAnalysis.fromJson(Map<String, dynamic> json) {
    return GrowthRecordAnalysis(
      records: (json['records'] as List? ?? [])
          .map((e) => GrowthRecord.fromJson(e))
          .toList(),
      ageDays: json['ageDays'] ?? 0,
      targets: (json['targets'] as List? ?? [])
          .map((e) => PerformanceTarget.fromJson(e))
          .toList(),
      fcr: json['fcr'] != null ? double.tryParse(json['fcr'].toString()) : null,
      currentCount: json['currentCount'] ?? 0,
    );
  }
}

class FeedSummary {
  final double totalFeedKg;
  final double totalCostZmw;
  final double costPerBird;
  final int currentCount;

  FeedSummary({
    required this.totalFeedKg,
    required this.totalCostZmw,
    required this.costPerBird,
    required this.currentCount,
  });

  factory FeedSummary.fromJson(Map<String, dynamic> json) {
    return FeedSummary(
      totalFeedKg: (json['totalFeedKg'] ?? 0).toDouble(),
      totalCostZmw: (json['totalCostZmw'] ?? 0).toDouble(),
      costPerBird: (json['costPerBird'] ?? 0).toDouble(),
      currentCount: json['currentCount'] ?? 0,
    );
  }
}

class WaterRatio {
  final double totalWaterLiters;
  final double totalFeedKg;
  final String? waterToFeedRatio;

  WaterRatio({
    required this.totalWaterLiters,
    required this.totalFeedKg,
    this.waterToFeedRatio,
  });

  factory WaterRatio.fromJson(Map<String, dynamic> json) {
    return WaterRatio(
      totalWaterLiters: (json['totalWaterLiters'] ?? 0).toDouble(),
      totalFeedKg: (json['totalFeedKg'] ?? 0).toDouble(),
      waterToFeedRatio: json['waterToFeedRatio'],
    );
  }
}

class MortalitySummary {
  final int totalDeaths;
  final String mortalityRate;
  final int initialCount;
  final int currentCount;

  MortalitySummary({
    required this.totalDeaths,
    required this.mortalityRate,
    required this.initialCount,
    required this.currentCount,
  });

  factory MortalitySummary.fromJson(Map<String, dynamic> json) {
    return MortalitySummary(
      totalDeaths: json['totalDeaths'] ?? 0,
      mortalityRate: json['mortalityRate']?.toString() ?? '0.00',
      initialCount: json['initialCount'] ?? 0,
      currentCount: json['currentCount'] ?? 0,
    );
  }
}

class VaccinationScheduleStatus {
  final List<VaccinationEvent> completed;
  final List<VaccinationScheduleItem> upcoming;
  final List<VaccinationScheduleItem> overdue;
  final int ageDays;

  VaccinationScheduleStatus({
    required this.completed,
    required this.upcoming,
    required this.overdue,
    required this.ageDays,
  });

  factory VaccinationScheduleStatus.fromJson(Map<String, dynamic> json) {
    return VaccinationScheduleStatus(
      completed: (json['completed'] as List? ?? [])
          .map((e) => VaccinationEvent.fromJson(e))
          .toList(),
      upcoming: (json['upcoming'] as List? ?? [])
          .map((e) => VaccinationScheduleItem.fromJson(e))
          .toList(),
      overdue: (json['overdue'] as List? ?? [])
          .map((e) => VaccinationScheduleItem.fromJson(e))
          .toList(),
      ageDays: json['ageDays'] ?? 0,
    );
  }
}

class FinancialSummary {
  final double totalCost;
  final double totalRevenue;
  final double profit;
  final double profitPerBird;
  final int currentCount;

  FinancialSummary({
    required this.totalCost,
    required this.totalRevenue,
    required this.profit,
    required this.profitPerBird,
    required this.currentCount,
  });

  factory FinancialSummary.fromJson(Map<String, dynamic> json) {
    return FinancialSummary(
      totalCost: (json['totalCost'] ?? 0).toDouble(),
      totalRevenue: (json['totalRevenue'] ?? 0).toDouble(),
      profit: (json['profit'] ?? 0).toDouble(),
      profitPerBird: (json['profitPerBird'] ?? 0).toDouble(),
      currentCount: json['currentCount'] ?? 0,
    );
  }
}

class FlockTaskGenerateResult {
  final int generated;
  final List<FlockTask> tasks;

  FlockTaskGenerateResult({required this.generated, required this.tasks});

  factory FlockTaskGenerateResult.fromJson(Map<String, dynamic> json) {
    return FlockTaskGenerateResult(
      generated: json['generated'] ?? 0,
      tasks: (json['tasks'] as List? ?? [])
          .map((e) => FlockTask.fromJson(e))
          .toList(),
    );
  }
}

class FlockCalendarSummary {
  final BroilerFlock flock;
  final int ageDays;
  final int targetAge;
  final List<CalendarDay> days;

  FlockCalendarSummary(
      {required this.flock,
      required this.ageDays,
      required this.targetAge,
      required this.days});

  factory FlockCalendarSummary.fromJson(Map<String, dynamic> json) {
    return FlockCalendarSummary(
      flock: BroilerFlock.fromJson(json['flock'] as Map<String, dynamic>),
      ageDays: json['ageDays'] ?? 0,
      targetAge: json['targetAge'] ?? 0,
      days: (json['days'] as List? ?? [])
          .map((e) => CalendarDay.fromJson(e))
          .toList(),
    );
  }
}
