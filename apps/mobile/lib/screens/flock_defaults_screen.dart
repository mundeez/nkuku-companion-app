import 'package:flutter/material.dart';
import '../models/flock.dart';
import '../services/broiler_service.dart';

/// Owner-only organization defaults: the vaccination schedule applied to new
/// flocks and the ambient temperature used for daily water estimates.
class FlockDefaultsScreen extends StatefulWidget {
  const FlockDefaultsScreen({super.key});

  @override
  State<FlockDefaultsScreen> createState() => _FlockDefaultsScreenState();
}

class _FlockDefaultsScreenState extends State<FlockDefaultsScreen> {
  bool _loading = true;
  bool _saving = false;
  String? _error;
  List<VaccinationSchedule> _schedules = [];
  String? _scheduleId; // null = auto (breed default)
  final _ambientController = TextEditingController(text: '25');

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _ambientController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final schedules = await BroilerService.getVaccinationSchedules();
      final org = await BroilerService.getOrganization();
      if (!mounted) return;
      setState(() {
        _schedules = schedules;
        _scheduleId = org['defaultVaccinationScheduleId']?.toString();
        _ambientController.text =
            (double.tryParse(org['ambientTempC']?.toString() ?? '') ?? 25)
                .toString();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load organization settings';
        _loading = false;
      });
    }
  }

  Future<void> _save() async {
    final temp = double.tryParse(_ambientController.text.trim());
    if (temp == null || temp < 10 || temp > 45) {
      setState(() => _error = 'Ambient temperature must be 10–45 °C');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await BroilerService.updateOrganization({
        'defaultVaccinationScheduleId': _scheduleId,
        'ambientTempC': temp,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Flock defaults saved')));
      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to save: $e';
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Flock Defaults')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                DropdownButtonFormField<String?>(
                  key: ValueKey(_scheduleId),
                  initialValue: _scheduleId,
                  decoration: const InputDecoration(
                    labelText: 'Default vaccination schedule',
                    helperText:
                        'Applied to new flocks unless a schedule is chosen per flock.',
                    helperMaxLines: 2,
                  ),
                  items: [
                    const DropdownMenuItem(
                        value: null, child: Text('Auto (breed default)')),
                    ..._schedules.map((s) =>
                        DropdownMenuItem(value: s.id, child: Text(s.name))),
                  ],
                  onChanged: (v) => setState(() => _scheduleId = v),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _ambientController,
                  decoration: const InputDecoration(
                    labelText: 'Ambient temperature (°C)',
                    helperText:
                        'Used to estimate daily drinking-water ranges on flock calendars.',
                    helperMaxLines: 2,
                  ),
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!,
                      style:
                          TextStyle(color: Theme.of(context).colorScheme.error)),
                ],
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: _saving ? null : _save,
                  icon: _saving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.save),
                  label: const Text('Save'),
                ),
              ],
            ),
    );
  }
}
