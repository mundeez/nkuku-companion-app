import 'package:flutter/material.dart';

/// Generic record list item used across all Flock Detail record tabs
/// (Growth, Feed, Water, Mortality, Vaccination, Financial, Medication,
/// Environmental, Sales, Documents). Title/subtitle are truncated with an
/// ellipsis so long supplier/feed-type/file names never overflow the row.
class RecordCard extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget trailing;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;

  const RecordCard({
    super.key,
    required this.title,
    this.subtitle,
    required this.trailing,
    this.onEdit,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: subtitle != null
            ? Text(subtitle!, maxLines: 2, overflow: TextOverflow.ellipsis)
            : null,
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            trailing,
            if (onEdit != null)
              IconButton(
                icon: const Icon(Icons.edit),
                onPressed: onEdit,
                visualDensity: VisualDensity.compact,
              ),
            if (onDelete != null)
              IconButton(
                icon: const Icon(Icons.delete, color: Colors.red),
                onPressed: onDelete,
                visualDensity: VisualDensity.compact,
              ),
          ],
        ),
      ),
    );
  }
}

/// Small colored swatch + phase name + day range, used in the Flock
/// Overview feed-programme card.
class FeedPhaseRow extends StatelessWidget {
  final String phase;
  final String dayRange;
  final Color color;

  const FeedPhaseRow({
    super.key,
    required this.phase,
    required this.dayRange,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Container(width: 12, height: 12, color: color),
          const SizedBox(width: 8),
          Text('$phase: ', style: const TextStyle(fontWeight: FontWeight.w600)),
          Flexible(child: Text(dayRange, overflow: TextOverflow.ellipsis)),
        ],
      ),
    );
  }
}
