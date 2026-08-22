// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_database.dart';

// ignore_for_file: type=lint
class $CachedFlocksTable extends CachedFlocks
    with TableInfo<$CachedFlocksTable, CachedFlock> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedFlocksTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
      'name', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _breedIdMeta =
      const VerificationMeta('breedId');
  @override
  late final GeneratedColumn<String> breedId = GeneratedColumn<String>(
      'breed_id', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant(''));
  static const VerificationMeta _breedNameMeta =
      const VerificationMeta('breedName');
  @override
  late final GeneratedColumn<String> breedName = GeneratedColumn<String>(
      'breed_name', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _supplierIdMeta =
      const VerificationMeta('supplierId');
  @override
  late final GeneratedColumn<String> supplierId = GeneratedColumn<String>(
      'supplier_id', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _supplierNameMeta =
      const VerificationMeta('supplierName');
  @override
  late final GeneratedColumn<String> supplierName = GeneratedColumn<String>(
      'supplier_name', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _startDateMeta =
      const VerificationMeta('startDate');
  @override
  late final GeneratedColumn<String> startDate = GeneratedColumn<String>(
      'start_date', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _initialCountMeta =
      const VerificationMeta('initialCount');
  @override
  late final GeneratedColumn<int> initialCount = GeneratedColumn<int>(
      'initial_count', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _currentCountMeta =
      const VerificationMeta('currentCount');
  @override
  late final GeneratedColumn<int> currentCount = GeneratedColumn<int>(
      'current_count', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _totalMortalityMeta =
      const VerificationMeta('totalMortality');
  @override
  late final GeneratedColumn<int> totalMortality = GeneratedColumn<int>(
      'total_mortality', aliasedName, true,
      type: DriftSqlType.int, requiredDuringInsert: false);
  static const VerificationMeta _mortalityRateMeta =
      const VerificationMeta('mortalityRate');
  @override
  late final GeneratedColumn<double> mortalityRate = GeneratedColumn<double>(
      'mortality_rate', aliasedName, true,
      type: DriftSqlType.double, requiredDuringInsert: false);
  static const VerificationMeta _targetWeightMeta =
      const VerificationMeta('targetWeight');
  @override
  late final GeneratedColumn<double> targetWeight = GeneratedColumn<double>(
      'target_weight', aliasedName, true,
      type: DriftSqlType.double, requiredDuringInsert: false);
  static const VerificationMeta _targetAgeMeta =
      const VerificationMeta('targetAge');
  @override
  late final GeneratedColumn<int> targetAge = GeneratedColumn<int>(
      'target_age', aliasedName, true,
      type: DriftSqlType.int, requiredDuringInsert: false);
  static const VerificationMeta _housingTypeMeta =
      const VerificationMeta('housingType');
  @override
  late final GeneratedColumn<String> housingType = GeneratedColumn<String>(
      'housing_type', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant('whole_house'));
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
      'status', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant('active'));
  static const VerificationMeta _ageDaysMeta =
      const VerificationMeta('ageDays');
  @override
  late final GeneratedColumn<int> ageDays = GeneratedColumn<int>(
      'age_days', aliasedName, true,
      type: DriftSqlType.int, requiredDuringInsert: false);
  static const VerificationMeta _chicksCollectedMeta =
      const VerificationMeta('chicksCollected');
  @override
  late final GeneratedColumn<bool> chicksCollected = GeneratedColumn<bool>(
      'chicks_collected', aliasedName, true,
      type: DriftSqlType.bool,
      requiredDuringInsert: false,
      defaultConstraints: GeneratedColumn.constraintIsAlways(
          'CHECK ("chicks_collected" IN (0, 1))'));
  static const VerificationMeta _cachedAtMeta =
      const VerificationMeta('cachedAt');
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
      'cached_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        name,
        breedId,
        breedName,
        supplierId,
        supplierName,
        startDate,
        initialCount,
        currentCount,
        totalMortality,
        mortalityRate,
        targetWeight,
        targetAge,
        housingType,
        status,
        ageDays,
        chicksCollected,
        cachedAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_flocks';
  @override
  VerificationContext validateIntegrity(Insertable<CachedFlock> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
          _nameMeta, name.isAcceptableOrUnknown(data['name']!, _nameMeta));
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('breed_id')) {
      context.handle(_breedIdMeta,
          breedId.isAcceptableOrUnknown(data['breed_id']!, _breedIdMeta));
    }
    if (data.containsKey('breed_name')) {
      context.handle(_breedNameMeta,
          breedName.isAcceptableOrUnknown(data['breed_name']!, _breedNameMeta));
    }
    if (data.containsKey('supplier_id')) {
      context.handle(
          _supplierIdMeta,
          supplierId.isAcceptableOrUnknown(
              data['supplier_id']!, _supplierIdMeta));
    }
    if (data.containsKey('supplier_name')) {
      context.handle(
          _supplierNameMeta,
          supplierName.isAcceptableOrUnknown(
              data['supplier_name']!, _supplierNameMeta));
    }
    if (data.containsKey('start_date')) {
      context.handle(_startDateMeta,
          startDate.isAcceptableOrUnknown(data['start_date']!, _startDateMeta));
    }
    if (data.containsKey('initial_count')) {
      context.handle(
          _initialCountMeta,
          initialCount.isAcceptableOrUnknown(
              data['initial_count']!, _initialCountMeta));
    }
    if (data.containsKey('current_count')) {
      context.handle(
          _currentCountMeta,
          currentCount.isAcceptableOrUnknown(
              data['current_count']!, _currentCountMeta));
    }
    if (data.containsKey('total_mortality')) {
      context.handle(
          _totalMortalityMeta,
          totalMortality.isAcceptableOrUnknown(
              data['total_mortality']!, _totalMortalityMeta));
    }
    if (data.containsKey('mortality_rate')) {
      context.handle(
          _mortalityRateMeta,
          mortalityRate.isAcceptableOrUnknown(
              data['mortality_rate']!, _mortalityRateMeta));
    }
    if (data.containsKey('target_weight')) {
      context.handle(
          _targetWeightMeta,
          targetWeight.isAcceptableOrUnknown(
              data['target_weight']!, _targetWeightMeta));
    }
    if (data.containsKey('target_age')) {
      context.handle(_targetAgeMeta,
          targetAge.isAcceptableOrUnknown(data['target_age']!, _targetAgeMeta));
    }
    if (data.containsKey('housing_type')) {
      context.handle(
          _housingTypeMeta,
          housingType.isAcceptableOrUnknown(
              data['housing_type']!, _housingTypeMeta));
    }
    if (data.containsKey('status')) {
      context.handle(_statusMeta,
          status.isAcceptableOrUnknown(data['status']!, _statusMeta));
    }
    if (data.containsKey('age_days')) {
      context.handle(_ageDaysMeta,
          ageDays.isAcceptableOrUnknown(data['age_days']!, _ageDaysMeta));
    }
    if (data.containsKey('chicks_collected')) {
      context.handle(
          _chicksCollectedMeta,
          chicksCollected.isAcceptableOrUnknown(
              data['chicks_collected']!, _chicksCollectedMeta));
    }
    if (data.containsKey('cached_at')) {
      context.handle(_cachedAtMeta,
          cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CachedFlock map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedFlock(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      name: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}name'])!,
      breedId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}breed_id'])!,
      breedName: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}breed_name']),
      supplierId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}supplier_id']),
      supplierName: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}supplier_name']),
      startDate: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}start_date']),
      initialCount: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}initial_count'])!,
      currentCount: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}current_count'])!,
      totalMortality: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}total_mortality']),
      mortalityRate: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}mortality_rate']),
      targetWeight: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}target_weight']),
      targetAge: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}target_age']),
      housingType: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}housing_type'])!,
      status: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}status'])!,
      ageDays: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}age_days']),
      chicksCollected: attachedDatabase.typeMapping
          .read(DriftSqlType.bool, data['${effectivePrefix}chicks_collected']),
      cachedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}cached_at'])!,
    );
  }

  @override
  $CachedFlocksTable createAlias(String alias) {
    return $CachedFlocksTable(attachedDatabase, alias);
  }
}

class CachedFlock extends DataClass implements Insertable<CachedFlock> {
  final String id;
  final String name;
  final String breedId;
  final String? breedName;
  final String? supplierId;
  final String? supplierName;
  final String? startDate;
  final int initialCount;
  final int currentCount;
  final int? totalMortality;
  final double? mortalityRate;
  final double? targetWeight;
  final int? targetAge;
  final String housingType;
  final String status;
  final int? ageDays;
  final bool? chicksCollected;
  final DateTime cachedAt;
  const CachedFlock(
      {required this.id,
      required this.name,
      required this.breedId,
      this.breedName,
      this.supplierId,
      this.supplierName,
      this.startDate,
      required this.initialCount,
      required this.currentCount,
      this.totalMortality,
      this.mortalityRate,
      this.targetWeight,
      this.targetAge,
      required this.housingType,
      required this.status,
      this.ageDays,
      this.chicksCollected,
      required this.cachedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['name'] = Variable<String>(name);
    map['breed_id'] = Variable<String>(breedId);
    if (!nullToAbsent || breedName != null) {
      map['breed_name'] = Variable<String>(breedName);
    }
    if (!nullToAbsent || supplierId != null) {
      map['supplier_id'] = Variable<String>(supplierId);
    }
    if (!nullToAbsent || supplierName != null) {
      map['supplier_name'] = Variable<String>(supplierName);
    }
    if (!nullToAbsent || startDate != null) {
      map['start_date'] = Variable<String>(startDate);
    }
    map['initial_count'] = Variable<int>(initialCount);
    map['current_count'] = Variable<int>(currentCount);
    if (!nullToAbsent || totalMortality != null) {
      map['total_mortality'] = Variable<int>(totalMortality);
    }
    if (!nullToAbsent || mortalityRate != null) {
      map['mortality_rate'] = Variable<double>(mortalityRate);
    }
    if (!nullToAbsent || targetWeight != null) {
      map['target_weight'] = Variable<double>(targetWeight);
    }
    if (!nullToAbsent || targetAge != null) {
      map['target_age'] = Variable<int>(targetAge);
    }
    map['housing_type'] = Variable<String>(housingType);
    map['status'] = Variable<String>(status);
    if (!nullToAbsent || ageDays != null) {
      map['age_days'] = Variable<int>(ageDays);
    }
    if (!nullToAbsent || chicksCollected != null) {
      map['chicks_collected'] = Variable<bool>(chicksCollected);
    }
    map['cached_at'] = Variable<DateTime>(cachedAt);
    return map;
  }

  CachedFlocksCompanion toCompanion(bool nullToAbsent) {
    return CachedFlocksCompanion(
      id: Value(id),
      name: Value(name),
      breedId: Value(breedId),
      breedName: breedName == null && nullToAbsent
          ? const Value.absent()
          : Value(breedName),
      supplierId: supplierId == null && nullToAbsent
          ? const Value.absent()
          : Value(supplierId),
      supplierName: supplierName == null && nullToAbsent
          ? const Value.absent()
          : Value(supplierName),
      startDate: startDate == null && nullToAbsent
          ? const Value.absent()
          : Value(startDate),
      initialCount: Value(initialCount),
      currentCount: Value(currentCount),
      totalMortality: totalMortality == null && nullToAbsent
          ? const Value.absent()
          : Value(totalMortality),
      mortalityRate: mortalityRate == null && nullToAbsent
          ? const Value.absent()
          : Value(mortalityRate),
      targetWeight: targetWeight == null && nullToAbsent
          ? const Value.absent()
          : Value(targetWeight),
      targetAge: targetAge == null && nullToAbsent
          ? const Value.absent()
          : Value(targetAge),
      housingType: Value(housingType),
      status: Value(status),
      ageDays: ageDays == null && nullToAbsent
          ? const Value.absent()
          : Value(ageDays),
      chicksCollected: chicksCollected == null && nullToAbsent
          ? const Value.absent()
          : Value(chicksCollected),
      cachedAt: Value(cachedAt),
    );
  }

  factory CachedFlock.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedFlock(
      id: serializer.fromJson<String>(json['id']),
      name: serializer.fromJson<String>(json['name']),
      breedId: serializer.fromJson<String>(json['breedId']),
      breedName: serializer.fromJson<String?>(json['breedName']),
      supplierId: serializer.fromJson<String?>(json['supplierId']),
      supplierName: serializer.fromJson<String?>(json['supplierName']),
      startDate: serializer.fromJson<String?>(json['startDate']),
      initialCount: serializer.fromJson<int>(json['initialCount']),
      currentCount: serializer.fromJson<int>(json['currentCount']),
      totalMortality: serializer.fromJson<int?>(json['totalMortality']),
      mortalityRate: serializer.fromJson<double?>(json['mortalityRate']),
      targetWeight: serializer.fromJson<double?>(json['targetWeight']),
      targetAge: serializer.fromJson<int?>(json['targetAge']),
      housingType: serializer.fromJson<String>(json['housingType']),
      status: serializer.fromJson<String>(json['status']),
      ageDays: serializer.fromJson<int?>(json['ageDays']),
      chicksCollected: serializer.fromJson<bool?>(json['chicksCollected']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'name': serializer.toJson<String>(name),
      'breedId': serializer.toJson<String>(breedId),
      'breedName': serializer.toJson<String?>(breedName),
      'supplierId': serializer.toJson<String?>(supplierId),
      'supplierName': serializer.toJson<String?>(supplierName),
      'startDate': serializer.toJson<String?>(startDate),
      'initialCount': serializer.toJson<int>(initialCount),
      'currentCount': serializer.toJson<int>(currentCount),
      'totalMortality': serializer.toJson<int?>(totalMortality),
      'mortalityRate': serializer.toJson<double?>(mortalityRate),
      'targetWeight': serializer.toJson<double?>(targetWeight),
      'targetAge': serializer.toJson<int?>(targetAge),
      'housingType': serializer.toJson<String>(housingType),
      'status': serializer.toJson<String>(status),
      'ageDays': serializer.toJson<int?>(ageDays),
      'chicksCollected': serializer.toJson<bool?>(chicksCollected),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
    };
  }

  CachedFlock copyWith(
          {String? id,
          String? name,
          String? breedId,
          Value<String?> breedName = const Value.absent(),
          Value<String?> supplierId = const Value.absent(),
          Value<String?> supplierName = const Value.absent(),
          Value<String?> startDate = const Value.absent(),
          int? initialCount,
          int? currentCount,
          Value<int?> totalMortality = const Value.absent(),
          Value<double?> mortalityRate = const Value.absent(),
          Value<double?> targetWeight = const Value.absent(),
          Value<int?> targetAge = const Value.absent(),
          String? housingType,
          String? status,
          Value<int?> ageDays = const Value.absent(),
          Value<bool?> chicksCollected = const Value.absent(),
          DateTime? cachedAt}) =>
      CachedFlock(
        id: id ?? this.id,
        name: name ?? this.name,
        breedId: breedId ?? this.breedId,
        breedName: breedName.present ? breedName.value : this.breedName,
        supplierId: supplierId.present ? supplierId.value : this.supplierId,
        supplierName:
            supplierName.present ? supplierName.value : this.supplierName,
        startDate: startDate.present ? startDate.value : this.startDate,
        initialCount: initialCount ?? this.initialCount,
        currentCount: currentCount ?? this.currentCount,
        totalMortality:
            totalMortality.present ? totalMortality.value : this.totalMortality,
        mortalityRate:
            mortalityRate.present ? mortalityRate.value : this.mortalityRate,
        targetWeight:
            targetWeight.present ? targetWeight.value : this.targetWeight,
        targetAge: targetAge.present ? targetAge.value : this.targetAge,
        housingType: housingType ?? this.housingType,
        status: status ?? this.status,
        ageDays: ageDays.present ? ageDays.value : this.ageDays,
        chicksCollected: chicksCollected.present
            ? chicksCollected.value
            : this.chicksCollected,
        cachedAt: cachedAt ?? this.cachedAt,
      );
  CachedFlock copyWithCompanion(CachedFlocksCompanion data) {
    return CachedFlock(
      id: data.id.present ? data.id.value : this.id,
      name: data.name.present ? data.name.value : this.name,
      breedId: data.breedId.present ? data.breedId.value : this.breedId,
      breedName: data.breedName.present ? data.breedName.value : this.breedName,
      supplierId:
          data.supplierId.present ? data.supplierId.value : this.supplierId,
      supplierName: data.supplierName.present
          ? data.supplierName.value
          : this.supplierName,
      startDate: data.startDate.present ? data.startDate.value : this.startDate,
      initialCount: data.initialCount.present
          ? data.initialCount.value
          : this.initialCount,
      currentCount: data.currentCount.present
          ? data.currentCount.value
          : this.currentCount,
      totalMortality: data.totalMortality.present
          ? data.totalMortality.value
          : this.totalMortality,
      mortalityRate: data.mortalityRate.present
          ? data.mortalityRate.value
          : this.mortalityRate,
      targetWeight: data.targetWeight.present
          ? data.targetWeight.value
          : this.targetWeight,
      targetAge: data.targetAge.present ? data.targetAge.value : this.targetAge,
      housingType:
          data.housingType.present ? data.housingType.value : this.housingType,
      status: data.status.present ? data.status.value : this.status,
      ageDays: data.ageDays.present ? data.ageDays.value : this.ageDays,
      chicksCollected: data.chicksCollected.present
          ? data.chicksCollected.value
          : this.chicksCollected,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedFlock(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('breedId: $breedId, ')
          ..write('breedName: $breedName, ')
          ..write('supplierId: $supplierId, ')
          ..write('supplierName: $supplierName, ')
          ..write('startDate: $startDate, ')
          ..write('initialCount: $initialCount, ')
          ..write('currentCount: $currentCount, ')
          ..write('totalMortality: $totalMortality, ')
          ..write('mortalityRate: $mortalityRate, ')
          ..write('targetWeight: $targetWeight, ')
          ..write('targetAge: $targetAge, ')
          ..write('housingType: $housingType, ')
          ..write('status: $status, ')
          ..write('ageDays: $ageDays, ')
          ..write('chicksCollected: $chicksCollected, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      id,
      name,
      breedId,
      breedName,
      supplierId,
      supplierName,
      startDate,
      initialCount,
      currentCount,
      totalMortality,
      mortalityRate,
      targetWeight,
      targetAge,
      housingType,
      status,
      ageDays,
      chicksCollected,
      cachedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedFlock &&
          other.id == this.id &&
          other.name == this.name &&
          other.breedId == this.breedId &&
          other.breedName == this.breedName &&
          other.supplierId == this.supplierId &&
          other.supplierName == this.supplierName &&
          other.startDate == this.startDate &&
          other.initialCount == this.initialCount &&
          other.currentCount == this.currentCount &&
          other.totalMortality == this.totalMortality &&
          other.mortalityRate == this.mortalityRate &&
          other.targetWeight == this.targetWeight &&
          other.targetAge == this.targetAge &&
          other.housingType == this.housingType &&
          other.status == this.status &&
          other.ageDays == this.ageDays &&
          other.chicksCollected == this.chicksCollected &&
          other.cachedAt == this.cachedAt);
}

class CachedFlocksCompanion extends UpdateCompanion<CachedFlock> {
  final Value<String> id;
  final Value<String> name;
  final Value<String> breedId;
  final Value<String?> breedName;
  final Value<String?> supplierId;
  final Value<String?> supplierName;
  final Value<String?> startDate;
  final Value<int> initialCount;
  final Value<int> currentCount;
  final Value<int?> totalMortality;
  final Value<double?> mortalityRate;
  final Value<double?> targetWeight;
  final Value<int?> targetAge;
  final Value<String> housingType;
  final Value<String> status;
  final Value<int?> ageDays;
  final Value<bool?> chicksCollected;
  final Value<DateTime> cachedAt;
  final Value<int> rowid;
  const CachedFlocksCompanion({
    this.id = const Value.absent(),
    this.name = const Value.absent(),
    this.breedId = const Value.absent(),
    this.breedName = const Value.absent(),
    this.supplierId = const Value.absent(),
    this.supplierName = const Value.absent(),
    this.startDate = const Value.absent(),
    this.initialCount = const Value.absent(),
    this.currentCount = const Value.absent(),
    this.totalMortality = const Value.absent(),
    this.mortalityRate = const Value.absent(),
    this.targetWeight = const Value.absent(),
    this.targetAge = const Value.absent(),
    this.housingType = const Value.absent(),
    this.status = const Value.absent(),
    this.ageDays = const Value.absent(),
    this.chicksCollected = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedFlocksCompanion.insert({
    required String id,
    required String name,
    this.breedId = const Value.absent(),
    this.breedName = const Value.absent(),
    this.supplierId = const Value.absent(),
    this.supplierName = const Value.absent(),
    this.startDate = const Value.absent(),
    this.initialCount = const Value.absent(),
    this.currentCount = const Value.absent(),
    this.totalMortality = const Value.absent(),
    this.mortalityRate = const Value.absent(),
    this.targetWeight = const Value.absent(),
    this.targetAge = const Value.absent(),
    this.housingType = const Value.absent(),
    this.status = const Value.absent(),
    this.ageDays = const Value.absent(),
    this.chicksCollected = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        name = Value(name);
  static Insertable<CachedFlock> custom({
    Expression<String>? id,
    Expression<String>? name,
    Expression<String>? breedId,
    Expression<String>? breedName,
    Expression<String>? supplierId,
    Expression<String>? supplierName,
    Expression<String>? startDate,
    Expression<int>? initialCount,
    Expression<int>? currentCount,
    Expression<int>? totalMortality,
    Expression<double>? mortalityRate,
    Expression<double>? targetWeight,
    Expression<int>? targetAge,
    Expression<String>? housingType,
    Expression<String>? status,
    Expression<int>? ageDays,
    Expression<bool>? chicksCollected,
    Expression<DateTime>? cachedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (name != null) 'name': name,
      if (breedId != null) 'breed_id': breedId,
      if (breedName != null) 'breed_name': breedName,
      if (supplierId != null) 'supplier_id': supplierId,
      if (supplierName != null) 'supplier_name': supplierName,
      if (startDate != null) 'start_date': startDate,
      if (initialCount != null) 'initial_count': initialCount,
      if (currentCount != null) 'current_count': currentCount,
      if (totalMortality != null) 'total_mortality': totalMortality,
      if (mortalityRate != null) 'mortality_rate': mortalityRate,
      if (targetWeight != null) 'target_weight': targetWeight,
      if (targetAge != null) 'target_age': targetAge,
      if (housingType != null) 'housing_type': housingType,
      if (status != null) 'status': status,
      if (ageDays != null) 'age_days': ageDays,
      if (chicksCollected != null) 'chicks_collected': chicksCollected,
      if (cachedAt != null) 'cached_at': cachedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedFlocksCompanion copyWith(
      {Value<String>? id,
      Value<String>? name,
      Value<String>? breedId,
      Value<String?>? breedName,
      Value<String?>? supplierId,
      Value<String?>? supplierName,
      Value<String?>? startDate,
      Value<int>? initialCount,
      Value<int>? currentCount,
      Value<int?>? totalMortality,
      Value<double?>? mortalityRate,
      Value<double?>? targetWeight,
      Value<int?>? targetAge,
      Value<String>? housingType,
      Value<String>? status,
      Value<int?>? ageDays,
      Value<bool?>? chicksCollected,
      Value<DateTime>? cachedAt,
      Value<int>? rowid}) {
    return CachedFlocksCompanion(
      id: id ?? this.id,
      name: name ?? this.name,
      breedId: breedId ?? this.breedId,
      breedName: breedName ?? this.breedName,
      supplierId: supplierId ?? this.supplierId,
      supplierName: supplierName ?? this.supplierName,
      startDate: startDate ?? this.startDate,
      initialCount: initialCount ?? this.initialCount,
      currentCount: currentCount ?? this.currentCount,
      totalMortality: totalMortality ?? this.totalMortality,
      mortalityRate: mortalityRate ?? this.mortalityRate,
      targetWeight: targetWeight ?? this.targetWeight,
      targetAge: targetAge ?? this.targetAge,
      housingType: housingType ?? this.housingType,
      status: status ?? this.status,
      ageDays: ageDays ?? this.ageDays,
      chicksCollected: chicksCollected ?? this.chicksCollected,
      cachedAt: cachedAt ?? this.cachedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (breedId.present) {
      map['breed_id'] = Variable<String>(breedId.value);
    }
    if (breedName.present) {
      map['breed_name'] = Variable<String>(breedName.value);
    }
    if (supplierId.present) {
      map['supplier_id'] = Variable<String>(supplierId.value);
    }
    if (supplierName.present) {
      map['supplier_name'] = Variable<String>(supplierName.value);
    }
    if (startDate.present) {
      map['start_date'] = Variable<String>(startDate.value);
    }
    if (initialCount.present) {
      map['initial_count'] = Variable<int>(initialCount.value);
    }
    if (currentCount.present) {
      map['current_count'] = Variable<int>(currentCount.value);
    }
    if (totalMortality.present) {
      map['total_mortality'] = Variable<int>(totalMortality.value);
    }
    if (mortalityRate.present) {
      map['mortality_rate'] = Variable<double>(mortalityRate.value);
    }
    if (targetWeight.present) {
      map['target_weight'] = Variable<double>(targetWeight.value);
    }
    if (targetAge.present) {
      map['target_age'] = Variable<int>(targetAge.value);
    }
    if (housingType.present) {
      map['housing_type'] = Variable<String>(housingType.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (ageDays.present) {
      map['age_days'] = Variable<int>(ageDays.value);
    }
    if (chicksCollected.present) {
      map['chicks_collected'] = Variable<bool>(chicksCollected.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedFlocksCompanion(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('breedId: $breedId, ')
          ..write('breedName: $breedName, ')
          ..write('supplierId: $supplierId, ')
          ..write('supplierName: $supplierName, ')
          ..write('startDate: $startDate, ')
          ..write('initialCount: $initialCount, ')
          ..write('currentCount: $currentCount, ')
          ..write('totalMortality: $totalMortality, ')
          ..write('mortalityRate: $mortalityRate, ')
          ..write('targetWeight: $targetWeight, ')
          ..write('targetAge: $targetAge, ')
          ..write('housingType: $housingType, ')
          ..write('status: $status, ')
          ..write('ageDays: $ageDays, ')
          ..write('chicksCollected: $chicksCollected, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedGrowthRecordsTable extends CachedGrowthRecords
    with TableInfo<$CachedGrowthRecordsTable, CachedGrowthRecord> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedGrowthRecordsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _flockIdMeta =
      const VerificationMeta('flockId');
  @override
  late final GeneratedColumn<String> flockId = GeneratedColumn<String>(
      'flock_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _recordDateMeta =
      const VerificationMeta('recordDate');
  @override
  late final GeneratedColumn<String> recordDate = GeneratedColumn<String>(
      'record_date', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _sampleSizeMeta =
      const VerificationMeta('sampleSize');
  @override
  late final GeneratedColumn<int> sampleSize = GeneratedColumn<int>(
      'sample_size', aliasedName, true,
      type: DriftSqlType.int, requiredDuringInsert: false);
  static const VerificationMeta _avgWeightMeta =
      const VerificationMeta('avgWeight');
  @override
  late final GeneratedColumn<double> avgWeight = GeneratedColumn<double>(
      'avg_weight', aliasedName, true,
      type: DriftSqlType.double, requiredDuringInsert: false);
  static const VerificationMeta _notesMeta = const VerificationMeta('notes');
  @override
  late final GeneratedColumn<String> notes = GeneratedColumn<String>(
      'notes', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _cachedAtMeta =
      const VerificationMeta('cachedAt');
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
      'cached_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  @override
  List<GeneratedColumn> get $columns =>
      [id, flockId, recordDate, sampleSize, avgWeight, notes, cachedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_growth_records';
  @override
  VerificationContext validateIntegrity(Insertable<CachedGrowthRecord> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('flock_id')) {
      context.handle(_flockIdMeta,
          flockId.isAcceptableOrUnknown(data['flock_id']!, _flockIdMeta));
    } else if (isInserting) {
      context.missing(_flockIdMeta);
    }
    if (data.containsKey('record_date')) {
      context.handle(
          _recordDateMeta,
          recordDate.isAcceptableOrUnknown(
              data['record_date']!, _recordDateMeta));
    } else if (isInserting) {
      context.missing(_recordDateMeta);
    }
    if (data.containsKey('sample_size')) {
      context.handle(
          _sampleSizeMeta,
          sampleSize.isAcceptableOrUnknown(
              data['sample_size']!, _sampleSizeMeta));
    }
    if (data.containsKey('avg_weight')) {
      context.handle(_avgWeightMeta,
          avgWeight.isAcceptableOrUnknown(data['avg_weight']!, _avgWeightMeta));
    }
    if (data.containsKey('notes')) {
      context.handle(
          _notesMeta, notes.isAcceptableOrUnknown(data['notes']!, _notesMeta));
    }
    if (data.containsKey('cached_at')) {
      context.handle(_cachedAtMeta,
          cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CachedGrowthRecord map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedGrowthRecord(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      flockId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}flock_id'])!,
      recordDate: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}record_date'])!,
      sampleSize: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}sample_size']),
      avgWeight: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}avg_weight']),
      notes: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}notes']),
      cachedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}cached_at'])!,
    );
  }

  @override
  $CachedGrowthRecordsTable createAlias(String alias) {
    return $CachedGrowthRecordsTable(attachedDatabase, alias);
  }
}

class CachedGrowthRecord extends DataClass
    implements Insertable<CachedGrowthRecord> {
  final String id;
  final String flockId;
  final String recordDate;
  final int? sampleSize;
  final double? avgWeight;
  final String? notes;
  final DateTime cachedAt;
  const CachedGrowthRecord(
      {required this.id,
      required this.flockId,
      required this.recordDate,
      this.sampleSize,
      this.avgWeight,
      this.notes,
      required this.cachedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['flock_id'] = Variable<String>(flockId);
    map['record_date'] = Variable<String>(recordDate);
    if (!nullToAbsent || sampleSize != null) {
      map['sample_size'] = Variable<int>(sampleSize);
    }
    if (!nullToAbsent || avgWeight != null) {
      map['avg_weight'] = Variable<double>(avgWeight);
    }
    if (!nullToAbsent || notes != null) {
      map['notes'] = Variable<String>(notes);
    }
    map['cached_at'] = Variable<DateTime>(cachedAt);
    return map;
  }

  CachedGrowthRecordsCompanion toCompanion(bool nullToAbsent) {
    return CachedGrowthRecordsCompanion(
      id: Value(id),
      flockId: Value(flockId),
      recordDate: Value(recordDate),
      sampleSize: sampleSize == null && nullToAbsent
          ? const Value.absent()
          : Value(sampleSize),
      avgWeight: avgWeight == null && nullToAbsent
          ? const Value.absent()
          : Value(avgWeight),
      notes:
          notes == null && nullToAbsent ? const Value.absent() : Value(notes),
      cachedAt: Value(cachedAt),
    );
  }

  factory CachedGrowthRecord.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedGrowthRecord(
      id: serializer.fromJson<String>(json['id']),
      flockId: serializer.fromJson<String>(json['flockId']),
      recordDate: serializer.fromJson<String>(json['recordDate']),
      sampleSize: serializer.fromJson<int?>(json['sampleSize']),
      avgWeight: serializer.fromJson<double?>(json['avgWeight']),
      notes: serializer.fromJson<String?>(json['notes']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'flockId': serializer.toJson<String>(flockId),
      'recordDate': serializer.toJson<String>(recordDate),
      'sampleSize': serializer.toJson<int?>(sampleSize),
      'avgWeight': serializer.toJson<double?>(avgWeight),
      'notes': serializer.toJson<String?>(notes),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
    };
  }

  CachedGrowthRecord copyWith(
          {String? id,
          String? flockId,
          String? recordDate,
          Value<int?> sampleSize = const Value.absent(),
          Value<double?> avgWeight = const Value.absent(),
          Value<String?> notes = const Value.absent(),
          DateTime? cachedAt}) =>
      CachedGrowthRecord(
        id: id ?? this.id,
        flockId: flockId ?? this.flockId,
        recordDate: recordDate ?? this.recordDate,
        sampleSize: sampleSize.present ? sampleSize.value : this.sampleSize,
        avgWeight: avgWeight.present ? avgWeight.value : this.avgWeight,
        notes: notes.present ? notes.value : this.notes,
        cachedAt: cachedAt ?? this.cachedAt,
      );
  CachedGrowthRecord copyWithCompanion(CachedGrowthRecordsCompanion data) {
    return CachedGrowthRecord(
      id: data.id.present ? data.id.value : this.id,
      flockId: data.flockId.present ? data.flockId.value : this.flockId,
      recordDate:
          data.recordDate.present ? data.recordDate.value : this.recordDate,
      sampleSize:
          data.sampleSize.present ? data.sampleSize.value : this.sampleSize,
      avgWeight: data.avgWeight.present ? data.avgWeight.value : this.avgWeight,
      notes: data.notes.present ? data.notes.value : this.notes,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedGrowthRecord(')
          ..write('id: $id, ')
          ..write('flockId: $flockId, ')
          ..write('recordDate: $recordDate, ')
          ..write('sampleSize: $sampleSize, ')
          ..write('avgWeight: $avgWeight, ')
          ..write('notes: $notes, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      id, flockId, recordDate, sampleSize, avgWeight, notes, cachedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedGrowthRecord &&
          other.id == this.id &&
          other.flockId == this.flockId &&
          other.recordDate == this.recordDate &&
          other.sampleSize == this.sampleSize &&
          other.avgWeight == this.avgWeight &&
          other.notes == this.notes &&
          other.cachedAt == this.cachedAt);
}

class CachedGrowthRecordsCompanion extends UpdateCompanion<CachedGrowthRecord> {
  final Value<String> id;
  final Value<String> flockId;
  final Value<String> recordDate;
  final Value<int?> sampleSize;
  final Value<double?> avgWeight;
  final Value<String?> notes;
  final Value<DateTime> cachedAt;
  final Value<int> rowid;
  const CachedGrowthRecordsCompanion({
    this.id = const Value.absent(),
    this.flockId = const Value.absent(),
    this.recordDate = const Value.absent(),
    this.sampleSize = const Value.absent(),
    this.avgWeight = const Value.absent(),
    this.notes = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedGrowthRecordsCompanion.insert({
    required String id,
    required String flockId,
    required String recordDate,
    this.sampleSize = const Value.absent(),
    this.avgWeight = const Value.absent(),
    this.notes = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        flockId = Value(flockId),
        recordDate = Value(recordDate);
  static Insertable<CachedGrowthRecord> custom({
    Expression<String>? id,
    Expression<String>? flockId,
    Expression<String>? recordDate,
    Expression<int>? sampleSize,
    Expression<double>? avgWeight,
    Expression<String>? notes,
    Expression<DateTime>? cachedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (flockId != null) 'flock_id': flockId,
      if (recordDate != null) 'record_date': recordDate,
      if (sampleSize != null) 'sample_size': sampleSize,
      if (avgWeight != null) 'avg_weight': avgWeight,
      if (notes != null) 'notes': notes,
      if (cachedAt != null) 'cached_at': cachedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedGrowthRecordsCompanion copyWith(
      {Value<String>? id,
      Value<String>? flockId,
      Value<String>? recordDate,
      Value<int?>? sampleSize,
      Value<double?>? avgWeight,
      Value<String?>? notes,
      Value<DateTime>? cachedAt,
      Value<int>? rowid}) {
    return CachedGrowthRecordsCompanion(
      id: id ?? this.id,
      flockId: flockId ?? this.flockId,
      recordDate: recordDate ?? this.recordDate,
      sampleSize: sampleSize ?? this.sampleSize,
      avgWeight: avgWeight ?? this.avgWeight,
      notes: notes ?? this.notes,
      cachedAt: cachedAt ?? this.cachedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (flockId.present) {
      map['flock_id'] = Variable<String>(flockId.value);
    }
    if (recordDate.present) {
      map['record_date'] = Variable<String>(recordDate.value);
    }
    if (sampleSize.present) {
      map['sample_size'] = Variable<int>(sampleSize.value);
    }
    if (avgWeight.present) {
      map['avg_weight'] = Variable<double>(avgWeight.value);
    }
    if (notes.present) {
      map['notes'] = Variable<String>(notes.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedGrowthRecordsCompanion(')
          ..write('id: $id, ')
          ..write('flockId: $flockId, ')
          ..write('recordDate: $recordDate, ')
          ..write('sampleSize: $sampleSize, ')
          ..write('avgWeight: $avgWeight, ')
          ..write('notes: $notes, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedFeedRecordsTable extends CachedFeedRecords
    with TableInfo<$CachedFeedRecordsTable, CachedFeedRecord> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedFeedRecordsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _flockIdMeta =
      const VerificationMeta('flockId');
  @override
  late final GeneratedColumn<String> flockId = GeneratedColumn<String>(
      'flock_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _recordDateMeta =
      const VerificationMeta('recordDate');
  @override
  late final GeneratedColumn<String> recordDate = GeneratedColumn<String>(
      'record_date', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _feedTypeMeta =
      const VerificationMeta('feedType');
  @override
  late final GeneratedColumn<String> feedType = GeneratedColumn<String>(
      'feed_type', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _feedBrandMeta =
      const VerificationMeta('feedBrand');
  @override
  late final GeneratedColumn<String> feedBrand = GeneratedColumn<String>(
      'feed_brand', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _quantityKgMeta =
      const VerificationMeta('quantityKg');
  @override
  late final GeneratedColumn<double> quantityKg = GeneratedColumn<double>(
      'quantity_kg', aliasedName, true,
      type: DriftSqlType.double, requiredDuringInsert: false);
  static const VerificationMeta _costZmwMeta =
      const VerificationMeta('costZmw');
  @override
  late final GeneratedColumn<double> costZmw = GeneratedColumn<double>(
      'cost_zmw', aliasedName, true,
      type: DriftSqlType.double, requiredDuringInsert: false);
  static const VerificationMeta _notesMeta = const VerificationMeta('notes');
  @override
  late final GeneratedColumn<String> notes = GeneratedColumn<String>(
      'notes', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _cachedAtMeta =
      const VerificationMeta('cachedAt');
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
      'cached_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        flockId,
        recordDate,
        feedType,
        feedBrand,
        quantityKg,
        costZmw,
        notes,
        cachedAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_feed_records';
  @override
  VerificationContext validateIntegrity(Insertable<CachedFeedRecord> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('flock_id')) {
      context.handle(_flockIdMeta,
          flockId.isAcceptableOrUnknown(data['flock_id']!, _flockIdMeta));
    } else if (isInserting) {
      context.missing(_flockIdMeta);
    }
    if (data.containsKey('record_date')) {
      context.handle(
          _recordDateMeta,
          recordDate.isAcceptableOrUnknown(
              data['record_date']!, _recordDateMeta));
    } else if (isInserting) {
      context.missing(_recordDateMeta);
    }
    if (data.containsKey('feed_type')) {
      context.handle(_feedTypeMeta,
          feedType.isAcceptableOrUnknown(data['feed_type']!, _feedTypeMeta));
    }
    if (data.containsKey('feed_brand')) {
      context.handle(_feedBrandMeta,
          feedBrand.isAcceptableOrUnknown(data['feed_brand']!, _feedBrandMeta));
    }
    if (data.containsKey('quantity_kg')) {
      context.handle(
          _quantityKgMeta,
          quantityKg.isAcceptableOrUnknown(
              data['quantity_kg']!, _quantityKgMeta));
    }
    if (data.containsKey('cost_zmw')) {
      context.handle(_costZmwMeta,
          costZmw.isAcceptableOrUnknown(data['cost_zmw']!, _costZmwMeta));
    }
    if (data.containsKey('notes')) {
      context.handle(
          _notesMeta, notes.isAcceptableOrUnknown(data['notes']!, _notesMeta));
    }
    if (data.containsKey('cached_at')) {
      context.handle(_cachedAtMeta,
          cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CachedFeedRecord map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedFeedRecord(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      flockId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}flock_id'])!,
      recordDate: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}record_date'])!,
      feedType: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}feed_type']),
      feedBrand: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}feed_brand']),
      quantityKg: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}quantity_kg']),
      costZmw: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}cost_zmw']),
      notes: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}notes']),
      cachedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}cached_at'])!,
    );
  }

  @override
  $CachedFeedRecordsTable createAlias(String alias) {
    return $CachedFeedRecordsTable(attachedDatabase, alias);
  }
}

class CachedFeedRecord extends DataClass
    implements Insertable<CachedFeedRecord> {
  final String id;
  final String flockId;
  final String recordDate;
  final String? feedType;
  final String? feedBrand;
  final double? quantityKg;
  final double? costZmw;
  final String? notes;
  final DateTime cachedAt;
  const CachedFeedRecord(
      {required this.id,
      required this.flockId,
      required this.recordDate,
      this.feedType,
      this.feedBrand,
      this.quantityKg,
      this.costZmw,
      this.notes,
      required this.cachedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['flock_id'] = Variable<String>(flockId);
    map['record_date'] = Variable<String>(recordDate);
    if (!nullToAbsent || feedType != null) {
      map['feed_type'] = Variable<String>(feedType);
    }
    if (!nullToAbsent || feedBrand != null) {
      map['feed_brand'] = Variable<String>(feedBrand);
    }
    if (!nullToAbsent || quantityKg != null) {
      map['quantity_kg'] = Variable<double>(quantityKg);
    }
    if (!nullToAbsent || costZmw != null) {
      map['cost_zmw'] = Variable<double>(costZmw);
    }
    if (!nullToAbsent || notes != null) {
      map['notes'] = Variable<String>(notes);
    }
    map['cached_at'] = Variable<DateTime>(cachedAt);
    return map;
  }

  CachedFeedRecordsCompanion toCompanion(bool nullToAbsent) {
    return CachedFeedRecordsCompanion(
      id: Value(id),
      flockId: Value(flockId),
      recordDate: Value(recordDate),
      feedType: feedType == null && nullToAbsent
          ? const Value.absent()
          : Value(feedType),
      feedBrand: feedBrand == null && nullToAbsent
          ? const Value.absent()
          : Value(feedBrand),
      quantityKg: quantityKg == null && nullToAbsent
          ? const Value.absent()
          : Value(quantityKg),
      costZmw: costZmw == null && nullToAbsent
          ? const Value.absent()
          : Value(costZmw),
      notes:
          notes == null && nullToAbsent ? const Value.absent() : Value(notes),
      cachedAt: Value(cachedAt),
    );
  }

  factory CachedFeedRecord.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedFeedRecord(
      id: serializer.fromJson<String>(json['id']),
      flockId: serializer.fromJson<String>(json['flockId']),
      recordDate: serializer.fromJson<String>(json['recordDate']),
      feedType: serializer.fromJson<String?>(json['feedType']),
      feedBrand: serializer.fromJson<String?>(json['feedBrand']),
      quantityKg: serializer.fromJson<double?>(json['quantityKg']),
      costZmw: serializer.fromJson<double?>(json['costZmw']),
      notes: serializer.fromJson<String?>(json['notes']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'flockId': serializer.toJson<String>(flockId),
      'recordDate': serializer.toJson<String>(recordDate),
      'feedType': serializer.toJson<String?>(feedType),
      'feedBrand': serializer.toJson<String?>(feedBrand),
      'quantityKg': serializer.toJson<double?>(quantityKg),
      'costZmw': serializer.toJson<double?>(costZmw),
      'notes': serializer.toJson<String?>(notes),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
    };
  }

  CachedFeedRecord copyWith(
          {String? id,
          String? flockId,
          String? recordDate,
          Value<String?> feedType = const Value.absent(),
          Value<String?> feedBrand = const Value.absent(),
          Value<double?> quantityKg = const Value.absent(),
          Value<double?> costZmw = const Value.absent(),
          Value<String?> notes = const Value.absent(),
          DateTime? cachedAt}) =>
      CachedFeedRecord(
        id: id ?? this.id,
        flockId: flockId ?? this.flockId,
        recordDate: recordDate ?? this.recordDate,
        feedType: feedType.present ? feedType.value : this.feedType,
        feedBrand: feedBrand.present ? feedBrand.value : this.feedBrand,
        quantityKg: quantityKg.present ? quantityKg.value : this.quantityKg,
        costZmw: costZmw.present ? costZmw.value : this.costZmw,
        notes: notes.present ? notes.value : this.notes,
        cachedAt: cachedAt ?? this.cachedAt,
      );
  CachedFeedRecord copyWithCompanion(CachedFeedRecordsCompanion data) {
    return CachedFeedRecord(
      id: data.id.present ? data.id.value : this.id,
      flockId: data.flockId.present ? data.flockId.value : this.flockId,
      recordDate:
          data.recordDate.present ? data.recordDate.value : this.recordDate,
      feedType: data.feedType.present ? data.feedType.value : this.feedType,
      feedBrand: data.feedBrand.present ? data.feedBrand.value : this.feedBrand,
      quantityKg:
          data.quantityKg.present ? data.quantityKg.value : this.quantityKg,
      costZmw: data.costZmw.present ? data.costZmw.value : this.costZmw,
      notes: data.notes.present ? data.notes.value : this.notes,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedFeedRecord(')
          ..write('id: $id, ')
          ..write('flockId: $flockId, ')
          ..write('recordDate: $recordDate, ')
          ..write('feedType: $feedType, ')
          ..write('feedBrand: $feedBrand, ')
          ..write('quantityKg: $quantityKg, ')
          ..write('costZmw: $costZmw, ')
          ..write('notes: $notes, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, flockId, recordDate, feedType, feedBrand,
      quantityKg, costZmw, notes, cachedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedFeedRecord &&
          other.id == this.id &&
          other.flockId == this.flockId &&
          other.recordDate == this.recordDate &&
          other.feedType == this.feedType &&
          other.feedBrand == this.feedBrand &&
          other.quantityKg == this.quantityKg &&
          other.costZmw == this.costZmw &&
          other.notes == this.notes &&
          other.cachedAt == this.cachedAt);
}

class CachedFeedRecordsCompanion extends UpdateCompanion<CachedFeedRecord> {
  final Value<String> id;
  final Value<String> flockId;
  final Value<String> recordDate;
  final Value<String?> feedType;
  final Value<String?> feedBrand;
  final Value<double?> quantityKg;
  final Value<double?> costZmw;
  final Value<String?> notes;
  final Value<DateTime> cachedAt;
  final Value<int> rowid;
  const CachedFeedRecordsCompanion({
    this.id = const Value.absent(),
    this.flockId = const Value.absent(),
    this.recordDate = const Value.absent(),
    this.feedType = const Value.absent(),
    this.feedBrand = const Value.absent(),
    this.quantityKg = const Value.absent(),
    this.costZmw = const Value.absent(),
    this.notes = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedFeedRecordsCompanion.insert({
    required String id,
    required String flockId,
    required String recordDate,
    this.feedType = const Value.absent(),
    this.feedBrand = const Value.absent(),
    this.quantityKg = const Value.absent(),
    this.costZmw = const Value.absent(),
    this.notes = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        flockId = Value(flockId),
        recordDate = Value(recordDate);
  static Insertable<CachedFeedRecord> custom({
    Expression<String>? id,
    Expression<String>? flockId,
    Expression<String>? recordDate,
    Expression<String>? feedType,
    Expression<String>? feedBrand,
    Expression<double>? quantityKg,
    Expression<double>? costZmw,
    Expression<String>? notes,
    Expression<DateTime>? cachedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (flockId != null) 'flock_id': flockId,
      if (recordDate != null) 'record_date': recordDate,
      if (feedType != null) 'feed_type': feedType,
      if (feedBrand != null) 'feed_brand': feedBrand,
      if (quantityKg != null) 'quantity_kg': quantityKg,
      if (costZmw != null) 'cost_zmw': costZmw,
      if (notes != null) 'notes': notes,
      if (cachedAt != null) 'cached_at': cachedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedFeedRecordsCompanion copyWith(
      {Value<String>? id,
      Value<String>? flockId,
      Value<String>? recordDate,
      Value<String?>? feedType,
      Value<String?>? feedBrand,
      Value<double?>? quantityKg,
      Value<double?>? costZmw,
      Value<String?>? notes,
      Value<DateTime>? cachedAt,
      Value<int>? rowid}) {
    return CachedFeedRecordsCompanion(
      id: id ?? this.id,
      flockId: flockId ?? this.flockId,
      recordDate: recordDate ?? this.recordDate,
      feedType: feedType ?? this.feedType,
      feedBrand: feedBrand ?? this.feedBrand,
      quantityKg: quantityKg ?? this.quantityKg,
      costZmw: costZmw ?? this.costZmw,
      notes: notes ?? this.notes,
      cachedAt: cachedAt ?? this.cachedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (flockId.present) {
      map['flock_id'] = Variable<String>(flockId.value);
    }
    if (recordDate.present) {
      map['record_date'] = Variable<String>(recordDate.value);
    }
    if (feedType.present) {
      map['feed_type'] = Variable<String>(feedType.value);
    }
    if (feedBrand.present) {
      map['feed_brand'] = Variable<String>(feedBrand.value);
    }
    if (quantityKg.present) {
      map['quantity_kg'] = Variable<double>(quantityKg.value);
    }
    if (costZmw.present) {
      map['cost_zmw'] = Variable<double>(costZmw.value);
    }
    if (notes.present) {
      map['notes'] = Variable<String>(notes.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedFeedRecordsCompanion(')
          ..write('id: $id, ')
          ..write('flockId: $flockId, ')
          ..write('recordDate: $recordDate, ')
          ..write('feedType: $feedType, ')
          ..write('feedBrand: $feedBrand, ')
          ..write('quantityKg: $quantityKg, ')
          ..write('costZmw: $costZmw, ')
          ..write('notes: $notes, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedWaterRecordsTable extends CachedWaterRecords
    with TableInfo<$CachedWaterRecordsTable, CachedWaterRecord> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedWaterRecordsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _flockIdMeta =
      const VerificationMeta('flockId');
  @override
  late final GeneratedColumn<String> flockId = GeneratedColumn<String>(
      'flock_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _recordDateMeta =
      const VerificationMeta('recordDate');
  @override
  late final GeneratedColumn<String> recordDate = GeneratedColumn<String>(
      'record_date', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _quantityLitersMeta =
      const VerificationMeta('quantityLiters');
  @override
  late final GeneratedColumn<double> quantityLiters = GeneratedColumn<double>(
      'quantity_liters', aliasedName, true,
      type: DriftSqlType.double, requiredDuringInsert: false);
  static const VerificationMeta _phMeta = const VerificationMeta('ph');
  @override
  late final GeneratedColumn<double> ph = GeneratedColumn<double>(
      'ph', aliasedName, true,
      type: DriftSqlType.double, requiredDuringInsert: false);
  static const VerificationMeta _temperatureMeta =
      const VerificationMeta('temperature');
  @override
  late final GeneratedColumn<double> temperature = GeneratedColumn<double>(
      'temperature', aliasedName, true,
      type: DriftSqlType.double, requiredDuringInsert: false);
  static const VerificationMeta _costZmwMeta =
      const VerificationMeta('costZmw');
  @override
  late final GeneratedColumn<double> costZmw = GeneratedColumn<double>(
      'cost_zmw', aliasedName, true,
      type: DriftSqlType.double, requiredDuringInsert: false);
  static const VerificationMeta _notesMeta = const VerificationMeta('notes');
  @override
  late final GeneratedColumn<String> notes = GeneratedColumn<String>(
      'notes', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _cachedAtMeta =
      const VerificationMeta('cachedAt');
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
      'cached_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        flockId,
        recordDate,
        quantityLiters,
        ph,
        temperature,
        costZmw,
        notes,
        cachedAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_water_records';
  @override
  VerificationContext validateIntegrity(Insertable<CachedWaterRecord> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('flock_id')) {
      context.handle(_flockIdMeta,
          flockId.isAcceptableOrUnknown(data['flock_id']!, _flockIdMeta));
    } else if (isInserting) {
      context.missing(_flockIdMeta);
    }
    if (data.containsKey('record_date')) {
      context.handle(
          _recordDateMeta,
          recordDate.isAcceptableOrUnknown(
              data['record_date']!, _recordDateMeta));
    } else if (isInserting) {
      context.missing(_recordDateMeta);
    }
    if (data.containsKey('quantity_liters')) {
      context.handle(
          _quantityLitersMeta,
          quantityLiters.isAcceptableOrUnknown(
              data['quantity_liters']!, _quantityLitersMeta));
    }
    if (data.containsKey('ph')) {
      context.handle(_phMeta, ph.isAcceptableOrUnknown(data['ph']!, _phMeta));
    }
    if (data.containsKey('temperature')) {
      context.handle(
          _temperatureMeta,
          temperature.isAcceptableOrUnknown(
              data['temperature']!, _temperatureMeta));
    }
    if (data.containsKey('cost_zmw')) {
      context.handle(_costZmwMeta,
          costZmw.isAcceptableOrUnknown(data['cost_zmw']!, _costZmwMeta));
    }
    if (data.containsKey('notes')) {
      context.handle(
          _notesMeta, notes.isAcceptableOrUnknown(data['notes']!, _notesMeta));
    }
    if (data.containsKey('cached_at')) {
      context.handle(_cachedAtMeta,
          cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CachedWaterRecord map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedWaterRecord(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      flockId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}flock_id'])!,
      recordDate: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}record_date'])!,
      quantityLiters: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}quantity_liters']),
      ph: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}ph']),
      temperature: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}temperature']),
      costZmw: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}cost_zmw']),
      notes: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}notes']),
      cachedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}cached_at'])!,
    );
  }

  @override
  $CachedWaterRecordsTable createAlias(String alias) {
    return $CachedWaterRecordsTable(attachedDatabase, alias);
  }
}

class CachedWaterRecord extends DataClass
    implements Insertable<CachedWaterRecord> {
  final String id;
  final String flockId;
  final String recordDate;
  final double? quantityLiters;
  final double? ph;
  final double? temperature;
  final double? costZmw;
  final String? notes;
  final DateTime cachedAt;
  const CachedWaterRecord(
      {required this.id,
      required this.flockId,
      required this.recordDate,
      this.quantityLiters,
      this.ph,
      this.temperature,
      this.costZmw,
      this.notes,
      required this.cachedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['flock_id'] = Variable<String>(flockId);
    map['record_date'] = Variable<String>(recordDate);
    if (!nullToAbsent || quantityLiters != null) {
      map['quantity_liters'] = Variable<double>(quantityLiters);
    }
    if (!nullToAbsent || ph != null) {
      map['ph'] = Variable<double>(ph);
    }
    if (!nullToAbsent || temperature != null) {
      map['temperature'] = Variable<double>(temperature);
    }
    if (!nullToAbsent || costZmw != null) {
      map['cost_zmw'] = Variable<double>(costZmw);
    }
    if (!nullToAbsent || notes != null) {
      map['notes'] = Variable<String>(notes);
    }
    map['cached_at'] = Variable<DateTime>(cachedAt);
    return map;
  }

  CachedWaterRecordsCompanion toCompanion(bool nullToAbsent) {
    return CachedWaterRecordsCompanion(
      id: Value(id),
      flockId: Value(flockId),
      recordDate: Value(recordDate),
      quantityLiters: quantityLiters == null && nullToAbsent
          ? const Value.absent()
          : Value(quantityLiters),
      ph: ph == null && nullToAbsent ? const Value.absent() : Value(ph),
      temperature: temperature == null && nullToAbsent
          ? const Value.absent()
          : Value(temperature),
      costZmw: costZmw == null && nullToAbsent
          ? const Value.absent()
          : Value(costZmw),
      notes:
          notes == null && nullToAbsent ? const Value.absent() : Value(notes),
      cachedAt: Value(cachedAt),
    );
  }

  factory CachedWaterRecord.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedWaterRecord(
      id: serializer.fromJson<String>(json['id']),
      flockId: serializer.fromJson<String>(json['flockId']),
      recordDate: serializer.fromJson<String>(json['recordDate']),
      quantityLiters: serializer.fromJson<double?>(json['quantityLiters']),
      ph: serializer.fromJson<double?>(json['ph']),
      temperature: serializer.fromJson<double?>(json['temperature']),
      costZmw: serializer.fromJson<double?>(json['costZmw']),
      notes: serializer.fromJson<String?>(json['notes']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'flockId': serializer.toJson<String>(flockId),
      'recordDate': serializer.toJson<String>(recordDate),
      'quantityLiters': serializer.toJson<double?>(quantityLiters),
      'ph': serializer.toJson<double?>(ph),
      'temperature': serializer.toJson<double?>(temperature),
      'costZmw': serializer.toJson<double?>(costZmw),
      'notes': serializer.toJson<String?>(notes),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
    };
  }

  CachedWaterRecord copyWith(
          {String? id,
          String? flockId,
          String? recordDate,
          Value<double?> quantityLiters = const Value.absent(),
          Value<double?> ph = const Value.absent(),
          Value<double?> temperature = const Value.absent(),
          Value<double?> costZmw = const Value.absent(),
          Value<String?> notes = const Value.absent(),
          DateTime? cachedAt}) =>
      CachedWaterRecord(
        id: id ?? this.id,
        flockId: flockId ?? this.flockId,
        recordDate: recordDate ?? this.recordDate,
        quantityLiters:
            quantityLiters.present ? quantityLiters.value : this.quantityLiters,
        ph: ph.present ? ph.value : this.ph,
        temperature: temperature.present ? temperature.value : this.temperature,
        costZmw: costZmw.present ? costZmw.value : this.costZmw,
        notes: notes.present ? notes.value : this.notes,
        cachedAt: cachedAt ?? this.cachedAt,
      );
  CachedWaterRecord copyWithCompanion(CachedWaterRecordsCompanion data) {
    return CachedWaterRecord(
      id: data.id.present ? data.id.value : this.id,
      flockId: data.flockId.present ? data.flockId.value : this.flockId,
      recordDate:
          data.recordDate.present ? data.recordDate.value : this.recordDate,
      quantityLiters: data.quantityLiters.present
          ? data.quantityLiters.value
          : this.quantityLiters,
      ph: data.ph.present ? data.ph.value : this.ph,
      temperature:
          data.temperature.present ? data.temperature.value : this.temperature,
      costZmw: data.costZmw.present ? data.costZmw.value : this.costZmw,
      notes: data.notes.present ? data.notes.value : this.notes,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedWaterRecord(')
          ..write('id: $id, ')
          ..write('flockId: $flockId, ')
          ..write('recordDate: $recordDate, ')
          ..write('quantityLiters: $quantityLiters, ')
          ..write('ph: $ph, ')
          ..write('temperature: $temperature, ')
          ..write('costZmw: $costZmw, ')
          ..write('notes: $notes, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, flockId, recordDate, quantityLiters, ph,
      temperature, costZmw, notes, cachedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedWaterRecord &&
          other.id == this.id &&
          other.flockId == this.flockId &&
          other.recordDate == this.recordDate &&
          other.quantityLiters == this.quantityLiters &&
          other.ph == this.ph &&
          other.temperature == this.temperature &&
          other.costZmw == this.costZmw &&
          other.notes == this.notes &&
          other.cachedAt == this.cachedAt);
}

class CachedWaterRecordsCompanion extends UpdateCompanion<CachedWaterRecord> {
  final Value<String> id;
  final Value<String> flockId;
  final Value<String> recordDate;
  final Value<double?> quantityLiters;
  final Value<double?> ph;
  final Value<double?> temperature;
  final Value<double?> costZmw;
  final Value<String?> notes;
  final Value<DateTime> cachedAt;
  final Value<int> rowid;
  const CachedWaterRecordsCompanion({
    this.id = const Value.absent(),
    this.flockId = const Value.absent(),
    this.recordDate = const Value.absent(),
    this.quantityLiters = const Value.absent(),
    this.ph = const Value.absent(),
    this.temperature = const Value.absent(),
    this.costZmw = const Value.absent(),
    this.notes = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedWaterRecordsCompanion.insert({
    required String id,
    required String flockId,
    required String recordDate,
    this.quantityLiters = const Value.absent(),
    this.ph = const Value.absent(),
    this.temperature = const Value.absent(),
    this.costZmw = const Value.absent(),
    this.notes = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        flockId = Value(flockId),
        recordDate = Value(recordDate);
  static Insertable<CachedWaterRecord> custom({
    Expression<String>? id,
    Expression<String>? flockId,
    Expression<String>? recordDate,
    Expression<double>? quantityLiters,
    Expression<double>? ph,
    Expression<double>? temperature,
    Expression<double>? costZmw,
    Expression<String>? notes,
    Expression<DateTime>? cachedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (flockId != null) 'flock_id': flockId,
      if (recordDate != null) 'record_date': recordDate,
      if (quantityLiters != null) 'quantity_liters': quantityLiters,
      if (ph != null) 'ph': ph,
      if (temperature != null) 'temperature': temperature,
      if (costZmw != null) 'cost_zmw': costZmw,
      if (notes != null) 'notes': notes,
      if (cachedAt != null) 'cached_at': cachedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedWaterRecordsCompanion copyWith(
      {Value<String>? id,
      Value<String>? flockId,
      Value<String>? recordDate,
      Value<double?>? quantityLiters,
      Value<double?>? ph,
      Value<double?>? temperature,
      Value<double?>? costZmw,
      Value<String?>? notes,
      Value<DateTime>? cachedAt,
      Value<int>? rowid}) {
    return CachedWaterRecordsCompanion(
      id: id ?? this.id,
      flockId: flockId ?? this.flockId,
      recordDate: recordDate ?? this.recordDate,
      quantityLiters: quantityLiters ?? this.quantityLiters,
      ph: ph ?? this.ph,
      temperature: temperature ?? this.temperature,
      costZmw: costZmw ?? this.costZmw,
      notes: notes ?? this.notes,
      cachedAt: cachedAt ?? this.cachedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (flockId.present) {
      map['flock_id'] = Variable<String>(flockId.value);
    }
    if (recordDate.present) {
      map['record_date'] = Variable<String>(recordDate.value);
    }
    if (quantityLiters.present) {
      map['quantity_liters'] = Variable<double>(quantityLiters.value);
    }
    if (ph.present) {
      map['ph'] = Variable<double>(ph.value);
    }
    if (temperature.present) {
      map['temperature'] = Variable<double>(temperature.value);
    }
    if (costZmw.present) {
      map['cost_zmw'] = Variable<double>(costZmw.value);
    }
    if (notes.present) {
      map['notes'] = Variable<String>(notes.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedWaterRecordsCompanion(')
          ..write('id: $id, ')
          ..write('flockId: $flockId, ')
          ..write('recordDate: $recordDate, ')
          ..write('quantityLiters: $quantityLiters, ')
          ..write('ph: $ph, ')
          ..write('temperature: $temperature, ')
          ..write('costZmw: $costZmw, ')
          ..write('notes: $notes, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedMortalityEventsTable extends CachedMortalityEvents
    with TableInfo<$CachedMortalityEventsTable, CachedMortalityEvent> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedMortalityEventsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _flockIdMeta =
      const VerificationMeta('flockId');
  @override
  late final GeneratedColumn<String> flockId = GeneratedColumn<String>(
      'flock_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _eventDateMeta =
      const VerificationMeta('eventDate');
  @override
  late final GeneratedColumn<String> eventDate = GeneratedColumn<String>(
      'event_date', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _countMeta = const VerificationMeta('count');
  @override
  late final GeneratedColumn<int> count = GeneratedColumn<int>(
      'count', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _causeMeta = const VerificationMeta('cause');
  @override
  late final GeneratedColumn<String> cause = GeneratedColumn<String>(
      'cause', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _ageDaysMeta =
      const VerificationMeta('ageDays');
  @override
  late final GeneratedColumn<int> ageDays = GeneratedColumn<int>(
      'age_days', aliasedName, true,
      type: DriftSqlType.int, requiredDuringInsert: false);
  static const VerificationMeta _costZmwMeta =
      const VerificationMeta('costZmw');
  @override
  late final GeneratedColumn<double> costZmw = GeneratedColumn<double>(
      'cost_zmw', aliasedName, true,
      type: DriftSqlType.double, requiredDuringInsert: false);
  static const VerificationMeta _notesMeta = const VerificationMeta('notes');
  @override
  late final GeneratedColumn<String> notes = GeneratedColumn<String>(
      'notes', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _cachedAtMeta =
      const VerificationMeta('cachedAt');
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
      'cached_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  @override
  List<GeneratedColumn> get $columns =>
      [id, flockId, eventDate, count, cause, ageDays, costZmw, notes, cachedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_mortality_events';
  @override
  VerificationContext validateIntegrity(
      Insertable<CachedMortalityEvent> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('flock_id')) {
      context.handle(_flockIdMeta,
          flockId.isAcceptableOrUnknown(data['flock_id']!, _flockIdMeta));
    } else if (isInserting) {
      context.missing(_flockIdMeta);
    }
    if (data.containsKey('event_date')) {
      context.handle(_eventDateMeta,
          eventDate.isAcceptableOrUnknown(data['event_date']!, _eventDateMeta));
    } else if (isInserting) {
      context.missing(_eventDateMeta);
    }
    if (data.containsKey('count')) {
      context.handle(
          _countMeta, count.isAcceptableOrUnknown(data['count']!, _countMeta));
    }
    if (data.containsKey('cause')) {
      context.handle(
          _causeMeta, cause.isAcceptableOrUnknown(data['cause']!, _causeMeta));
    }
    if (data.containsKey('age_days')) {
      context.handle(_ageDaysMeta,
          ageDays.isAcceptableOrUnknown(data['age_days']!, _ageDaysMeta));
    }
    if (data.containsKey('cost_zmw')) {
      context.handle(_costZmwMeta,
          costZmw.isAcceptableOrUnknown(data['cost_zmw']!, _costZmwMeta));
    }
    if (data.containsKey('notes')) {
      context.handle(
          _notesMeta, notes.isAcceptableOrUnknown(data['notes']!, _notesMeta));
    }
    if (data.containsKey('cached_at')) {
      context.handle(_cachedAtMeta,
          cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CachedMortalityEvent map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedMortalityEvent(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      flockId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}flock_id'])!,
      eventDate: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}event_date'])!,
      count: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}count'])!,
      cause: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}cause']),
      ageDays: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}age_days']),
      costZmw: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}cost_zmw']),
      notes: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}notes']),
      cachedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}cached_at'])!,
    );
  }

  @override
  $CachedMortalityEventsTable createAlias(String alias) {
    return $CachedMortalityEventsTable(attachedDatabase, alias);
  }
}

class CachedMortalityEvent extends DataClass
    implements Insertable<CachedMortalityEvent> {
  final String id;
  final String flockId;
  final String eventDate;
  final int count;
  final String? cause;
  final int? ageDays;
  final double? costZmw;
  final String? notes;
  final DateTime cachedAt;
  const CachedMortalityEvent(
      {required this.id,
      required this.flockId,
      required this.eventDate,
      required this.count,
      this.cause,
      this.ageDays,
      this.costZmw,
      this.notes,
      required this.cachedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['flock_id'] = Variable<String>(flockId);
    map['event_date'] = Variable<String>(eventDate);
    map['count'] = Variable<int>(count);
    if (!nullToAbsent || cause != null) {
      map['cause'] = Variable<String>(cause);
    }
    if (!nullToAbsent || ageDays != null) {
      map['age_days'] = Variable<int>(ageDays);
    }
    if (!nullToAbsent || costZmw != null) {
      map['cost_zmw'] = Variable<double>(costZmw);
    }
    if (!nullToAbsent || notes != null) {
      map['notes'] = Variable<String>(notes);
    }
    map['cached_at'] = Variable<DateTime>(cachedAt);
    return map;
  }

  CachedMortalityEventsCompanion toCompanion(bool nullToAbsent) {
    return CachedMortalityEventsCompanion(
      id: Value(id),
      flockId: Value(flockId),
      eventDate: Value(eventDate),
      count: Value(count),
      cause:
          cause == null && nullToAbsent ? const Value.absent() : Value(cause),
      ageDays: ageDays == null && nullToAbsent
          ? const Value.absent()
          : Value(ageDays),
      costZmw: costZmw == null && nullToAbsent
          ? const Value.absent()
          : Value(costZmw),
      notes:
          notes == null && nullToAbsent ? const Value.absent() : Value(notes),
      cachedAt: Value(cachedAt),
    );
  }

  factory CachedMortalityEvent.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedMortalityEvent(
      id: serializer.fromJson<String>(json['id']),
      flockId: serializer.fromJson<String>(json['flockId']),
      eventDate: serializer.fromJson<String>(json['eventDate']),
      count: serializer.fromJson<int>(json['count']),
      cause: serializer.fromJson<String?>(json['cause']),
      ageDays: serializer.fromJson<int?>(json['ageDays']),
      costZmw: serializer.fromJson<double?>(json['costZmw']),
      notes: serializer.fromJson<String?>(json['notes']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'flockId': serializer.toJson<String>(flockId),
      'eventDate': serializer.toJson<String>(eventDate),
      'count': serializer.toJson<int>(count),
      'cause': serializer.toJson<String?>(cause),
      'ageDays': serializer.toJson<int?>(ageDays),
      'costZmw': serializer.toJson<double?>(costZmw),
      'notes': serializer.toJson<String?>(notes),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
    };
  }

  CachedMortalityEvent copyWith(
          {String? id,
          String? flockId,
          String? eventDate,
          int? count,
          Value<String?> cause = const Value.absent(),
          Value<int?> ageDays = const Value.absent(),
          Value<double?> costZmw = const Value.absent(),
          Value<String?> notes = const Value.absent(),
          DateTime? cachedAt}) =>
      CachedMortalityEvent(
        id: id ?? this.id,
        flockId: flockId ?? this.flockId,
        eventDate: eventDate ?? this.eventDate,
        count: count ?? this.count,
        cause: cause.present ? cause.value : this.cause,
        ageDays: ageDays.present ? ageDays.value : this.ageDays,
        costZmw: costZmw.present ? costZmw.value : this.costZmw,
        notes: notes.present ? notes.value : this.notes,
        cachedAt: cachedAt ?? this.cachedAt,
      );
  CachedMortalityEvent copyWithCompanion(CachedMortalityEventsCompanion data) {
    return CachedMortalityEvent(
      id: data.id.present ? data.id.value : this.id,
      flockId: data.flockId.present ? data.flockId.value : this.flockId,
      eventDate: data.eventDate.present ? data.eventDate.value : this.eventDate,
      count: data.count.present ? data.count.value : this.count,
      cause: data.cause.present ? data.cause.value : this.cause,
      ageDays: data.ageDays.present ? data.ageDays.value : this.ageDays,
      costZmw: data.costZmw.present ? data.costZmw.value : this.costZmw,
      notes: data.notes.present ? data.notes.value : this.notes,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedMortalityEvent(')
          ..write('id: $id, ')
          ..write('flockId: $flockId, ')
          ..write('eventDate: $eventDate, ')
          ..write('count: $count, ')
          ..write('cause: $cause, ')
          ..write('ageDays: $ageDays, ')
          ..write('costZmw: $costZmw, ')
          ..write('notes: $notes, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      id, flockId, eventDate, count, cause, ageDays, costZmw, notes, cachedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedMortalityEvent &&
          other.id == this.id &&
          other.flockId == this.flockId &&
          other.eventDate == this.eventDate &&
          other.count == this.count &&
          other.cause == this.cause &&
          other.ageDays == this.ageDays &&
          other.costZmw == this.costZmw &&
          other.notes == this.notes &&
          other.cachedAt == this.cachedAt);
}

class CachedMortalityEventsCompanion
    extends UpdateCompanion<CachedMortalityEvent> {
  final Value<String> id;
  final Value<String> flockId;
  final Value<String> eventDate;
  final Value<int> count;
  final Value<String?> cause;
  final Value<int?> ageDays;
  final Value<double?> costZmw;
  final Value<String?> notes;
  final Value<DateTime> cachedAt;
  final Value<int> rowid;
  const CachedMortalityEventsCompanion({
    this.id = const Value.absent(),
    this.flockId = const Value.absent(),
    this.eventDate = const Value.absent(),
    this.count = const Value.absent(),
    this.cause = const Value.absent(),
    this.ageDays = const Value.absent(),
    this.costZmw = const Value.absent(),
    this.notes = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedMortalityEventsCompanion.insert({
    required String id,
    required String flockId,
    required String eventDate,
    this.count = const Value.absent(),
    this.cause = const Value.absent(),
    this.ageDays = const Value.absent(),
    this.costZmw = const Value.absent(),
    this.notes = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        flockId = Value(flockId),
        eventDate = Value(eventDate);
  static Insertable<CachedMortalityEvent> custom({
    Expression<String>? id,
    Expression<String>? flockId,
    Expression<String>? eventDate,
    Expression<int>? count,
    Expression<String>? cause,
    Expression<int>? ageDays,
    Expression<double>? costZmw,
    Expression<String>? notes,
    Expression<DateTime>? cachedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (flockId != null) 'flock_id': flockId,
      if (eventDate != null) 'event_date': eventDate,
      if (count != null) 'count': count,
      if (cause != null) 'cause': cause,
      if (ageDays != null) 'age_days': ageDays,
      if (costZmw != null) 'cost_zmw': costZmw,
      if (notes != null) 'notes': notes,
      if (cachedAt != null) 'cached_at': cachedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedMortalityEventsCompanion copyWith(
      {Value<String>? id,
      Value<String>? flockId,
      Value<String>? eventDate,
      Value<int>? count,
      Value<String?>? cause,
      Value<int?>? ageDays,
      Value<double?>? costZmw,
      Value<String?>? notes,
      Value<DateTime>? cachedAt,
      Value<int>? rowid}) {
    return CachedMortalityEventsCompanion(
      id: id ?? this.id,
      flockId: flockId ?? this.flockId,
      eventDate: eventDate ?? this.eventDate,
      count: count ?? this.count,
      cause: cause ?? this.cause,
      ageDays: ageDays ?? this.ageDays,
      costZmw: costZmw ?? this.costZmw,
      notes: notes ?? this.notes,
      cachedAt: cachedAt ?? this.cachedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (flockId.present) {
      map['flock_id'] = Variable<String>(flockId.value);
    }
    if (eventDate.present) {
      map['event_date'] = Variable<String>(eventDate.value);
    }
    if (count.present) {
      map['count'] = Variable<int>(count.value);
    }
    if (cause.present) {
      map['cause'] = Variable<String>(cause.value);
    }
    if (ageDays.present) {
      map['age_days'] = Variable<int>(ageDays.value);
    }
    if (costZmw.present) {
      map['cost_zmw'] = Variable<double>(costZmw.value);
    }
    if (notes.present) {
      map['notes'] = Variable<String>(notes.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedMortalityEventsCompanion(')
          ..write('id: $id, ')
          ..write('flockId: $flockId, ')
          ..write('eventDate: $eventDate, ')
          ..write('count: $count, ')
          ..write('cause: $cause, ')
          ..write('ageDays: $ageDays, ')
          ..write('costZmw: $costZmw, ')
          ..write('notes: $notes, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedVaccinationEventsTable extends CachedVaccinationEvents
    with TableInfo<$CachedVaccinationEventsTable, CachedVaccinationEvent> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedVaccinationEventsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _flockIdMeta =
      const VerificationMeta('flockId');
  @override
  late final GeneratedColumn<String> flockId = GeneratedColumn<String>(
      'flock_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _vaccineNameMeta =
      const VerificationMeta('vaccineName');
  @override
  late final GeneratedColumn<String> vaccineName = GeneratedColumn<String>(
      'vaccine_name', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _eventDateMeta =
      const VerificationMeta('eventDate');
  @override
  late final GeneratedColumn<String> eventDate = GeneratedColumn<String>(
      'event_date', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _adminMethodMeta =
      const VerificationMeta('adminMethod');
  @override
  late final GeneratedColumn<String> adminMethod = GeneratedColumn<String>(
      'admin_method', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _costZmwMeta =
      const VerificationMeta('costZmw');
  @override
  late final GeneratedColumn<double> costZmw = GeneratedColumn<double>(
      'cost_zmw', aliasedName, true,
      type: DriftSqlType.double, requiredDuringInsert: false);
  static const VerificationMeta _notesMeta = const VerificationMeta('notes');
  @override
  late final GeneratedColumn<String> notes = GeneratedColumn<String>(
      'notes', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _cachedAtMeta =
      const VerificationMeta('cachedAt');
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
      'cached_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        flockId,
        vaccineName,
        eventDate,
        adminMethod,
        costZmw,
        notes,
        cachedAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_vaccination_events';
  @override
  VerificationContext validateIntegrity(
      Insertable<CachedVaccinationEvent> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('flock_id')) {
      context.handle(_flockIdMeta,
          flockId.isAcceptableOrUnknown(data['flock_id']!, _flockIdMeta));
    } else if (isInserting) {
      context.missing(_flockIdMeta);
    }
    if (data.containsKey('vaccine_name')) {
      context.handle(
          _vaccineNameMeta,
          vaccineName.isAcceptableOrUnknown(
              data['vaccine_name']!, _vaccineNameMeta));
    } else if (isInserting) {
      context.missing(_vaccineNameMeta);
    }
    if (data.containsKey('event_date')) {
      context.handle(_eventDateMeta,
          eventDate.isAcceptableOrUnknown(data['event_date']!, _eventDateMeta));
    }
    if (data.containsKey('admin_method')) {
      context.handle(
          _adminMethodMeta,
          adminMethod.isAcceptableOrUnknown(
              data['admin_method']!, _adminMethodMeta));
    }
    if (data.containsKey('cost_zmw')) {
      context.handle(_costZmwMeta,
          costZmw.isAcceptableOrUnknown(data['cost_zmw']!, _costZmwMeta));
    }
    if (data.containsKey('notes')) {
      context.handle(
          _notesMeta, notes.isAcceptableOrUnknown(data['notes']!, _notesMeta));
    }
    if (data.containsKey('cached_at')) {
      context.handle(_cachedAtMeta,
          cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CachedVaccinationEvent map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedVaccinationEvent(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      flockId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}flock_id'])!,
      vaccineName: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}vaccine_name'])!,
      eventDate: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}event_date']),
      adminMethod: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}admin_method']),
      costZmw: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}cost_zmw']),
      notes: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}notes']),
      cachedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}cached_at'])!,
    );
  }

  @override
  $CachedVaccinationEventsTable createAlias(String alias) {
    return $CachedVaccinationEventsTable(attachedDatabase, alias);
  }
}

class CachedVaccinationEvent extends DataClass
    implements Insertable<CachedVaccinationEvent> {
  final String id;
  final String flockId;
  final String vaccineName;
  final String? eventDate;
  final String? adminMethod;
  final double? costZmw;
  final String? notes;
  final DateTime cachedAt;
  const CachedVaccinationEvent(
      {required this.id,
      required this.flockId,
      required this.vaccineName,
      this.eventDate,
      this.adminMethod,
      this.costZmw,
      this.notes,
      required this.cachedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['flock_id'] = Variable<String>(flockId);
    map['vaccine_name'] = Variable<String>(vaccineName);
    if (!nullToAbsent || eventDate != null) {
      map['event_date'] = Variable<String>(eventDate);
    }
    if (!nullToAbsent || adminMethod != null) {
      map['admin_method'] = Variable<String>(adminMethod);
    }
    if (!nullToAbsent || costZmw != null) {
      map['cost_zmw'] = Variable<double>(costZmw);
    }
    if (!nullToAbsent || notes != null) {
      map['notes'] = Variable<String>(notes);
    }
    map['cached_at'] = Variable<DateTime>(cachedAt);
    return map;
  }

  CachedVaccinationEventsCompanion toCompanion(bool nullToAbsent) {
    return CachedVaccinationEventsCompanion(
      id: Value(id),
      flockId: Value(flockId),
      vaccineName: Value(vaccineName),
      eventDate: eventDate == null && nullToAbsent
          ? const Value.absent()
          : Value(eventDate),
      adminMethod: adminMethod == null && nullToAbsent
          ? const Value.absent()
          : Value(adminMethod),
      costZmw: costZmw == null && nullToAbsent
          ? const Value.absent()
          : Value(costZmw),
      notes:
          notes == null && nullToAbsent ? const Value.absent() : Value(notes),
      cachedAt: Value(cachedAt),
    );
  }

  factory CachedVaccinationEvent.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedVaccinationEvent(
      id: serializer.fromJson<String>(json['id']),
      flockId: serializer.fromJson<String>(json['flockId']),
      vaccineName: serializer.fromJson<String>(json['vaccineName']),
      eventDate: serializer.fromJson<String?>(json['eventDate']),
      adminMethod: serializer.fromJson<String?>(json['adminMethod']),
      costZmw: serializer.fromJson<double?>(json['costZmw']),
      notes: serializer.fromJson<String?>(json['notes']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'flockId': serializer.toJson<String>(flockId),
      'vaccineName': serializer.toJson<String>(vaccineName),
      'eventDate': serializer.toJson<String?>(eventDate),
      'adminMethod': serializer.toJson<String?>(adminMethod),
      'costZmw': serializer.toJson<double?>(costZmw),
      'notes': serializer.toJson<String?>(notes),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
    };
  }

  CachedVaccinationEvent copyWith(
          {String? id,
          String? flockId,
          String? vaccineName,
          Value<String?> eventDate = const Value.absent(),
          Value<String?> adminMethod = const Value.absent(),
          Value<double?> costZmw = const Value.absent(),
          Value<String?> notes = const Value.absent(),
          DateTime? cachedAt}) =>
      CachedVaccinationEvent(
        id: id ?? this.id,
        flockId: flockId ?? this.flockId,
        vaccineName: vaccineName ?? this.vaccineName,
        eventDate: eventDate.present ? eventDate.value : this.eventDate,
        adminMethod: adminMethod.present ? adminMethod.value : this.adminMethod,
        costZmw: costZmw.present ? costZmw.value : this.costZmw,
        notes: notes.present ? notes.value : this.notes,
        cachedAt: cachedAt ?? this.cachedAt,
      );
  CachedVaccinationEvent copyWithCompanion(
      CachedVaccinationEventsCompanion data) {
    return CachedVaccinationEvent(
      id: data.id.present ? data.id.value : this.id,
      flockId: data.flockId.present ? data.flockId.value : this.flockId,
      vaccineName:
          data.vaccineName.present ? data.vaccineName.value : this.vaccineName,
      eventDate: data.eventDate.present ? data.eventDate.value : this.eventDate,
      adminMethod:
          data.adminMethod.present ? data.adminMethod.value : this.adminMethod,
      costZmw: data.costZmw.present ? data.costZmw.value : this.costZmw,
      notes: data.notes.present ? data.notes.value : this.notes,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedVaccinationEvent(')
          ..write('id: $id, ')
          ..write('flockId: $flockId, ')
          ..write('vaccineName: $vaccineName, ')
          ..write('eventDate: $eventDate, ')
          ..write('adminMethod: $adminMethod, ')
          ..write('costZmw: $costZmw, ')
          ..write('notes: $notes, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, flockId, vaccineName, eventDate,
      adminMethod, costZmw, notes, cachedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedVaccinationEvent &&
          other.id == this.id &&
          other.flockId == this.flockId &&
          other.vaccineName == this.vaccineName &&
          other.eventDate == this.eventDate &&
          other.adminMethod == this.adminMethod &&
          other.costZmw == this.costZmw &&
          other.notes == this.notes &&
          other.cachedAt == this.cachedAt);
}

class CachedVaccinationEventsCompanion
    extends UpdateCompanion<CachedVaccinationEvent> {
  final Value<String> id;
  final Value<String> flockId;
  final Value<String> vaccineName;
  final Value<String?> eventDate;
  final Value<String?> adminMethod;
  final Value<double?> costZmw;
  final Value<String?> notes;
  final Value<DateTime> cachedAt;
  final Value<int> rowid;
  const CachedVaccinationEventsCompanion({
    this.id = const Value.absent(),
    this.flockId = const Value.absent(),
    this.vaccineName = const Value.absent(),
    this.eventDate = const Value.absent(),
    this.adminMethod = const Value.absent(),
    this.costZmw = const Value.absent(),
    this.notes = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedVaccinationEventsCompanion.insert({
    required String id,
    required String flockId,
    required String vaccineName,
    this.eventDate = const Value.absent(),
    this.adminMethod = const Value.absent(),
    this.costZmw = const Value.absent(),
    this.notes = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        flockId = Value(flockId),
        vaccineName = Value(vaccineName);
  static Insertable<CachedVaccinationEvent> custom({
    Expression<String>? id,
    Expression<String>? flockId,
    Expression<String>? vaccineName,
    Expression<String>? eventDate,
    Expression<String>? adminMethod,
    Expression<double>? costZmw,
    Expression<String>? notes,
    Expression<DateTime>? cachedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (flockId != null) 'flock_id': flockId,
      if (vaccineName != null) 'vaccine_name': vaccineName,
      if (eventDate != null) 'event_date': eventDate,
      if (adminMethod != null) 'admin_method': adminMethod,
      if (costZmw != null) 'cost_zmw': costZmw,
      if (notes != null) 'notes': notes,
      if (cachedAt != null) 'cached_at': cachedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedVaccinationEventsCompanion copyWith(
      {Value<String>? id,
      Value<String>? flockId,
      Value<String>? vaccineName,
      Value<String?>? eventDate,
      Value<String?>? adminMethod,
      Value<double?>? costZmw,
      Value<String?>? notes,
      Value<DateTime>? cachedAt,
      Value<int>? rowid}) {
    return CachedVaccinationEventsCompanion(
      id: id ?? this.id,
      flockId: flockId ?? this.flockId,
      vaccineName: vaccineName ?? this.vaccineName,
      eventDate: eventDate ?? this.eventDate,
      adminMethod: adminMethod ?? this.adminMethod,
      costZmw: costZmw ?? this.costZmw,
      notes: notes ?? this.notes,
      cachedAt: cachedAt ?? this.cachedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (flockId.present) {
      map['flock_id'] = Variable<String>(flockId.value);
    }
    if (vaccineName.present) {
      map['vaccine_name'] = Variable<String>(vaccineName.value);
    }
    if (eventDate.present) {
      map['event_date'] = Variable<String>(eventDate.value);
    }
    if (adminMethod.present) {
      map['admin_method'] = Variable<String>(adminMethod.value);
    }
    if (costZmw.present) {
      map['cost_zmw'] = Variable<double>(costZmw.value);
    }
    if (notes.present) {
      map['notes'] = Variable<String>(notes.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedVaccinationEventsCompanion(')
          ..write('id: $id, ')
          ..write('flockId: $flockId, ')
          ..write('vaccineName: $vaccineName, ')
          ..write('eventDate: $eventDate, ')
          ..write('adminMethod: $adminMethod, ')
          ..write('costZmw: $costZmw, ')
          ..write('notes: $notes, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedFinancialRecordsTable extends CachedFinancialRecords
    with TableInfo<$CachedFinancialRecordsTable, CachedFinancialRecord> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedFinancialRecordsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _flockIdMeta =
      const VerificationMeta('flockId');
  @override
  late final GeneratedColumn<String> flockId = GeneratedColumn<String>(
      'flock_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _recordDateMeta =
      const VerificationMeta('recordDate');
  @override
  late final GeneratedColumn<String> recordDate = GeneratedColumn<String>(
      'record_date', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _categoryMeta =
      const VerificationMeta('category');
  @override
  late final GeneratedColumn<String> category = GeneratedColumn<String>(
      'category', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _descriptionMeta =
      const VerificationMeta('description');
  @override
  late final GeneratedColumn<String> description = GeneratedColumn<String>(
      'description', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _amountZmwMeta =
      const VerificationMeta('amountZmw');
  @override
  late final GeneratedColumn<double> amountZmw = GeneratedColumn<double>(
      'amount_zmw', aliasedName, false,
      type: DriftSqlType.double,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _isIncomeMeta =
      const VerificationMeta('isIncome');
  @override
  late final GeneratedColumn<bool> isIncome = GeneratedColumn<bool>(
      'is_income', aliasedName, false,
      type: DriftSqlType.bool,
      requiredDuringInsert: false,
      defaultConstraints:
          GeneratedColumn.constraintIsAlways('CHECK ("is_income" IN (0, 1))'),
      defaultValue: const Constant(false));
  static const VerificationMeta _notesMeta = const VerificationMeta('notes');
  @override
  late final GeneratedColumn<String> notes = GeneratedColumn<String>(
      'notes', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _cachedAtMeta =
      const VerificationMeta('cachedAt');
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
      'cached_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        flockId,
        recordDate,
        category,
        description,
        amountZmw,
        isIncome,
        notes,
        cachedAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_financial_records';
  @override
  VerificationContext validateIntegrity(
      Insertable<CachedFinancialRecord> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('flock_id')) {
      context.handle(_flockIdMeta,
          flockId.isAcceptableOrUnknown(data['flock_id']!, _flockIdMeta));
    } else if (isInserting) {
      context.missing(_flockIdMeta);
    }
    if (data.containsKey('record_date')) {
      context.handle(
          _recordDateMeta,
          recordDate.isAcceptableOrUnknown(
              data['record_date']!, _recordDateMeta));
    } else if (isInserting) {
      context.missing(_recordDateMeta);
    }
    if (data.containsKey('category')) {
      context.handle(_categoryMeta,
          category.isAcceptableOrUnknown(data['category']!, _categoryMeta));
    } else if (isInserting) {
      context.missing(_categoryMeta);
    }
    if (data.containsKey('description')) {
      context.handle(
          _descriptionMeta,
          description.isAcceptableOrUnknown(
              data['description']!, _descriptionMeta));
    }
    if (data.containsKey('amount_zmw')) {
      context.handle(_amountZmwMeta,
          amountZmw.isAcceptableOrUnknown(data['amount_zmw']!, _amountZmwMeta));
    }
    if (data.containsKey('is_income')) {
      context.handle(_isIncomeMeta,
          isIncome.isAcceptableOrUnknown(data['is_income']!, _isIncomeMeta));
    }
    if (data.containsKey('notes')) {
      context.handle(
          _notesMeta, notes.isAcceptableOrUnknown(data['notes']!, _notesMeta));
    }
    if (data.containsKey('cached_at')) {
      context.handle(_cachedAtMeta,
          cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CachedFinancialRecord map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedFinancialRecord(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      flockId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}flock_id'])!,
      recordDate: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}record_date'])!,
      category: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}category'])!,
      description: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}description']),
      amountZmw: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}amount_zmw'])!,
      isIncome: attachedDatabase.typeMapping
          .read(DriftSqlType.bool, data['${effectivePrefix}is_income'])!,
      notes: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}notes']),
      cachedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}cached_at'])!,
    );
  }

  @override
  $CachedFinancialRecordsTable createAlias(String alias) {
    return $CachedFinancialRecordsTable(attachedDatabase, alias);
  }
}

class CachedFinancialRecord extends DataClass
    implements Insertable<CachedFinancialRecord> {
  final String id;
  final String flockId;
  final String recordDate;
  final String category;
  final String? description;
  final double amountZmw;
  final bool isIncome;
  final String? notes;
  final DateTime cachedAt;
  const CachedFinancialRecord(
      {required this.id,
      required this.flockId,
      required this.recordDate,
      required this.category,
      this.description,
      required this.amountZmw,
      required this.isIncome,
      this.notes,
      required this.cachedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['flock_id'] = Variable<String>(flockId);
    map['record_date'] = Variable<String>(recordDate);
    map['category'] = Variable<String>(category);
    if (!nullToAbsent || description != null) {
      map['description'] = Variable<String>(description);
    }
    map['amount_zmw'] = Variable<double>(amountZmw);
    map['is_income'] = Variable<bool>(isIncome);
    if (!nullToAbsent || notes != null) {
      map['notes'] = Variable<String>(notes);
    }
    map['cached_at'] = Variable<DateTime>(cachedAt);
    return map;
  }

  CachedFinancialRecordsCompanion toCompanion(bool nullToAbsent) {
    return CachedFinancialRecordsCompanion(
      id: Value(id),
      flockId: Value(flockId),
      recordDate: Value(recordDate),
      category: Value(category),
      description: description == null && nullToAbsent
          ? const Value.absent()
          : Value(description),
      amountZmw: Value(amountZmw),
      isIncome: Value(isIncome),
      notes:
          notes == null && nullToAbsent ? const Value.absent() : Value(notes),
      cachedAt: Value(cachedAt),
    );
  }

  factory CachedFinancialRecord.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedFinancialRecord(
      id: serializer.fromJson<String>(json['id']),
      flockId: serializer.fromJson<String>(json['flockId']),
      recordDate: serializer.fromJson<String>(json['recordDate']),
      category: serializer.fromJson<String>(json['category']),
      description: serializer.fromJson<String?>(json['description']),
      amountZmw: serializer.fromJson<double>(json['amountZmw']),
      isIncome: serializer.fromJson<bool>(json['isIncome']),
      notes: serializer.fromJson<String?>(json['notes']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'flockId': serializer.toJson<String>(flockId),
      'recordDate': serializer.toJson<String>(recordDate),
      'category': serializer.toJson<String>(category),
      'description': serializer.toJson<String?>(description),
      'amountZmw': serializer.toJson<double>(amountZmw),
      'isIncome': serializer.toJson<bool>(isIncome),
      'notes': serializer.toJson<String?>(notes),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
    };
  }

  CachedFinancialRecord copyWith(
          {String? id,
          String? flockId,
          String? recordDate,
          String? category,
          Value<String?> description = const Value.absent(),
          double? amountZmw,
          bool? isIncome,
          Value<String?> notes = const Value.absent(),
          DateTime? cachedAt}) =>
      CachedFinancialRecord(
        id: id ?? this.id,
        flockId: flockId ?? this.flockId,
        recordDate: recordDate ?? this.recordDate,
        category: category ?? this.category,
        description: description.present ? description.value : this.description,
        amountZmw: amountZmw ?? this.amountZmw,
        isIncome: isIncome ?? this.isIncome,
        notes: notes.present ? notes.value : this.notes,
        cachedAt: cachedAt ?? this.cachedAt,
      );
  CachedFinancialRecord copyWithCompanion(
      CachedFinancialRecordsCompanion data) {
    return CachedFinancialRecord(
      id: data.id.present ? data.id.value : this.id,
      flockId: data.flockId.present ? data.flockId.value : this.flockId,
      recordDate:
          data.recordDate.present ? data.recordDate.value : this.recordDate,
      category: data.category.present ? data.category.value : this.category,
      description:
          data.description.present ? data.description.value : this.description,
      amountZmw: data.amountZmw.present ? data.amountZmw.value : this.amountZmw,
      isIncome: data.isIncome.present ? data.isIncome.value : this.isIncome,
      notes: data.notes.present ? data.notes.value : this.notes,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedFinancialRecord(')
          ..write('id: $id, ')
          ..write('flockId: $flockId, ')
          ..write('recordDate: $recordDate, ')
          ..write('category: $category, ')
          ..write('description: $description, ')
          ..write('amountZmw: $amountZmw, ')
          ..write('isIncome: $isIncome, ')
          ..write('notes: $notes, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, flockId, recordDate, category,
      description, amountZmw, isIncome, notes, cachedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedFinancialRecord &&
          other.id == this.id &&
          other.flockId == this.flockId &&
          other.recordDate == this.recordDate &&
          other.category == this.category &&
          other.description == this.description &&
          other.amountZmw == this.amountZmw &&
          other.isIncome == this.isIncome &&
          other.notes == this.notes &&
          other.cachedAt == this.cachedAt);
}

class CachedFinancialRecordsCompanion
    extends UpdateCompanion<CachedFinancialRecord> {
  final Value<String> id;
  final Value<String> flockId;
  final Value<String> recordDate;
  final Value<String> category;
  final Value<String?> description;
  final Value<double> amountZmw;
  final Value<bool> isIncome;
  final Value<String?> notes;
  final Value<DateTime> cachedAt;
  final Value<int> rowid;
  const CachedFinancialRecordsCompanion({
    this.id = const Value.absent(),
    this.flockId = const Value.absent(),
    this.recordDate = const Value.absent(),
    this.category = const Value.absent(),
    this.description = const Value.absent(),
    this.amountZmw = const Value.absent(),
    this.isIncome = const Value.absent(),
    this.notes = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedFinancialRecordsCompanion.insert({
    required String id,
    required String flockId,
    required String recordDate,
    required String category,
    this.description = const Value.absent(),
    this.amountZmw = const Value.absent(),
    this.isIncome = const Value.absent(),
    this.notes = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        flockId = Value(flockId),
        recordDate = Value(recordDate),
        category = Value(category);
  static Insertable<CachedFinancialRecord> custom({
    Expression<String>? id,
    Expression<String>? flockId,
    Expression<String>? recordDate,
    Expression<String>? category,
    Expression<String>? description,
    Expression<double>? amountZmw,
    Expression<bool>? isIncome,
    Expression<String>? notes,
    Expression<DateTime>? cachedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (flockId != null) 'flock_id': flockId,
      if (recordDate != null) 'record_date': recordDate,
      if (category != null) 'category': category,
      if (description != null) 'description': description,
      if (amountZmw != null) 'amount_zmw': amountZmw,
      if (isIncome != null) 'is_income': isIncome,
      if (notes != null) 'notes': notes,
      if (cachedAt != null) 'cached_at': cachedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedFinancialRecordsCompanion copyWith(
      {Value<String>? id,
      Value<String>? flockId,
      Value<String>? recordDate,
      Value<String>? category,
      Value<String?>? description,
      Value<double>? amountZmw,
      Value<bool>? isIncome,
      Value<String?>? notes,
      Value<DateTime>? cachedAt,
      Value<int>? rowid}) {
    return CachedFinancialRecordsCompanion(
      id: id ?? this.id,
      flockId: flockId ?? this.flockId,
      recordDate: recordDate ?? this.recordDate,
      category: category ?? this.category,
      description: description ?? this.description,
      amountZmw: amountZmw ?? this.amountZmw,
      isIncome: isIncome ?? this.isIncome,
      notes: notes ?? this.notes,
      cachedAt: cachedAt ?? this.cachedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (flockId.present) {
      map['flock_id'] = Variable<String>(flockId.value);
    }
    if (recordDate.present) {
      map['record_date'] = Variable<String>(recordDate.value);
    }
    if (category.present) {
      map['category'] = Variable<String>(category.value);
    }
    if (description.present) {
      map['description'] = Variable<String>(description.value);
    }
    if (amountZmw.present) {
      map['amount_zmw'] = Variable<double>(amountZmw.value);
    }
    if (isIncome.present) {
      map['is_income'] = Variable<bool>(isIncome.value);
    }
    if (notes.present) {
      map['notes'] = Variable<String>(notes.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedFinancialRecordsCompanion(')
          ..write('id: $id, ')
          ..write('flockId: $flockId, ')
          ..write('recordDate: $recordDate, ')
          ..write('category: $category, ')
          ..write('description: $description, ')
          ..write('amountZmw: $amountZmw, ')
          ..write('isIncome: $isIncome, ')
          ..write('notes: $notes, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $SyncQueueTable extends SyncQueue
    with TableInfo<$SyncQueueTable, SyncQueueEntry> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SyncQueueTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
      'id', aliasedName, false,
      hasAutoIncrement: true,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultConstraints:
          GeneratedColumn.constraintIsAlways('PRIMARY KEY AUTOINCREMENT'));
  static const VerificationMeta _entityTypeMeta =
      const VerificationMeta('entityType');
  @override
  late final GeneratedColumn<String> entityType = GeneratedColumn<String>(
      'entity_type', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _operationMeta =
      const VerificationMeta('operation');
  @override
  late final GeneratedColumn<String> operation = GeneratedColumn<String>(
      'operation', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _entityIdMeta =
      const VerificationMeta('entityId');
  @override
  late final GeneratedColumn<String> entityId = GeneratedColumn<String>(
      'entity_id', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _payloadMeta =
      const VerificationMeta('payload');
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
      'payload', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
      'status', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant('pending'));
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  static const VerificationMeta _lastAttemptAtMeta =
      const VerificationMeta('lastAttemptAt');
  @override
  late final GeneratedColumn<DateTime> lastAttemptAt =
      GeneratedColumn<DateTime>('last_attempt_at', aliasedName, true,
          type: DriftSqlType.dateTime, requiredDuringInsert: false);
  static const VerificationMeta _retryCountMeta =
      const VerificationMeta('retryCount');
  @override
  late final GeneratedColumn<int> retryCount = GeneratedColumn<int>(
      'retry_count', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _lastErrorMeta =
      const VerificationMeta('lastError');
  @override
  late final GeneratedColumn<String> lastError = GeneratedColumn<String>(
      'last_error', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        entityType,
        operation,
        entityId,
        payload,
        status,
        createdAt,
        lastAttemptAt,
        retryCount,
        lastError
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'sync_queue';
  @override
  VerificationContext validateIntegrity(Insertable<SyncQueueEntry> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('entity_type')) {
      context.handle(
          _entityTypeMeta,
          entityType.isAcceptableOrUnknown(
              data['entity_type']!, _entityTypeMeta));
    } else if (isInserting) {
      context.missing(_entityTypeMeta);
    }
    if (data.containsKey('operation')) {
      context.handle(_operationMeta,
          operation.isAcceptableOrUnknown(data['operation']!, _operationMeta));
    } else if (isInserting) {
      context.missing(_operationMeta);
    }
    if (data.containsKey('entity_id')) {
      context.handle(_entityIdMeta,
          entityId.isAcceptableOrUnknown(data['entity_id']!, _entityIdMeta));
    }
    if (data.containsKey('payload')) {
      context.handle(_payloadMeta,
          payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta));
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    if (data.containsKey('status')) {
      context.handle(_statusMeta,
          status.isAcceptableOrUnknown(data['status']!, _statusMeta));
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    }
    if (data.containsKey('last_attempt_at')) {
      context.handle(
          _lastAttemptAtMeta,
          lastAttemptAt.isAcceptableOrUnknown(
              data['last_attempt_at']!, _lastAttemptAtMeta));
    }
    if (data.containsKey('retry_count')) {
      context.handle(
          _retryCountMeta,
          retryCount.isAcceptableOrUnknown(
              data['retry_count']!, _retryCountMeta));
    }
    if (data.containsKey('last_error')) {
      context.handle(_lastErrorMeta,
          lastError.isAcceptableOrUnknown(data['last_error']!, _lastErrorMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  SyncQueueEntry map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SyncQueueEntry(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      entityType: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}entity_type'])!,
      operation: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}operation'])!,
      entityId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}entity_id']),
      payload: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}payload'])!,
      status: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}status'])!,
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
      lastAttemptAt: attachedDatabase.typeMapping.read(
          DriftSqlType.dateTime, data['${effectivePrefix}last_attempt_at']),
      retryCount: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}retry_count'])!,
      lastError: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}last_error']),
    );
  }

  @override
  $SyncQueueTable createAlias(String alias) {
    return $SyncQueueTable(attachedDatabase, alias);
  }
}

class SyncQueueEntry extends DataClass implements Insertable<SyncQueueEntry> {
  final int id;
  final String entityType;
  final String operation;
  final String? entityId;
  final String payload;
  final String status;
  final DateTime createdAt;
  final DateTime? lastAttemptAt;
  final int retryCount;
  final String? lastError;
  const SyncQueueEntry(
      {required this.id,
      required this.entityType,
      required this.operation,
      this.entityId,
      required this.payload,
      required this.status,
      required this.createdAt,
      this.lastAttemptAt,
      required this.retryCount,
      this.lastError});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['entity_type'] = Variable<String>(entityType);
    map['operation'] = Variable<String>(operation);
    if (!nullToAbsent || entityId != null) {
      map['entity_id'] = Variable<String>(entityId);
    }
    map['payload'] = Variable<String>(payload);
    map['status'] = Variable<String>(status);
    map['created_at'] = Variable<DateTime>(createdAt);
    if (!nullToAbsent || lastAttemptAt != null) {
      map['last_attempt_at'] = Variable<DateTime>(lastAttemptAt);
    }
    map['retry_count'] = Variable<int>(retryCount);
    if (!nullToAbsent || lastError != null) {
      map['last_error'] = Variable<String>(lastError);
    }
    return map;
  }

  SyncQueueCompanion toCompanion(bool nullToAbsent) {
    return SyncQueueCompanion(
      id: Value(id),
      entityType: Value(entityType),
      operation: Value(operation),
      entityId: entityId == null && nullToAbsent
          ? const Value.absent()
          : Value(entityId),
      payload: Value(payload),
      status: Value(status),
      createdAt: Value(createdAt),
      lastAttemptAt: lastAttemptAt == null && nullToAbsent
          ? const Value.absent()
          : Value(lastAttemptAt),
      retryCount: Value(retryCount),
      lastError: lastError == null && nullToAbsent
          ? const Value.absent()
          : Value(lastError),
    );
  }

  factory SyncQueueEntry.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SyncQueueEntry(
      id: serializer.fromJson<int>(json['id']),
      entityType: serializer.fromJson<String>(json['entityType']),
      operation: serializer.fromJson<String>(json['operation']),
      entityId: serializer.fromJson<String?>(json['entityId']),
      payload: serializer.fromJson<String>(json['payload']),
      status: serializer.fromJson<String>(json['status']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      lastAttemptAt: serializer.fromJson<DateTime?>(json['lastAttemptAt']),
      retryCount: serializer.fromJson<int>(json['retryCount']),
      lastError: serializer.fromJson<String?>(json['lastError']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'entityType': serializer.toJson<String>(entityType),
      'operation': serializer.toJson<String>(operation),
      'entityId': serializer.toJson<String?>(entityId),
      'payload': serializer.toJson<String>(payload),
      'status': serializer.toJson<String>(status),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'lastAttemptAt': serializer.toJson<DateTime?>(lastAttemptAt),
      'retryCount': serializer.toJson<int>(retryCount),
      'lastError': serializer.toJson<String?>(lastError),
    };
  }

  SyncQueueEntry copyWith(
          {int? id,
          String? entityType,
          String? operation,
          Value<String?> entityId = const Value.absent(),
          String? payload,
          String? status,
          DateTime? createdAt,
          Value<DateTime?> lastAttemptAt = const Value.absent(),
          int? retryCount,
          Value<String?> lastError = const Value.absent()}) =>
      SyncQueueEntry(
        id: id ?? this.id,
        entityType: entityType ?? this.entityType,
        operation: operation ?? this.operation,
        entityId: entityId.present ? entityId.value : this.entityId,
        payload: payload ?? this.payload,
        status: status ?? this.status,
        createdAt: createdAt ?? this.createdAt,
        lastAttemptAt:
            lastAttemptAt.present ? lastAttemptAt.value : this.lastAttemptAt,
        retryCount: retryCount ?? this.retryCount,
        lastError: lastError.present ? lastError.value : this.lastError,
      );
  SyncQueueEntry copyWithCompanion(SyncQueueCompanion data) {
    return SyncQueueEntry(
      id: data.id.present ? data.id.value : this.id,
      entityType:
          data.entityType.present ? data.entityType.value : this.entityType,
      operation: data.operation.present ? data.operation.value : this.operation,
      entityId: data.entityId.present ? data.entityId.value : this.entityId,
      payload: data.payload.present ? data.payload.value : this.payload,
      status: data.status.present ? data.status.value : this.status,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      lastAttemptAt: data.lastAttemptAt.present
          ? data.lastAttemptAt.value
          : this.lastAttemptAt,
      retryCount:
          data.retryCount.present ? data.retryCount.value : this.retryCount,
      lastError: data.lastError.present ? data.lastError.value : this.lastError,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SyncQueueEntry(')
          ..write('id: $id, ')
          ..write('entityType: $entityType, ')
          ..write('operation: $operation, ')
          ..write('entityId: $entityId, ')
          ..write('payload: $payload, ')
          ..write('status: $status, ')
          ..write('createdAt: $createdAt, ')
          ..write('lastAttemptAt: $lastAttemptAt, ')
          ..write('retryCount: $retryCount, ')
          ..write('lastError: $lastError')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, entityType, operation, entityId, payload,
      status, createdAt, lastAttemptAt, retryCount, lastError);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SyncQueueEntry &&
          other.id == this.id &&
          other.entityType == this.entityType &&
          other.operation == this.operation &&
          other.entityId == this.entityId &&
          other.payload == this.payload &&
          other.status == this.status &&
          other.createdAt == this.createdAt &&
          other.lastAttemptAt == this.lastAttemptAt &&
          other.retryCount == this.retryCount &&
          other.lastError == this.lastError);
}

class SyncQueueCompanion extends UpdateCompanion<SyncQueueEntry> {
  final Value<int> id;
  final Value<String> entityType;
  final Value<String> operation;
  final Value<String?> entityId;
  final Value<String> payload;
  final Value<String> status;
  final Value<DateTime> createdAt;
  final Value<DateTime?> lastAttemptAt;
  final Value<int> retryCount;
  final Value<String?> lastError;
  const SyncQueueCompanion({
    this.id = const Value.absent(),
    this.entityType = const Value.absent(),
    this.operation = const Value.absent(),
    this.entityId = const Value.absent(),
    this.payload = const Value.absent(),
    this.status = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.lastAttemptAt = const Value.absent(),
    this.retryCount = const Value.absent(),
    this.lastError = const Value.absent(),
  });
  SyncQueueCompanion.insert({
    this.id = const Value.absent(),
    required String entityType,
    required String operation,
    this.entityId = const Value.absent(),
    required String payload,
    this.status = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.lastAttemptAt = const Value.absent(),
    this.retryCount = const Value.absent(),
    this.lastError = const Value.absent(),
  })  : entityType = Value(entityType),
        operation = Value(operation),
        payload = Value(payload);
  static Insertable<SyncQueueEntry> custom({
    Expression<int>? id,
    Expression<String>? entityType,
    Expression<String>? operation,
    Expression<String>? entityId,
    Expression<String>? payload,
    Expression<String>? status,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? lastAttemptAt,
    Expression<int>? retryCount,
    Expression<String>? lastError,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (entityType != null) 'entity_type': entityType,
      if (operation != null) 'operation': operation,
      if (entityId != null) 'entity_id': entityId,
      if (payload != null) 'payload': payload,
      if (status != null) 'status': status,
      if (createdAt != null) 'created_at': createdAt,
      if (lastAttemptAt != null) 'last_attempt_at': lastAttemptAt,
      if (retryCount != null) 'retry_count': retryCount,
      if (lastError != null) 'last_error': lastError,
    });
  }

  SyncQueueCompanion copyWith(
      {Value<int>? id,
      Value<String>? entityType,
      Value<String>? operation,
      Value<String?>? entityId,
      Value<String>? payload,
      Value<String>? status,
      Value<DateTime>? createdAt,
      Value<DateTime?>? lastAttemptAt,
      Value<int>? retryCount,
      Value<String?>? lastError}) {
    return SyncQueueCompanion(
      id: id ?? this.id,
      entityType: entityType ?? this.entityType,
      operation: operation ?? this.operation,
      entityId: entityId ?? this.entityId,
      payload: payload ?? this.payload,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
      lastAttemptAt: lastAttemptAt ?? this.lastAttemptAt,
      retryCount: retryCount ?? this.retryCount,
      lastError: lastError ?? this.lastError,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (entityType.present) {
      map['entity_type'] = Variable<String>(entityType.value);
    }
    if (operation.present) {
      map['operation'] = Variable<String>(operation.value);
    }
    if (entityId.present) {
      map['entity_id'] = Variable<String>(entityId.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (lastAttemptAt.present) {
      map['last_attempt_at'] = Variable<DateTime>(lastAttemptAt.value);
    }
    if (retryCount.present) {
      map['retry_count'] = Variable<int>(retryCount.value);
    }
    if (lastError.present) {
      map['last_error'] = Variable<String>(lastError.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SyncQueueCompanion(')
          ..write('id: $id, ')
          ..write('entityType: $entityType, ')
          ..write('operation: $operation, ')
          ..write('entityId: $entityId, ')
          ..write('payload: $payload, ')
          ..write('status: $status, ')
          ..write('createdAt: $createdAt, ')
          ..write('lastAttemptAt: $lastAttemptAt, ')
          ..write('retryCount: $retryCount, ')
          ..write('lastError: $lastError')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $CachedFlocksTable cachedFlocks = $CachedFlocksTable(this);
  late final $CachedGrowthRecordsTable cachedGrowthRecords =
      $CachedGrowthRecordsTable(this);
  late final $CachedFeedRecordsTable cachedFeedRecords =
      $CachedFeedRecordsTable(this);
  late final $CachedWaterRecordsTable cachedWaterRecords =
      $CachedWaterRecordsTable(this);
  late final $CachedMortalityEventsTable cachedMortalityEvents =
      $CachedMortalityEventsTable(this);
  late final $CachedVaccinationEventsTable cachedVaccinationEvents =
      $CachedVaccinationEventsTable(this);
  late final $CachedFinancialRecordsTable cachedFinancialRecords =
      $CachedFinancialRecordsTable(this);
  late final $SyncQueueTable syncQueue = $SyncQueueTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
        cachedFlocks,
        cachedGrowthRecords,
        cachedFeedRecords,
        cachedWaterRecords,
        cachedMortalityEvents,
        cachedVaccinationEvents,
        cachedFinancialRecords,
        syncQueue
      ];
}

typedef $$CachedFlocksTableCreateCompanionBuilder = CachedFlocksCompanion
    Function({
  required String id,
  required String name,
  Value<String> breedId,
  Value<String?> breedName,
  Value<String?> supplierId,
  Value<String?> supplierName,
  Value<String?> startDate,
  Value<int> initialCount,
  Value<int> currentCount,
  Value<int?> totalMortality,
  Value<double?> mortalityRate,
  Value<double?> targetWeight,
  Value<int?> targetAge,
  Value<String> housingType,
  Value<String> status,
  Value<int?> ageDays,
  Value<bool?> chicksCollected,
  Value<DateTime> cachedAt,
  Value<int> rowid,
});
typedef $$CachedFlocksTableUpdateCompanionBuilder = CachedFlocksCompanion
    Function({
  Value<String> id,
  Value<String> name,
  Value<String> breedId,
  Value<String?> breedName,
  Value<String?> supplierId,
  Value<String?> supplierName,
  Value<String?> startDate,
  Value<int> initialCount,
  Value<int> currentCount,
  Value<int?> totalMortality,
  Value<double?> mortalityRate,
  Value<double?> targetWeight,
  Value<int?> targetAge,
  Value<String> housingType,
  Value<String> status,
  Value<int?> ageDays,
  Value<bool?> chicksCollected,
  Value<DateTime> cachedAt,
  Value<int> rowid,
});

class $$CachedFlocksTableFilterComposer
    extends Composer<_$AppDatabase, $CachedFlocksTable> {
  $$CachedFlocksTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get breedId => $composableBuilder(
      column: $table.breedId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get breedName => $composableBuilder(
      column: $table.breedName, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get supplierId => $composableBuilder(
      column: $table.supplierId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get supplierName => $composableBuilder(
      column: $table.supplierName, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get startDate => $composableBuilder(
      column: $table.startDate, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get initialCount => $composableBuilder(
      column: $table.initialCount, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get currentCount => $composableBuilder(
      column: $table.currentCount, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get totalMortality => $composableBuilder(
      column: $table.totalMortality,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get mortalityRate => $composableBuilder(
      column: $table.mortalityRate, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get targetWeight => $composableBuilder(
      column: $table.targetWeight, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get targetAge => $composableBuilder(
      column: $table.targetAge, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get housingType => $composableBuilder(
      column: $table.housingType, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get ageDays => $composableBuilder(
      column: $table.ageDays, builder: (column) => ColumnFilters(column));

  ColumnFilters<bool> get chicksCollected => $composableBuilder(
      column: $table.chicksCollected,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnFilters(column));
}

class $$CachedFlocksTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedFlocksTable> {
  $$CachedFlocksTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get breedId => $composableBuilder(
      column: $table.breedId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get breedName => $composableBuilder(
      column: $table.breedName, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get supplierId => $composableBuilder(
      column: $table.supplierId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get supplierName => $composableBuilder(
      column: $table.supplierName,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get startDate => $composableBuilder(
      column: $table.startDate, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get initialCount => $composableBuilder(
      column: $table.initialCount,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get currentCount => $composableBuilder(
      column: $table.currentCount,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get totalMortality => $composableBuilder(
      column: $table.totalMortality,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get mortalityRate => $composableBuilder(
      column: $table.mortalityRate,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get targetWeight => $composableBuilder(
      column: $table.targetWeight,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get targetAge => $composableBuilder(
      column: $table.targetAge, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get housingType => $composableBuilder(
      column: $table.housingType, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get ageDays => $composableBuilder(
      column: $table.ageDays, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<bool> get chicksCollected => $composableBuilder(
      column: $table.chicksCollected,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnOrderings(column));
}

class $$CachedFlocksTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedFlocksTable> {
  $$CachedFlocksTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get breedId =>
      $composableBuilder(column: $table.breedId, builder: (column) => column);

  GeneratedColumn<String> get breedName =>
      $composableBuilder(column: $table.breedName, builder: (column) => column);

  GeneratedColumn<String> get supplierId => $composableBuilder(
      column: $table.supplierId, builder: (column) => column);

  GeneratedColumn<String> get supplierName => $composableBuilder(
      column: $table.supplierName, builder: (column) => column);

  GeneratedColumn<String> get startDate =>
      $composableBuilder(column: $table.startDate, builder: (column) => column);

  GeneratedColumn<int> get initialCount => $composableBuilder(
      column: $table.initialCount, builder: (column) => column);

  GeneratedColumn<int> get currentCount => $composableBuilder(
      column: $table.currentCount, builder: (column) => column);

  GeneratedColumn<int> get totalMortality => $composableBuilder(
      column: $table.totalMortality, builder: (column) => column);

  GeneratedColumn<double> get mortalityRate => $composableBuilder(
      column: $table.mortalityRate, builder: (column) => column);

  GeneratedColumn<double> get targetWeight => $composableBuilder(
      column: $table.targetWeight, builder: (column) => column);

  GeneratedColumn<int> get targetAge =>
      $composableBuilder(column: $table.targetAge, builder: (column) => column);

  GeneratedColumn<String> get housingType => $composableBuilder(
      column: $table.housingType, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<int> get ageDays =>
      $composableBuilder(column: $table.ageDays, builder: (column) => column);

  GeneratedColumn<bool> get chicksCollected => $composableBuilder(
      column: $table.chicksCollected, builder: (column) => column);

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$CachedFlocksTableTableManager extends RootTableManager<
    _$AppDatabase,
    $CachedFlocksTable,
    CachedFlock,
    $$CachedFlocksTableFilterComposer,
    $$CachedFlocksTableOrderingComposer,
    $$CachedFlocksTableAnnotationComposer,
    $$CachedFlocksTableCreateCompanionBuilder,
    $$CachedFlocksTableUpdateCompanionBuilder,
    (
      CachedFlock,
      BaseReferences<_$AppDatabase, $CachedFlocksTable, CachedFlock>
    ),
    CachedFlock,
    PrefetchHooks Function()> {
  $$CachedFlocksTableTableManager(_$AppDatabase db, $CachedFlocksTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedFlocksTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedFlocksTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedFlocksTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> name = const Value.absent(),
            Value<String> breedId = const Value.absent(),
            Value<String?> breedName = const Value.absent(),
            Value<String?> supplierId = const Value.absent(),
            Value<String?> supplierName = const Value.absent(),
            Value<String?> startDate = const Value.absent(),
            Value<int> initialCount = const Value.absent(),
            Value<int> currentCount = const Value.absent(),
            Value<int?> totalMortality = const Value.absent(),
            Value<double?> mortalityRate = const Value.absent(),
            Value<double?> targetWeight = const Value.absent(),
            Value<int?> targetAge = const Value.absent(),
            Value<String> housingType = const Value.absent(),
            Value<String> status = const Value.absent(),
            Value<int?> ageDays = const Value.absent(),
            Value<bool?> chicksCollected = const Value.absent(),
            Value<DateTime> cachedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CachedFlocksCompanion(
            id: id,
            name: name,
            breedId: breedId,
            breedName: breedName,
            supplierId: supplierId,
            supplierName: supplierName,
            startDate: startDate,
            initialCount: initialCount,
            currentCount: currentCount,
            totalMortality: totalMortality,
            mortalityRate: mortalityRate,
            targetWeight: targetWeight,
            targetAge: targetAge,
            housingType: housingType,
            status: status,
            ageDays: ageDays,
            chicksCollected: chicksCollected,
            cachedAt: cachedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String name,
            Value<String> breedId = const Value.absent(),
            Value<String?> breedName = const Value.absent(),
            Value<String?> supplierId = const Value.absent(),
            Value<String?> supplierName = const Value.absent(),
            Value<String?> startDate = const Value.absent(),
            Value<int> initialCount = const Value.absent(),
            Value<int> currentCount = const Value.absent(),
            Value<int?> totalMortality = const Value.absent(),
            Value<double?> mortalityRate = const Value.absent(),
            Value<double?> targetWeight = const Value.absent(),
            Value<int?> targetAge = const Value.absent(),
            Value<String> housingType = const Value.absent(),
            Value<String> status = const Value.absent(),
            Value<int?> ageDays = const Value.absent(),
            Value<bool?> chicksCollected = const Value.absent(),
            Value<DateTime> cachedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CachedFlocksCompanion.insert(
            id: id,
            name: name,
            breedId: breedId,
            breedName: breedName,
            supplierId: supplierId,
            supplierName: supplierName,
            startDate: startDate,
            initialCount: initialCount,
            currentCount: currentCount,
            totalMortality: totalMortality,
            mortalityRate: mortalityRate,
            targetWeight: targetWeight,
            targetAge: targetAge,
            housingType: housingType,
            status: status,
            ageDays: ageDays,
            chicksCollected: chicksCollected,
            cachedAt: cachedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$CachedFlocksTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $CachedFlocksTable,
    CachedFlock,
    $$CachedFlocksTableFilterComposer,
    $$CachedFlocksTableOrderingComposer,
    $$CachedFlocksTableAnnotationComposer,
    $$CachedFlocksTableCreateCompanionBuilder,
    $$CachedFlocksTableUpdateCompanionBuilder,
    (
      CachedFlock,
      BaseReferences<_$AppDatabase, $CachedFlocksTable, CachedFlock>
    ),
    CachedFlock,
    PrefetchHooks Function()>;
typedef $$CachedGrowthRecordsTableCreateCompanionBuilder
    = CachedGrowthRecordsCompanion Function({
  required String id,
  required String flockId,
  required String recordDate,
  Value<int?> sampleSize,
  Value<double?> avgWeight,
  Value<String?> notes,
  Value<DateTime> cachedAt,
  Value<int> rowid,
});
typedef $$CachedGrowthRecordsTableUpdateCompanionBuilder
    = CachedGrowthRecordsCompanion Function({
  Value<String> id,
  Value<String> flockId,
  Value<String> recordDate,
  Value<int?> sampleSize,
  Value<double?> avgWeight,
  Value<String?> notes,
  Value<DateTime> cachedAt,
  Value<int> rowid,
});

class $$CachedGrowthRecordsTableFilterComposer
    extends Composer<_$AppDatabase, $CachedGrowthRecordsTable> {
  $$CachedGrowthRecordsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get flockId => $composableBuilder(
      column: $table.flockId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get recordDate => $composableBuilder(
      column: $table.recordDate, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get sampleSize => $composableBuilder(
      column: $table.sampleSize, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get avgWeight => $composableBuilder(
      column: $table.avgWeight, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get notes => $composableBuilder(
      column: $table.notes, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnFilters(column));
}

class $$CachedGrowthRecordsTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedGrowthRecordsTable> {
  $$CachedGrowthRecordsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get flockId => $composableBuilder(
      column: $table.flockId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get recordDate => $composableBuilder(
      column: $table.recordDate, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get sampleSize => $composableBuilder(
      column: $table.sampleSize, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get avgWeight => $composableBuilder(
      column: $table.avgWeight, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get notes => $composableBuilder(
      column: $table.notes, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnOrderings(column));
}

class $$CachedGrowthRecordsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedGrowthRecordsTable> {
  $$CachedGrowthRecordsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get flockId =>
      $composableBuilder(column: $table.flockId, builder: (column) => column);

  GeneratedColumn<String> get recordDate => $composableBuilder(
      column: $table.recordDate, builder: (column) => column);

  GeneratedColumn<int> get sampleSize => $composableBuilder(
      column: $table.sampleSize, builder: (column) => column);

  GeneratedColumn<double> get avgWeight =>
      $composableBuilder(column: $table.avgWeight, builder: (column) => column);

  GeneratedColumn<String> get notes =>
      $composableBuilder(column: $table.notes, builder: (column) => column);

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$CachedGrowthRecordsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $CachedGrowthRecordsTable,
    CachedGrowthRecord,
    $$CachedGrowthRecordsTableFilterComposer,
    $$CachedGrowthRecordsTableOrderingComposer,
    $$CachedGrowthRecordsTableAnnotationComposer,
    $$CachedGrowthRecordsTableCreateCompanionBuilder,
    $$CachedGrowthRecordsTableUpdateCompanionBuilder,
    (
      CachedGrowthRecord,
      BaseReferences<_$AppDatabase, $CachedGrowthRecordsTable,
          CachedGrowthRecord>
    ),
    CachedGrowthRecord,
    PrefetchHooks Function()> {
  $$CachedGrowthRecordsTableTableManager(
      _$AppDatabase db, $CachedGrowthRecordsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedGrowthRecordsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedGrowthRecordsTableOrderingComposer(
                  $db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedGrowthRecordsTableAnnotationComposer(
                  $db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> flockId = const Value.absent(),
            Value<String> recordDate = const Value.absent(),
            Value<int?> sampleSize = const Value.absent(),
            Value<double?> avgWeight = const Value.absent(),
            Value<String?> notes = const Value.absent(),
            Value<DateTime> cachedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CachedGrowthRecordsCompanion(
            id: id,
            flockId: flockId,
            recordDate: recordDate,
            sampleSize: sampleSize,
            avgWeight: avgWeight,
            notes: notes,
            cachedAt: cachedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String flockId,
            required String recordDate,
            Value<int?> sampleSize = const Value.absent(),
            Value<double?> avgWeight = const Value.absent(),
            Value<String?> notes = const Value.absent(),
            Value<DateTime> cachedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CachedGrowthRecordsCompanion.insert(
            id: id,
            flockId: flockId,
            recordDate: recordDate,
            sampleSize: sampleSize,
            avgWeight: avgWeight,
            notes: notes,
            cachedAt: cachedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$CachedGrowthRecordsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $CachedGrowthRecordsTable,
    CachedGrowthRecord,
    $$CachedGrowthRecordsTableFilterComposer,
    $$CachedGrowthRecordsTableOrderingComposer,
    $$CachedGrowthRecordsTableAnnotationComposer,
    $$CachedGrowthRecordsTableCreateCompanionBuilder,
    $$CachedGrowthRecordsTableUpdateCompanionBuilder,
    (
      CachedGrowthRecord,
      BaseReferences<_$AppDatabase, $CachedGrowthRecordsTable,
          CachedGrowthRecord>
    ),
    CachedGrowthRecord,
    PrefetchHooks Function()>;
typedef $$CachedFeedRecordsTableCreateCompanionBuilder
    = CachedFeedRecordsCompanion Function({
  required String id,
  required String flockId,
  required String recordDate,
  Value<String?> feedType,
  Value<String?> feedBrand,
  Value<double?> quantityKg,
  Value<double?> costZmw,
  Value<String?> notes,
  Value<DateTime> cachedAt,
  Value<int> rowid,
});
typedef $$CachedFeedRecordsTableUpdateCompanionBuilder
    = CachedFeedRecordsCompanion Function({
  Value<String> id,
  Value<String> flockId,
  Value<String> recordDate,
  Value<String?> feedType,
  Value<String?> feedBrand,
  Value<double?> quantityKg,
  Value<double?> costZmw,
  Value<String?> notes,
  Value<DateTime> cachedAt,
  Value<int> rowid,
});

class $$CachedFeedRecordsTableFilterComposer
    extends Composer<_$AppDatabase, $CachedFeedRecordsTable> {
  $$CachedFeedRecordsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get flockId => $composableBuilder(
      column: $table.flockId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get recordDate => $composableBuilder(
      column: $table.recordDate, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get feedType => $composableBuilder(
      column: $table.feedType, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get feedBrand => $composableBuilder(
      column: $table.feedBrand, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get quantityKg => $composableBuilder(
      column: $table.quantityKg, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get costZmw => $composableBuilder(
      column: $table.costZmw, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get notes => $composableBuilder(
      column: $table.notes, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnFilters(column));
}

class $$CachedFeedRecordsTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedFeedRecordsTable> {
  $$CachedFeedRecordsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get flockId => $composableBuilder(
      column: $table.flockId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get recordDate => $composableBuilder(
      column: $table.recordDate, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get feedType => $composableBuilder(
      column: $table.feedType, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get feedBrand => $composableBuilder(
      column: $table.feedBrand, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get quantityKg => $composableBuilder(
      column: $table.quantityKg, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get costZmw => $composableBuilder(
      column: $table.costZmw, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get notes => $composableBuilder(
      column: $table.notes, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnOrderings(column));
}

class $$CachedFeedRecordsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedFeedRecordsTable> {
  $$CachedFeedRecordsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get flockId =>
      $composableBuilder(column: $table.flockId, builder: (column) => column);

  GeneratedColumn<String> get recordDate => $composableBuilder(
      column: $table.recordDate, builder: (column) => column);

  GeneratedColumn<String> get feedType =>
      $composableBuilder(column: $table.feedType, builder: (column) => column);

  GeneratedColumn<String> get feedBrand =>
      $composableBuilder(column: $table.feedBrand, builder: (column) => column);

  GeneratedColumn<double> get quantityKg => $composableBuilder(
      column: $table.quantityKg, builder: (column) => column);

  GeneratedColumn<double> get costZmw =>
      $composableBuilder(column: $table.costZmw, builder: (column) => column);

  GeneratedColumn<String> get notes =>
      $composableBuilder(column: $table.notes, builder: (column) => column);

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$CachedFeedRecordsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $CachedFeedRecordsTable,
    CachedFeedRecord,
    $$CachedFeedRecordsTableFilterComposer,
    $$CachedFeedRecordsTableOrderingComposer,
    $$CachedFeedRecordsTableAnnotationComposer,
    $$CachedFeedRecordsTableCreateCompanionBuilder,
    $$CachedFeedRecordsTableUpdateCompanionBuilder,
    (
      CachedFeedRecord,
      BaseReferences<_$AppDatabase, $CachedFeedRecordsTable, CachedFeedRecord>
    ),
    CachedFeedRecord,
    PrefetchHooks Function()> {
  $$CachedFeedRecordsTableTableManager(
      _$AppDatabase db, $CachedFeedRecordsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedFeedRecordsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedFeedRecordsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedFeedRecordsTableAnnotationComposer(
                  $db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> flockId = const Value.absent(),
            Value<String> recordDate = const Value.absent(),
            Value<String?> feedType = const Value.absent(),
            Value<String?> feedBrand = const Value.absent(),
            Value<double?> quantityKg = const Value.absent(),
            Value<double?> costZmw = const Value.absent(),
            Value<String?> notes = const Value.absent(),
            Value<DateTime> cachedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CachedFeedRecordsCompanion(
            id: id,
            flockId: flockId,
            recordDate: recordDate,
            feedType: feedType,
            feedBrand: feedBrand,
            quantityKg: quantityKg,
            costZmw: costZmw,
            notes: notes,
            cachedAt: cachedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String flockId,
            required String recordDate,
            Value<String?> feedType = const Value.absent(),
            Value<String?> feedBrand = const Value.absent(),
            Value<double?> quantityKg = const Value.absent(),
            Value<double?> costZmw = const Value.absent(),
            Value<String?> notes = const Value.absent(),
            Value<DateTime> cachedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CachedFeedRecordsCompanion.insert(
            id: id,
            flockId: flockId,
            recordDate: recordDate,
            feedType: feedType,
            feedBrand: feedBrand,
            quantityKg: quantityKg,
            costZmw: costZmw,
            notes: notes,
            cachedAt: cachedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$CachedFeedRecordsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $CachedFeedRecordsTable,
    CachedFeedRecord,
    $$CachedFeedRecordsTableFilterComposer,
    $$CachedFeedRecordsTableOrderingComposer,
    $$CachedFeedRecordsTableAnnotationComposer,
    $$CachedFeedRecordsTableCreateCompanionBuilder,
    $$CachedFeedRecordsTableUpdateCompanionBuilder,
    (
      CachedFeedRecord,
      BaseReferences<_$AppDatabase, $CachedFeedRecordsTable, CachedFeedRecord>
    ),
    CachedFeedRecord,
    PrefetchHooks Function()>;
typedef $$CachedWaterRecordsTableCreateCompanionBuilder
    = CachedWaterRecordsCompanion Function({
  required String id,
  required String flockId,
  required String recordDate,
  Value<double?> quantityLiters,
  Value<double?> ph,
  Value<double?> temperature,
  Value<double?> costZmw,
  Value<String?> notes,
  Value<DateTime> cachedAt,
  Value<int> rowid,
});
typedef $$CachedWaterRecordsTableUpdateCompanionBuilder
    = CachedWaterRecordsCompanion Function({
  Value<String> id,
  Value<String> flockId,
  Value<String> recordDate,
  Value<double?> quantityLiters,
  Value<double?> ph,
  Value<double?> temperature,
  Value<double?> costZmw,
  Value<String?> notes,
  Value<DateTime> cachedAt,
  Value<int> rowid,
});

class $$CachedWaterRecordsTableFilterComposer
    extends Composer<_$AppDatabase, $CachedWaterRecordsTable> {
  $$CachedWaterRecordsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get flockId => $composableBuilder(
      column: $table.flockId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get recordDate => $composableBuilder(
      column: $table.recordDate, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get quantityLiters => $composableBuilder(
      column: $table.quantityLiters,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get ph => $composableBuilder(
      column: $table.ph, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get temperature => $composableBuilder(
      column: $table.temperature, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get costZmw => $composableBuilder(
      column: $table.costZmw, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get notes => $composableBuilder(
      column: $table.notes, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnFilters(column));
}

class $$CachedWaterRecordsTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedWaterRecordsTable> {
  $$CachedWaterRecordsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get flockId => $composableBuilder(
      column: $table.flockId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get recordDate => $composableBuilder(
      column: $table.recordDate, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get quantityLiters => $composableBuilder(
      column: $table.quantityLiters,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get ph => $composableBuilder(
      column: $table.ph, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get temperature => $composableBuilder(
      column: $table.temperature, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get costZmw => $composableBuilder(
      column: $table.costZmw, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get notes => $composableBuilder(
      column: $table.notes, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnOrderings(column));
}

class $$CachedWaterRecordsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedWaterRecordsTable> {
  $$CachedWaterRecordsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get flockId =>
      $composableBuilder(column: $table.flockId, builder: (column) => column);

  GeneratedColumn<String> get recordDate => $composableBuilder(
      column: $table.recordDate, builder: (column) => column);

  GeneratedColumn<double> get quantityLiters => $composableBuilder(
      column: $table.quantityLiters, builder: (column) => column);

  GeneratedColumn<double> get ph =>
      $composableBuilder(column: $table.ph, builder: (column) => column);

  GeneratedColumn<double> get temperature => $composableBuilder(
      column: $table.temperature, builder: (column) => column);

  GeneratedColumn<double> get costZmw =>
      $composableBuilder(column: $table.costZmw, builder: (column) => column);

  GeneratedColumn<String> get notes =>
      $composableBuilder(column: $table.notes, builder: (column) => column);

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$CachedWaterRecordsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $CachedWaterRecordsTable,
    CachedWaterRecord,
    $$CachedWaterRecordsTableFilterComposer,
    $$CachedWaterRecordsTableOrderingComposer,
    $$CachedWaterRecordsTableAnnotationComposer,
    $$CachedWaterRecordsTableCreateCompanionBuilder,
    $$CachedWaterRecordsTableUpdateCompanionBuilder,
    (
      CachedWaterRecord,
      BaseReferences<_$AppDatabase, $CachedWaterRecordsTable, CachedWaterRecord>
    ),
    CachedWaterRecord,
    PrefetchHooks Function()> {
  $$CachedWaterRecordsTableTableManager(
      _$AppDatabase db, $CachedWaterRecordsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedWaterRecordsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedWaterRecordsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedWaterRecordsTableAnnotationComposer(
                  $db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> flockId = const Value.absent(),
            Value<String> recordDate = const Value.absent(),
            Value<double?> quantityLiters = const Value.absent(),
            Value<double?> ph = const Value.absent(),
            Value<double?> temperature = const Value.absent(),
            Value<double?> costZmw = const Value.absent(),
            Value<String?> notes = const Value.absent(),
            Value<DateTime> cachedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CachedWaterRecordsCompanion(
            id: id,
            flockId: flockId,
            recordDate: recordDate,
            quantityLiters: quantityLiters,
            ph: ph,
            temperature: temperature,
            costZmw: costZmw,
            notes: notes,
            cachedAt: cachedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String flockId,
            required String recordDate,
            Value<double?> quantityLiters = const Value.absent(),
            Value<double?> ph = const Value.absent(),
            Value<double?> temperature = const Value.absent(),
            Value<double?> costZmw = const Value.absent(),
            Value<String?> notes = const Value.absent(),
            Value<DateTime> cachedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CachedWaterRecordsCompanion.insert(
            id: id,
            flockId: flockId,
            recordDate: recordDate,
            quantityLiters: quantityLiters,
            ph: ph,
            temperature: temperature,
            costZmw: costZmw,
            notes: notes,
            cachedAt: cachedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$CachedWaterRecordsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $CachedWaterRecordsTable,
    CachedWaterRecord,
    $$CachedWaterRecordsTableFilterComposer,
    $$CachedWaterRecordsTableOrderingComposer,
    $$CachedWaterRecordsTableAnnotationComposer,
    $$CachedWaterRecordsTableCreateCompanionBuilder,
    $$CachedWaterRecordsTableUpdateCompanionBuilder,
    (
      CachedWaterRecord,
      BaseReferences<_$AppDatabase, $CachedWaterRecordsTable, CachedWaterRecord>
    ),
    CachedWaterRecord,
    PrefetchHooks Function()>;
typedef $$CachedMortalityEventsTableCreateCompanionBuilder
    = CachedMortalityEventsCompanion Function({
  required String id,
  required String flockId,
  required String eventDate,
  Value<int> count,
  Value<String?> cause,
  Value<int?> ageDays,
  Value<double?> costZmw,
  Value<String?> notes,
  Value<DateTime> cachedAt,
  Value<int> rowid,
});
typedef $$CachedMortalityEventsTableUpdateCompanionBuilder
    = CachedMortalityEventsCompanion Function({
  Value<String> id,
  Value<String> flockId,
  Value<String> eventDate,
  Value<int> count,
  Value<String?> cause,
  Value<int?> ageDays,
  Value<double?> costZmw,
  Value<String?> notes,
  Value<DateTime> cachedAt,
  Value<int> rowid,
});

class $$CachedMortalityEventsTableFilterComposer
    extends Composer<_$AppDatabase, $CachedMortalityEventsTable> {
  $$CachedMortalityEventsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get flockId => $composableBuilder(
      column: $table.flockId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get eventDate => $composableBuilder(
      column: $table.eventDate, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get count => $composableBuilder(
      column: $table.count, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get cause => $composableBuilder(
      column: $table.cause, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get ageDays => $composableBuilder(
      column: $table.ageDays, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get costZmw => $composableBuilder(
      column: $table.costZmw, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get notes => $composableBuilder(
      column: $table.notes, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnFilters(column));
}

class $$CachedMortalityEventsTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedMortalityEventsTable> {
  $$CachedMortalityEventsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get flockId => $composableBuilder(
      column: $table.flockId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get eventDate => $composableBuilder(
      column: $table.eventDate, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get count => $composableBuilder(
      column: $table.count, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get cause => $composableBuilder(
      column: $table.cause, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get ageDays => $composableBuilder(
      column: $table.ageDays, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get costZmw => $composableBuilder(
      column: $table.costZmw, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get notes => $composableBuilder(
      column: $table.notes, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnOrderings(column));
}

class $$CachedMortalityEventsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedMortalityEventsTable> {
  $$CachedMortalityEventsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get flockId =>
      $composableBuilder(column: $table.flockId, builder: (column) => column);

  GeneratedColumn<String> get eventDate =>
      $composableBuilder(column: $table.eventDate, builder: (column) => column);

  GeneratedColumn<int> get count =>
      $composableBuilder(column: $table.count, builder: (column) => column);

  GeneratedColumn<String> get cause =>
      $composableBuilder(column: $table.cause, builder: (column) => column);

  GeneratedColumn<int> get ageDays =>
      $composableBuilder(column: $table.ageDays, builder: (column) => column);

  GeneratedColumn<double> get costZmw =>
      $composableBuilder(column: $table.costZmw, builder: (column) => column);

  GeneratedColumn<String> get notes =>
      $composableBuilder(column: $table.notes, builder: (column) => column);

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$CachedMortalityEventsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $CachedMortalityEventsTable,
    CachedMortalityEvent,
    $$CachedMortalityEventsTableFilterComposer,
    $$CachedMortalityEventsTableOrderingComposer,
    $$CachedMortalityEventsTableAnnotationComposer,
    $$CachedMortalityEventsTableCreateCompanionBuilder,
    $$CachedMortalityEventsTableUpdateCompanionBuilder,
    (
      CachedMortalityEvent,
      BaseReferences<_$AppDatabase, $CachedMortalityEventsTable,
          CachedMortalityEvent>
    ),
    CachedMortalityEvent,
    PrefetchHooks Function()> {
  $$CachedMortalityEventsTableTableManager(
      _$AppDatabase db, $CachedMortalityEventsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedMortalityEventsTableFilterComposer(
                  $db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedMortalityEventsTableOrderingComposer(
                  $db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedMortalityEventsTableAnnotationComposer(
                  $db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> flockId = const Value.absent(),
            Value<String> eventDate = const Value.absent(),
            Value<int> count = const Value.absent(),
            Value<String?> cause = const Value.absent(),
            Value<int?> ageDays = const Value.absent(),
            Value<double?> costZmw = const Value.absent(),
            Value<String?> notes = const Value.absent(),
            Value<DateTime> cachedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CachedMortalityEventsCompanion(
            id: id,
            flockId: flockId,
            eventDate: eventDate,
            count: count,
            cause: cause,
            ageDays: ageDays,
            costZmw: costZmw,
            notes: notes,
            cachedAt: cachedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String flockId,
            required String eventDate,
            Value<int> count = const Value.absent(),
            Value<String?> cause = const Value.absent(),
            Value<int?> ageDays = const Value.absent(),
            Value<double?> costZmw = const Value.absent(),
            Value<String?> notes = const Value.absent(),
            Value<DateTime> cachedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CachedMortalityEventsCompanion.insert(
            id: id,
            flockId: flockId,
            eventDate: eventDate,
            count: count,
            cause: cause,
            ageDays: ageDays,
            costZmw: costZmw,
            notes: notes,
            cachedAt: cachedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$CachedMortalityEventsTableProcessedTableManager
    = ProcessedTableManager<
        _$AppDatabase,
        $CachedMortalityEventsTable,
        CachedMortalityEvent,
        $$CachedMortalityEventsTableFilterComposer,
        $$CachedMortalityEventsTableOrderingComposer,
        $$CachedMortalityEventsTableAnnotationComposer,
        $$CachedMortalityEventsTableCreateCompanionBuilder,
        $$CachedMortalityEventsTableUpdateCompanionBuilder,
        (
          CachedMortalityEvent,
          BaseReferences<_$AppDatabase, $CachedMortalityEventsTable,
              CachedMortalityEvent>
        ),
        CachedMortalityEvent,
        PrefetchHooks Function()>;
typedef $$CachedVaccinationEventsTableCreateCompanionBuilder
    = CachedVaccinationEventsCompanion Function({
  required String id,
  required String flockId,
  required String vaccineName,
  Value<String?> eventDate,
  Value<String?> adminMethod,
  Value<double?> costZmw,
  Value<String?> notes,
  Value<DateTime> cachedAt,
  Value<int> rowid,
});
typedef $$CachedVaccinationEventsTableUpdateCompanionBuilder
    = CachedVaccinationEventsCompanion Function({
  Value<String> id,
  Value<String> flockId,
  Value<String> vaccineName,
  Value<String?> eventDate,
  Value<String?> adminMethod,
  Value<double?> costZmw,
  Value<String?> notes,
  Value<DateTime> cachedAt,
  Value<int> rowid,
});

class $$CachedVaccinationEventsTableFilterComposer
    extends Composer<_$AppDatabase, $CachedVaccinationEventsTable> {
  $$CachedVaccinationEventsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get flockId => $composableBuilder(
      column: $table.flockId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get vaccineName => $composableBuilder(
      column: $table.vaccineName, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get eventDate => $composableBuilder(
      column: $table.eventDate, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get adminMethod => $composableBuilder(
      column: $table.adminMethod, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get costZmw => $composableBuilder(
      column: $table.costZmw, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get notes => $composableBuilder(
      column: $table.notes, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnFilters(column));
}

class $$CachedVaccinationEventsTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedVaccinationEventsTable> {
  $$CachedVaccinationEventsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get flockId => $composableBuilder(
      column: $table.flockId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get vaccineName => $composableBuilder(
      column: $table.vaccineName, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get eventDate => $composableBuilder(
      column: $table.eventDate, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get adminMethod => $composableBuilder(
      column: $table.adminMethod, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get costZmw => $composableBuilder(
      column: $table.costZmw, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get notes => $composableBuilder(
      column: $table.notes, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnOrderings(column));
}

class $$CachedVaccinationEventsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedVaccinationEventsTable> {
  $$CachedVaccinationEventsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get flockId =>
      $composableBuilder(column: $table.flockId, builder: (column) => column);

  GeneratedColumn<String> get vaccineName => $composableBuilder(
      column: $table.vaccineName, builder: (column) => column);

  GeneratedColumn<String> get eventDate =>
      $composableBuilder(column: $table.eventDate, builder: (column) => column);

  GeneratedColumn<String> get adminMethod => $composableBuilder(
      column: $table.adminMethod, builder: (column) => column);

  GeneratedColumn<double> get costZmw =>
      $composableBuilder(column: $table.costZmw, builder: (column) => column);

  GeneratedColumn<String> get notes =>
      $composableBuilder(column: $table.notes, builder: (column) => column);

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$CachedVaccinationEventsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $CachedVaccinationEventsTable,
    CachedVaccinationEvent,
    $$CachedVaccinationEventsTableFilterComposer,
    $$CachedVaccinationEventsTableOrderingComposer,
    $$CachedVaccinationEventsTableAnnotationComposer,
    $$CachedVaccinationEventsTableCreateCompanionBuilder,
    $$CachedVaccinationEventsTableUpdateCompanionBuilder,
    (
      CachedVaccinationEvent,
      BaseReferences<_$AppDatabase, $CachedVaccinationEventsTable,
          CachedVaccinationEvent>
    ),
    CachedVaccinationEvent,
    PrefetchHooks Function()> {
  $$CachedVaccinationEventsTableTableManager(
      _$AppDatabase db, $CachedVaccinationEventsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedVaccinationEventsTableFilterComposer(
                  $db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedVaccinationEventsTableOrderingComposer(
                  $db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedVaccinationEventsTableAnnotationComposer(
                  $db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> flockId = const Value.absent(),
            Value<String> vaccineName = const Value.absent(),
            Value<String?> eventDate = const Value.absent(),
            Value<String?> adminMethod = const Value.absent(),
            Value<double?> costZmw = const Value.absent(),
            Value<String?> notes = const Value.absent(),
            Value<DateTime> cachedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CachedVaccinationEventsCompanion(
            id: id,
            flockId: flockId,
            vaccineName: vaccineName,
            eventDate: eventDate,
            adminMethod: adminMethod,
            costZmw: costZmw,
            notes: notes,
            cachedAt: cachedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String flockId,
            required String vaccineName,
            Value<String?> eventDate = const Value.absent(),
            Value<String?> adminMethod = const Value.absent(),
            Value<double?> costZmw = const Value.absent(),
            Value<String?> notes = const Value.absent(),
            Value<DateTime> cachedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CachedVaccinationEventsCompanion.insert(
            id: id,
            flockId: flockId,
            vaccineName: vaccineName,
            eventDate: eventDate,
            adminMethod: adminMethod,
            costZmw: costZmw,
            notes: notes,
            cachedAt: cachedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$CachedVaccinationEventsTableProcessedTableManager
    = ProcessedTableManager<
        _$AppDatabase,
        $CachedVaccinationEventsTable,
        CachedVaccinationEvent,
        $$CachedVaccinationEventsTableFilterComposer,
        $$CachedVaccinationEventsTableOrderingComposer,
        $$CachedVaccinationEventsTableAnnotationComposer,
        $$CachedVaccinationEventsTableCreateCompanionBuilder,
        $$CachedVaccinationEventsTableUpdateCompanionBuilder,
        (
          CachedVaccinationEvent,
          BaseReferences<_$AppDatabase, $CachedVaccinationEventsTable,
              CachedVaccinationEvent>
        ),
        CachedVaccinationEvent,
        PrefetchHooks Function()>;
typedef $$CachedFinancialRecordsTableCreateCompanionBuilder
    = CachedFinancialRecordsCompanion Function({
  required String id,
  required String flockId,
  required String recordDate,
  required String category,
  Value<String?> description,
  Value<double> amountZmw,
  Value<bool> isIncome,
  Value<String?> notes,
  Value<DateTime> cachedAt,
  Value<int> rowid,
});
typedef $$CachedFinancialRecordsTableUpdateCompanionBuilder
    = CachedFinancialRecordsCompanion Function({
  Value<String> id,
  Value<String> flockId,
  Value<String> recordDate,
  Value<String> category,
  Value<String?> description,
  Value<double> amountZmw,
  Value<bool> isIncome,
  Value<String?> notes,
  Value<DateTime> cachedAt,
  Value<int> rowid,
});

class $$CachedFinancialRecordsTableFilterComposer
    extends Composer<_$AppDatabase, $CachedFinancialRecordsTable> {
  $$CachedFinancialRecordsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get flockId => $composableBuilder(
      column: $table.flockId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get recordDate => $composableBuilder(
      column: $table.recordDate, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get category => $composableBuilder(
      column: $table.category, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get description => $composableBuilder(
      column: $table.description, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get amountZmw => $composableBuilder(
      column: $table.amountZmw, builder: (column) => ColumnFilters(column));

  ColumnFilters<bool> get isIncome => $composableBuilder(
      column: $table.isIncome, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get notes => $composableBuilder(
      column: $table.notes, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnFilters(column));
}

class $$CachedFinancialRecordsTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedFinancialRecordsTable> {
  $$CachedFinancialRecordsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get flockId => $composableBuilder(
      column: $table.flockId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get recordDate => $composableBuilder(
      column: $table.recordDate, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get category => $composableBuilder(
      column: $table.category, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get description => $composableBuilder(
      column: $table.description, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get amountZmw => $composableBuilder(
      column: $table.amountZmw, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<bool> get isIncome => $composableBuilder(
      column: $table.isIncome, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get notes => $composableBuilder(
      column: $table.notes, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnOrderings(column));
}

class $$CachedFinancialRecordsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedFinancialRecordsTable> {
  $$CachedFinancialRecordsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get flockId =>
      $composableBuilder(column: $table.flockId, builder: (column) => column);

  GeneratedColumn<String> get recordDate => $composableBuilder(
      column: $table.recordDate, builder: (column) => column);

  GeneratedColumn<String> get category =>
      $composableBuilder(column: $table.category, builder: (column) => column);

  GeneratedColumn<String> get description => $composableBuilder(
      column: $table.description, builder: (column) => column);

  GeneratedColumn<double> get amountZmw =>
      $composableBuilder(column: $table.amountZmw, builder: (column) => column);

  GeneratedColumn<bool> get isIncome =>
      $composableBuilder(column: $table.isIncome, builder: (column) => column);

  GeneratedColumn<String> get notes =>
      $composableBuilder(column: $table.notes, builder: (column) => column);

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$CachedFinancialRecordsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $CachedFinancialRecordsTable,
    CachedFinancialRecord,
    $$CachedFinancialRecordsTableFilterComposer,
    $$CachedFinancialRecordsTableOrderingComposer,
    $$CachedFinancialRecordsTableAnnotationComposer,
    $$CachedFinancialRecordsTableCreateCompanionBuilder,
    $$CachedFinancialRecordsTableUpdateCompanionBuilder,
    (
      CachedFinancialRecord,
      BaseReferences<_$AppDatabase, $CachedFinancialRecordsTable,
          CachedFinancialRecord>
    ),
    CachedFinancialRecord,
    PrefetchHooks Function()> {
  $$CachedFinancialRecordsTableTableManager(
      _$AppDatabase db, $CachedFinancialRecordsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedFinancialRecordsTableFilterComposer(
                  $db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedFinancialRecordsTableOrderingComposer(
                  $db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedFinancialRecordsTableAnnotationComposer(
                  $db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> flockId = const Value.absent(),
            Value<String> recordDate = const Value.absent(),
            Value<String> category = const Value.absent(),
            Value<String?> description = const Value.absent(),
            Value<double> amountZmw = const Value.absent(),
            Value<bool> isIncome = const Value.absent(),
            Value<String?> notes = const Value.absent(),
            Value<DateTime> cachedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CachedFinancialRecordsCompanion(
            id: id,
            flockId: flockId,
            recordDate: recordDate,
            category: category,
            description: description,
            amountZmw: amountZmw,
            isIncome: isIncome,
            notes: notes,
            cachedAt: cachedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String flockId,
            required String recordDate,
            required String category,
            Value<String?> description = const Value.absent(),
            Value<double> amountZmw = const Value.absent(),
            Value<bool> isIncome = const Value.absent(),
            Value<String?> notes = const Value.absent(),
            Value<DateTime> cachedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CachedFinancialRecordsCompanion.insert(
            id: id,
            flockId: flockId,
            recordDate: recordDate,
            category: category,
            description: description,
            amountZmw: amountZmw,
            isIncome: isIncome,
            notes: notes,
            cachedAt: cachedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$CachedFinancialRecordsTableProcessedTableManager
    = ProcessedTableManager<
        _$AppDatabase,
        $CachedFinancialRecordsTable,
        CachedFinancialRecord,
        $$CachedFinancialRecordsTableFilterComposer,
        $$CachedFinancialRecordsTableOrderingComposer,
        $$CachedFinancialRecordsTableAnnotationComposer,
        $$CachedFinancialRecordsTableCreateCompanionBuilder,
        $$CachedFinancialRecordsTableUpdateCompanionBuilder,
        (
          CachedFinancialRecord,
          BaseReferences<_$AppDatabase, $CachedFinancialRecordsTable,
              CachedFinancialRecord>
        ),
        CachedFinancialRecord,
        PrefetchHooks Function()>;
typedef $$SyncQueueTableCreateCompanionBuilder = SyncQueueCompanion Function({
  Value<int> id,
  required String entityType,
  required String operation,
  Value<String?> entityId,
  required String payload,
  Value<String> status,
  Value<DateTime> createdAt,
  Value<DateTime?> lastAttemptAt,
  Value<int> retryCount,
  Value<String?> lastError,
});
typedef $$SyncQueueTableUpdateCompanionBuilder = SyncQueueCompanion Function({
  Value<int> id,
  Value<String> entityType,
  Value<String> operation,
  Value<String?> entityId,
  Value<String> payload,
  Value<String> status,
  Value<DateTime> createdAt,
  Value<DateTime?> lastAttemptAt,
  Value<int> retryCount,
  Value<String?> lastError,
});

class $$SyncQueueTableFilterComposer
    extends Composer<_$AppDatabase, $SyncQueueTable> {
  $$SyncQueueTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get entityType => $composableBuilder(
      column: $table.entityType, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get operation => $composableBuilder(
      column: $table.operation, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get entityId => $composableBuilder(
      column: $table.entityId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get payload => $composableBuilder(
      column: $table.payload, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get lastAttemptAt => $composableBuilder(
      column: $table.lastAttemptAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get retryCount => $composableBuilder(
      column: $table.retryCount, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get lastError => $composableBuilder(
      column: $table.lastError, builder: (column) => ColumnFilters(column));
}

class $$SyncQueueTableOrderingComposer
    extends Composer<_$AppDatabase, $SyncQueueTable> {
  $$SyncQueueTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get entityType => $composableBuilder(
      column: $table.entityType, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get operation => $composableBuilder(
      column: $table.operation, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get entityId => $composableBuilder(
      column: $table.entityId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get payload => $composableBuilder(
      column: $table.payload, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get lastAttemptAt => $composableBuilder(
      column: $table.lastAttemptAt,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get retryCount => $composableBuilder(
      column: $table.retryCount, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get lastError => $composableBuilder(
      column: $table.lastError, builder: (column) => ColumnOrderings(column));
}

class $$SyncQueueTableAnnotationComposer
    extends Composer<_$AppDatabase, $SyncQueueTable> {
  $$SyncQueueTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get entityType => $composableBuilder(
      column: $table.entityType, builder: (column) => column);

  GeneratedColumn<String> get operation =>
      $composableBuilder(column: $table.operation, builder: (column) => column);

  GeneratedColumn<String> get entityId =>
      $composableBuilder(column: $table.entityId, builder: (column) => column);

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get lastAttemptAt => $composableBuilder(
      column: $table.lastAttemptAt, builder: (column) => column);

  GeneratedColumn<int> get retryCount => $composableBuilder(
      column: $table.retryCount, builder: (column) => column);

  GeneratedColumn<String> get lastError =>
      $composableBuilder(column: $table.lastError, builder: (column) => column);
}

class $$SyncQueueTableTableManager extends RootTableManager<
    _$AppDatabase,
    $SyncQueueTable,
    SyncQueueEntry,
    $$SyncQueueTableFilterComposer,
    $$SyncQueueTableOrderingComposer,
    $$SyncQueueTableAnnotationComposer,
    $$SyncQueueTableCreateCompanionBuilder,
    $$SyncQueueTableUpdateCompanionBuilder,
    (
      SyncQueueEntry,
      BaseReferences<_$AppDatabase, $SyncQueueTable, SyncQueueEntry>
    ),
    SyncQueueEntry,
    PrefetchHooks Function()> {
  $$SyncQueueTableTableManager(_$AppDatabase db, $SyncQueueTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SyncQueueTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SyncQueueTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SyncQueueTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<String> entityType = const Value.absent(),
            Value<String> operation = const Value.absent(),
            Value<String?> entityId = const Value.absent(),
            Value<String> payload = const Value.absent(),
            Value<String> status = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime?> lastAttemptAt = const Value.absent(),
            Value<int> retryCount = const Value.absent(),
            Value<String?> lastError = const Value.absent(),
          }) =>
              SyncQueueCompanion(
            id: id,
            entityType: entityType,
            operation: operation,
            entityId: entityId,
            payload: payload,
            status: status,
            createdAt: createdAt,
            lastAttemptAt: lastAttemptAt,
            retryCount: retryCount,
            lastError: lastError,
          ),
          createCompanionCallback: ({
            Value<int> id = const Value.absent(),
            required String entityType,
            required String operation,
            Value<String?> entityId = const Value.absent(),
            required String payload,
            Value<String> status = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime?> lastAttemptAt = const Value.absent(),
            Value<int> retryCount = const Value.absent(),
            Value<String?> lastError = const Value.absent(),
          }) =>
              SyncQueueCompanion.insert(
            id: id,
            entityType: entityType,
            operation: operation,
            entityId: entityId,
            payload: payload,
            status: status,
            createdAt: createdAt,
            lastAttemptAt: lastAttemptAt,
            retryCount: retryCount,
            lastError: lastError,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$SyncQueueTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $SyncQueueTable,
    SyncQueueEntry,
    $$SyncQueueTableFilterComposer,
    $$SyncQueueTableOrderingComposer,
    $$SyncQueueTableAnnotationComposer,
    $$SyncQueueTableCreateCompanionBuilder,
    $$SyncQueueTableUpdateCompanionBuilder,
    (
      SyncQueueEntry,
      BaseReferences<_$AppDatabase, $SyncQueueTable, SyncQueueEntry>
    ),
    SyncQueueEntry,
    PrefetchHooks Function()>;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$CachedFlocksTableTableManager get cachedFlocks =>
      $$CachedFlocksTableTableManager(_db, _db.cachedFlocks);
  $$CachedGrowthRecordsTableTableManager get cachedGrowthRecords =>
      $$CachedGrowthRecordsTableTableManager(_db, _db.cachedGrowthRecords);
  $$CachedFeedRecordsTableTableManager get cachedFeedRecords =>
      $$CachedFeedRecordsTableTableManager(_db, _db.cachedFeedRecords);
  $$CachedWaterRecordsTableTableManager get cachedWaterRecords =>
      $$CachedWaterRecordsTableTableManager(_db, _db.cachedWaterRecords);
  $$CachedMortalityEventsTableTableManager get cachedMortalityEvents =>
      $$CachedMortalityEventsTableTableManager(_db, _db.cachedMortalityEvents);
  $$CachedVaccinationEventsTableTableManager get cachedVaccinationEvents =>
      $$CachedVaccinationEventsTableTableManager(
          _db, _db.cachedVaccinationEvents);
  $$CachedFinancialRecordsTableTableManager get cachedFinancialRecords =>
      $$CachedFinancialRecordsTableTableManager(
          _db, _db.cachedFinancialRecords);
  $$SyncQueueTableTableManager get syncQueue =>
      $$SyncQueueTableTableManager(_db, _db.syncQueue);
}
