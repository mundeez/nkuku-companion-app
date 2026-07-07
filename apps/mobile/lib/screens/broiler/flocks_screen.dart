import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../models/flock.dart';
import 'flock_detail_screen.dart';

class FlocksScreen extends StatefulWidget {
  const FlocksScreen({super.key});

  @override
  State<FlocksScreen> createState() => _FlocksScreenState();
}

class _FlocksScreenState extends State<FlocksScreen> {
  List<BroilerFlock> _flocks = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadFlocks();
  }

  Future<void> _loadFlocks() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ApiService.dio.get('/api/v1/broiler-flocks');
      final flocks = (res.data as List).map((e) => BroilerFlock.fromJson(e)).toList();
      setState(() {
        _flocks = flocks;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load flocks';
        _loading = false;
      });
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'active':
        return Colors.green;
      case 'sold':
        return Colors.blue;
      case 'completed':
        return Colors.purple;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Broiler Flocks'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadFlocks),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadFlocks,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_error!, style: const TextStyle(color: Colors.red)),
                      const SizedBox(height: 16),
                      ElevatedButton(onPressed: _loadFlocks, child: const Text('Retry')),
                    ],
                  ))
                : _flocks.isEmpty
                    ? const Center(child: Text('No flocks yet. Create one from the web app.'))
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _flocks.length,
                        itemBuilder: (context, index) {
                          final flock = _flocks[index];
                          final mortality = flock.initialCount - flock.currentCount;
                          final mortalityRate = flock.initialCount > 0
                              ? ((mortality / flock.initialCount) * 100).toStringAsFixed(1)
                              : '0.0';
                          return Card(
                            margin: const EdgeInsets.only(bottom: 12),
                            child: ListTile(
                              contentPadding: const EdgeInsets.all(16),
                              leading: CircleAvatar(
                                backgroundColor: _statusColor(flock.status).withAlpha(30),
                                child: Icon(Icons.egg_alt, color: _statusColor(flock.status)),
                              ),
                              title: Text(flock.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const SizedBox(height: 4),
                                  Text(flock.breedName ?? 'Unknown breed'),
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      Chip(
                                        label: Text('${flock.currentCount} birds'),
                                        visualDensity: VisualDensity.compact,
                                      ),
                                      const SizedBox(width: 8),
                                      Chip(
                                        label: Text('Day ${flock.ageDays ?? 0}'),
                                        visualDensity: VisualDensity.compact,
                                      ),
                                      const SizedBox(width: 8),
                                      Chip(
                                        label: Text('$mortalityRate% mortality'),
                                        visualDensity: VisualDensity.compact,
                                        backgroundColor: mortalityRate != '0.0'
                                            ? Colors.red.withAlpha(30)
                                            : null,
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              trailing: const Icon(Icons.chevron_right),
                              onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => FlockDetailScreen(flockId: flock.id, flockName: flock.name),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}
