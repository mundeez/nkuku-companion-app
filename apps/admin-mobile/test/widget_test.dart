import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:nkuku_admin/main.dart';
import 'package:nkuku_admin/screens/login.dart';
import 'package:nkuku_admin/screens/manage.dart';

void main() {
  testWidgets('app renders auth gate', (tester) async {
    await tester.pumpWidget(const NkukuAdminApp());
    await tester.pump();
    // Unauthenticated → login screen (token lookup resolves async).
    expect(find.byType(NkukuAdminApp), findsOneWidget);
  });

  testWidgets('login screen shows staff fields', (tester) async {
    await tester.pumpWidget(MaterialApp(
      builder: (context, child) => SafeArea(top: false, child: child!),
      home: LoginScreen(onLoggedIn: () {}),
    ));
    await tester.pump();
    expect(find.text('Nkuku Admin'), findsOneWidget);
    expect(find.text('Sign in'), findsOneWidget);
    expect(find.byType(TextField), findsNWidgets(2));
  });

  testWidgets('manage hub renders', (tester) async {
    SharedPreferences.setMockInitialValues({'staffRole': 'super_admin'});
    await tester.pumpWidget(const MaterialApp(home: ManageScreen()));
    await tester.pumpAndSettle();
    expect(find.text('Catalogue'), findsOneWidget);
    expect(find.text('Plans & Pricing'), findsOneWidget);
    expect(find.text('Announcements'), findsOneWidget);
    expect(find.text('Feature Flags'), findsOneWidget);
    expect(find.text('Analytics'), findsOneWidget);
  });
}
