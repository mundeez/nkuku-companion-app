import 'dart:io';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'tables.dart';

part 'app_database.g.dart';

@DriftDatabase(tables: [
  CachedFlocks,
  CachedGrowthRecords,
  CachedFeedRecords,
  CachedWaterRecords,
  CachedMortalityEvents,
  CachedVaccinationEvents,
  CachedFinancialRecords,
  CachedEnvironmentalRecords,
  CachedAlerts,
  CachedDashboardSummaries,
  CachedSaleRecords,
  CachedSuppliers,
  CachedSyncMetadatas,
  SyncQueue,
])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 3;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (m) => m.createAll(),
        onUpgrade: (m, from, to) async {
          if (from < 2) {
            await m.createTable(cachedEnvironmentalRecords);
            await m.createTable(cachedAlerts);
            await m.createTable(cachedDashboardSummaries);
          }
          if (from < 3) {
            await m.createTable(cachedSaleRecords);
            await m.createTable(cachedSuppliers);
            await m.createTable(cachedSyncMetadatas);
          }
        },
      );

  // ── Flock cache ──────────────────────────────

  Future<void> upsertFlock(CachedFlocksCompanion entry) async {
    await into(cachedFlocks).insertOnConflictUpdate(entry);
  }

  Future<void> upsertFlocks(List<CachedFlocksCompanion> entries) async {
    await batch((b) => b.insertAllOnConflictUpdate(cachedFlocks, entries));
  }

  Future<List<CachedFlock>> getAllFlocks() => select(cachedFlocks).get();

  Future<List<CachedFlock>> getFlocksByStatus(String status) {
    return (select(cachedFlocks)..where((t) => t.status.equals(status))).get();
  }

  Future<void> deleteFlock(String id) async {
    await (delete(cachedFlocks)..where((t) => t.id.equals(id))).go();
  }

  Future<void> clearFlocks() => delete(cachedFlocks).go();

  // ── Sync queue ───────────────────────────────

  Future<int> enqueueSync(SyncQueueCompanion entry) {
    return into(syncQueue).insert(entry);
  }

  Future<List<SyncQueueEntry>> getPendingSyncs() {
    return (select(syncQueue)
          ..where((t) => t.status.equals('pending'))
          ..orderBy([(t) => OrderingTerm.asc(t.createdAt)]))
        .get();
  }

  Future<void> markSyncDone(int id) async {
    await (update(syncQueue)..where((t) => t.id.equals(id)))
        .write(SyncQueueCompanion(status: const Value('done')));
  }

  Future<void> markSyncFailed(int id, String error) async {
    // Read current retry count, then increment — CustomExpression can't
    // be used as a Value<int> in Drift's write() API.
    final row = await (select(syncQueue)..where((t) => t.id.equals(id)))
        .getSingleOrNull();
    final newRetryCount = (row?.retryCount ?? 0) + 1;
    await (update(syncQueue)..where((t) => t.id.equals(id))).write(
      SyncQueueCompanion(
        status: const Value('failed'),
        lastError: Value(error),
        retryCount: Value(newRetryCount),
      ),
    );
  }

  Future<int> pendingSyncCount() async {
    final count = countAll();
    final query = selectOnly(syncQueue)
      ..addColumns([count])
      ..where(syncQueue.status.equals('pending'));
    final result = await query.getSingle();
    return result.read(count) ?? 0;
  }

  Future<void> clearDoneSyncs() async {
    await (delete(syncQueue)..where((t) => t.status.equals('done'))).go();
  }

  /// Returns all sync entries with status 'failed' (for the Sync Issues screen).
  Future<List<SyncQueueEntry>> getFailedSyncs() {
    return (select(syncQueue)
          ..where((t) => t.status.equals('failed'))
          ..orderBy([(t) => OrderingTerm.asc(t.createdAt)]))
        .get();
  }

  /// Returns all sync entries with status 'skipped' (for the Sync Issues screen).
  Future<List<SyncQueueEntry>> getSkippedSyncs() {
    return (select(syncQueue)
          ..where((t) => t.status.equals('skipped'))
          ..orderBy([(t) => OrderingTerm.asc(t.createdAt)]))
        .get();
  }

  /// Removes a single sync queue entry by its database [id].
  Future<void> removeSync(int id) async {
    await (delete(syncQueue)..where((t) => t.id.equals(id))).go();
  }

  /// Clears all sync entries with status 'skipped' or 'failed'.
  Future<void> clearSkippedSyncs() async {
    await (delete(syncQueue)
          ..where((t) => t.status.equals('skipped') | t.status.equals('failed')))
        .go();
  }

  // ── Record caches ────────────────────────────

  Future<void> upsertGrowthRecords(List<CachedGrowthRecordsCompanion> entries) async {
    await batch((b) => b.insertAllOnConflictUpdate(cachedGrowthRecords, entries));
  }

  Future<List<CachedGrowthRecord>> getGrowthRecords(String flockId) {
    return (select(cachedGrowthRecords)
          ..where((t) => t.flockId.equals(flockId))
          ..orderBy([(t) => OrderingTerm.desc(t.recordDate)]))
        .get();
  }

  Future<void> upsertFeedRecords(List<CachedFeedRecordsCompanion> entries) async {
    await batch((b) => b.insertAllOnConflictUpdate(cachedFeedRecords, entries));
  }

  Future<List<CachedFeedRecord>> getFeedRecords(String flockId) {
    return (select(cachedFeedRecords)
          ..where((t) => t.flockId.equals(flockId))
          ..orderBy([(t) => OrderingTerm.desc(t.recordDate)]))
        .get();
  }

  Future<void> upsertWaterRecords(List<CachedWaterRecordsCompanion> entries) async {
    await batch((b) => b.insertAllOnConflictUpdate(cachedWaterRecords, entries));
  }

  Future<List<CachedWaterRecord>> getWaterRecords(String flockId) {
    return (select(cachedWaterRecords)
          ..where((t) => t.flockId.equals(flockId))
          ..orderBy([(t) => OrderingTerm.desc(t.recordDate)]))
        .get();
  }

  Future<void> upsertMortalityEvents(List<CachedMortalityEventsCompanion> entries) async {
    await batch((b) => b.insertAllOnConflictUpdate(cachedMortalityEvents, entries));
  }

  Future<List<CachedMortalityEvent>> getMortalityEvents(String flockId) {
    return (select(cachedMortalityEvents)
          ..where((t) => t.flockId.equals(flockId))
          ..orderBy([(t) => OrderingTerm.desc(t.eventDate)]))
        .get();
  }

  Future<void> upsertVaccinationEvents(List<CachedVaccinationEventsCompanion> entries) async {
    await batch((b) => b.insertAllOnConflictUpdate(cachedVaccinationEvents, entries));
  }

  Future<List<CachedVaccinationEvent>> getVaccinationEvents(String flockId) {
    return (select(cachedVaccinationEvents)
          ..where((t) => t.flockId.equals(flockId))
          ..orderBy([(t) => OrderingTerm.desc(t.eventDate)]))
        .get();
  }

  Future<void> upsertFinancialRecords(List<CachedFinancialRecordsCompanion> entries) async {
    await batch((b) => b.insertAllOnConflictUpdate(cachedFinancialRecords, entries));
  }

  Future<List<CachedFinancialRecord>> getFinancialRecords(String flockId) {
    return (select(cachedFinancialRecords)
          ..where((t) => t.flockId.equals(flockId))
          ..orderBy([(t) => OrderingTerm.desc(t.recordDate)]))
        .get();
  }

  // ── Environmental record cache ───────────────

  Future<void> upsertEnvironmentalRecords(
          List<CachedEnvironmentalRecordsCompanion> entries) async =>
      await batch(
          (b) => b.insertAllOnConflictUpdate(cachedEnvironmentalRecords, entries));

  Future<List<CachedEnvironmentalRecord>> getEnvironmentalRecords(String flockId) {
    return (select(cachedEnvironmentalRecords)
          ..where((t) => t.flockId.equals(flockId))
          ..orderBy([(t) => OrderingTerm.desc(t.recordDate)]))
        .get();
  }

  // ── Alert cache (read-only) ──────────────────

  Future<void> upsertAlerts(List<CachedAlertsCompanion> entries) async =>
      await batch((b) => b.insertAllOnConflictUpdate(cachedAlerts, entries));

  Future<List<CachedAlert>> getAllAlerts() {
    return (select(cachedAlerts)
          ..orderBy([(t) => OrderingTerm.desc(t.cachedAt)]))
        .get();
  }

  Future<List<CachedAlert>> getUnresolvedAlerts() {
    return (select(cachedAlerts)
          ..where((t) => t.isResolved.equals(false))
          ..orderBy([(t) => OrderingTerm.desc(t.cachedAt)]))
        .get();
  }

  // ── Dashboard summary cache (single row) ─────

  Future<void> upsertDashboardSummary(String payloadJson) async {
    await into(cachedDashboardSummaries).insertOnConflictUpdate(
      CachedDashboardSummariesCompanion(
        id: const Value(1),
        payload: Value(payloadJson),
        cachedAt: Value(DateTime.now()),
      ),
    );
  }

  Future<CachedDashboardSummary?> getDashboardSummary() {
    return (select(cachedDashboardSummaries)..limit(1)).getSingleOrNull();
  }

  // ── Storage cap enforcement ──────────────────
  /// Caps cached records per flock/entity to the most recent [limit] rows
  /// (by recordDate / eventDate). Called after upserts to bound DB growth.
  /// Per the mobile modernization plan §5.4: last 100 records or 90 days,
  /// whichever is larger. Here we keep the last [limit] rows; the 90-day
  /// floor is handled by the caller (only fetching recent data from the API).
  Future<void> enforceStorageCap(String flockId, int limit) async {
    // Growth records
    final oldGrowth = await (select(cachedGrowthRecords)
          ..where((t) => t.flockId.equals(flockId))
          ..orderBy([(t) => OrderingTerm.desc(t.recordDate)])
          ..limit(limit))
        .get();
    if (oldGrowth.length >= limit) {
      final cutoff = oldGrowth.last.recordDate;
      await (delete(cachedGrowthRecords)
            ..where((t) =>
                t.flockId.equals(flockId) & t.recordDate.isSmallerThanValue(cutoff)))
          .go();
    }

    // Feed records
    final oldFeed = await (select(cachedFeedRecords)
          ..where((t) => t.flockId.equals(flockId))
          ..orderBy([(t) => OrderingTerm.desc(t.recordDate)])
          ..limit(limit))
        .get();
    if (oldFeed.length >= limit) {
      final cutoff = oldFeed.last.recordDate;
      await (delete(cachedFeedRecords)
            ..where((t) =>
                t.flockId.equals(flockId) & t.recordDate.isSmallerThanValue(cutoff)))
          .go();
    }

    // Water records
    final oldWater = await (select(cachedWaterRecords)
          ..where((t) => t.flockId.equals(flockId))
          ..orderBy([(t) => OrderingTerm.desc(t.recordDate)])
          ..limit(limit))
        .get();
    if (oldWater.length >= limit) {
      final cutoff = oldWater.last.recordDate;
      await (delete(cachedWaterRecords)
            ..where((t) =>
                t.flockId.equals(flockId) & t.recordDate.isSmallerThanValue(cutoff)))
          .go();
    }

    // Mortality events
    final oldMortality = await (select(cachedMortalityEvents)
          ..where((t) => t.flockId.equals(flockId))
          ..orderBy([(t) => OrderingTerm.desc(t.eventDate)])
          ..limit(limit))
        .get();
    if (oldMortality.length >= limit) {
      final cutoff = oldMortality.last.eventDate;
      await (delete(cachedMortalityEvents)
            ..where((t) =>
                t.flockId.equals(flockId) & t.eventDate.isSmallerThanValue(cutoff)))
          .go();
    }

    // Environmental records
    final oldEnv = await (select(cachedEnvironmentalRecords)
          ..where((t) => t.flockId.equals(flockId))
          ..orderBy([(t) => OrderingTerm.desc(t.recordDate)])
          ..limit(limit))
        .get();
    if (oldEnv.length >= limit) {
      final cutoff = oldEnv.last.recordDate;
      await (delete(cachedEnvironmentalRecords)
            ..where((t) =>
                t.flockId.equals(flockId) & t.recordDate.isSmallerThanValue(cutoff)))
          .go();
    }
  }

  // ── Sale record cache ───────────────────────

  Future<void> upsertSaleRecords(List<CachedSaleRecordsCompanion> entries) async {
    await batch((b) => b.insertAllOnConflictUpdate(cachedSaleRecords, entries));
  }

  Future<List<CachedSaleRecord>> getSaleRecords(String flockId) {
    return (select(cachedSaleRecords)
          ..where((t) => t.flockId.equals(flockId))
          ..orderBy([(t) => OrderingTerm.desc(t.saleDate)]))
        .get();
  }

  Future<List<CachedSaleRecord>> getAllSaleRecords() {
    return (select(cachedSaleRecords)
          ..orderBy([(t) => OrderingTerm.desc(t.saleDate)]))
        .get();
  }

  Future<void> deleteSaleRecord(String id) async {
    await (delete(cachedSaleRecords)..where((t) => t.id.equals(id))).go();
  }

  // ── Supplier cache ──────────────────────────

  Future<void> upsertSuppliers(List<CachedSuppliersCompanion> entries) async {
    await batch((b) => b.insertAllOnConflictUpdate(cachedSuppliers, entries));
  }

  Future<List<CachedSupplier>> getAllSuppliers() => select(cachedSuppliers).get();

  // ── Sync metadata ───────────────────────────

  Future<void> setSyncMetadata(String entityType) async {
    await into(cachedSyncMetadatas).insertOnConflictUpdate(
      CachedSyncMetadatasCompanion(
        entityType: Value(entityType),
        lastSyncAt: Value(DateTime.now()),
      ),
    );
  }

  Future<CachedSyncMetadata?> getSyncMetadata(String entityType) {
    return (select(cachedSyncMetadatas)..where((t) => t.entityType.equals(entityType)))
        .getSingleOrNull();
  }

  // ── Full cache clear (on logout / "Clear local cache") ────
  /// Clears all cached data. Does NOT clear the sync queue (pending
  /// mutations are never silently discarded — see plan §5.4).

  Future<void> clearAllCache() async {
    await delete(cachedFlocks).go();
    await delete(cachedGrowthRecords).go();
    await delete(cachedFeedRecords).go();
    await delete(cachedWaterRecords).go();
    await delete(cachedMortalityEvents).go();
    await delete(cachedVaccinationEvents).go();
    await delete(cachedFinancialRecords).go();
    await delete(cachedEnvironmentalRecords).go();
    await delete(cachedAlerts).go();
    await delete(cachedDashboardSummaries).go();
    await delete(cachedSaleRecords).go();
    await delete(cachedSuppliers).go();
    await delete(cachedSyncMetadatas).go();
  }

  /// Clears everything including the sync queue (used on logout only,
  /// after the queue has been flushed or the user has confirmed discard).
  Future<void> clearAll() async {
    await clearAllCache();
    await delete(syncQueue).go();
  }
}

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dir = await getApplicationDocumentsDirectory();
    final file = File(p.join(dir.path, 'nkuku_offline.db'));
    return NativeDatabase.createInBackground(file);
  });
}
