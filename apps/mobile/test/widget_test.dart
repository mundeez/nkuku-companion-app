import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nkuku_mobile/main.dart';
import 'package:nkuku_mobile/services/auth_service.dart';

void main() {
  testWidgets('App builds without error', (WidgetTester tester) async {
    await AuthService.init();
    await tester.pumpWidget(const NkukuApp());
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
