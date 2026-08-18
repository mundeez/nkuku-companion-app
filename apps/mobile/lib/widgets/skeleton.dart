import 'package:flutter/material.dart';

/// A single shimmering placeholder box, used to build skeleton loading
/// screens that mimic the shape of the eventual content (cards, list tiles,
/// text lines) instead of a full-screen spinner. Reduces perceived load
/// time since the user immediately sees the layout taking shape.
///
/// Implemented as a small self-contained animation (no external `shimmer`
/// package) to avoid adding a dependency for what's a fairly simple
/// gradient sweep.
class Skeleton extends StatefulWidget {
  final double width;
  final double height;
  final BorderRadius borderRadius;

  const Skeleton({
    super.key,
    this.width = double.infinity,
    required this.height,
    this.borderRadius = const BorderRadius.all(Radius.circular(6)),
  });

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).colorScheme.surfaceContainerHighest;
    final highlight = Theme.of(context).colorScheme.surface;
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (bounds) {
            final t = _controller.value;
            return LinearGradient(
              colors: [base, highlight, base],
              stops: const [0.35, 0.5, 0.65],
              begin: Alignment(-1 - t * 2, 0),
              end: Alignment(1 - t * 2, 0),
            ).createShader(bounds);
          },
          child: Container(
            width: widget.width,
            height: widget.height,
            decoration: BoxDecoration(
              color: base,
              borderRadius: widget.borderRadius,
            ),
          ),
        );
      },
    );
  }
}

/// Skeleton placeholder shaped like a [Card]-based list item with an
/// avatar, a title line, and 1-2 detail lines — matches the common list
/// pattern used across Flocks, Alerts, Vaccines, etc.
class SkeletonListCard extends StatelessWidget {
  final bool withAvatar;
  const SkeletonListCard({super.key, this.withAvatar = true});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (withAvatar) ...[
              const Skeleton(
                width: 40,
                height: 40,
                borderRadius: BorderRadius.all(Radius.circular(20)),
              ),
              const SizedBox(width: 12),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Skeleton(height: 14, width: 160),
                  SizedBox(height: 8),
                  Skeleton(height: 12),
                  SizedBox(height: 6),
                  Skeleton(height: 12, width: 120),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A column of [SkeletonListCard]s, for list screens' initial loading state.
class SkeletonList extends StatelessWidget {
  final int count;
  final bool withAvatar;
  const SkeletonList({super.key, this.count = 5, this.withAvatar = true});

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: count,
      itemBuilder: (context, _) => SkeletonListCard(withAvatar: withAvatar),
    );
  }
}
