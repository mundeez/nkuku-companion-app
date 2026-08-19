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
  final VoidCallback? onTap;

  // Selection mode props
  final bool selectable;
  final bool selected;
  final ValueChanged<bool>? onSelectChanged;

  const RecordCard({
    super.key,
    required this.title,
    this.subtitle,
    required this.trailing,
    this.onEdit,
    this.onDelete,
    this.onTap,
    this.selectable = false,
    this.selected = false,
    this.onSelectChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: selectable && selected
          ? Theme.of(context).colorScheme.primary.withAlpha(30)
          : null,
      child: ListTile(
        leading: selectable
            ? Checkbox(
                value: selected,
                onChanged: (bool? value) => onSelectChanged?.call(value ?? false),
              )
            : null,
        title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: subtitle != null
            ? Text(subtitle!, maxLines: 2, overflow: TextOverflow.ellipsis)
            : null,
        trailing: selectable
            ? null
            : Row(
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
        onTap: selectable ? () => onSelectChanged?.call(!selected) : onTap,
        onLongPress: !selectable && onDelete != null ? () => onSelectChanged?.call(true) : null,
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
