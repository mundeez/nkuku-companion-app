import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class OverheadsScreen extends StatefulWidget {
  const OverheadsScreen({super.key});

  @override
  State<OverheadsScreen> createState() => _OverheadsScreenState();
}

class _OverheadsScreenState extends State<OverheadsScreen> {
  List<dynamic> _overheads = [];
  bool _loading = true;
  bool _showForm = false;
  final _form = {
    'yearMonth': DateTime.now().toIso8601String().substring(0, 7),
    'category': 'labour',
    'description': '',
    'amountZmw': '',
    'contractType': 'monthly',
  };

  final _categories = [
    'labour', 'electricity', 'water', 'litter',
    'transport_to_market', 'medication', 'vaccination', 'other',
  ];

  final _contractTypes = ['monthly', 'weekly', 'daily', 'once_off'];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await ApiService.dio.get('/api/v1/financial-engine/overheads');
      setState(() {
        _overheads = res.data;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to load overheads')),
      );
    }
  }

  Future<void> _create() async {
    try {
      await ApiService.dio.post('/api/v1/financial-engine/overheads', data: {
        ..._form,
        'amountZmw': double.parse(_form['amountZmw']!),
      });
      setState(() {
        _showForm = false;
        _form['description'] = '';
        _form['amountZmw'] = '';
      });
      _load();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to add overhead')),
      );
    }
  }

  Future<void> _delete(String id) async {
    try {
      await ApiService.dio.delete('/api/v1/financial-engine/overheads/$id');
      _load();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to delete overhead')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final grouped = <String, List<dynamic>>{};
    for (final o in _overheads) {
      grouped.putIfAbsent(o['yearMonth'], () => []).add(o);
    }
    final months = grouped.keys.toList()..sort((a, b) => b.compareTo(a));

    return Scaffold(
      appBar: AppBar(title: const Text('Monthly Overheads')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_showForm) ...[
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            TextField(
                              decoration: const InputDecoration(labelText: 'Month (YYYY-MM)'),
                              controller: TextEditingController(text: _form['yearMonth']),
                              onChanged: (v) => _form['yearMonth'] = v,
                            ),
                            const SizedBox(height: 8),
                            DropdownButtonFormField<String>(
                              value: _form['category'],
                              decoration: const InputDecoration(labelText: 'Category'),
                              items: _categories.map((c) => DropdownMenuItem(value: c, child: Text(c.replaceAll('_', ' ')))).toList(),
                              onChanged: (v) => setState(() => _form['category'] = v!),
                            ),
                            const SizedBox(height: 8),
                            TextField(
                              decoration: const InputDecoration(labelText: 'Description'),
                              onChanged: (v) => _form['description'] = v,
                            ),
                            const SizedBox(height: 8),
                            TextField(
                              decoration: const InputDecoration(labelText: 'Amount (ZMW)'),
                              keyboardType: TextInputType.number,
                              onChanged: (v) => _form['amountZmw'] = v,
                            ),
                            const SizedBox(height: 8),
                            DropdownButtonFormField<String>(
                              value: _form['contractType'],
                              decoration: const InputDecoration(labelText: 'Contract Type'),
                              items: _contractTypes.map((c) => DropdownMenuItem(value: c, child: Text(c.replaceAll('_', ' ')))).toList(),
                              onChanged: (v) => setState(() => _form['contractType'] = v!),
                            ),
                            const SizedBox(height: 16),
                            FilledButton(
                              onPressed: _create,
                              child: const Text('Add Overhead & Allocate'),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  ...months.map((month) {
                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(month, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 8),
                            ...grouped[month]!.map((o) => ListTile(
                              dense: true,
                              title: Text(o['category'].toString().replaceAll('_', ' ')),
                              subtitle: Text(o['description'] ?? ''),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text('ZMW ${(o['amountZmw'] as num).toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold)),
                                  IconButton(
                                    icon: const Icon(Icons.delete, color: Colors.red, size: 20),
                                    onPressed: () => _delete(o['id']),
                                  ),
                                ],
                              ),
                            )),
                          ],
                        ),
                      ),
                    );
                  }),
                  if (_overheads.isEmpty)
                    const Center(child: Text('No overheads yet. Tap + to add.', style: TextStyle(color: Colors.grey))),
                ],
              ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => setState(() => _showForm = !_showForm),
        child: Icon(_showForm ? Icons.close : Icons.add),
      ),
    );
  }
}
