import 'dart:convert';
import 'dart:developer';
import 'package:drift/drift.dart';
import '../database/app_database.dart';
import 'api_service.dart';
import 'connectivity_service.dart';

/// Single source of truth for offline data access.
///
/// Implements an **online-first** pattern:
/// 1. When online: fetch from API, cache result in Drift, return fresh data.
/// 2. When offline: return cached Drift data (if available).
/// 3. Background refresh is only used as a fallback, not the primary path.
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
    // When online (or forced), fetch from API first for fresh data
    if (ConnectivityService.instance.isOnline || forceRefresh) {
      try {
        return await _refreshFlocks(status);
      } catch (e) {
        log('OfflineRepository: API fetch failed for flocks, falling back to cache: $e',
            name: 'OfflineRepository');
      }
    }
    // Fall back to cache (offline or API error)
    return status != null
        ? await db.getFlocksByStatus(status)
        : await db.getAllFlocks();
  }

  Future<List<CachedFlock>> _refreshFlocks([String? status]) async {
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
      orderDate: Value(f['orderDate']?.toString()),
      startDate: Value(f['startDate']?.toString()),
      initialCount: Value(_toInt(f['initialCount'])),
      currentCount: Value(_toInt(f['currentCount'])),
      totalMortality: Value(_toIntOrNull(f['totalMortality'])),
      mortalityRate: Value(_toDouble(f['mortalityRate']) ?? 0),
      targetWeight: Value(_toDouble(f['targetWeight'])),
      targetAge: Value(_toIntOrNull(f['targetAge'])),
      housingType: Value((f['housingType'] ?? 'whole_house').toString()),
      status: Value((f['status'] ?? 'active').toString()),
      ageDays: Value(_toIntOrNull(f['ageDays'])),
      chicksCollected: Value(f['chicksCollected'] as bool?),
    )).toList();
    await db.upsertFlocks(companions);
    await db.setSyncMetadata('flocks');
    return status != null
        ? await db.getFlocksByStatus(status)
        : await db.getAllFlocks();
  }

  /// Safely convert a JSON value to [double].
  /// Handles [int], [double], and [String] (from Prisma Decimal serialization).
  static double? _toDouble(dynamic v) {
    if (v == null) return null;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    if (v is String) return double.tryParse(v);
    return null;
  }

  /// Safely convert a JSON value to [int].
  /// Handles [int], [double], and [String].
  static int _toInt(dynamic v) {
    if (v == null) return 0;
    if (v is int) return v;
    if (v is double) return v.toInt();
    if (v is String) return int.tryParse(v) ?? 0;
    return 0;
  }

  /// Safely convert a nullable JSON value to [int]?.
  static int? _toIntOrNull(dynamic v) {
    if (v == null) return null;
    if (v is int) return v;
    if (v is double) return v.toInt();
    if (v is String) return int.tryParse(v);
    return null;
  }

  // ── Flock detail ─────────────────────────────

  Future<Map<String, dynamic>?> getFlockDetail(String id, {bool forceRefresh = false}) async {
    try {
      final res = await ApiService.dio.get('/api/v1/broiler-flocks/$id');
      ConnectivityService.instance.markOnline();
      return res.data as Map<String, dynamic>;
    } catch (e) {
      // Fall back to cached flock data
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
      rethrow;
    }
  }

  // ── Growth records ───────────────────────────

  Future<List<CachedGrowthRecord>> getGrowthRecords(String flockId, {bool forceRefresh = false}) async {
    if (ConnectivityService.instance.isOnline || forceRefresh) {
      try {
        return await _refreshGrowthRecords(flockId);
      } catch (e) {
        log('OfflineRepository: API fetch failed for growth records, falling back to cache: $e',
            name: 'OfflineRepository');
      }
    }
    return await db.getGrowthRecords(flockId);
  }

  Future<List<CachedGrowthRecord>> _refreshGrowthRecords(String flockId) async {
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
      sampleSize: Value(_toIntOrNull(r['sampleSize'])),
      avgWeight: Value(_toDouble(r['avgWeight'])),
      notes: Value(r['notes']?.toString()),
    )).toList();
    await db.upsertGrowthRecords(companions);
    await db.enforceStorageCap(flockId, 100);
    return await db.getGrowthRecords(flockId);
  }

  // ── Feed records ─────────────────────────────

  Future<List<CachedFeedRecord>> getFeedRecords(String flockId, {bool forceRefresh = false}) async {
    if (ConnectivityService.instance.isOnline || forceRefresh) {
      try {
        return await _refreshFeedRecords(flockId);
      } catch (e) {
        log('OfflineRepository: API fetch failed for feed records, falling back to cache: $e',
            name: 'OfflineRepository');
      }
    }
    return await db.getFeedRecords(flockId);
  }

  Future<List<CachedFeedRecord>> _refreshFeedRecords(String flockId) async {
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
      quantityKg: Value(_toDouble(r['quantityKg'])),
      costZmw: Value(_toDouble(r['costZmw'])),
      notes: Value(r['notes']?.toString()),
    )).toList();
    await db.upsertFeedRecords(companions);
    await db.enforceStorageCap(flockId, 100);
    return await db.getFeedRecords(flockId);
  }

  // ── Water records ────────────────────────────

  Future<List<CachedWaterRecord>> getWaterRecords(String flockId, {bool forceRefresh = false}) async {
    if (ConnectivityService.instance.isOnline || forceRefresh) {
      try {
        return await _refreshWaterRecords(flockId);
      } catch (e) {
        log('OfflineRepository: API fetch failed for water records, falling back to cache: $e',
            name: 'OfflineRepository');
      }
    }
    return await db.getWaterRecords(flockId);
  }

  Future<List<CachedWaterRecord>> _refreshWaterRecords(String flockId) async {
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
      quantityLiters: Value(_toDouble(r['quantityLiters'])),
      ph: Value(_toDouble(r['ph'])),
      temperature: Value(_toDouble(r['temperature'])),
      costZmw: Value(_toDouble(r['costZmw'])),
      notes: Value(r['notes']?.toString()),
    )).toList();
    await db.upsertWaterRecords(companions);
    await db.enforceStorageCap(flockId, 100);
    return await db.getWaterRecords(flockId);
  }

  // ── Mortality events ─────────────────────────

  Future<List<CachedMortalityEvent>> getMortalityEvents(String flockId, {bool forceRefresh = false}) async {
    if (ConnectivityService.instance.isOnline || forceRefresh) {
      try {
        return await _refreshMortalityEvents(flockId);
      } catch (e) {
        log('OfflineRepository: API fetch failed for mortality events, falling back to cache: $e',
            name: 'OfflineRepository');
      }
    }
    return await db.getMortalityEvents(flockId);
  }

  Future<List<CachedMortalityEvent>> _refreshMortalityEvents(String flockId) async {
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
      count: Value(_toInt(r['count'])),
      cause: Value(r['cause']?.toString()),
      ageDays: Value(_toIntOrNull(r['ageDays'])),
      costZmw: Value(_toDouble(r['costZmw'])),
      notes: Value(r['notes']?.toString()),
    )).toList();
    await db.upsertMortalityEvents(companions);
    await db.enforceStorageCap(flockId, 100);
    return await db.getMortalityEvents(flockId);
  }

  // ── Vaccination events ───────────────────────

  Future<List<CachedVaccinationEvent>> getVaccinationEvents(String flockId, {bool forceRefresh = false}) async {
    if (ConnectivityService.instance.isOnline || forceRefresh) {
      try {
        return await _refreshVaccinationEvents(flockId);
      } catch (e) {
        log('OfflineRepository: API fetch failed for vaccination events, falling back to cache: $e',
            name: 'OfflineRepository');
      }
    }
    return await db.getVaccinationEvents(flockId);
  }

  Future<List<CachedVaccinationEvent>> _refreshVaccinationEvents(String flockId) async {
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
      costZmw: Value(_toDouble(r['costZmw'])),
      notes: Value(r['notes']?.toString()),
    )).toList();
    await db.upsertVaccinationEvents(companions);
    return await db.getVaccinationEvents(flockId);
  }

  // ── Financial records ────────────────────────

  Future<List<CachedFinancialRecord>> getFinancialRecords(String flockId, {bool forceRefresh = false}) async {
    if (ConnectivityService.instance.isOnline || forceRefresh) {
      try {
        return await _refreshFinancialRecords(flockId);
      } catch (e) {
        log('OfflineRepository: API fetch failed for financial records, falling back to cache: $e',
            name: 'OfflineRepository');
      }
    }
    return await db.getFinancialRecords(flockId);
  }

  Future<List<CachedFinancialRecord>> _refreshFinancialRecords(String flockId) async {
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
      amountZmw: Value(_toDouble(r['amountZmw']) ?? 0),
      isIncome: Value(r['isIncome'] as bool? ?? false),
      notes: Value(r['notes']?.toString()),
    )).toList();
    await db.upsertFinancialRecords(companions);
    return await db.getFinancialRecords(flockId);
  }

  // ── Sale records ─────────────────────────────

  Future<List<CachedSaleRecord>> getSaleRecords(String flockId, {bool forceRefresh = false}) async {
    if (ConnectivityService.instance.isOnline || forceRefresh) {
      try {
        return await _refreshSaleRecords(flockId);
      } catch (e) {
        log('OfflineRepository: API fetch failed for sale records, falling back to cache: $e',
            name: 'OfflineRepository');
      }
    }
    return await db.getSaleRecords(flockId);
  }

  Future<List<CachedSaleRecord>> _refreshSaleRecords(String flockId) async {
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
      birdCount: Value(_toInt(r['birdCount'])),
      avgWeightKg: Value(_toDouble(r['avgWeightKg'])),
      pricePerBirdZmw: Value(_toDouble(r['pricePerBirdZmw']) ?? 0),
      totalAmountZmw: Value(_toDouble(r['totalAmountZmw']) ?? 0),
      paymentStatus: Value((r['paymentStatus'] ?? 'pending').toString()),
      amountPaidZmw: Value(_toDouble(r['amountPaidZmw'])),
      customerName: Value(r['customerName']?.toString()),
      customerPhone: Value(r['customerPhone']?.toString()),
      notes: Value(r['notes']?.toString()),
    )).toList();
    await db.upsertSaleRecords(companions);
    return await db.getSaleRecords(flockId);
  }

  // ── Alerts ───────────────────────────────────

  Future<List<CachedAlert>> getAlerts({bool forceRefresh = false}) async {
    if (ConnectivityService.instance.isOnline || forceRefresh) {
      try {
        return await _refreshAlerts();
      } catch (e) {
        log('OfflineRepository: API fetch failed for alerts, falling back to cache: $e',
            name: 'OfflineRepository');
      }
    }
    return await db.getUnresolvedAlerts();
  }

  Future<List<CachedAlert>> _refreshAlerts() async {
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
  }

  // ── Dashboard summary ────────────────────────

  Future<Map<String, dynamic>?> getDashboardSummary({bool forceRefresh = false}) async {
    if (ConnectivityService.instance.isOnline || forceRefresh) {
      try {
        final res = await ApiService.dio.get('/api/v1/dashboard/summary');
        ConnectivityService.instance.markOnline();
        await db.upsertDashboardSummary(jsonEncode(res.data));
        return res.data as Map<String, dynamic>;
      } catch (e) {
        log('OfflineRepository: API fetch failed for dashboard summary, falling back to cache: $e',
            name: 'OfflineRepository');
      }
    }
    // Fall back to cache
    final cached = await db.getDashboardSummary();
    if (cached != null) {
      return jsonDecode(cached.payload) as Map<String, dynamic>;
    }
    return null;
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
