import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/ad_service.dart';

/// Banner (or native card, via `placement: 'native'`) ad slot for mobile.
/// Mirrors apps/web/src/components/ads/AdSlot.tsx — serves a house ad when
/// eligible, an inert "Advertisement" placeholder for the network fallback
/// (until AdMob is wired in behind ADMOB_ENABLED — see
/// docs/ADVERTISING_PLAN.md §7), or nothing at all (paid tiers / remove-ads
/// add-on / no fill).
class AdSlot extends StatefulWidget {
  final String page;
  final String placement;

  const AdSlot({super.key, required this.page, this.placement = 'banner'});

  @override
  State<AdSlot> createState() => _AdSlotState();
}

class _AdSlotState extends State<AdSlot> {
  AdServeResult? _result;
  bool _impressionFired = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final result = await AdService.serve(widget.page, widget.placement);
    if (!mounted) return;
    setState(() => _result = result);
    if (result.source == 'house' &&
        result.campaign != null &&
        !_impressionFired) {
      _impressionFired = true;
      AdService.recordImpression(result.campaign!.id, widget.page);
    }
  }

  @override
  Widget build(BuildContext context) {
    final result = _result;
    if (result == null || result.source == 'none')
      return const SizedBox.shrink();

    if (result.source == 'network') {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 24),
        decoration: BoxDecoration(
          border: Border.all(
              color: Theme.of(context).dividerColor, style: BorderStyle.solid),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Center(
          child: Text('Advertisement',
              style:
                  TextStyle(color: Theme.of(context).hintColor, fontSize: 12)),
        ),
      );
    }

    final campaign = result.campaign!;
    return GestureDetector(
      onTap: () => launchUrl(
          Uri.parse(AdService.clickUrl(campaign.id, widget.page)),
          mode: LaunchMode.externalApplication),
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          border: Border.all(color: Theme.of(context).dividerColor),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Stack(
          children: [
            Image.network(campaign.creativeImageUrl,
                width: double.infinity,
                fit: BoxFit.cover,
                semanticLabel: campaign.altText),
            Positioned(
              top: 4,
              left: 4,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text('Sponsored',
                    style: TextStyle(color: Colors.white, fontSize: 10)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
