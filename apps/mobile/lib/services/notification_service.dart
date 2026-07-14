import 'dart:async';
import 'dart:convert';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:dio/dio.dart';
import 'auth_service.dart';

/// NotificationService — subscribes to ntfy via SSE and surfaces
/// local notifications via flutter_local_notifications.
///
/// Usage:
///   await NotificationService.init();
///   NotificationService.startListening(); // call after login
///   NotificationService.stop();           // call on logout
class NotificationService {
  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  static const _channelId = 'nkuku_alerts';
  static const _channelName = 'Nkuku Alerts';
  static const _channelDesc = 'Push notifications from the Nkuku Companion API';

  static StreamSubscription? _sseSub;
  static bool _initialized = false;
  static int _notificationId = 0;

  /// Call once at app startup (before login).
  static Future<void> init() async {
    if (_initialized) return;

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );
    await _plugin.initialize(initSettings);

    // Request Android 13+ permission (no-op on older versions)
    final androidPlugin = _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    await androidPlugin?.requestNotificationsPermission();

    _initialized = true;
  }

  /// Start SSE subscription to ntfy after user logs in.
  ///
  /// [ntfyBaseUrl] — base URL of the ntfy server, e.g. https://ntfy.deeztechnology.solutions
  /// [topic]       — ntfy topic to subscribe to (default: nkuku-alerts)
  static void startListening({
    String ntfyBaseUrl = 'https://ntfy.deeztechnology.solutions',
    String topic = 'nkuku-alerts',
  }) {
    stop(); // cancel any existing subscription

    final url = '$ntfyBaseUrl/$topic/sse';

    // Use a dedicated Dio instance without auth interceptors for ntfy
    final dio = Dio(BaseOptions(
      responseType: ResponseType.stream,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: Duration.zero, // stream — no receive timeout
    ));

    dio.get<ResponseBody>(url).then((response) {
      final stream = response.data!.stream;
      final buffer = StringBuffer();

      _sseSub = stream.listen(
        (data) {
          final chunk = utf8.decode(data);
          buffer.write(chunk);
          // Process complete SSE events (terminated by double newline)
          final raw = buffer.toString();
          final events = raw.split('\n\n');
          buffer.clear();
          // Keep the last potentially incomplete event in buffer
          if (!raw.endsWith('\n\n') && events.isNotEmpty) {
            buffer.write(events.removeLast());
          }
          for (final event in events) {
            _processEvent(event.trim());
          }
        },
        onError: (_) {
          // Reconnect after 10 seconds on error
          Future.delayed(const Duration(seconds: 10), () {
            if (AuthService.isLoggedIn) {
              startListening(ntfyBaseUrl: ntfyBaseUrl, topic: topic);
            }
          });
        },
        onDone: () {
          // Reconnect after 5 seconds when stream closes
          Future.delayed(const Duration(seconds: 5), () {
            if (AuthService.isLoggedIn) {
              startListening(ntfyBaseUrl: ntfyBaseUrl, topic: topic);
            }
          });
        },
        cancelOnError: true,
      );
    }).catchError((_) {
      // Reconnect on connection failure
      Future.delayed(const Duration(seconds: 15), () {
        if (AuthService.isLoggedIn) {
          startListening(ntfyBaseUrl: ntfyBaseUrl, topic: topic);
        }
      });
    });
  }

  /// Stop listening (call on logout).
  static void stop() {
    _sseSub?.cancel();
    _sseSub = null;
  }

  static void _processEvent(String event) {
    if (event.isEmpty || event.startsWith(':')) return; // ignore comments/heartbeats

    String? eventData;
    for (final line in event.split('\n')) {
      if (line.startsWith('data: ')) {
        eventData = line.substring(6);
      }
    }

    if (eventData == null || eventData.isEmpty) return;

    try {
      final json = jsonDecode(eventData) as Map<String, dynamic>;
      final title = json['title'] as String? ?? 'Nkuku Alert';
      final message = json['message'] as String? ?? '';
      _showNotification(title, message);
    } catch (_) {
      // Not JSON — treat as plain text
      _showNotification('Nkuku Alert', eventData);
    }
  }

  static Future<void> _showNotification(String title, String body) async {
    const androidDetails = AndroidNotificationDetails(
      _channelId,
      _channelName,
      channelDescription: _channelDesc,
      importance: Importance.high,
      priority: Priority.high,
    );
    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );
    const details = NotificationDetails(android: androidDetails, iOS: iosDetails);

    await _plugin.show(_notificationId++, title, body, details);
  }
}
