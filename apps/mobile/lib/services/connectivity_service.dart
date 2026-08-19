import 'dart:async';
import 'dart:developer';
import 'dart:ui';

/// Monitors network connectivity state.
///
/// Uses a simple ping-based approach: when the app detects a Dio connection
/// error, it marks the device as offline. Successful API calls mark it as
/// online. This avoids adding a connectivity plugin dependency.
class ConnectivityService {
  static final ConnectivityService _instance = ConnectivityService._();
  static ConnectivityService get instance => _instance;
  ConnectivityService._();

  bool _isOnline = true;
  final List<VoidCallback> _listeners = [];

  bool get isOnline => _isOnline;

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
