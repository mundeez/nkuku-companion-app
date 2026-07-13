import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nkuku_mobile/screens/broiler/records/water_record_form.dart';
import 'package:nkuku_mobile/services/auth_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'test_helpers.dart';

void main() {
  Future<void> setRole(String role) async {
    TestWidgetsFlutterBinding.ensureInitialized();
    SharedPreferences.setMockInitialValues({
      'access_token': role == 'viewer' ? 'viewer-token' : 'manager-token',
      'user': '{}',
      'user_role': role,
      'user_email': 'test@example.com',
    });
    await AuthService.init();
  }

  testWidgets('WaterRecordForm blocks viewers', (WidgetTester tester) async {
    await setRole('viewer');
    await tester.pumpWidget(MaterialApp(home: WaterRecordForm(flockId: 'f1')));
    await tester.pumpAndSettle();
    expect(find.text('Viewers cannot edit records.'), findsOneWidget);
  });

  testWidgets('WaterRecordForm renders fields for editor', (WidgetTester tester) async {
    await setRole('owner');
    await tester.pumpWidget(MaterialApp(home: WaterRecordForm(flockId: 'f1')));
    await tester.pumpAndSettle();
    expect(find.text('New Water Record'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Quantity (liters)'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'pH (optional, 0-14)'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Temperature (°C, optional)'), findsOneWidget);
  });

  testWidgets('WaterRecordForm validates quantity', (WidgetTester tester) async {
    await setRole('manager');
    await tester.pumpWidget(MaterialApp(home: WaterRecordForm(flockId: 'f1')));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ElevatedButton, 'Save'));
    await tester.pumpAndSettle();
    expect(find.text('Enter a positive quantity'), findsOneWidget);
  });
}
