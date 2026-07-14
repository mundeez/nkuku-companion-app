import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:share_plus/share_plus.dart';
import '../../models/flock.dart';

class CalendarScreen extends StatefulWidget {
  final BroilerFlock flock;
  final List<CalendarDay> days;

  const CalendarScreen({super.key, required this.flock, required this.days});

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  final _captureKey = GlobalKey();
  bool _sharing = false;

  Future<void> _shareImage() async {
    setState(() => _sharing = true);
    try {
      await Future.delayed(const Duration(milliseconds: 200));
      final boundary = _captureKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) throw Exception('Cannot capture calendar');
      final image = await boundary.toImage(pixelRatio: 3.0);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      final bytes = byteData?.buffer.asUint8List();
      if (bytes == null) throw Exception('Failed to encode image');
      await SharePlus.instance.share(
        ShareParams(
          files: [XFile.fromData(bytes, mimeType: 'image/png', name: 'calendar_${widget.flock.id}.png')],
          text: 'Flock calendar: ${widget.flock.name}',
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Share failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _sharing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Flock Calendar'),
        actions: [
          IconButton(
            icon: _sharing ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.share),
            onPressed: _sharing ? null : _shareImage,
          ),
        ],
      ),
      body: RepaintBoundary(
        key: _captureKey,
        child: ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: widget.days.length,
          itemBuilder: (context, index) {
            final day = widget.days[index];
            final env = day.lightingTemperature;
            return Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        CircleAvatar(child: Text('${day.day}')),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Day ${day.day} · ${day.feedPhase}',
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                        ),
                        Text(day.date.split('T').first, style: const TextStyle(color: Colors.grey)),
                      ],
                    ),
                    const Divider(),
                    if (day.vaccines.isNotEmpty) ...[
                      const Text('Vaccines', style: TextStyle(fontWeight: FontWeight.bold)),
                      ...day.vaccines.map((v) => Text('• ${v.vaccineName} (Day ${v.ageDays})')),
                      const SizedBox(height: 8),
                    ],
                    if (env != null) ...[
                      const Text('Environment', style: TextStyle(fontWeight: FontWeight.bold)),
                      Text('Temp ${env.targetTempC ?? "-"}°C · Humidity ${env.targetRhMinPct ?? "-"}-${env.targetRhMaxPct ?? "-"}% · Light ${env.lightHours ?? "-"}h'),
                      const SizedBox(height: 8),
                    ],
                    if (day.managementTasks.isNotEmpty) ...[
                      const Text('Tasks', style: TextStyle(fontWeight: FontWeight.bold)),
                      ...day.managementTasks.map((t) => Text('• $t')),
                      const SizedBox(height: 8),
                    ],
                    Text('Health: ${day.healthSupport}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
