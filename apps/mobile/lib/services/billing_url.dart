/// Store-posture flag — set at build time via
/// `--dart-define=APP_STORE_MODE=strict|link` (default: `link`).
///
///  * `link`   — normal builds (Android): billing upsell UI may show a
///               tappable link that opens the web billing page via
///               url_launcher.
///  * `strict` — iOS App Store review builds: billing upsell UI must not
///               present a tappable external purchase link. The upgrade
///               sheet shows "Manage your plan on the web" as plain text
///               and never calls url_launcher.
const String appStoreMode = String.fromEnvironment(
  'APP_STORE_MODE',
  defaultValue: 'link',
);

/// True when built with `APP_STORE_MODE=strict` (iOS review posture).
const bool appStoreModeStrict = appStoreMode == 'strict';

/// Derive the web app base URL from the API base URL
/// (`APP_API_BASE_URL`). Strips trailing slashes and any trailing
/// `/api` or `/api/vN` path segment, so both
/// `https://example.com` and `https://example.com/api/v1` resolve to
/// `https://example.com`.
String webBaseUrlFrom(String apiBaseUrl) {
  var url = apiBaseUrl.trim();
  while (url.endsWith('/')) {
    url = url.substring(0, url.length - 1);
  }
  return url.replaceFirst(RegExp(r'/api(/v\d+)?$'), '');
}

/// Web billing page URL derived from the API base URL.
String billingUrlFrom(String apiBaseUrl) =>
    '${webBaseUrlFrom(apiBaseUrl)}/billing';
