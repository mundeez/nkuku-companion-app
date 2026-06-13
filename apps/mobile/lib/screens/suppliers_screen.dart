import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../models/supplier.dart';

class SuppliersScreen extends StatefulWidget {
  const SuppliersScreen({super.key});

  @override
  State<SuppliersScreen> createState() => _SuppliersScreenState();
}

class _SuppliersScreenState extends State<SuppliersScreen> {
  List<Supplier> _suppliers = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await ApiService.dio.get('/api/v1/suppliers');
      setState(() {
        _suppliers = (res.data as List).map((e) => Supplier.fromJson(e)).toList();
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Suppliers')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _suppliers.length,
              itemBuilder: (context, index) {
                final s = _suppliers[index];
                return ExpansionTile(
                  title: Text(s.name),
                  subtitle: Text(s.description ?? 'No description'),
                  leading: s.isDefault
                      ? const Chip(label: Text('Default'), backgroundColor: Colors.green)
                      : null,
                  children: s.feedStages.map((stage) => ListTile(
                    dense: true,
                    title: Text(stage.stageName),
                    subtitle: Text('${stage.unitSizeKg}kg bag @ ZMW ${stage.unitPriceZmw}'),
                    trailing: Text('${stage.intakePerBirdKg}kg/bird'),
                  )).toList(),
                );
              },
            ),
    );
  }
}

