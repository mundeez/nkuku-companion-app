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

  Future<void> _showCreateDialog() async {
    if (!AuthService.canEdit) return;
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => _TaskCreateDialog(flockId: widget.flockId),
    );
    if (result == true) _load();
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
      floatingActionButton: AuthService.canEdit
          ? FloatingActionButton.extended(
              icon: const Icon(Icons.add),
              label: const Text('New Task'),
              onPressed: _showCreateDialog,
            )
          : null,
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
                          title: Text(task.title,
                              maxLines: 1, overflow: TextOverflow.ellipsis),
                          subtitle: Text(
                              '${task.category} · ${task.taskDate.toIso8601String().split('T').first}\n${task.description ?? ''}',
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis),
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

class _TaskCreateDialog extends StatefulWidget {
  final String flockId;
  const _TaskCreateDialog({required this.flockId});

  @override
  State<_TaskCreateDialog> createState() => _TaskCreateDialogState();
}

class _TaskCreateDialogState extends State<_TaskCreateDialog> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descController = TextEditingController();
  final _ageController = TextEditingController(text: '0');
  DateTime _taskDate = DateTime.now();
  String _category = 'management';
  bool _saving = false;
  String? _error;

  final _categories = [
    'vaccination', 'feed', 'water', 'environment',
    'health', 'biosecurity', 'management',
  ];

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    _ageController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _taskDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked != null) setState(() => _taskDate = picked);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _saving = true; _error = null; });
    try {
      final task = FlockTask(
        id: '',
        flockId: widget.flockId,
        taskDate: _taskDate,
        ageDays: int.parse(_ageController.text.trim()),
        category: _category,
        title: _titleController.text.trim(),
        description: _descController.text.trim().isEmpty ? null : _descController.text.trim(),
      );
      await BroilerService.createFlockTask(task);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _saving = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('New Task'),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _titleController,
                decoration: const InputDecoration(labelText: 'Title'),
                validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _category,
                decoration: const InputDecoration(labelText: 'Category'),
                items: _categories
                    .map((c) => DropdownMenuItem(value: c, child: Text(c[0].toUpperCase() + c.substring(1))))
                    .toList(),
                onChanged: (v) => setState(() => _category = v!),
              ),
              const SizedBox(height: 12),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.calendar_today),
                title: Text(_taskDate.toIso8601String().split('T').first),
                trailing: const Text('Change'),
                onTap: _pickDate,
              ),
              TextFormField(
                controller: _ageController,
                decoration: const InputDecoration(labelText: 'Age (days)'),
                keyboardType: TextInputType.number,
                validator: (v) {
                  final n = int.tryParse(v ?? '');
                  if (n == null || n < 0) return 'Enter a valid number';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _descController,
                decoration: const InputDecoration(labelText: 'Description (optional)'),
                maxLines: 2,
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(onPressed: _saving ? null : () => Navigator.pop(context, false), child: const Text('Cancel')),
        ElevatedButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Save'),
        ),
      ],
    );
  }
}
