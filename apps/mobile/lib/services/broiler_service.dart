import 'dart:developer';
import 'package:dio/dio.dart';
import '../models/breed.dart';
import '../models/financial_record.dart';
import '../models/feed_record.dart';
import '../models/flock.dart';
import '../models/growth_record.dart';
import '../models/mortality_event.dart';
import '../models/supplier.dart';
import '../models/vaccination_event.dart';
import '../models/water_record.dart';
import 'api_service.dart';

class BroilerServiceException implements Exception {
  final String message;
  BroilerServiceException(this.message);
  @override
  String toString() => message;
}

class BroilerService {
  // Flocks
  static Future<List<BroilerFlock>> getFlocks({String? status}) async {
    final res = await ApiService.dio.get(
      '/api/v1/broiler-flocks',
      queryParameters: {if (status != null) 'status': status},
    );
    _assertOk(res);
    return (res.data as List).map((e) => BroilerFlock.fromJson(e)).toList();
  }

  static Future<BroilerFlock> getFlock(String id) async {
    final res = await ApiService.dio.get('/api/v1/broiler-flocks/$id');
    _assertOk(res);
    final payload = res.data['flock'] ?? res.data;
    return BroilerFlock.fromJson(payload);
  }

  static Future<BroilerFlock> createFlock(BroilerFlock flock) async {
    final res = await ApiService.dio.post('/api/v1/broiler-flocks', data: flock.toJson());
    _assertOk(res);
    return BroilerFlock.fromJson(res.data);
  }

  static Future<BroilerFlock> updateFlock(String id, Map<String, dynamic> data) async {
    final res = await ApiService.dio.patch('/api/v1/broiler-flocks/$id', data: data);
    _assertOk(res);
    return BroilerFlock.fromJson(res.data);
  }

  static Future<void> deleteFlock(String id) async {
    final res = await ApiService.dio.delete('/api/v1/broiler-flocks/$id');
    _assertOk(res);
  }

  // Breeds / Suppliers
  static Future<List<Breed>> getBreeds() async {
    final res = await ApiService.dio.get('/api/v1/breeds');
    _assertOk(res);
    return (res.data as List).map((e) => Breed.fromJson(e)).toList();
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
    if (res.data is Map && res.data['error'] != null) throw BroilerServiceException(res.data['error']);
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
    final res = await ApiService.dio.post('/api/v1/growth-records', data: record.toJson());
    _assertOk(res);
    return GrowthRecord.fromJson(res.data);
  }

  static Future<GrowthRecord> updateGrowthRecord(String id, GrowthRecord record) async {
    final res = await ApiService.dio.patch('/api/v1/growth-records/$id', data: record.toJson());
    _assertOk(res);
    return GrowthRecord.fromJson(res.data);
  }

  static Future<void> deleteGrowthRecord(String id) async {
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
    if (res.data is Map && res.data['error'] != null) throw BroilerServiceException(res.data['error']);
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
    final res = await ApiService.dio.post('/api/v1/feed-records', data: record.toJson());
    _assertOk(res);
    return FeedRecord.fromJson(res.data);
  }

  static Future<FeedRecord> updateFeedRecord(String id, FeedRecord record) async {
    final res = await ApiService.dio.patch('/api/v1/feed-records/$id', data: record.toJson());
    _assertOk(res);
    return FeedRecord.fromJson(res.data);
  }

  static Future<void> deleteFeedRecord(String id) async {
    final res = await ApiService.dio.delete('/api/v1/feed-records/$id');
    _assertOk(res);
  }

  // Water records
  static Future<List<WaterRecord>> getWaterRecords(String flockId) async {
    final res = await ApiService.dio.get(
      '/api/v1/water-records',
      queryParameters: {'flockId': flockId},
    );
    _assertOk(res);
    if (res.data is Map && res.data['error'] != null) throw BroilerServiceException(res.data['error']);
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
    final res = await ApiService.dio.post('/api/v1/water-records', data: record.toJson());
    _assertOk(res);
    return WaterRecord.fromJson(res.data);
  }

  static Future<WaterRecord> updateWaterRecord(String id, WaterRecord record) async {
    final res = await ApiService.dio.patch('/api/v1/water-records/$id', data: record.toJson());
    _assertOk(res);
    return WaterRecord.fromJson(res.data);
  }

  static Future<void> deleteWaterRecord(String id) async {
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
    if (res.data is Map && res.data['error'] != null) throw BroilerServiceException(res.data['error']);
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

  static Future<MortalityEvent> createMortalityEvent(MortalityEvent event) async {
    final res = await ApiService.dio.post('/api/v1/mortality-events', data: event.toJson());
    _assertOk(res);
    return MortalityEvent.fromJson(res.data);
  }

  static Future<MortalityEvent> updateMortalityEvent(String id, MortalityEvent event) async {
    final res = await ApiService.dio.patch('/api/v1/mortality-events/$id', data: event.toJson());
    _assertOk(res);
    return MortalityEvent.fromJson(res.data);
  }

  static Future<void> deleteMortalityEvent(String id) async {
    final res = await ApiService.dio.delete('/api/v1/mortality-events/$id');
    _assertOk(res);
  }

  // Vaccination events
  static Future<List<VaccinationEvent>> getVaccinationEvents(String flockId) async {
    final res = await ApiService.dio.get(
      '/api/v1/vaccination-events',
      queryParameters: {'flockId': flockId},
    );
    _assertOk(res);
    if (res.data is Map && res.data['error'] != null) throw BroilerServiceException(res.data['error']);
    return (res.data as List).map((e) => VaccinationEvent.fromJson(e)).toList();
  }

  static Future<VaccinationScheduleStatus> getVaccinationScheduleStatus(String flockId) async {
    final res = await ApiService.dio.get(
      '/api/v1/vaccination-events/schedule',
      queryParameters: {'flockId': flockId},
    );
    _assertOk(res);
    return VaccinationScheduleStatus.fromJson(res.data);
  }

  static Future<VaccinationEvent> createVaccinationEvent(VaccinationEvent event) async {
    final res = await ApiService.dio.post('/api/v1/vaccination-events', data: event.toJson());
    _assertOk(res);
    return VaccinationEvent.fromJson(res.data);
  }

  static Future<VaccinationEvent> updateVaccinationEvent(String id, VaccinationEvent event) async {
    final res = await ApiService.dio.patch('/api/v1/vaccination-events/$id', data: event.toJson());
    _assertOk(res);
    return VaccinationEvent.fromJson(res.data);
  }

  static Future<void> deleteVaccinationEvent(String id) async {
    final res = await ApiService.dio.delete('/api/v1/vaccination-events/$id');
    _assertOk(res);
  }

  // Financial records
  static Future<List<FinancialRecord>> getFinancialRecords(String flockId) async {
    final res = await ApiService.dio.get(
      '/api/v1/financial-records',
      queryParameters: {'flockId': flockId},
    );
    _assertOk(res);
    if (res.data is Map && res.data['error'] != null) throw BroilerServiceException(res.data['error']);
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

  static Future<FinancialRecord> createFinancialRecord(FinancialRecord record) async {
    final res = await ApiService.dio.post('/api/v1/financial-records', data: record.toJson());
    _assertOk(res);
    return FinancialRecord.fromJson(res.data);
  }

  static Future<FinancialRecord> updateFinancialRecord(String id, FinancialRecord record) async {
    final res = await ApiService.dio.patch('/api/v1/financial-records/$id', data: record.toJson());
    _assertOk(res);
    return FinancialRecord.fromJson(res.data);
  }

  static Future<void> deleteFinancialRecord(String id) async {
    final res = await ApiService.dio.delete('/api/v1/financial-records/$id');
    _assertOk(res);
  }

  static void _assertOk(Response<dynamic> res) {
    if (res.statusCode == null || res.statusCode! >= 400) {
      final message = res.data is Map ? (res.data['error'] ?? res.data['message'] ?? 'Request failed') : 'Request failed';
      log('BroilerService error: $message', name: 'BroilerService');
      throw BroilerServiceException(message.toString());
    }
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
      records: (json['records'] as List? ?? []).map((e) => GrowthRecord.fromJson(e)).toList(),
      ageDays: json['ageDays'] ?? 0,
      targets: (json['targets'] as List? ?? []).map((e) => PerformanceTarget.fromJson(e)).toList(),
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
      completed: (json['completed'] as List? ?? []).map((e) => VaccinationEvent.fromJson(e)).toList(),
      upcoming: (json['upcoming'] as List? ?? []).map((e) => VaccinationScheduleItem.fromJson(e)).toList(),
      overdue: (json['overdue'] as List? ?? []).map((e) => VaccinationScheduleItem.fromJson(e)).toList(),
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
