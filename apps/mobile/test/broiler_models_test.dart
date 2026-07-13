import 'package:flutter_test/flutter_test.dart';
import 'package:nkuku_mobile/models/breed.dart';
import 'package:nkuku_mobile/models/feed_record.dart';
import 'package:nkuku_mobile/models/financial_record.dart';
import 'package:nkuku_mobile/models/flock.dart';
import 'package:nkuku_mobile/models/growth_record.dart';
import 'package:nkuku_mobile/models/mortality_event.dart';
import 'package:nkuku_mobile/models/vaccination_event.dart';
import 'package:nkuku_mobile/models/water_record.dart';

void main() {
  group('BroilerFlock', () {
    test('parses camelCase and nested breed/supplier', () {
      final json = {
        'id': 'f1',
        'name': 'Ross Flock',
        'breedId': 'b1',
        'breed': {'name': 'Ross 308'},
        'supplier': {'name': 'NUTRI FEED'},
        'startDate': '2026-06-01',
        'initialCount': 500,
        'currentCount': 495,
        'targetWeight': 2.5,
        'targetAge': 35,
        'feedTransitionDay': 11,
        'finisherDay': 29,
        'chickPriceZmw': 12.5,
        'housingType': 'spot_brooding',
        'status': 'active',
        'ageDays': 14,
      };
      final flock = BroilerFlock.fromJson(json);
      expect(flock.id, 'f1');
      expect(flock.breedName, 'Ross 308');
      expect(flock.supplierName, 'NUTRI FEED');
      expect(flock.targetWeight, 2.5);
      expect(flock.toJson()['feedTransitionDay'], 11);
      expect(flock.toJson()['startDate'], '2026-06-01');
    });

    test('parses snake_case aliases', () {
      final json = {
        'id': 'f2',
        'name': 'Cobb Flock',
        'breed_id': 'b2',
        'start_date': '2026-05-01',
        'initial_count': 1000,
        'current_count': 980,
        'target_weight': '2.8',
        'housing_type': 'whole_house',
        'status': 'pending',
      };
      final flock = BroilerFlock.fromJson(json);
      expect(flock.breedId, 'b2');
      expect(flock.targetWeight, 2.8);
      expect(flock.housingType, 'whole_house');
      expect(flock.toJson()['housingType'], 'whole_house');
    });

    test('serializes with defaults for transition/finisher', () {
      final flock = BroilerFlock(
        id: 'f3',
        name: 'Default Flock',
        breedId: 'b1',
        startDate: '2026-06-15',
        initialCount: 300,
        currentCount: 300,
        status: 'active',
      );
      final json = flock.toJson();
      expect(json['feedTransitionDay'], 18);
      expect(json['finisherDay'], 29);
      expect(json['housingType'], 'whole_house');
    });
  });

  group('GrowthRecord', () {
    test('round-trips with date truncation', () {
      final json = {
        'id': 'g1',
        'flockId': 'f1',
        'recordDate': '2026-06-15',
        'sampleSize': 30,
        'avgWeight': 1.25,
        'notes': 'Good sample',
      };
      final r = GrowthRecord.fromJson(json);
      expect(r.avgWeight, 1.25);
      expect(r.toJson()['recordDate'], '2026-06-15');
      expect(r.toJson()['sampleSize'], 30);
    });

    test('parses snake_case aliases', () {
      final json = {
        'id': 'g2',
        'flock_id': 'f1',
        'record_date': '2026-06-16',
        'sample_size': 25,
        'avg_weight': '1.30',
      };
      final r = GrowthRecord.fromJson(json);
      expect(r.flockId, 'f1');
      expect(r.avgWeight, 1.30);
    });
  });

  group('FeedRecord', () {
    test('round-trips with optional fields', () {
      final json = {
        'id': 'fr1',
        'flockId': 'f1',
        'supplierId': 's1',
        'supplier': {'name': 'NUTRI FEED'},
        'recordDate': '2026-06-15',
        'feedType': 'starter',
        'feedBrand': 'Nutri Starter',
        'quantityKg': 150.5,
        'costZmw': 2500.0,
      };
      final r = FeedRecord.fromJson(json);
      expect(r.supplierName, 'NUTRI FEED');
      expect(r.toJson()['feedType'], 'starter');
      expect(r.toJson()['quantityKg'], 150.5);
      expect(r.toJson()['costZmw'], 2500.0);
    });

    test('parses string numbers', () {
      final json = {
        'id': 'fr2',
        'flock_id': 'f1',
        'record_date': '2026-06-15',
        'feed_type': 'grower',
        'quantity_kg': '200',
        'cost_zmw': '3000',
      };
      final r = FeedRecord.fromJson(json);
      expect(r.quantityKg, 200.0);
      expect(r.costZmw, 3000.0);
    });
  });

  group('WaterRecord', () {
    test('round-trips with optional fields', () {
      final json = {
        'id': 'w1',
        'flockId': 'f1',
        'recordDate': '2026-06-15',
        'quantityLiters': 300.0,
        'ph': 6.8,
        'temperature': 24.5,
      };
      final r = WaterRecord.fromJson(json);
      expect(r.ph, 6.8);
      expect(r.toJson()['quantityLiters'], 300.0);
      expect(r.toJson()['ph'], 6.8);
    });
  });

  group('MortalityEvent', () {
    test('round-trips with optional fields', () {
      final json = {
        'id': 'm1',
        'flockId': 'f1',
        'eventDate': '2026-06-15',
        'count': 5,
        'cause': 'heat stress',
        'ageDays': 14,
        'costZmw': 50.0,
      };
      final e = MortalityEvent.fromJson(json);
      expect(e.count, 5);
      expect(e.toJson()['count'], 5);
      expect(e.toJson()['cause'], 'heat stress');
    });
  });

  group('VaccinationEvent', () {
    test('round-trips with optional dates', () {
      final json = {
        'id': 'v1',
        'flockId': 'f1',
        'vaccineName': 'Newcastle',
        'vaccineType': 'Live',
        'adminDate': '2026-06-15',
        'adminMethod': 'drinking_water',
        'ageDays': 7,
        'costZmw': 120.0,
        'nextDueDate': '2026-06-22',
        'batchNumber': 'B123',
        'expiryDate': '2026-12-31',
      };
      final e = VaccinationEvent.fromJson(json);
      expect(e.vaccineName, 'Newcastle');
      expect(e.nextDueDate, DateTime(2026, 6, 22));
      expect(e.toJson()['adminDate'], '2026-06-15');
      expect(e.toJson()['nextDueDate'], '2026-06-22');
      expect(e.toJson()['batchNumber'], 'B123');
    });
  });

  group('FinancialRecord', () {
    test('round-trips with defaults', () {
      final json = {
        'id': 'fn1',
        'flockId': 'f1',
        'recordDate': '2026-06-15',
        'category': 'feed',
        'description': 'Feed purchase',
        'amountZmw': 1500.0,
        'isIncome': false,
      };
      final r = FinancialRecord.fromJson(json);
      expect(r.isIncome, false);
      expect(r.isSystemGenerated, false);
      expect(r.toJson()['isIncome'], false);
      expect(r.toJson()['amountZmw'], 1500.0);
    });

    test('parses income and system flags', () {
      final json = {
        'id': 'fn2',
        'flock_id': 'f1',
        'record_date': '2026-06-15',
        'category': 'sales',
        'description': 'Bird sales',
        'amount_zmw': 5000,
        'is_income': true,
        'is_system_generated': true,
      };
      final r = FinancialRecord.fromJson(json);
      expect(r.isIncome, true);
      expect(r.isSystemGenerated, true);
    });
  });

  group('Breed / PerformanceTarget', () {
    test('parses breed with performance targets', () {
      final json = {
        'id': 'b1',
        'name': 'Ross 308',
        'supplier': 'Aviagen',
        'isPrimary': true,
        'performanceTargets': [
          {
            'id': 'pt1',
            'ageDays': 7,
            'targetWeightG': 180.5,
            'feedConversionRatio': 1.05,
          },
        ],
      };
      final breed = Breed.fromJson(json);
      expect(breed.name, 'Ross 308');
      expect(breed.performanceTargets.length, 1);
      expect(breed.performanceTargets.first.targetWeightG, 180.5);
    });
  });
}
