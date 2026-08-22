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
  SyncQueue,
])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 1;

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

  // ── Full cache clear (on logout) ─────────────

  Future<void> clearAll() async {
    // Drift's batch.delete() expects a row, not a table. For clearing
    // all rows, use individual delete().go() calls instead.
    await delete(cachedFlocks).go();
    await delete(cachedGrowthRecords).go();
    await delete(cachedFeedRecords).go();
    await delete(cachedWaterRecords).go();
    await delete(cachedMortalityEvents).go();
    await delete(cachedVaccinationEvents).go();
    await delete(cachedFinancialRecords).go();
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
