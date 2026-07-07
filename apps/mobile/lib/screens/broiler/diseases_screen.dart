import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../models/flock.dart';

class DiseasesScreen extends StatefulWidget {
  const DiseasesScreen({super.key});

  @override
  State<DiseasesScreen> createState() => _DiseasesScreenState();
}

class _DiseasesScreenState extends State<DiseasesScreen> {
  List<Disease> _diseases = [];
  List<Disease> _filtered = [];
  bool _loading = true;
  String? _error;
  String _searchQuery = '';
  String? _selectedCategory;

  @override
  void initState() {
    super.initState();
    _loadDiseases();
  }

  Future<void> _loadDiseases() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ApiService.dio.get('/api/v1/diseases');
      final diseases = (res.data as List).map((e) => Disease.fromJson(e)).toList();
      setState(() {
        _diseases = diseases;
        _filtered = diseases;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load diseases';
        _loading = false;
      });
    }
  }

  void _filter(String query) {
    setState(() {
      _searchQuery = query;
      _filtered = _diseases.where((d) {
        final matchesQuery = d.name.toLowerCase().contains(query.toLowerCase()) ||
            d.symptoms.toLowerCase().contains(query.toLowerCase());
        final matchesCategory = _selectedCategory == null || d.category == _selectedCategory;
        return matchesQuery && matchesCategory;
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final categories = _diseases.map((d) => d.category).toSet().toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Disease Database'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadDiseases),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              decoration: const InputDecoration(
                labelText: 'Search diseases...',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
              ),
              onChanged: _filter,
            ),
          ),
          if (categories.isNotEmpty)
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  FilterChip(
                    label: const Text('All'),
                    selected: _selectedCategory == null,
                    onSelected: (_) {
                      setState(() {
                        _selectedCategory = null;
                        _filter(_searchQuery);
                      });
                    },
                  ),
                  const SizedBox(width: 8),
                  ...categories.map((cat) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: FilterChip(
                          label: Text(cat),
                          selected: _selectedCategory == cat,
                          onSelected: (_) {
                            setState(() {
                              _selectedCategory = cat;
                              _filter(_searchQuery);
                            });
                          },
                        ),
                      )),
                ],
              ),
            ),
          const SizedBox(height: 8),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(_error!, style: const TextStyle(color: Colors.red)),
                          const SizedBox(height: 16),
                          ElevatedButton(onPressed: _loadDiseases, child: const Text('Retry')),
                        ],
                      ))
                    : _filtered.isEmpty
                        ? const Center(child: Text('No diseases found'))
                        : ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            itemCount: _filtered.length,
                            itemBuilder: (context, index) {
                              final disease = _filtered[index];
                              return Card(
                                margin: const EdgeInsets.only(bottom: 8),
                                child: ExpansionTile(
                                  leading: Icon(_categoryIcon(disease.category), color: Colors.red),
                                  title: Text(disease.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                                  subtitle: Text(disease.category),
                                  children: [
                                    Padding(
                                      padding: const EdgeInsets.all(16),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          _InfoRow(label: 'Incubation', value: disease.incubation),
                                          _InfoRow(label: 'Mortality', value: disease.mortalityRate),
                                          const SizedBox(height: 8),
                                          const Text('Symptoms', style: TextStyle(fontWeight: FontWeight.bold)),
                                          Text(disease.symptoms),
                                          const SizedBox(height: 8),
                                          const Text('Prevention', style: TextStyle(fontWeight: FontWeight.bold)),
                                          Text(disease.prevention),
                                          const SizedBox(height: 8),
                                          const Text('Treatment', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.red)),
                                          Text(disease.treatment, style: const TextStyle(color: Colors.red)),
                                          const SizedBox(height: 8),
                                          const Text('Organic Treatments', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.green)),
                                          Text(disease.organicTreatments, style: const TextStyle(color: Colors.green)),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }

  IconData _categoryIcon(String category) {
    switch (category.toLowerCase()) {
      case 'viral':
        return Icons.coronavirus;
      case 'bacterial':
        return Icons.bug_report;
      case 'parasitic':
        return Icons.pest_control;
      case 'fungal':
        return Icons.grain;
      default:
        return Icons.medical_information;
    }
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;

  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.grey)),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
