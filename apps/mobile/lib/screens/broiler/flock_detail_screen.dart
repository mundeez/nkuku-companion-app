import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../services/api_service.dart';
import '../../models/flock.dart';

class FlockDetailScreen extends StatefulWidget {
  final String flockId;
  final String flockName;

  const FlockDetailScreen({super.key, required this.flockId, required this.flockName});

  @override
  State<FlockDetailScreen> createState() => _FlockDetailScreenState();
}

class _FlockDetailScreenState extends State<FlockDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  BroilerFlock? _flock;
  List<CalendarDay> _calendarDays = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final flockRes = await ApiService.dio.get('/api/v1/broiler-flocks/${widget.flockId}');
      _flock = BroilerFlock.fromJson(flockRes.data['flock'] ?? flockRes.data);

      final calRes = await ApiService.dio.get('/api/v1/broiler-flocks/${widget.flockId}/summary');
      final days = (calRes.data['days'] as List).map((e) => CalendarDay.fromJson(e)).toList();
      setState(() {
        _calendarDays = days;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load flock details';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.flockName),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(icon: Icon(Icons.info), text: 'Overview'),
            Tab(icon: Icon(Icons.thermostat), text: 'Environment'),
            Tab(icon: Icon(Icons.vaccines), text: 'Vaccination'),
            Tab(icon: Icon(Icons.medical_services), text: 'Health'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(_error!, style: const TextStyle(color: Colors.red)),
                    const SizedBox(height: 16),
                    ElevatedButton(onPressed: _loadData, child: const Text('Retry')),
                  ],
                ))
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _buildOverviewTab(),
                    _buildEnvironmentTab(),
                    _buildVaccinationTab(),
                    _buildHealthTab(),
                  ],
                ),
    );
  }

  Widget _buildOverviewTab() {
    final flock = _flock!;
    final mortality = flock.initialCount - flock.currentCount;
    final mortalityRate = flock.initialCount > 0
        ? ((mortality / flock.initialCount) * 100).toStringAsFixed(1)
        : '0.0';
    final feedTransition = flock.feedTransitionDay ?? 18;
    final finisherDay = flock.finisherDay ?? 29;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(flock.name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Text('Breed: ${flock.breedName ?? "Unknown"}'),
                Text('Housing: ${flock.housingType.replaceAll('_', ' ')}'),
                Text('Started: ${flock.startDate.split('T').first}'),
                Text('Age: Day ${flock.ageDays ?? 0}'),
                Text('Status: ${flock.status}'),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: _StatCard(label: 'Birds', value: '${flock.currentCount}', color: Colors.green)),
            const SizedBox(width: 8),
            Expanded(child: _StatCard(label: 'Initial', value: '${flock.initialCount}', color: Colors.blue)),
            const SizedBox(width: 8),
            Expanded(child: _StatCard(label: 'Mortality', value: '$mortalityRate%', color: Colors.red)),
          ],
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Feed Programme', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                _FeedPhaseRow(phase: 'Starter', dayRange: 'Day 1 - $feedTransition', color: Colors.orange),
                _FeedPhaseRow(phase: 'Grower', dayRange: 'Day ${feedTransition + 1} - $finisherDay', color: Colors.teal),
                _FeedPhaseRow(phase: 'Finisher', dayRange: 'Day ${finisherDay + 1}+', color: Colors.brown),
                const SizedBox(height: 8),
                Text('Transition day: Day $feedTransition (configurable)',
                    style: const TextStyle(fontSize: 12, color: Colors.grey)),
                Text('Finisher start: Day $finisherDay (configurable)',
                    style: const TextStyle(fontSize: 12, color: Colors.grey)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        if (flock.targetWeight != null || flock.targetAge != null)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Targets', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  if (flock.targetWeight != null)
                    Text('Target weight: ${flock.targetWeight} kg'),
                  if (flock.targetAge != null)
                    Text('Target age: Day ${flock.targetAge}'),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildEnvironmentTab() {
    final envDays = _calendarDays.where((d) => d.lightingTemperature != null).toList();

    if (envDays.isEmpty) {
      return const Center(child: Text('No environment targets scheduled'));
    }

    final docsUrl = '${ApiService.baseUrl}/docs/environment/Ross308_Zambia_Lighting_Temperature_Guide.md';

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: envDays.length + 1,
      itemBuilder: (context, index) {
        if (index == 0) {
          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: ListTile(
              leading: const Icon(Icons.book),
              title: const Text('Reference Guide'),
              subtitle: const Text('Ross 308 Lighting & Temperature Guide'),
              trailing: const Icon(Icons.open_in_new),
              onTap: () async {
                final uri = Uri.parse(docsUrl);
                if (await canLaunchUrl(uri)) {
                  await launchUrl(uri, mode: LaunchMode.externalApplication);
                }
              },
            ),
          );
        }
        final day = envDays[index - 1];
        final env = day.lightingTemperature!;
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: Colors.orange.withAlpha(30),
                      child: Text('${day.day}'),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text('Day ${day.day}',
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    ),
                    Text(day.date.split('T').first,
                        style: const TextStyle(color: Colors.grey)),
                  ],
                ),
                const Divider(),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Light: ${env.lightHours ?? "-"}h / Dark: ${env.darkHours ?? "-"}h'),
                          Text('Intensity: ${env.lightIntensityLux ?? "-"} lux'),
                        ],
                      ),
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Temp: ${env.targetTempC ?? "-"}°C'),
                          Text('Range: ${env.targetTempMinC ?? "-"}-${env.targetTempMaxC ?? "-"}°C'),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text('Humidity: ${env.targetRhMinPct ?? "-"}-${env.targetRhMaxPct ?? "-"}%'),
                if (env.notes != null && env.notes!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(env.notes!, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildVaccinationTab() {
    final vaccineDays = _calendarDays.where((d) => d.vaccines.isNotEmpty).toList();
    final vaccineDocsUrl = '${ApiService.baseUrl}/docs/vaccines/Ross308_Zambia_Broiler_Management_Guide.md';

    if (vaccineDays.isEmpty) {
      return const Center(child: Text('No vaccination events scheduled'));
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: vaccineDays.length + 1,
      itemBuilder: (context, index) {
        if (index == 0) {
          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: ListTile(
              leading: const Icon(Icons.book),
              title: const Text('Reference Guide'),
              subtitle: const Text('Ross 308 Vaccination Schedule'),
              trailing: const Icon(Icons.open_in_new),
              onTap: () async {
                final uri = Uri.parse(vaccineDocsUrl);
                if (await canLaunchUrl(uri)) {
                  await launchUrl(uri, mode: LaunchMode.externalApplication);
                }
              },
            ),
          );
        }
        final day = vaccineDays[index - 1];
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: Colors.green.withAlpha(30),
                      child: Text('${day.day}'),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text('Day ${day.day}',
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    ),
                    Text(day.date.split('T').first,
                        style: const TextStyle(color: Colors.grey)),
                  ],
                ),
                const Divider(),
                ...day.vaccines.map((v) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(v.vaccineName, style: const TextStyle(fontWeight: FontWeight.w600)),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Chip(
                                label: Text(v.vaccineType),
                                visualDensity: VisualDensity.compact,
                              ),
                              const SizedBox(width: 8),
                              Chip(
                                label: Text(v.adminMethod),
                                visualDensity: VisualDensity.compact,
                              ),
                            ],
                          ),
                          if (v.notes != null && v.notes!.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(v.notes!, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                          ],
                        ],
                      ),
                    )),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildHealthTab() {
    final healthDays = _calendarDays.where((d) =>
        d.healthSupport.isNotEmpty &&
        d.healthSupport != 'Monitor; vitamins/electrolytes if stress or heat. Ensure clean water and proper ventilation.'
    ).toList();

    if (healthDays.isEmpty) {
      return const Center(child: Text('No health support notes for this flock'));
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: healthDays.length,
      itemBuilder: (context, index) {
        final day = healthDays[index];
        final isVaccinationDay = day.healthSupport.contains('VACCINATION DAY');
        final isPreVaccination = day.healthSupport.contains('PRE-VACCINATION');
        final isPostVaccination = day.healthSupport.contains('POST-');

        Color cardColor;
        IconData icon;
        if (isVaccinationDay) {
          cardColor = Colors.red.withAlpha(20);
          icon = Icons.vaccines;
        } else if (isPreVaccination) {
          cardColor = Colors.orange.withAlpha(20);
          icon = Icons.warning;
        } else if (isPostVaccination) {
          cardColor = Colors.green.withAlpha(20);
          icon = Icons.check_circle;
        } else {
          cardColor = Colors.blue.withAlpha(20);
          icon = Icons.health_and_safety;
        }

        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          color: cardColor,
          child: ListTile(
            leading: Icon(icon, color: Colors.green),
            title: Text('Day ${day.day} - ${day.feedPhase}'),
            subtitle: Text(day.healthSupport, style: const TextStyle(fontSize: 12)),
            isThreeLine: true,
          ),
        );
      },
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatCard({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
            Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
          ],
        ),
      ),
    );
  }
}

class _FeedPhaseRow extends StatelessWidget {
  final String phase;
  final String dayRange;
  final Color color;

  const _FeedPhaseRow({required this.phase, required this.dayRange, required this.color});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Container(width: 12, height: 12, color: color),
          const SizedBox(width: 8),
          Text('$phase: ', style: const TextStyle(fontWeight: FontWeight.w600)),
          Text(dayRange),
        ],
      ),
    );
  }
}
