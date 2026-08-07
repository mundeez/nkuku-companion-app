import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nkuku_mobile/main.dart';
import 'package:nkuku_mobile/services/auth_service.dart';
import 'test_helpers.dart';

void main() {
  testWidgets('App builds without error', (WidgetTester tester) async {
    await setupSharedPreferences();
    await AuthService.init();
    await tester.pumpWidget(const NkukuApp());
    // Pump a few frames to let async initState calls (e.g. social provider
    // config fetch) settle without waiting for network timeouts.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
