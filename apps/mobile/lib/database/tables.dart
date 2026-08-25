import 'package:drift/drift.dart';

/// Cached flocks table — mirrors the key fields from BroilerFlock.
@DataClassName('CachedFlock')
class CachedFlocks extends Table {
  TextColumn get id => text()();
  TextColumn get name => text()();
  TextColumn get breedId => text().withDefault(const Constant(''))();
  TextColumn get breedName => text().nullable()();
  TextColumn get supplierId => text().nullable()();
  TextColumn get supplierName => text().nullable()();
  TextColumn get startDate => text().nullable()();
  IntColumn get initialCount => integer().withDefault(const Constant(0))();
  IntColumn get currentCount => integer().withDefault(const Constant(0))();
  IntColumn get totalMortality => integer().nullable()();
  RealColumn get mortalityRate => real().nullable()();
  RealColumn get targetWeight => real().nullable()();
  IntColumn get targetAge => integer().nullable()();
  TextColumn get housingType => text().withDefault(const Constant('whole_house'))();
  TextColumn get status => text().withDefault(const Constant('active'))();
  IntColumn get ageDays => integer().nullable()();
  BoolColumn get chicksCollected => boolean().nullable()();
  DateTimeColumn get cachedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Cached growth records.
@DataClassName('CachedGrowthRecord')
class CachedGrowthRecords extends Table {
  TextColumn get id => text()();
  TextColumn get flockId => text()();
  TextColumn get recordDate => text()();
  IntColumn get sampleSize => integer().nullable()();
  RealColumn get avgWeight => real().nullable()();
  TextColumn get notes => text().nullable()();
  DateTimeColumn get cachedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Cached feed records.
@DataClassName('CachedFeedRecord')
class CachedFeedRecords extends Table {
  TextColumn get id => text()();
  TextColumn get flockId => text()();
  TextColumn get recordDate => text()();
  TextColumn get feedType => text().nullable()();
  TextColumn get feedBrand => text().nullable()();
  RealColumn get quantityKg => real().nullable()();
  RealColumn get costZmw => real().nullable()();
  TextColumn get notes => text().nullable()();
  DateTimeColumn get cachedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Cached water records.
@DataClassName('CachedWaterRecord')
class CachedWaterRecords extends Table {
  TextColumn get id => text()();
  TextColumn get flockId => text()();
  TextColumn get recordDate => text()();
  RealColumn get quantityLiters => real().nullable()();
  RealColumn get ph => real().nullable()();
  RealColumn get temperature => real().nullable()();
  RealColumn get costZmw => real().nullable()();
  TextColumn get notes => text().nullable()();
  DateTimeColumn get cachedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Cached mortality events.
@DataClassName('CachedMortalityEvent')
class CachedMortalityEvents extends Table {
  TextColumn get id => text()();
  TextColumn get flockId => text()();
  TextColumn get eventDate => text()();
  IntColumn get count => integer().withDefault(const Constant(0))();
  TextColumn get cause => text().nullable()();
  IntColumn get ageDays => integer().nullable()();
  RealColumn get costZmw => real().nullable()();
  TextColumn get notes => text().nullable()();
  DateTimeColumn get cachedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Cached vaccination events.
@DataClassName('CachedVaccinationEvent')
class CachedVaccinationEvents extends Table {
  TextColumn get id => text()();
  TextColumn get flockId => text()();
  TextColumn get vaccineName => text()();
  TextColumn get eventDate => text().nullable()();
  TextColumn get adminMethod => text().nullable()();
  RealColumn get costZmw => real().nullable()();
  TextColumn get notes => text().nullable()();
  DateTimeColumn get cachedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Cached financial records.
@DataClassName('CachedFinancialRecord')
class CachedFinancialRecords extends Table {
  TextColumn get id => text()();
  TextColumn get flockId => text()();
  TextColumn get recordDate => text()();
  TextColumn get category => text()();
  TextColumn get description => text().nullable()();
  RealColumn get amountZmw => real().withDefault(const Constant(0))();
  BoolColumn get isIncome => boolean().withDefault(const Constant(false))();
  TextColumn get notes => text().nullable()();
  DateTimeColumn get cachedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Cached environmental records.
@DataClassName('CachedEnvironmentalRecord')
class CachedEnvironmentalRecords extends Table {
  TextColumn get id => text()();
  TextColumn get flockId => text()();
  TextColumn get recordDate => text()();
  TextColumn get timeOfDay => text().nullable()();
  RealColumn get temperatureC => real().nullable()();
  RealColumn get humidityPct => real().nullable()();
  RealColumn get ammoniaPpm => real().nullable()();
  RealColumn get lightHours => real().nullable()();
  IntColumn get litterScore => integer().nullable()();
  TextColumn get ventilationNote => text().nullable()();
  TextColumn get notes => text().nullable()();
  DateTimeColumn get cachedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Cached alerts (read-only, for offline visibility).
@DataClassName('CachedAlert')
class CachedAlerts extends Table {
  TextColumn get id => text()();
  TextColumn get flockId => text()();
  TextColumn get alertType => text()();
  TextColumn get title => text()();
  TextColumn get message => text()();
  TextColumn get severity => text().withDefault(const Constant('info'))();
  TextColumn get dueDate => text().nullable()();
  BoolColumn get isRead => boolean().withDefault(const Constant(false))();
  BoolColumn get isResolved => boolean().withDefault(const Constant(false))();
  TextColumn get createdAt => text().nullable()();
  DateTimeColumn get cachedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Single-row cache of the last successful dashboard summary fetch.
/// Stores the raw JSON to avoid mirroring the full nested structure.
@DataClassName('CachedDashboardSummary')
class CachedDashboardSummaries extends Table {
  IntColumn get id => integer().withDefault(const Constant(1))();
  TextColumn get payload => text()();
  DateTimeColumn get cachedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Sync queue — tracks pending mutations created while offline.
@DataClassName('SyncQueueEntry')
class SyncQueue extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get entityType => text()(); // e.g. 'flock', 'growth_record'
  TextColumn get operation => text()(); // 'create', 'update', 'delete'
  TextColumn get entityId => text().nullable()(); // null for creates
  TextColumn get payload => text()(); // JSON string
  TextColumn get status => text().withDefault(const Constant('pending'))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get lastAttemptAt => dateTime().nullable()();
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  TextColumn get lastError => text().nullable()();
}
