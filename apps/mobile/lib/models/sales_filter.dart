/// Filter parameters for sale record queries.
class SalesFilter {
  final DateTime? fromDate;
  final DateTime? toDate;
  final String? paymentStatus; // 'pending' | 'partial' | 'paid'
  final String? flockId;
  final String? customerQuery;
  final String? sortBy;
  final String? sortDir; // 'asc' | 'desc'
  final int limit;
  final int offset;

  const SalesFilter({
    this.fromDate,
    this.toDate,
    this.paymentStatus,
    this.flockId,
    this.customerQuery,
    this.sortBy,
    this.sortDir,
    this.limit = 20,
    this.offset = 0,
  });

  /// Returns true if any filter is active.
  bool get hasActiveFilters =>
      fromDate != null ||
      toDate != null ||
      (paymentStatus != null && paymentStatus!.isNotEmpty) ||
      (flockId != null && flockId!.isNotEmpty) ||
      (customerQuery != null && customerQuery!.isNotEmpty);

  /// Number of active filter dimensions (for badge count).
  int get activeCount {
    int count = 0;
    if (fromDate != null) count++;
    if (toDate != null) count++;
    if (paymentStatus != null && paymentStatus!.isNotEmpty) count++;
    if (flockId != null && flockId!.isNotEmpty) count++;
    if (customerQuery != null && customerQuery!.isNotEmpty) count++;
    return count;
  }

  /// Convert filter to query parameters for Dio.
  Map<String, dynamic> toQueryParams() {
    final params = <String, dynamic>{};
    if (fromDate != null) {
      params['fromDate'] = _formatDate(fromDate!);
    }
    if (toDate != null) {
      params['toDate'] = _formatDate(toDate!);
    }
    if (paymentStatus != null && paymentStatus!.isNotEmpty) {
      params['paymentStatus'] = paymentStatus;
    }
    if (flockId != null && flockId!.isNotEmpty) {
      params['flockId'] = flockId;
    }
    if (customerQuery != null && customerQuery!.isNotEmpty) {
      params['customer'] = customerQuery;
    }
    if (sortBy != null && sortBy!.isNotEmpty) {
      params['sortBy'] = sortBy;
      params['sortDir'] = sortDir ?? 'desc';
    }
    params['limit'] = limit;
    params['offset'] = offset;
    return params;
  }

  /// Convert filter to query params without pagination (for dashboard/summary).
  Map<String, dynamic> toFilterParams() {
    final params = <String, dynamic>{};
    if (fromDate != null) params['fromDate'] = _formatDate(fromDate!);
    if (toDate != null) params['toDate'] = _formatDate(toDate!);
    if (paymentStatus != null && paymentStatus!.isNotEmpty) {
      params['paymentStatus'] = paymentStatus;
    }
    if (flockId != null && flockId!.isNotEmpty) params['flockId'] = flockId;
    if (customerQuery != null && customerQuery!.isNotEmpty) {
      params['customer'] = customerQuery;
    }
    return params;
  }

  SalesFilter copyWith({
    DateTime? fromDate,
    DateTime? toDate,
    String? paymentStatus,
    String? flockId,
    String? customerQuery,
    String? sortBy,
    String? sortDir,
    int? limit,
    int? offset,
    bool clearFromDate = false,
    bool clearToDate = false,
    bool clearPaymentStatus = false,
    bool clearFlockId = false,
    bool clearCustomerQuery = false,
  }) {
    return SalesFilter(
      fromDate: clearFromDate ? null : (fromDate ?? this.fromDate),
      toDate: clearToDate ? null : (toDate ?? this.toDate),
      paymentStatus: clearPaymentStatus ? null : (paymentStatus ?? this.paymentStatus),
      flockId: clearFlockId ? null : (flockId ?? this.flockId),
      customerQuery: clearCustomerQuery ? null : (customerQuery ?? this.customerQuery),
      sortBy: sortBy ?? this.sortBy,
      sortDir: sortDir ?? this.sortDir,
      limit: limit ?? this.limit,
      offset: offset ?? this.offset,
    );
  }

  static String _formatDate(DateTime d) {
    final y = d.year.toString().padLeft(4, '0');
    final m = d.month.toString().padLeft(2, '0');
    final day = d.day.toString().padLeft(2, '0');
    return '$y-$m-$day';
  }
}
