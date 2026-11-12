/// Hatch-day display convention.
///
/// Storage/internal `ageDays` is always 0-based elapsed days (hatch = 0).
/// The org-level `hatchDayConvention` setting controls user-facing
/// "Day N" labels only:
///   'day1' (default): hatch day displays as Day 1 → offset 1
///   'day0':           hatch day displays as Day 0 → offset 0
/// `DayConvention.current` is populated from GET /organizations/me in
/// BroilerService.getOrganization() and refreshed on save in
/// flock_defaults_screen.dart.
class DayConvention {
  static String current = 'day1';

  static int get offset => current == 'day0' ? 0 : 1;
}

/// Converts a 0-based elapsed `ageDays` (or a config day-number like a feed
/// transition day, which is also stored 0-based) to the user-facing day label.
int displayDay(int ageDays) => ageDays + DayConvention.offset;
