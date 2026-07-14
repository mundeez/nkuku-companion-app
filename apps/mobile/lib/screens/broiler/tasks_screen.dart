import 'package:flutter/material.dart';
import '../../models/flock_task.dart';
import '../../services/auth_service.dart';
import '../../services/broiler_service.dart';

class TasksScreen extends StatefulWidget {
  final String flockId;

  const TasksScreen({super.key, required this.flockId});

  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  List<FlockTask> _tasks = [];
  bool _loading = true;
  String? _error;
  String _filter = 'pending';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final tasks = await BroilerService.getFlockTasks(widget.flockId, status: _filter);
      if (mounted) setState(() { _tasks = tasks; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _generate() async {
    if (!AuthService.canEdit) return;
    setState(() => _loading = true);
    try {
      final result = await BroilerService.generateFlockTasks(widget.flockId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Generated ${result.generated} tasks')));
      }
      await _load();
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _toggleComplete(FlockTask task, bool value) async {
    if (!AuthService.canEdit) return;
    try {
      await BroilerService.updateFlockTask(task.id, isCompleted: value, isSkipped: value ? false : task.isSkipped);
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Update failed: $e')));
    }
  }

  Future<void> _toggleSkip(FlockTask task, bool value) async {
    if (!AuthService.canEdit) return;
    try {
      await BroilerService.updateFlockTask(task.id, isSkipped: value, isCompleted: value ? false : task.isCompleted);
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Update failed: $e')));
    }
  }

  Future<void> _delete(FlockTask task) async {
    if (!AuthService.canDelete) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete task?'),
        content: Text('Delete "${task.title}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await BroilerService.deleteFlockTask(task.id);
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Delete failed: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _loading && _tasks.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : _error != null && _tasks.isEmpty
              ? Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Text(_error!, style: const TextStyle(color: Colors.red)),
                  const SizedBox(height: 16),
                  ElevatedButton(onPressed: _load, child: const Text('Retry')),
                ]))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _tasks.isEmpty ? 1 : _tasks.length + 1,
                    itemBuilder: (context, index) {
                      if (index == 0) {
                        return Row(
                          children: [
                            Expanded(
                              child: SegmentedButton<String>(
                                segments: const [
                                  ButtonSegment(value: 'pending', label: Text('Pending')),
                                  ButtonSegment(value: 'completed', label: Text('Done')),
                                  ButtonSegment(value: 'skipped', label: Text('Skipped')),
                                ],
                                selected: {_filter},
                                onSelectionChanged: (s) {
                                  setState(() => _filter = s.first);
                                  _load();
                                },
                              ),
                            ),
                            if (AuthService.canEdit) ...[
                              const SizedBox(width: 8),
                              ElevatedButton.icon(
                                onPressed: _generate,
                                icon: const Icon(Icons.auto_fix_high),
                                label: const Text('Generate'),
                              ),
                            ],
                          ],
                        );
                      }
                      if (_tasks.isEmpty) {
                        return const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('No tasks.')));
                      }
                      final task = _tasks[index - 1];
                      return Card(
                        margin: const EdgeInsets.only(top: 12),
                        child: ListTile(
                          leading: CircleAvatar(child: Text('D${task.ageDays}')),
                          title: Text(task.title),
                          subtitle: Text('${task.category} · ${task.taskDate.toIso8601String().split('T').first}\n${task.description ?? ''}'),
                          isThreeLine: true,
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (AuthService.canEdit) ...[
                                IconButton(
                                  icon: Icon(Icons.check_circle, color: task.isCompleted ? Colors.green : Colors.grey),
                                  onPressed: () => _toggleComplete(task, !task.isCompleted),
                                  tooltip: 'Complete',
                                ),
                                IconButton(
                                  icon: Icon(Icons.skip_next, color: task.isSkipped ? Colors.orange : Colors.grey),
                                  onPressed: () => _toggleSkip(task, !task.isSkipped),
                                  tooltip: 'Skip',
                                ),
                              ],
                              if (AuthService.canDelete)
                                IconButton(
                                  icon: const Icon(Icons.delete, color: Colors.red),
                                  onPressed: () => _delete(task),
                                ),
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
