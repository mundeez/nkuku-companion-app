import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../models/flock.dart';

class VaccinationSchedulesScreen extends StatefulWidget {
  const VaccinationSchedulesScreen({super.key});

  @override
  State<VaccinationSchedulesScreen> createState() => _VaccinationSchedulesScreenState();
}

class _VaccinationSchedulesScreenState extends State<VaccinationSchedulesScreen> {
  List<VaccinationSchedule> _schedules = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadSchedules();
  }

  Future<void> _loadSchedules() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ApiService.dio.get('/api/v1/vaccination-events/schedules');
      final schedules = (res.data as List).map((e) => VaccinationSchedule.fromJson(e)).toList();
      setState(() {
        _schedules = schedules;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load schedules';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Vaccination Schedules'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadSchedules),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadSchedules,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_error!, style: const TextStyle(color: Colors.red)),
                      const SizedBox(height: 16),
                      ElevatedButton(onPressed: _loadSchedules, child: const Text('Retry')),
                    ],
                  ))
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _schedules.length,
                    itemBuilder: (context, index) {
                      final schedule = _schedules[index];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 16),
                        child: ExpansionTile(
                          leading: Icon(
                            schedule.isDefault ? Icons.star : Icons.schedule,
                            color: schedule.isDefault ? Colors.amber : Colors.green,
                          ),
                          title: Text(schedule.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Text('${schedule.items.length} vaccinations'),
                          children: [
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              child: Text(schedule.description,
                                  style: const TextStyle(fontSize: 12, color: Colors.grey)),
                            ),
                            const Divider(),
                            ...schedule.items.map((item) => ListTile(
                                  leading: CircleAvatar(
                                    backgroundColor: _dayColor(item.ageDays),
                                    child: Text('D${item.ageDays}',
                                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                                  ),
                                  title: Text(item.vaccineName,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontSize: 14)),
                                  subtitle: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('${item.vaccineType} - ${item.adminMethod}',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(fontSize: 12)),
                                      if (item.notes != null && item.notes!.isNotEmpty)
                                        Padding(
                                          padding: const EdgeInsets.only(top: 4),
                                          child: Text(item.notes!,
                                              style: const TextStyle(fontSize: 11, color: Colors.grey),
                                              maxLines: 3,
                                              overflow: TextOverflow.ellipsis),
                                        ),
                                    ],
                                  ),
                                  isThreeLine: true,
                                )),
                          ],
                        ),
                      );
                    },
                  ),
      ),
    );
  }

  Color _dayColor(int day) {
    if (day == 0) return Colors.purple.withAlpha(30);
    if (day <= 10) return Colors.orange.withAlpha(30);
    if (day <= 14) return Colors.blue.withAlpha(30);
    if (day <= 18) return Colors.teal.withAlpha(30);
    if (day <= 21) return Colors.red.withAlpha(30);
    return Colors.grey.withAlpha(30);
  }
}
