/// An individual physical feed bag materialized from a purchase.
/// Lifecycle: sealed → open → finished (reseal steps open back to sealed).
class FeedBag {
  final String id;
  final String flockId;
  final String purchaseId;
  final String? feedStageId;
  final String? supplierId;
  final String? supplierName;
  final String stageName;
  final double bagSizeKg;
  final int bagIndex;
  final String status; // 'sealed' | 'open' | 'finished'
  final DateTime? openedAt;
  final DateTime? finishedAt;

  FeedBag({
    required this.id,
    required this.flockId,
    required this.purchaseId,
    this.feedStageId,
    this.supplierId,
    this.supplierName,
    required this.stageName,
    required this.bagSizeKg,
    required this.bagIndex,
    required this.status,
    this.openedAt,
    this.finishedAt,
  });

  factory FeedBag.fromJson(Map<String, dynamic> json) {
    return FeedBag(
      id: json['id'] ?? '',
      flockId: json['flockId'] ?? json['flock_id'] ?? '',
      purchaseId: json['purchaseId'] ?? json['purchase_id'] ?? '',
      feedStageId: json['feedStageId'] ?? json['feed_stage_id'],
      supplierId: json['supplierId'] ?? json['supplier_id'],
      supplierName: json['supplier']?['name'],
      stageName: json['stageName'] ?? json['stage_name'] ?? '',
      bagSizeKg: _toDouble(json['bagSizeKg'] ?? json['bag_size_kg']) ?? 0,
      bagIndex: json['bagIndex'] ?? json['bag_index'] ?? 0,
      status: json['status'] ?? 'sealed',
      openedAt: json['openedAt'] != null
          ? DateTime.tryParse(json['openedAt'])
          : null,
      finishedAt: json['finishedAt'] != null
          ? DateTime.tryParse(json['finishedAt'])
          : null,
    );
  }

  static double? _toDouble(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString());
  }
}

/// Per-stage stock rollup from GET /feed-bags/summary.
class FeedBagStageSummary {
  final String stageName;
  final int sealed;
  final int open;
  final int finished;
  final double sealedKg;
  final double openKg;
  final List<String> suppliers;

  FeedBagStageSummary({
    required this.stageName,
    required this.sealed,
    required this.open,
    required this.finished,
    required this.sealedKg,
    required this.openKg,
    required this.suppliers,
  });

  factory FeedBagStageSummary.fromJson(Map<String, dynamic> json) {
    double d(dynamic v) =>
        v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
    return FeedBagStageSummary(
      stageName: json['stageName'] ?? '',
      sealed: json['sealed'] ?? 0,
      open: json['open'] ?? 0,
      finished: json['finished'] ?? 0,
      sealedKg: d(json['sealedKg']),
      openKg: d(json['openKg']),
      suppliers:
          (json['suppliers'] as List? ?? []).map((e) => '$e').toList(),
    );
  }
}
