import 'package:flutter/material.dart';

/// Compact metric card used in dashboard-style stat rows (e.g. Flock
/// Overview: Birds / Initial / Mortality). Value/label are both truncated
/// with an ellipsis instead of overflowing if unusually long.
class StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color? color;

  const StatCard({
    super.key,
    required this.label,
    required this.value,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: color ?? theme.colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style:
                  TextStyle(fontSize: 12, color: theme.colorScheme.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}

/// Lays out any number of [StatCard]s evenly, each wrapped in `Expanded`
/// with spacing between them — the safe pattern for stat rows (avoids the
/// unconstrained-`Row` overflow risk found during the modernization audit).
class StatCardRow extends StatelessWidget {
  final List<StatCard> cards;
  const StatCardRow({super.key, required this.cards});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < cards.length; i++) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(child: cards[i]),
        ],
      ],
    );
  }
}
