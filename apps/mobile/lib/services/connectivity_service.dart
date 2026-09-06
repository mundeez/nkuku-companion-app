import 'dart:async';
import 'dart:developer';
import 'dart:ui';
import 'package:connectivity_plus/connectivity_plus.dart';

/// Monitors network connectivity state using the connectivity_plus plugin.
///
/// Proactively listens to OS network state changes (WiFi/cellular/none)
/// for instant offline detection — no need to wait for a failed API request.
/// Also supports manual markOnline/markOffline for API-level confirmation.
class ConnectivityService {
  static final ConnectivityService _instance = ConnectivityService._();
  static ConnectivityService get instance => _instance;
  ConnectivityService._();

  bool _isOnline = true;
  final List<VoidCallback> _listeners = [];
  StreamSubscription<List<ConnectivityResult>>? _subscription;

  bool get isOnline => _isOnline;

  /// Start listening to OS-level connectivity changes.
  void init() {
    _subscription?.cancel();
    _subscription = Connectivity().onConnectivityChanged.listen((results) {
      final hasConnection = results.any((r) =>
          r == ConnectivityResult.wifi ||
          r == ConnectivityResult.mobile ||
          r == ConnectivityResult.ethernet ||
          r == ConnectivityResult.bluetooth ||
          r == ConnectivityResult.vpn);
      if (hasConnection) {
        markOnline();
      } else {
        markOffline();
      }
    });
  }

  /// Stop listening (called on logout/dispose).
  void dispose() {
    _subscription?.cancel();
    _subscription = null;
  }

  /// Notifies the service that an API call succeeded.
  void markOnline() {
    if (!_isOnline) {
      _isOnline = true;
      log('Connectivity: online', name: 'ConnectivityService');
      _notifyListeners();
    }
  }

  /// Notifies the service that an API call failed due to a network error.
  void markOffline() {
    if (_isOnline) {
      _isOnline = false;
      log('Connectivity: offline', name: 'ConnectivityService');
      _notifyListeners();
    }
  }

  void addListener(VoidCallback callback) {
    _listeners.add(callback);
  }

  void removeListener(VoidCallback callback) {
    _listeners.remove(callback);
  }

  void _notifyListeners() {
    for (final cb in _listeners) {
      cb();
    }
  }
}
