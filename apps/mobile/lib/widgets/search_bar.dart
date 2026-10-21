import 'dart:async';
import 'package:flutter/material.dart';

/// Reusable debounced search field for list screens.
///
/// Calls [onChanged] ~300 ms after the user stops typing, and immediately
/// when the clear button is tapped (with an empty string). Named
/// `DebouncedSearchBar` rather than `SearchBar` to avoid colliding with
/// Flutter's built-in Material [SearchBar] widget.
class DebouncedSearchBar extends StatefulWidget {
  /// Called with the trimmed query after the debounce window elapses,
  /// or immediately with `''` when the field is cleared.
  final ValueChanged<String> onChanged;

  /// Placeholder text shown inside the field.
  final String hintText;

  /// How long to wait after the last keystroke before firing [onChanged].
  final Duration debounce;

  const DebouncedSearchBar({
    super.key,
    required this.onChanged,
    this.hintText = 'Search...',
    this.debounce = const Duration(milliseconds: 300),
  });

  @override
  State<DebouncedSearchBar> createState() => _DebouncedSearchBarState();
}

class _DebouncedSearchBarState extends State<DebouncedSearchBar> {
  final TextEditingController _controller = TextEditingController();
  Timer? _debounceTimer;

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onTextChanged(String value) {
    // Rebuild so the clear button appears/disappears with the text.
    setState(() {});
    _debounceTimer?.cancel();
    _debounceTimer = Timer(widget.debounce, () {
      widget.onChanged(value.trim());
    });
  }

  void _clear() {
    _debounceTimer?.cancel();
    _controller.clear();
    setState(() {});
    // Clearing is a deliberate action — notify immediately, no debounce.
    widget.onChanged('');
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _controller,
      decoration: InputDecoration(
        hintText: widget.hintText,
        prefixIcon: const Icon(Icons.search),
        suffixIcon: _controller.text.isEmpty
            ? null
            : IconButton(
                icon: const Icon(Icons.clear),
                tooltip: 'Clear search',
                onPressed: _clear,
              ),
        border: const OutlineInputBorder(),
        isDense: true,
      ),
      textInputAction: TextInputAction.search,
      onChanged: _onTextChanged,
    );
  }
}
