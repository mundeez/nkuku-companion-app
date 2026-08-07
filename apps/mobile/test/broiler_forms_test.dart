import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nkuku_mobile/screens/broiler/records/environmental_record_form.dart';
import 'package:nkuku_mobile/screens/broiler/records/medication_record_form.dart';
import 'package:nkuku_mobile/screens/broiler/records/water_record_form.dart';
import 'package:nkuku_mobile/services/auth_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

void main() {
  Future<void> setRole(String role) async {
    TestWidgetsFlutterBinding.ensureInitialized();
    SharedPreferences.setMockInitialValues({
      'user': '{}',
      'user_role': role,
      'user_email': 'test@example.com',
    });
    FlutterSecureStorage.setMockInitialValues({
      'access_token': role == 'viewer' ? 'viewer-token' : 'manager-token',
    });
    await AuthService.init();
  }

  testWidgets('WaterRecordForm blocks viewers', (WidgetTester tester) async {
    await setRole('viewer');
    await tester.pumpWidget(MaterialApp(home: WaterRecordForm(flockId: 'f1')));
    await tester.pumpAndSettle();
    expect(find.text('Viewers cannot edit records.'), findsOneWidget);
  });

  testWidgets('WaterRecordForm renders fields for editor',
      (WidgetTester tester) async {
    await setRole('owner');
    await tester.pumpWidget(MaterialApp(home: WaterRecordForm(flockId: 'f1')));
    await tester.pumpAndSettle();
    expect(find.text('New Water Record'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Quantity (liters)'),
        findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'pH (optional, 0-14)'),
        findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Temperature (°C, optional)'),
        findsOneWidget);
  });

  testWidgets('WaterRecordForm validates quantity',
      (WidgetTester tester) async {
    await setRole('manager');
    await tester.pumpWidget(MaterialApp(home: WaterRecordForm(flockId: 'f1')));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ElevatedButton, 'Save'));
    await tester.pumpAndSettle();
    expect(find.text('Enter a positive quantity'), findsOneWidget);
  });

  // ---------- MedicationRecordForm ----------

  testWidgets('MedicationRecordForm blocks viewers',
      (WidgetTester tester) async {
    await setRole('viewer');
    await tester
        .pumpWidget(MaterialApp(home: MedicationRecordForm(flockId: 'f1')));
    await tester.pumpAndSettle();
    expect(find.text('Viewers cannot edit records.'), findsOneWidget);
  });

  testWidgets('MedicationRecordForm renders key fields for editor',
      (WidgetTester tester) async {
    await setRole('owner');
    await tester
        .pumpWidget(MaterialApp(home: MedicationRecordForm(flockId: 'f1')));
    await tester.pumpAndSettle();
    expect(find.text('New Medication'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Product name'), findsOneWidget);
    expect(
        find.widgetWithText(TextFormField, 'Dose (optional)'), findsOneWidget);
    expect(
        find.widgetWithText(TextFormField, 'Route (optional)'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Cost (ZMW, optional)'),
        findsOneWidget);
  });

  testWidgets('MedicationRecordForm validates required product name',
      (WidgetTester tester) async {
    await setRole('manager');
    await tester
        .pumpWidget(MaterialApp(home: MedicationRecordForm(flockId: 'f1')));
    await tester.pumpAndSettle();
    await tester.dragUntilVisible(
      find.widgetWithText(ElevatedButton, 'Save'),
      find.byType(SingleChildScrollView),
      const Offset(0, -300),
    );
    await tester.tap(find.widgetWithText(ElevatedButton, 'Save'));
    await tester.pumpAndSettle();
    expect(find.text('Required'), findsOneWidget);
  });

  // ---------- EnvironmentalRecordForm ----------

  testWidgets('EnvironmentalRecordForm blocks viewers',
      (WidgetTester tester) async {
    await setRole('viewer');
    await tester
        .pumpWidget(MaterialApp(home: EnvironmentalRecordForm(flockId: 'f1')));
    await tester.pumpAndSettle();
    expect(find.text('Viewers cannot edit records.'), findsOneWidget);
  });

  testWidgets('EnvironmentalRecordForm renders key fields for editor',
      (WidgetTester tester) async {
    await setRole('owner');
    await tester
        .pumpWidget(MaterialApp(home: EnvironmentalRecordForm(flockId: 'f1')));
    await tester.pumpAndSettle();
    expect(find.text('New Environment Record'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Temperature (°C, optional)'),
        findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Humidity (% optional)'),
        findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Ammonia (ppm, optional)'),
        findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Light hours (optional)'),
        findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Litter score 1-5 (optional)'),
        findsOneWidget);
  });

  testWidgets('EnvironmentalRecordForm validates humidity range',
      (WidgetTester tester) async {
    await setRole('owner');
    await tester
        .pumpWidget(MaterialApp(home: EnvironmentalRecordForm(flockId: 'f1')));
    await tester.pumpAndSettle();
    await tester.enterText(
        find.widgetWithText(TextFormField, 'Humidity (% optional)'), '120');
    await tester.dragUntilVisible(
      find.widgetWithText(ElevatedButton, 'Save'),
      find.byType(SingleChildScrollView),
      const Offset(0, -300),
    );
    await tester.tap(find.widgetWithText(ElevatedButton, 'Save'));
    await tester.pumpAndSettle();
    expect(find.text('Enter 0-100'), findsOneWidget);
  });

  testWidgets('EnvironmentalRecordForm validates litter score range',
      (WidgetTester tester) async {
    await setRole('owner');
    await tester
        .pumpWidget(MaterialApp(home: EnvironmentalRecordForm(flockId: 'f1')));
    await tester.pumpAndSettle();
    await tester.dragUntilVisible(
      find.widgetWithText(TextFormField, 'Litter score 1-5 (optional)'),
      find.byType(SingleChildScrollView),
      const Offset(0, -300),
    );
    await tester.enterText(
        find.widgetWithText(TextFormField, 'Litter score 1-5 (optional)'), '9');
    await tester.dragUntilVisible(
      find.widgetWithText(ElevatedButton, 'Save'),
      find.byType(SingleChildScrollView),
      const Offset(0, -300),
    );
    await tester.tap(find.widgetWithText(ElevatedButton, 'Save'));
    await tester.pumpAndSettle();
    expect(find.text('Enter 1-5'), findsOneWidget);
  });

  testWidgets('EnvironmentalRecordForm validates light hours range',
      (WidgetTester tester) async {
    await setRole('owner');
    await tester
        .pumpWidget(MaterialApp(home: EnvironmentalRecordForm(flockId: 'f1')));
    await tester.pumpAndSettle();
    await tester.enterText(
        find.widgetWithText(TextFormField, 'Light hours (optional)'), '25');
    await tester.dragUntilVisible(
      find.widgetWithText(ElevatedButton, 'Save'),
      find.byType(SingleChildScrollView),
      const Offset(0, -300),
    );
    await tester.tap(find.widgetWithText(ElevatedButton, 'Save'));
    await tester.pumpAndSettle();
    expect(find.text('Enter 0-24'), findsOneWidget);
  });
}
