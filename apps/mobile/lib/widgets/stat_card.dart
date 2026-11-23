import 'package:flutter/material.dart';

/// Compact metric card used in dashboard-style stat rows (e.g. Flock
/// Overview: Birds / Initial / Mortality). Value/label are both truncated
/// with an ellipsis instead of overflowing if unusually long.
class StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color? color;
  final VoidCallback? onTap;

  const StatCard({
    super.key,
    required this.label,
    required this.value,
    this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
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

/// Horizontally-paged 2×2 grid of [StatCard]s — keeps the card area a fixed
/// height and scrolls only the cards, leaving the content below untouched.
/// Shows a dot indicator when there is more than one page.
class StatCardPager extends StatefulWidget {
  final List<StatCard> cards;
  const StatCardPager({super.key, required this.cards});

  @override
  State<StatCardPager> createState() => _StatCardPagerState();
}

class _StatCardPagerState extends State<StatCardPager> {
  final _controller = PageController();
  int _page = 0;

  static const _cardsPerPage = 4;
  static const _pageHeight = 180.0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cards = widget.cards;
    final pageCount = (cards.length / _cardsPerPage).ceil();
    final pager = SizedBox(
      height: _pageHeight,
      child: pageCount <= 1
          ? _pageGrid(cards)
          : PageView(
              controller: _controller,
              onPageChanged: (p) => setState(() => _page = p),
              children: [
                for (var p = 0; p < pageCount; p++)
                  _pageGrid(
                    cards.skip(p * _cardsPerPage).take(_cardsPerPage).toList(),
                  ),
              ],
            ),
    );
    if (pageCount <= 1) return pager;
    return Column(
      children: [
        pager,
        const SizedBox(height: 6),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var i = 0; i < pageCount; i++)
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: i == _page ? 16 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color: i == _page
                      ? Theme.of(context).colorScheme.primary
                      : Theme.of(context).colorScheme.outlineVariant,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
          ],
        ),
      ],
    );
  }

  Widget _pageGrid(List<StatCard> pageCards) {
    Widget cell(int i) =>
        i < pageCards.length ? pageCards[i] : const SizedBox.shrink();
    Widget row(int r) => Expanded(
          child: Row(
            children: [
              Expanded(child: cell(r * 2)),
              const SizedBox(width: 8),
              Expanded(child: cell(r * 2 + 1)),
            ],
          ),
        );
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Column(
        children: [
          row(0),
          const SizedBox(height: 8),
          row(1),
        ],
      ),
    );
  }
}
