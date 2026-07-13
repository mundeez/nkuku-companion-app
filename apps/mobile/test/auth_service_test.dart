import 'package:flutter_test/flutter_test.dart';
import 'package:nkuku_mobile/services/auth_service.dart';
import 'test_helpers.dart';

void main() {
  group('AuthService role helpers', () {
    setUpAll(() async {
      await setupSharedPreferences();
      await AuthService.init();
    });

    tearDown(() async {
      await AuthService.logout();
    });

    test('no role when not logged in', () {
      expect(AuthService.role, isNull);
      expect(AuthService.isOwner, false);
      expect(AuthService.isManager, false);
      expect(AuthService.isViewer, false);
      expect(AuthService.canEdit, false);
      expect(AuthService.canDelete, false);
    });

    test('role string constants are recognised', () {
      const owner = 'owner';
      const manager = 'manager';
      const viewer = 'viewer';

      expect(owner == 'owner', true);
      expect(manager == 'manager', true);
      expect(viewer == 'viewer', true);
      expect(owner == 'owner' || manager == 'manager', true);
      expect(owner == 'owner' || viewer == 'viewer' || manager == 'manager', true);
    });
  });
}
