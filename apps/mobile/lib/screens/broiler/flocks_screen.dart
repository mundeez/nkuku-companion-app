import 'package:flutter/material.dart';
import '../../models/flock.dart';
import '../../services/auth_service.dart';
import '../../services/broiler_service.dart';
import 'flock_detail_screen.dart';
import 'flock_form_screen.dart';

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
      final flocks = await BroilerService.getFlocks();
      if (!mounted) return;
      setState(() {
        _flocks = flocks;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load flocks: $e';
        _loading = false;
      });
    }
  }

  Future<void> _createFlock() async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const FlockFormScreen()),
    );
    if (result != null) _loadFlocks();
  }

  Future<void> _editFlock(BroilerFlock flock) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => FlockFormScreen(flock: flock)),
    );
    if (result != null) _loadFlocks();
  }

  Future<void> _deleteFlock(BroilerFlock flock) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete flock?'),
        content: Text('This will permanently delete "${flock.name}" and all its records.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await BroilerService.deleteFlock(flock.id);
      if (mounted) _loadFlocks();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Delete failed: $e')));
      }
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

  Color _harvestColor(int? days) {
    if (days == null) return Colors.amber;
    if (days <= 0) return Colors.red;
    if (days <= 7) return Colors.orange;
    return Colors.grey;
  }

  String _harvestLabel(int? days) {
    if (days == null) return 'Pending';
    if (days <= 0) return 'Due now';
    if (days == 1) return '1 day left';
    return '$days days left';
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
      floatingActionButton: AuthService.canEdit
          ? FloatingActionButton(
              onPressed: _createFlock,
              child: const Icon(Icons.add),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: _loadFlocks,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(_error!, style: const TextStyle(color: Colors.red)),
                        const SizedBox(height: 16),
                        ElevatedButton(onPressed: _loadFlocks, child: const Text('Retry')),
                      ],
                    ),
                  )
                : _flocks.isEmpty
                    ? const Center(child: Text('No flocks yet. Tap + to create one.'))
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
                                        label: Text(
                                          flock.startDate == null
                                              ? 'Pending'
                                              : 'Day ${flock.ageDays ?? 0}',
                                        ),
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
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      Icon(Icons.event, size: 14, color: Colors.grey[600]),
                                      const SizedBox(width: 4),
                                      Text(
                                        flock.harvestDateStr != null
                                            ? 'Harvest: ${flock.harvestDateStr}'
                                            : 'Harvest: Pending',
                                        style: TextStyle(fontSize: 12, color: Colors.grey[700]),
                                      ),
                                      const SizedBox(width: 12),
                                      Icon(Icons.timer, size: 14, color: _harvestColor(flock.daysToHarvest)),
                                      const SizedBox(width: 4),
                                      Text(
                                        _harvestLabel(flock.daysToHarvest),
                                        style: TextStyle(fontSize: 12, color: _harvestColor(flock.daysToHarvest)),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              trailing: PopupMenuButton<String>(
                                onSelected: (value) {
                                  if (value == 'edit') {
                                    _editFlock(flock);
                                  } else if (value == 'delete') {
                                    _deleteFlock(flock);
                                  }
                                },
                                itemBuilder: (context) => [
                                  if (AuthService.canEdit)
                                    const PopupMenuItem(value: 'edit', child: Text('Edit')),
                                  if (AuthService.canDelete)
                                    const PopupMenuItem(value: 'delete', child: Text('Delete')),
                                  if (!AuthService.canEdit && !AuthService.canDelete)
                                    const PopupMenuItem(value: 'noop', enabled: false, child: Text('No actions')),
                                ],
                              ),
                              onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => FlockDetailScreen(flockId: flock.id, flockName: flock.name),
                                ),
                              ).then((_) => _loadFlocks()),
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}
