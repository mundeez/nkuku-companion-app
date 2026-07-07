class BroilerFlock {
  final String id;
  final String name;
  final String breedId;
  final String? breedName;
  final String startDate;
  final int initialCount;
  final int currentCount;
  final double? targetWeight;
  final int? targetAge;
  final int? feedTransitionDay;
  final int? finisherDay;
  final double? chickPriceZmw;
  final double? salePriceZmw;
  final String status;
  final int? ageDays;

  BroilerFlock({
    required this.id,
    required this.name,
    required this.breedId,
    this.breedName,
    required this.startDate,
    required this.initialCount,
    required this.currentCount,
    this.targetWeight,
    this.targetAge,
    this.feedTransitionDay,
    this.finisherDay,
    this.chickPriceZmw,
    this.salePriceZmw,
    required this.status,
    this.ageDays,
  });

  factory BroilerFlock.fromJson(Map<String, dynamic> json) {
    return BroilerFlock(
      id: json['id'],
      name: json['name'],
      breedId: json['breedId'] ?? json['breed_id'] ?? '',
      breedName: json['breed']?['name'],
      startDate: json['startDate'] ?? json['start_date'] ?? '',
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
      status: json['status'] ?? 'active',
      ageDays: json['ageDays'] ?? json['age_days'],
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

class CalendarDay {
  final int day;
  final String date;
  final String feedPhase;
  final List<VaccinationScheduleItem> vaccines;
  final List<String> managementTasks;
  final String healthSupport;

  CalendarDay({
    required this.day,
    required this.date,
    required this.feedPhase,
    required this.vaccines,
    required this.managementTasks,
    required this.healthSupport,
  });

  factory CalendarDay.fromJson(Map<String, dynamic> json) {
    return CalendarDay(
      day: json['day'] ?? 0,
      date: json['date'] ?? '',
      feedPhase: json['feedPhase'] ?? json['feed_phase'] ?? '',
      vaccines: (json['vaccines'] as List?)?.map((e) => VaccinationScheduleItem.fromJson(e)).toList() ?? [],
      managementTasks: List<String>.from(json['managementTasks'] ?? json['management_tasks'] ?? []),
      healthSupport: json['healthSupport'] ?? json['health_support'] ?? '',
    );
  }
}
