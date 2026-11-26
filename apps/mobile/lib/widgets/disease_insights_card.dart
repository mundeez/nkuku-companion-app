import 'package:flutter/material.dart';
import '../services/broiler_service.dart';

/// Card showing disease↔flock insights (Phase F): a watchlist of diseases
/// relevant to the flock plus per-mortality-event disease suggestions from
/// GET /api/v1/broiler-flocks/:id/disease-insights.
class DiseaseInsightsCard extends StatefulWidget {
  final String flockId;

  const DiseaseInsightsCard({super.key, required this.flockId});

  @override
  State<DiseaseInsightsCard> createState() => _DiseaseInsightsCardState();
}

class _DiseaseInsightsCardState extends State<DiseaseInsightsCard> {
  DiseaseInsights? _insights;
  bool _loading = true;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final insights = await BroilerService.getDiseaseInsights(widget.flockId);
      if (!mounted) return;
      setState(() {
        _insights = insights;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = true;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Row(children: [
            SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2)),
            SizedBox(width: 12),
            Text('Loading disease insights…'),
          ]),
        ),
      );
    }

    if (_error) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            const Icon(Icons.error_outline, color: Colors.red, size: 20),
            const SizedBox(width: 8),
            const Expanded(child: Text('Could not load disease insights.')),
            TextButton(onPressed: _load, child: const Text('Retry')),
          ]),
        ),
      );
    }

    final insights = _insights;
    if (insights == null || insights.isEmpty) {
      return const SizedBox.shrink();
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Icon(Icons.coronavirus, size: 20, color: Colors.red[400]),
              const SizedBox(width: 8),
              Expanded(
                child: Text('Disease Insights',
                    style: Theme.of(context).textTheme.titleSmall),
              ),
            ]),
            const SizedBox(height: 12),
            if (insights.watchlist.isNotEmpty) ...[
              const Text('Watchlist',
                  style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      color: Colors.orange)),
              const SizedBox(height: 4),
              ...insights.watchlist.map(_watchlistRow),
              const SizedBox(height: 8),
            ],
            if (insights.matches.isNotEmpty) ...[
              const Text('Mortality matches',
                  style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      color: Colors.red)),
              const SizedBox(height: 4),
              ...insights.matches.map(_matchBlock),
            ],
          ],
        ),
      ),
    );
  }

  Widget _watchlistRow(DiseaseWatchItem item) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(item.disease.name,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          if (item.reason.isNotEmpty)
            Text(item.reason,
                style: TextStyle(fontSize: 12, color: Colors.grey[700])),
          if (item.regionalNote != null && item.regionalNote!.isNotEmpty)
            Text(item.regionalNote!,
                style: TextStyle(
                    fontSize: 11,
                    fontStyle: FontStyle.italic,
                    color: Colors.blueGrey[600])),
        ],
      ),
    );
  }

  Widget _matchBlock(DiseaseInsightMatch match) {
    final top = match.suggestions.take(3).toList();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            match.cause != null && match.cause!.isNotEmpty
                ? 'Cause: ${match.cause}'
                : 'Mortality event',
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
          ),
          ...top.map((s) {
            return Padding(
                padding: const EdgeInsets.only(left: 12, top: 2),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${s.disease.name}'
                      '${s.disease.category.isNotEmpty ? ' · ${s.disease.category}' : ''}'
                      ' — score ${s.score}',
                      style: const TextStyle(fontSize: 12),
                    ),
                    if (s.regionalNote != null && s.regionalNote!.isNotEmpty)
                      Text(s.regionalNote!,
                          style: TextStyle(
                              fontSize: 11,
                              fontStyle: FontStyle.italic,
                              color: Colors.blueGrey[600])),
                  ],
                ),
              );
          }),
        ],
      ),
    );
  }
}
