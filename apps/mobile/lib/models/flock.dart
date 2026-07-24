class BroilerFlock {
  final String id;
  final String name;
  final String breedId;
  final String? breedName;
  final String? supplierId;
  final String? supplierName;
  final String? startDate;
  final String? orderDate;
  final String? expectedCollectionStart;
  final String? expectedCollectionEnd;
  final int initialCount;
  final int currentCount;
  final double? targetWeight;
  final int? targetAge;
  final int? feedTransitionDay;
  final int? finisherDay;
  final double? chickPriceZmw;
  final double? salePriceZmw;
  final String housingType;
  final String status;
  final int? ageDays;
  final bool? chicksCollected;
  final String? collectionDate;
  final String? chickQualityNotes;

  BroilerFlock({
    required this.id,
    required this.name,
    required this.breedId,
    this.breedName,
    this.supplierId,
    this.supplierName,
    this.startDate,
    this.orderDate,
    this.expectedCollectionStart,
    this.expectedCollectionEnd,
    required this.initialCount,
    required this.currentCount,
    this.targetWeight,
    this.targetAge,
    this.feedTransitionDay,
    this.finisherDay,
    this.chickPriceZmw,
    this.salePriceZmw,
    this.housingType = 'whole_house',
    required this.status,
    this.ageDays,
    this.chicksCollected,
    this.collectionDate,
    this.chickQualityNotes,
  });

  factory BroilerFlock.fromJson(Map<String, dynamic> json) {
    return BroilerFlock(
      id: json['id'],
      name: json['name'],
      breedId: json['breedId'] ?? json['breed_id'] ?? '',
      breedName: json['breed']?['name'],
      supplierId: json['supplierId'] ?? json['supplier_id'],
      supplierName: json['supplier']?['name'],
      orderDate: json['orderDate'] ?? json['order_date'],
      startDate: json['startDate'] ?? json['start_date'],
      expectedCollectionStart: json['expectedCollectionStart'] ?? json['expected_collection_start'],
      expectedCollectionEnd: json['expectedCollectionEnd'] ?? json['expected_collection_end'],
      initialCount: json['initialCount'] ?? json['initial_count'] ?? 0,
      currentCount: json['currentCount'] ?? json['current_count'] ?? 0,
      targetWeight: json['targetWeight'] != null
          ? double.tryParse(json['targetWeight'].toString())
          : (json['target_weight'] != null ? double.tryParse(json['target_weight'].toString()) : null),
      targetAge: json['targetAge'] ?? json['target_age'],
      feedTransitionDay: json['feedTransitionDay'] ?? json['feed_transition_day'],
      finisherDay: json['finisherDay'] ?? json['finisher_day'],
      chickPriceZmw: json['chickPriceZmw'] != null
          ? double.tryParse(json['chickPriceZmw'].toString())
          : (json['chick_price_zmw'] != null ? double.tryParse(json['chick_price_zmw'].toString()) : null),
      salePriceZmw: json['salePriceZmw'] != null
          ? double.tryParse(json['salePriceZmw'].toString())
          : (json['sale_price_zmw'] != null ? double.tryParse(json['sale_price_zmw'].toString()) : null),
      housingType: json['housingType'] ?? json['housing_type'] ?? 'whole_house',
      status: json['status'] ?? 'active',
      ageDays: json['ageDays'] ?? json['age_days'],
      chicksCollected: json['chicksCollected'] ?? json['chicks_collected'],
      collectionDate: json['collectionDate'] ?? json['collection_date'],
      chickQualityNotes: json['chickQualityNotes'] ?? json['chick_quality_notes'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'breedId': breedId,
      if (startDate != null) 'startDate': startDate!.split('T').first,
      if (orderDate != null) 'orderDate': orderDate!.split('T').first,
      if (expectedCollectionStart != null) 'expectedCollectionStart': expectedCollectionStart!.split('T').first,
      if (expectedCollectionEnd != null) 'expectedCollectionEnd': expectedCollectionEnd!.split('T').first,
      'initialCount': initialCount,
      if (supplierId != null) 'supplierId': supplierId,
      if (targetWeight != null) 'targetWeight': targetWeight,
      if (targetAge != null) 'targetAge': targetAge,
      'feedTransitionDay': feedTransitionDay ?? 18,
      'finisherDay': finisherDay ?? 29,
      if (chickPriceZmw != null) 'chickPriceZmw': chickPriceZmw,
      if (housingType.isNotEmpty) 'housingType': housingType,
      if (chicksCollected != null) 'chicksCollected': chicksCollected,
      if (collectionDate != null) 'collectionDate': collectionDate,
      if (chickQualityNotes != null && chickQualityNotes!.isNotEmpty)
        'chickQualityNotes': chickQualityNotes,
    };
  }

  BroilerFlock copyWith({
    String? id,
    String? name,
    String? breedId,
    String? breedName,
    String? supplierId,
    String? supplierName,
    String? startDate,
    String? orderDate,
    String? expectedCollectionStart,
    String? expectedCollectionEnd,
    int? initialCount,
    int? currentCount,
    double? targetWeight,
    int? targetAge,
    int? feedTransitionDay,
    int? finisherDay,
    double? chickPriceZmw,
    double? salePriceZmw,
    String? housingType,
    String? status,
    int? ageDays,
    bool? chicksCollected,
    String? collectionDate,
    String? chickQualityNotes,
  }) {
    return BroilerFlock(
      id: id ?? this.id,
      name: name ?? this.name,
      breedId: breedId ?? this.breedId,
      breedName: breedName ?? this.breedName,
      supplierId: supplierId ?? this.supplierId,
      supplierName: supplierName ?? this.supplierName,
      startDate: startDate ?? this.startDate,
      orderDate: orderDate ?? this.orderDate,
      expectedCollectionStart: expectedCollectionStart ?? this.expectedCollectionStart,
      expectedCollectionEnd: expectedCollectionEnd ?? this.expectedCollectionEnd,
      initialCount: initialCount ?? this.initialCount,
      currentCount: currentCount ?? this.currentCount,
      targetWeight: targetWeight ?? this.targetWeight,
      targetAge: targetAge ?? this.targetAge,
      feedTransitionDay: feedTransitionDay ?? this.feedTransitionDay,
      finisherDay: finisherDay ?? this.finisherDay,
      chickPriceZmw: chickPriceZmw ?? this.chickPriceZmw,
      salePriceZmw: salePriceZmw ?? this.salePriceZmw,
      housingType: housingType ?? this.housingType,
      status: status ?? this.status,
      ageDays: ageDays ?? this.ageDays,
      chicksCollected: chicksCollected ?? this.chicksCollected,
      collectionDate: collectionDate ?? this.collectionDate,
      chickQualityNotes: chickQualityNotes ?? this.chickQualityNotes,
    );
  }
}

class VaccinationSchedule {
  final String id;
  final String name;
  final bool isDefault;
  final String description;
  final List<VaccinationScheduleItem> items;

  VaccinationSchedule({
    required this.id,
    required this.name,
    required this.isDefault,
    required this.description,
    required this.items,
  });

  factory VaccinationSchedule.fromJson(Map<String, dynamic> json) {
    return VaccinationSchedule(
      id: json['id'],
      name: json['name'],
      isDefault: json['isDefault'] ?? false,
      description: json['description'] ?? '',
      items: (json['items'] as List?)?.map((e) => VaccinationScheduleItem.fromJson(e)).toList() ?? [],
    );
  }
}

class VaccinationScheduleItem {
  final String id;
  final String vaccineName;
  final String vaccineType;
  final int ageDays;
  final String adminMethod;
  final String? notes;

  VaccinationScheduleItem({
    required this.id,
    required this.vaccineName,
    required this.vaccineType,
    required this.ageDays,
    required this.adminMethod,
    this.notes,
  });

  factory VaccinationScheduleItem.fromJson(Map<String, dynamic> json) {
    return VaccinationScheduleItem(
      id: json['id'] ?? '',
      vaccineName: json['vaccineName'] ?? json['vaccine_name'] ?? '',
      vaccineType: json['vaccineType'] ?? json['vaccine_type'] ?? '',
      ageDays: json['ageDays'] ?? json['age_days'] ?? 0,
      adminMethod: json['adminMethod'] ?? json['admin_method'] ?? '',
      notes: json['notes'],
    );
  }
}

class Disease {
  final String id;
  final String name;
  final String category;
  final String incubation;
  final String mortalityRate;
  final String symptoms;
  final String prevention;
  final String treatment;
  final String organicTreatments;

  Disease({
    required this.id,
    required this.name,
    required this.category,
    required this.incubation,
    required this.mortalityRate,
    required this.symptoms,
    required this.prevention,
    required this.treatment,
    required this.organicTreatments,
  });

  factory Disease.fromJson(Map<String, dynamic> json) {
    return Disease(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      category: json['category'] ?? '',
      incubation: json['incubation'] ?? '',
      mortalityRate: json['mortalityRate'] ?? json['mortality_rate'] ?? '',
      symptoms: json['symptoms'] ?? '',
      prevention: json['prevention'] ?? '',
      treatment: json['treatment'] ?? '',
      organicTreatments: json['organicTreatments'] ?? json['organic_treatments'] ?? '',
    );
  }
}

class LightingTemperatureSchedule {
  final String id;
  final String name;
  final String description;
  final String housingType;
  final bool isDefault;
  final List<LightingTemperatureScheduleItem> items;

  LightingTemperatureSchedule({
    required this.id,
    required this.name,
    required this.description,
    required this.housingType,
    required this.isDefault,
    required this.items,
  });

  factory LightingTemperatureSchedule.fromJson(Map<String, dynamic> json) {
    return LightingTemperatureSchedule(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      housingType: json['housingType'] ?? json['housing_type'] ?? 'whole_house',
      isDefault: json['isDefault'] ?? json['is_default'] ?? false,
      items: (json['items'] as List?)?.map((e) => LightingTemperatureScheduleItem.fromJson(e)).toList() ?? [],
    );
  }
}

class LightingTemperatureScheduleItem {
  final String id;
  final String scheduleId;
  final int ageDays;
  final double? lightHours;
  final double? darkHours;
  final int? lightIntensityLux;
  final int? darkIntensityLux;
  final double? targetTempC;
  final double? targetTempMinC;
  final double? targetTempMaxC;
  final int? targetRhMinPct;
  final int? targetRhMaxPct;
  final String? notes;

  LightingTemperatureScheduleItem({
    required this.id,
    required this.scheduleId,
    required this.ageDays,
    this.lightHours,
    this.darkHours,
    this.lightIntensityLux,
    this.darkIntensityLux,
    this.targetTempC,
    this.targetTempMinC,
    this.targetTempMaxC,
    this.targetRhMinPct,
    this.targetRhMaxPct,
    this.notes,
  });

  factory LightingTemperatureScheduleItem.fromJson(Map<String, dynamic> json) {
    return LightingTemperatureScheduleItem(
      id: json['id'] ?? '',
      scheduleId: json['scheduleId'] ?? json['schedule_id'] ?? '',
      ageDays: json['ageDays'] ?? json['age_days'] ?? 0,
      lightHours: json['lightHours'] != null ? double.tryParse(json['lightHours'].toString()) : null,
      darkHours: json['darkHours'] != null ? double.tryParse(json['darkHours'].toString()) : null,
      lightIntensityLux: json['lightIntensityLux'] ?? json['light_intensity_lux'],
      darkIntensityLux: json['darkIntensityLux'] ?? json['dark_intensity_lux'],
      targetTempC: json['targetTempC'] != null ? double.tryParse(json['targetTempC'].toString()) : null,
      targetTempMinC: json['targetTempMinC'] != null ? double.tryParse(json['targetTempMinC'].toString()) : null,
      targetTempMaxC: json['targetTempMaxC'] != null ? double.tryParse(json['targetTempMaxC'].toString()) : null,
      targetRhMinPct: json['targetRhMinPct'] ?? json['target_rh_min_pct'],
      targetRhMaxPct: json['targetRhMaxPct'] ?? json['target_rh_max_pct'],
      notes: json['notes'],
    );
  }
}

class CalendarDay {
  final int day;
  final String date;
  final String feedPhase;
  final List<VaccinationScheduleItem> vaccines;
  final LightingTemperatureScheduleItem? lightingTemperature;
  final List<String> managementTasks;
  final String healthSupport;

  CalendarDay({
    required this.day,
    required this.date,
    required this.feedPhase,
    required this.vaccines,
    this.lightingTemperature,
    required this.managementTasks,
    required this.healthSupport,
  });

  factory CalendarDay.fromJson(Map<String, dynamic> json) {
    return CalendarDay(
      day: json['day'] ?? 0,
      date: json['date'] ?? '',
      feedPhase: json['feedPhase'] ?? json['feed_phase'] ?? '',
      vaccines: (json['vaccines'] as List?)?.map((e) => VaccinationScheduleItem.fromJson(e)).toList() ?? [],
      lightingTemperature: json['lightingTemperature'] != null
          ? LightingTemperatureScheduleItem.fromJson(json['lightingTemperature'])
          : null,
      managementTasks: List<String>.from(json['managementTasks'] ?? json['management_tasks'] ?? []),
      healthSupport: json['healthSupport'] ?? json['health_support'] ?? '',
    );
  }
}
