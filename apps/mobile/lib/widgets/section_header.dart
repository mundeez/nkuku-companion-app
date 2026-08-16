import 'package:flutter/material.dart';

/// Small, uppercase-weight section label used to group related list items
/// (e.g. the More screen's Production/Operations/Planning groups).
/// Consolidates what used to be several near-identical private
/// `_SectionHeader` implementations duplicated per-screen.
class SectionHeader extends StatelessWidget {
  final String title;
  const SectionHeader({super.key, required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.bold,
          color: Theme.of(context).colorScheme.primary,
        ),
      ),
    );
  }
}
