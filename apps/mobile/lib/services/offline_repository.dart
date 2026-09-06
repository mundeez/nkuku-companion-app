import 'dart:convert';
import 'dart:developer';
import 'package:drift/drift.dart';
import '../database/app_database.dart';
import 'api_service.dart';
import 'connectivity_service.dart';

/// Single source of truth for offline data access.
///
/// Implements a stale-while-revalidate pattern:
/// 1. Return cached data from Drift immediately (if available)
/// 2. Fetch fresh data from the API in the background
/// 3. Update the Drift cache with the fresh data
/// 4. Notify listeners of the new data
///
/// For writes: if online, calls the API and updates the local cache.
/// If offline, writes to Drift with a temporary ID and enqueues a sync.
class OfflineRepository {
  static final OfflineRepository _instance = OfflineRepository._();
  static OfflineRepository get instance => _instance;
  OfflineRepository._();

  late AppDatabase _db;
  bool _initialized = false;

  void init(AppDatabase db) {
    _db = db;
    _initialized = true;
  }

  AppDatabase get db {
    if (!_initialized) throw StateError('OfflineRepository not initialized');
    return _db;
  }

  // ── Flocks ───────────────────────────────────

  Future<List<CachedFlock>> getFlocks({String? status, bool forceRefresh = false}) async {
    // Return cached data immediately
    if (!forceRefresh) {
      var cached = status != null
          ? await db.getFlocksByStatus(status)
          : await db.getAllFlocks();
      if (cached.isNotEmpty) {
        _refreshFlocksInBackground(status);
        return cached;
      }
    }
    // No cache or forced refresh — fetch from API
    return await _refreshFlocks(status);
  }

  Future<List<CachedFlock>> _refreshFlocks([String? status]) async {
    try {
      final res = await ApiService.dio.get(
        '/api/v1/broiler-flocks',
        queryParameters: {if (status != null) 'status': status},
      );
      ConnectivityService.instance.markOnline();
      final flocks = (res.data as List).cast<Map<String, dynamic>>();
      final companions = flocks.map((f) => CachedFlocksCompanion(
        id: Value(f['id'] as String),
        name: Value(f['name'] as String),
        breedId: Value((f['breedId'] ?? '').toString()),
        breedName: Value(f['breed']?['name']?.toString()),
        supplierId: Value(f['supplierId']?.toString()),
        supplierName: Value(f['supplier']?['name']?.toString()),
        startDate: Value(f['startDate']?.toString()),
        initialCount: Value((f['initialCount'] ?? 0) as int),
        currentCount: Value((f['currentCount'] ?? 0) as int),
        totalMortality: Value(f['totalMortality'] as int?),
        mortalityRate: Value((f['mortalityRate'] ?? 0).toDouble()),
        targetWeight: Value(f['targetWeight']?.toDouble()),
        targetAge: Value(f['targetAge'] as int?),
        housingType: Value((f['housingType'] ?? 'whole_house').toString()),
        status: Value((f['status'] ?? 'active').toString()),
        ageDays: Value(f['ageDays'] as int?),
        chicksCollected: Value(f['chicksCollected'] as bool?),
      )).toList();
      await db.upsertFlocks(companions);
      await db.setSyncMetadata('flocks');
      return status != null
          ? await db.getFlocksByStatus(status)
          : await db.getAllFlocks();
    } catch (e) {
      log('OfflineRepository: failed to refresh flocks: $e', name: 'OfflineRepository');
      // Return whatever we have in cache
      return status != null
          ? await db.getFlocksByStatus(status)
          : await db.getAllFlocks();
    }
  }

  void _refreshFlocksInBackground([String? status]) {
    _refreshFlocks(status).then<void>((_) {}).catchError((_) {});
  }

  // ── Flock detail ─────────────────────────────

  Future<Map<String, dynamic>?> getFlockDetail(String id, {bool forceRefresh = false}) async {
    try {
      final res = await ApiService.dio.get('/api/v1/broiler-flocks/$id');
      ConnectivityService.instance.markOnline();
      return res.data as Map<String, dynamic>;
    } catch (e) {
      if (!ConnectivityService.instance.isOnline) {
        // Return cached flock data
        final flocks = await db.getAllFlocks();
        final flock = flocks.where((f) => f.id == id).firstOrNull;
        if (flock != null) {
          return {
            'id': flock.id,
            'name': flock.name,
            'breedId': flock.breedId,
            'breedName': flock.breedName,
            'supplierId': flock.supplierId,
            'supplierName': flock.supplierName,
            'startDate': flock.startDate,
            'initialCount': flock.initialCount,
            'currentCount': flock.currentCount,
            'totalMortality': flock.totalMortality,
            'mortalityRate': flock.mortalityRate,
            'targetWeight': flock.targetWeight,
            'targetAge': flock.targetAge,
            'housingType': flock.housingType,
            'status': flock.status,
            'ageDays': flock.ageDays,
            'chicksCollected': flock.chicksCollected,
          };
        }
      }
      rethrow;
    }
  }

  // ── Growth records ───────────────────────────

  Future<List<CachedGrowthRecord>> getGrowthRecords(String flockId, {bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final cached = await db.getGrowthRecords(flockId);
      if (cached.isNotEmpty) {
        _refreshGrowthRecordsInBackground(flockId);
        return cached;
      }
    }
    return await _refreshGrowthRecords(flockId);
  }

  Future<List<CachedGrowthRecord>> _refreshGrowthRecords(String flockId) async {
    try {
      final res = await ApiService.dio.get(
        '/api/v1/growth-records',
        queryParameters: {'flockId': flockId},
      );
      ConnectivityService.instance.markOnline();
      final records = (res.data as List).cast<Map<String, dynamic>>();
      final companions = records.map((r) => CachedGrowthRecordsCompanion(
        id: Value(r['id'] as String),
        flockId: Value(flockId),
        recordDate: Value(r['recordDate'].toString()),
        sampleSize: Value(r['sampleSize'] as int?),
        avgWeight: Value(r['avgWeight']?.toDouble()),
        notes: Value(r['notes']?.toString()),
      )).toList();
      await db.upsertGrowthRecords(companions);
      await db.enforceStorageCap(flockId, 100);
      return await db.getGrowthRecords(flockId);
    } catch (e) {
      log('OfflineRepository: failed to refresh growth records: $e', name: 'OfflineRepository');
      return await db.getGrowthRecords(flockId);
    }
  }

  void _refreshGrowthRecordsInBackground(String flockId) {
    _refreshGrowthRecords(flockId).then<void>((_) {}).catchError((_) {});
  }

  // ── Feed records ─────────────────────────────

  Future<List<CachedFeedRecord>> getFeedRecords(String flockId, {bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final cached = await db.getFeedRecords(flockId);
      if (cached.isNotEmpty) {
        _refreshFeedRecordsInBackground(flockId);
        return cached;
      }
    }
    return await _refreshFeedRecords(flockId);
  }

  Future<List<CachedFeedRecord>> _refreshFeedRecords(String flockId) async {
    try {
      final res = await ApiService.dio.get(
        '/api/v1/feed-records',
        queryParameters: {'flockId': flockId},
      );
      ConnectivityService.instance.markOnline();
      final records = (res.data as List).cast<Map<String, dynamic>>();
      final companions = records.map((r) => CachedFeedRecordsCompanion(
        id: Value(r['id'] as String),
        flockId: Value(flockId),
        recordDate: Value(r['recordDate'].toString()),
        feedType: Value(r['feedType']?.toString()),
        feedBrand: Value(r['feedBrand']?.toString()),
        quantityKg: Value(r['quantityKg']?.toDouble()),
        costZmw: Value(r['costZmw']?.toDouble()),
        notes: Value(r['notes']?.toString()),
      )).toList();
      await db.upsertFeedRecords(companions);
      await db.enforceStorageCap(flockId, 100);
      return await db.getFeedRecords(flockId);
    } catch (e) {
      log('OfflineRepository: failed to refresh feed records: $e', name: 'OfflineRepository');
      return await db.getFeedRecords(flockId);
    }
  }

  void _refreshFeedRecordsInBackground(String flockId) {
    _refreshFeedRecords(flockId).then<void>((_) {}).catchError((_) {});
  }

  // ── Water records ────────────────────────────

  Future<List<CachedWaterRecord>> getWaterRecords(String flockId, {bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final cached = await db.getWaterRecords(flockId);
      if (cached.isNotEmpty) {
        _refreshWaterRecordsInBackground(flockId);
        return cached;
      }
    }
    return await _refreshWaterRecords(flockId);
  }

  Future<List<CachedWaterRecord>> _refreshWaterRecords(String flockId) async {
    try {
      final res = await ApiService.dio.get(
        '/api/v1/water-records',
        queryParameters: {'flockId': flockId},
      );
      ConnectivityService.instance.markOnline();
      final records = (res.data as List).cast<Map<String, dynamic>>();
      final companions = records.map((r) => CachedWaterRecordsCompanion(
        id: Value(r['id'] as String),
        flockId: Value(flockId),
        recordDate: Value(r['recordDate'].toString()),
        quantityLiters: Value(r['quantityLiters']?.toDouble()),
        ph: Value(r['ph']?.toDouble()),
        temperature: Value(r['temperature']?.toDouble()),
        costZmw: Value(r['costZmw']?.toDouble()),
        notes: Value(r['notes']?.toString()),
      )).toList();
      await db.upsertWaterRecords(companions);
      await db.enforceStorageCap(flockId, 100);
      return await db.getWaterRecords(flockId);
    } catch (e) {
      log('OfflineRepository: failed to refresh water records: $e', name: 'OfflineRepository');
      return await db.getWaterRecords(flockId);
    }
  }

  void _refreshWaterRecordsInBackground(String flockId) {
    _refreshWaterRecords(flockId).then<void>((_) {}).catchError((_) {});
  }

  // ── Mortality events ─────────────────────────

  Future<List<CachedMortalityEvent>> getMortalityEvents(String flockId, {bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final cached = await db.getMortalityEvents(flockId);
      if (cached.isNotEmpty) {
        _refreshMortalityEventsInBackground(flockId);
        return cached;
      }
    }
    return await _refreshMortalityEvents(flockId);
  }

  Future<List<CachedMortalityEvent>> _refreshMortalityEvents(String flockId) async {
    try {
      final res = await ApiService.dio.get(
        '/api/v1/mortality-events',
        queryParameters: {'flockId': flockId},
      );
      ConnectivityService.instance.markOnline();
      final records = (res.data as List).cast<Map<String, dynamic>>();
      final companions = records.map((r) => CachedMortalityEventsCompanion(
        id: Value(r['id'] as String),
        flockId: Value(flockId),
        eventDate: Value(r['eventDate'].toString()),
        count: Value((r['count'] ?? 0) as int),
        cause: Value(r['cause']?.toString()),
        ageDays: Value(r['ageDays'] as int?),
        costZmw: Value(r['costZmw']?.toDouble()),
        notes: Value(r['notes']?.toString()),
      )).toList();
      await db.upsertMortalityEvents(companions);
      await db.enforceStorageCap(flockId, 100);
      return await db.getMortalityEvents(flockId);
    } catch (e) {
      log('OfflineRepository: failed to refresh mortality events: $e', name: 'OfflineRepository');
      return await db.getMortalityEvents(flockId);
    }
  }

  void _refreshMortalityEventsInBackground(String flockId) {
    _refreshMortalityEvents(flockId).then<void>((_) {}).catchError((_) {});
  }

  // ── Vaccination events ───────────────────────

  Future<List<CachedVaccinationEvent>> getVaccinationEvents(String flockId, {bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final cached = await db.getVaccinationEvents(flockId);
      if (cached.isNotEmpty) {
        _refreshVaccinationEventsInBackground(flockId);
        return cached;
      }
    }
    return await _refreshVaccinationEvents(flockId);
  }

  Future<List<CachedVaccinationEvent>> _refreshVaccinationEvents(String flockId) async {
    try {
      final res = await ApiService.dio.get(
        '/api/v1/vaccination-events',
        queryParameters: {'flockId': flockId},
      );
      ConnectivityService.instance.markOnline();
      final records = (res.data as List).cast<Map<String, dynamic>>();
      final companions = records.map((r) => CachedVaccinationEventsCompanion(
        id: Value(r['id'] as String),
        flockId: Value(flockId),
        vaccineName: Value(r['vaccineName'].toString()),
        eventDate: Value(r['eventDate']?.toString()),
        adminMethod: Value(r['adminMethod']?.toString()),
        costZmw: Value(r['costZmw']?.toDouble()),
        notes: Value(r['notes']?.toString()),
      )).toList();
      await db.upsertVaccinationEvents(companions);
      return await db.getVaccinationEvents(flockId);
    } catch (e) {
      log('OfflineRepository: failed to refresh vaccination events: $e', name: 'OfflineRepository');
      return await db.getVaccinationEvents(flockId);
    }
  }

  void _refreshVaccinationEventsInBackground(String flockId) {
    _refreshVaccinationEvents(flockId).then<void>((_) {}).catchError((_) {});
  }

  // ── Financial records ────────────────────────

  Future<List<CachedFinancialRecord>> getFinancialRecords(String flockId, {bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final cached = await db.getFinancialRecords(flockId);
      if (cached.isNotEmpty) {
        _refreshFinancialRecordsInBackground(flockId);
        return cached;
      }
    }
    return await _refreshFinancialRecords(flockId);
  }

  Future<List<CachedFinancialRecord>> _refreshFinancialRecords(String flockId) async {
    try {
      final res = await ApiService.dio.get(
        '/api/v1/financial-records',
        queryParameters: {'flockId': flockId},
      );
      ConnectivityService.instance.markOnline();
      final records = (res.data as List).cast<Map<String, dynamic>>();
      final companions = records.map((r) => CachedFinancialRecordsCompanion(
        id: Value(r['id'] as String),
        flockId: Value(flockId),
        recordDate: Value(r['recordDate'].toString()),
        category: Value(r['category'].toString()),
        description: Value(r['description']?.toString()),
        amountZmw: Value((r['amountZmw'] ?? 0).toDouble()),
        isIncome: Value(r['isIncome'] as bool? ?? false),
        notes: Value(r['notes']?.toString()),
      )).toList();
      await db.upsertFinancialRecords(companions);
      return await db.getFinancialRecords(flockId);
    } catch (e) {
      log('OfflineRepository: failed to refresh financial records: $e', name: 'OfflineRepository');
      return await db.getFinancialRecords(flockId);
    }
  }

  void _refreshFinancialRecordsInBackground(String flockId) {
    _refreshFinancialRecords(flockId).then<void>((_) {}).catchError((_) {});
  }

  // ── Sale records ─────────────────────────────

  Future<List<CachedSaleRecord>> getSaleRecords(String flockId, {bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final cached = await db.getSaleRecords(flockId);
      if (cached.isNotEmpty) {
        _refreshSaleRecordsInBackground(flockId);
        return cached;
      }
    }
    return await _refreshSaleRecords(flockId);
  }

  Future<List<CachedSaleRecord>> _refreshSaleRecords(String flockId) async {
    try {
      final res = await ApiService.dio.get(
        '/api/v1/sale-records',
        queryParameters: {'flockId': flockId, 'limit': 100},
      );
      ConnectivityService.instance.markOnline();
      final data = res.data;
      final records = (data is Map ? data['data'] : data) as List;
      final companions = records.cast<Map<String, dynamic>>().map((r) => CachedSaleRecordsCompanion(
        id: Value(r['id'] as String),
        flockId: Value(flockId),
        saleDate: Value(r['saleDate'].toString()),
        birdCount: Value((r['birdCount'] ?? 0) as int),
        avgWeightKg: Value(r['avgWeightKg']?.toDouble()),
        pricePerBirdZmw: Value((r['pricePerBirdZmw'] ?? 0).toDouble()),
        totalAmountZmw: Value((r['totalAmountZmw'] ?? 0).toDouble()),
        paymentStatus: Value((r['paymentStatus'] ?? 'pending').toString()),
        amountPaidZmw: Value(r['amountPaidZmw']?.toDouble()),
        customerName: Value(r['customerName']?.toString()),
        customerPhone: Value(r['customerPhone']?.toString()),
        notes: Value(r['notes']?.toString()),
      )).toList();
      await db.upsertSaleRecords(companions);
      return await db.getSaleRecords(flockId);
    } catch (e) {
      log('OfflineRepository: failed to refresh sale records: $e', name: 'OfflineRepository');
      return await db.getSaleRecords(flockId);
    }
  }

  void _refreshSaleRecordsInBackground(String flockId) {
    _refreshSaleRecords(flockId).then<void>((_) {}).catchError((_) {});
  }

  // ── Alerts ───────────────────────────────────

  Future<List<CachedAlert>> getAlerts({bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final cached = await db.getUnresolvedAlerts();
      if (cached.isNotEmpty) {
        _refreshAlertsInBackground();
        return cached;
      }
    }
    return await _refreshAlerts();
  }

  Future<List<CachedAlert>> _refreshAlerts() async {
    try {
      final res = await ApiService.dio.get('/api/v1/alerts');
      ConnectivityService.instance.markOnline();
      final records = (res.data as List).cast<Map<String, dynamic>>();
      final companions = records.map((r) => CachedAlertsCompanion(
        id: Value(r['id'] as String),
        flockId: Value((r['flockId'] ?? '').toString()),
        alertType: Value(r['alertType'].toString()),
        title: Value(r['title'].toString()),
        message: Value((r['message'] ?? '').toString()),
        severity: Value((r['severity'] ?? 'info').toString()),
        dueDate: Value(r['dueDate']?.toString()),
        isRead: Value(r['isRead'] as bool? ?? false),
        isResolved: Value(r['isResolved'] as bool? ?? false),
        createdAt: Value(r['createdAt']?.toString()),
      )).toList();
      await db.upsertAlerts(companions);
      return await db.getUnresolvedAlerts();
    } catch (e) {
      log('OfflineRepository: failed to refresh alerts: $e', name: 'OfflineRepository');
      return await db.getUnresolvedAlerts();
    }
  }

  void _refreshAlertsInBackground() {
    _refreshAlerts().then<void>((_) {}).catchError((_) {});
  }

  // ── Dashboard summary ────────────────────────

  Future<Map<String, dynamic>?> getDashboardSummary({bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final cached = await db.getDashboardSummary();
      if (cached != null) {
        _refreshDashboardSummaryInBackground();
        return jsonDecode(cached.payload) as Map<String, dynamic>;
      }
    }
    try {
      final res = await ApiService.dio.get('/api/v1/dashboard/summary');
      ConnectivityService.instance.markOnline();
      await db.upsertDashboardSummary(jsonEncode(res.data));
      return res.data as Map<String, dynamic>;
    } catch (e) {
      if (!ConnectivityService.instance.isOnline) {
        final cached = await db.getDashboardSummary();
        if (cached != null) {
          return jsonDecode(cached.payload) as Map<String, dynamic>;
        }
      }
      rethrow;
    }
  }

  void _refreshDashboardSummaryInBackground() {
    try {
      ApiService.dio.get('/api/v1/dashboard/summary').then((res) {
        ConnectivityService.instance.markOnline();
        db.upsertDashboardSummary(jsonEncode(res.data));
      }).then<void>((_) {}).catchError((_) {});
    } catch (_) {}
  }

  // ── Sync queue ───────────────────────────────

  Future<int> enqueueSync({
    required String entityType,
    required String operation,
    String? entityId,
    required Map<String, dynamic> payload,
  }) async {
    return await db.enqueueSync(SyncQueueCompanion(
      entityType: Value(entityType),
      operation: Value(operation),
      entityId: Value(entityId),
      payload: Value(jsonEncode(payload)),
    ));
  }

  Future<List<SyncQueueEntry>> getPendingSyncs() => db.getPendingSyncs();
  Future<List<SyncQueueEntry>> getFailedSyncs() => db.getFailedSyncs();
  Future<List<SyncQueueEntry>> getSkippedSyncs() => db.getSkippedSyncs();
  Future<int> pendingSyncCount() => db.pendingSyncCount();
  Future<void> markSyncDone(int id) => db.markSyncDone(id);
  Future<void> markSyncFailed(int id, String error) => db.markSyncFailed(id, error);
  Future<void> removeSync(int id) => db.removeSync(id);
  Future<void> clearDoneSyncs() => db.clearDoneSyncs();
  Future<void> clearSkippedSyncs() => db.clearSkippedSyncs();

  // ── Cache management ─────────────────────────

  Future<void> clearAllCache() async {
    if (!_initialized) return;
    await db.clearAllCache();
  }

  Future<void> clearAll() async {
    if (!_initialized) return;
    await db.clearAll();
  }
}
