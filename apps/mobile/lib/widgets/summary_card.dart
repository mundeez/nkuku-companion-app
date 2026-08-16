import 'package:flutter/material.dart';

/// Card wrapper for a vertical list of [SummaryRow]s (label/value pairs) —
/// used throughout Flock Detail's summary sections (Growth, Feed, Water,
/// Mortality, Vaccination, Financial, Sales, etc).
class SummaryCard extends StatelessWidget {
  final List<Widget> children;
  const SummaryCard({super.key, required this.children});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: children,
        ),
      ),
    );
  }
}

/// A label/value row. Both sides are bounded and ellipsized so long labels
/// or values (e.g. long supplier/feed-type names) truncate gracefully
/// instead of throwing a `RenderFlex` overflow.
class SummaryRow extends StatelessWidget {
  final String label;
  final String value;
  const SummaryRow(this.label, this.value, {super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.right,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }
}
