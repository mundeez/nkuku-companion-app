import 'api_service.dart';

/// Service for double-entry ledger API endpoints.
class LedgerService {
  /// GET /api/v1/ledger/trial-balance
  static Future<Map<String, dynamic>> getTrialBalance({String? asOf}) async {
    final res = await ApiService.dio.get(
      '/api/v1/ledger/trial-balance',
      queryParameters: {if (asOf != null) 'asOf': asOf},
    );
    return res.data as Map<String, dynamic>;
  }

  /// GET /api/v1/accounts
  static Future<List<dynamic>> getAccounts() async {
    final res = await ApiService.dio.get('/api/v1/accounts');
    return res.data as List<dynamic>;
  }

  /// GET /api/v1/ledger/account/:code
  static Future<Map<String, dynamic>> getAccountLedger(
    String code, {
    required String fromDate,
    required String toDate,
  }) async {
    final res = await ApiService.dio.get(
      '/api/v1/ledger/account/$code',
      queryParameters: {'fromDate': fromDate, 'toDate': toDate},
    );
    return res.data as Map<String, dynamic>;
  }

  /// GET /api/v1/journal
  static Future<List<dynamic>> getJournalEntries({String? sourceType}) async {
    final res = await ApiService.dio.get(
      '/api/v1/journal',
      queryParameters: {if (sourceType != null) 'sourceType': sourceType},
    );
    return res.data as List<dynamic>;
  }

  /// GET /api/v1/journal/:id
  static Future<Map<String, dynamic>> getJournalEntry(String id) async {
    final res = await ApiService.dio.get('/api/v1/journal/$id');
    return res.data as Map<String, dynamic>;
  }

  /// GET /api/v1/ledger/income-statement
  static Future<Map<String, dynamic>> getIncomeStatement({
    required String fromDate,
    required String toDate,
  }) async {
    final res = await ApiService.dio.get(
      '/api/v1/ledger/income-statement',
      queryParameters: {'fromDate': fromDate, 'toDate': toDate},
    );
    return res.data as Map<String, dynamic>;
  }

  /// GET /api/v1/ledger/balance-sheet
  static Future<Map<String, dynamic>> getBalanceSheet({String? asOf}) async {
    final res = await ApiService.dio.get(
      '/api/v1/ledger/balance-sheet',
      queryParameters: {if (asOf != null) 'asOf': asOf},
    );
    return res.data as Map<String, dynamic>;
  }

  /// GET /api/v1/ledger/cash-flow
  static Future<Map<String, dynamic>> getCashFlow({
    required String fromDate,
    required String toDate,
  }) async {
    final res = await ApiService.dio.get(
      '/api/v1/ledger/cash-flow',
      queryParameters: {'fromDate': fromDate, 'toDate': toDate},
    );
    return res.data as Map<String, dynamic>;
  }
}
