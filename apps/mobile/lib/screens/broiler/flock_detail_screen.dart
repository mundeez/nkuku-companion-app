import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../models/breed.dart';
import '../../models/document.dart';
import '../../models/environmental_record.dart';
import '../../models/financial_record.dart';
import '../../models/feed_record.dart';
import '../../models/flock.dart';
import '../../models/growth_record.dart';
import '../../models/medication_record.dart';
import '../../models/mortality_event.dart';
import '../../models/sale_record.dart';
import '../../models/vaccination_event.dart';
import '../../models/water_record.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../../services/broiler_service.dart';
import '../../widgets/flock_charts.dart';
import 'calendar_screen.dart';
import 'medication_screen.dart';
import 'records/document_form.dart';
import 'records/environmental_record_form.dart';
import 'records/financial_record_form.dart';
import 'records/feed_record_form.dart';
import 'records/growth_record_form.dart';
import 'records/medication_record_form.dart';
import 'records/mortality_event_form.dart';
import 'records/sale_record_form.dart';
import 'records/vaccination_event_form.dart';
import 'records/water_record_form.dart';
import 'tasks_screen.dart';

/// Wraps a future so that errors are swallowed and null is returned instead.
Future<T?> _safeCall<T>(Future<T> future) async {
  try {
    return await future;
  } catch (_) {
    return null;
  }
}

class FlockDetailScreen extends StatefulWidget {
  final String flockId;
  final String flockName;

  const FlockDetailScreen(
      {super.key, required this.flockId, required this.flockName});

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

  List<GrowthRecord> _growthRecords = [];
  GrowthRecordAnalysis? _growthAnalysis;
  List<FeedRecord> _feedRecords = [];
  FeedSummary? _feedSummary;
  List<WaterRecord> _waterRecords = [];
  WaterRatio? _waterRatio;
  List<MortalityEvent> _mortalityEvents = [];
  MortalitySummary? _mortalitySummary;
  List<VaccinationEvent> _vaccinationEvents = [];
  VaccinationScheduleStatus? _vaccinationStatus;
  List<FinancialRecord> _financialRecords = [];
  FinancialSummary? _financialSummary;
  List<MedicationRecord> _medicationRecords = [];
  List<EnvironmentalRecord> _environmentalRecords = [];
  List<SaleRecord> _saleRecords = [];
  Map<String, dynamic>? _saleSummary;
  List<DocumentRecord> _documents = [];
  List<PerformanceTarget> _breedTargets = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 13, vsync: this);
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
      final flock = await BroilerService.getFlock(widget.flockId);

      // Fetch breed performance targets for growth chart
      List<PerformanceTarget> breedTargets = [];
      try {
        final breedRes =
            await ApiService.dio.get('/api/v1/breeds/${flock.breedId}');
        final breed = Breed.fromJson(breedRes.data);
        breedTargets = breed.performanceTargets;
      } catch (_) {}

      List<CalendarDay> days = [];
      try {
        final calRes = await ApiService.dio
            .get('/api/v1/broiler-flocks/${widget.flockId}/summary');
        days = (calRes.data['days'] as List)
            .map((e) => CalendarDay.fromJson(e))
            .toList();
      } catch (_) {
        // Calendar is optional — continue without it
      }

      final results = await Future.wait([
        BroilerService.getGrowthRecords(widget.flockId)
            .catchError((_) => <GrowthRecord>[]),
        BroilerService.getFeedRecords(widget.flockId)
            .catchError((_) => <FeedRecord>[]),
        BroilerService.getWaterRecords(widget.flockId)
            .catchError((_) => <WaterRecord>[]),
        BroilerService.getMortalityEvents(widget.flockId)
            .catchError((_) => <MortalityEvent>[]),
        BroilerService.getVaccinationEvents(widget.flockId)
            .catchError((_) => <VaccinationEvent>[]),
        BroilerService.getFinancialRecords(widget.flockId)
            .catchError((_) => <FinancialRecord>[]),
        BroilerService.getMedicationRecords(widget.flockId)
            .catchError((_) => <MedicationRecord>[]),
        BroilerService.getEnvironmentalRecords(widget.flockId)
            .catchError((_) => <EnvironmentalRecord>[]),
        BroilerService.getSaleRecords(widget.flockId)
            .catchError((_) => <SaleRecord>[]),
        BroilerService.getDocuments(widget.flockId)
            .catchError((_) => <DocumentRecord>[]),
      ]);

      final growth = results[0] as List<GrowthRecord>;
      final feed = results[1] as List<FeedRecord>;
      final water = results[2] as List<WaterRecord>;
      final mortality = results[3] as List<MortalityEvent>;
      final vaccination = results[4] as List<VaccinationEvent>;
      final financial = results[5] as List<FinancialRecord>;
      final medication = results[6] as List<MedicationRecord>;
      final environment = results[7] as List<EnvironmentalRecord>;
      final sales = results[8] as List<SaleRecord>;
      final documents = results[9] as List<DocumentRecord>;

      final analysis =
          await _safeCall(BroilerService.getGrowthAnalysis(widget.flockId));
      final feedSummary =
          await _safeCall(BroilerService.getFeedSummary(widget.flockId));
      final waterRatio =
          await _safeCall(BroilerService.getWaterRatio(widget.flockId));
      final mortalitySummary =
          await _safeCall(BroilerService.getMortalitySummary(widget.flockId));
      final vaccinationStatus = await _safeCall(
          BroilerService.getVaccinationScheduleStatus(widget.flockId));
      final financialSummary =
          await _safeCall(BroilerService.getFinancialSummary(widget.flockId));
      Map<String, dynamic>? saleSummary;
      try {
        saleSummary = await BroilerService.getSaleRecordSummary(widget.flockId);
      } catch (_) {
        saleSummary = null;
      }

      setState(() {
        _flock = flock;
        _calendarDays = days;
        _growthRecords = growth;
        _growthAnalysis = analysis;
        _feedRecords = feed;
        _feedSummary = feedSummary;
        _waterRecords = water;
        _waterRatio = waterRatio;
        _mortalityEvents = mortality;
        _mortalitySummary = mortalitySummary;
        _vaccinationEvents = vaccination;
        _vaccinationStatus = vaccinationStatus;
        _financialRecords = financial;
        _financialSummary = financialSummary;
        _medicationRecords = medication;
        _environmentalRecords = environment;
        _saleRecords = sales;
        _saleSummary = saleSummary;
        _documents = documents;
        _breedTargets = breedTargets;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load flock details: $e';
        _loading = false;
      });
    }
  }

  void _navigateToForm(Widget form) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => form),
    );
    if (result == true && mounted) _loadData();
  }

  void _onAddRecord() {
    if (_flock == null) return;
    final flock = _flock!;
    switch (_tabController.index) {
      case 1:
        if (!AuthService.canEdit) return;
        _navigateToForm(GrowthRecordForm(flockId: flock.id));
        break;
      case 2:
        if (!AuthService.canEdit) return;
        _navigateToForm(FeedRecordForm(flockId: flock.id));
        break;
      case 3:
        if (!AuthService.canEdit) return;
        _navigateToForm(WaterRecordForm(flockId: flock.id));
        break;
      case 4:
        if (!AuthService.canEdit) return;
        _navigateToForm(MortalityEventForm(
            flockId: flock.id, currentCount: flock.currentCount));
        break;
      case 5:
        if (!AuthService.canEdit) return;
        _navigateToForm(VaccinationEventForm(
            flockId: flock.id, flockAgeDays: flock.ageDays ?? 0));
        break;
      case 6:
        if (!AuthService.canEdit) return;
        _navigateToForm(FinancialRecordForm(flockId: flock.id));
        break;
      case 7:
        if (!AuthService.canEdit) return;
        _navigateToForm(EnvironmentalRecordForm(flockId: flock.id));
        break;
      case 8:
        if (!AuthService.canEdit) return;
        _navigateToForm(MedicationRecordForm(flockId: flock.id));
        break;
      case 11:
        if (!AuthService.canManageSales) return;
        _navigateToForm(SaleRecordForm(flockId: flock.id));
        break;
      case 12:
        if (!AuthService.canManageDocuments) return;
        _navigateToForm(DocumentForm(flockId: flock.id));
        break;
    }
  }

  Widget? get _floatingActionButton {
    final index = _tabController.index;
    // No FAB on Overview (0), Tasks (9), or Calendar (10)
    if (index == 0 || index == 9 || index == 10) return null;
    if (index == 11) {
      if (!AuthService.canManageSales) return null;
    } else if (index == 12) {
      if (!AuthService.canManageDocuments) return null;
    } else {
      if (!AuthService.canEdit) return null;
    }
    return FloatingActionButton(
      onPressed: _onAddRecord,
      child: const Icon(Icons.add),
    );
  }

  Future<void> _deleteRecord<T>({
    required String label,
    required T record,
    required String Function(T) name,
    required Future<void> Function() onDelete,
  }) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Delete $label?'),
        content: Text('Delete ${name(record)}?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Delete', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await onDelete();
      if (mounted) _loadData();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Delete failed: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.flockName),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadData),
        ],
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabs: const [
            Tab(icon: Icon(Icons.info), text: 'Overview'),
            Tab(icon: Icon(Icons.trending_up), text: 'Growth'),
            Tab(icon: Icon(Icons.grass), text: 'Feed'),
            Tab(icon: Icon(Icons.water_drop), text: 'Water'),
            Tab(icon: Icon(Icons.warning), text: 'Mortality'),
            Tab(icon: Icon(Icons.vaccines), text: 'Vaccination'),
            Tab(icon: Icon(Icons.attach_money), text: 'Financial'),
            Tab(icon: Icon(Icons.thermostat), text: 'Environment'),
            Tab(icon: Icon(Icons.medication), text: 'Medication'),
            Tab(icon: Icon(Icons.task_alt), text: 'Tasks'),
            Tab(icon: Icon(Icons.calendar_month), text: 'Calendar'),
            Tab(icon: Icon(Icons.point_of_sale), text: 'Sales'),
            Tab(icon: Icon(Icons.attach_file), text: 'Docs'),
          ],
        ),
      ),
      floatingActionButton: _floatingActionButton,
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_error!, style: const TextStyle(color: Colors.red)),
                      const SizedBox(height: 16),
                      ElevatedButton(
                          onPressed: _loadData, child: const Text('Retry')),
                    ],
                  ),
                )
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _buildOverviewTab(),
                    _buildGrowthTab(),
                    _buildFeedTab(),
                    _buildWaterTab(),
                    _buildMortalityTab(),
                    _buildVaccinationTab(),
                    _buildFinancialTab(),
                    _buildEnvironmentTab(),
                    _buildMedicationTab(),
                    _buildTasksTab(),
                    _buildCalendarTab(),
                    _buildSalesTab(),
                    _buildDocumentsTab(),
                  ],
                ),
    );
  }

  Widget _buildOverviewTab() {
    final flock = _flock!;
    final mortalityRate = _mortalitySummary?.mortalityRate != null
        ? (double.tryParse(_mortalitySummary!.mortalityRate)
                ?.toStringAsFixed(1) ??
            '0.0')
        : (flock.initialCount > 0
            ? (((flock.totalMortality ?? 0) / flock.initialCount) * 100)
                .toStringAsFixed(1)
            : '0.0');
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
                Text(flock.name,
                    style: const TextStyle(
                        fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Text('Breed: ${flock.breedName ?? "Unknown"}'),
                Text('Supplier: ${flock.supplierName ?? "None"}'),
                Text('Housing: ${flock.housingType.replaceAll('_', ' ')}'),
                Text(
                    'Ordered: ${flock.orderDate != null ? flock.orderDate!.split('T').first : '-'}'),
                Text(
                    'Started: ${flock.startDate != null ? flock.startDate!.split('T').first : 'Pending collection'}'),
                if (flock.expectedCollectionStart != null &&
                    flock.expectedCollectionEnd != null)
                  Text(
                      'Est. Collection: ${flock.expectedCollectionStart!.split('T').first} – ${flock.expectedCollectionEnd!.split('T').first}'),
                Text(
                    'Age: ${flock.startDate == null ? 'Pending collection' : 'Day ${flock.ageDays ?? 0}'}'),
                Text(
                    'Harvest Date: ${flock.harvestDateStr ?? 'Pending collection'}'),
                Text(
                  'Days to Harvest: ${flock.daysToHarvest == null ? 'Pending collection' : (flock.daysToHarvest! <= 0 ? 'Due now' : '${flock.daysToHarvest} day${flock.daysToHarvest == 1 ? '' : 's'}')}',
                  style: TextStyle(
                    color: flock.daysToHarvest == null
                        ? Colors.amber[800]
                        : flock.daysToHarvest! <= 0
                            ? Colors.red
                            : flock.daysToHarvest! <= 7
                                ? Colors.orange[800]
                                : null,
                  ),
                ),
                Text('Status: ${flock.status}'),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
                child: _StatCard(
                    label: 'Birds',
                    value: '${flock.currentCount}',
                    color: Colors.green)),
            const SizedBox(width: 8),
            Expanded(
                child: _StatCard(
                    label: 'Initial',
                    value: '${flock.initialCount}',
                    color: Colors.blue)),
            const SizedBox(width: 8),
            Expanded(
                child: _StatCard(
                    label: 'Mortality',
                    value: '$mortalityRate%',
                    color: Colors.red)),
          ],
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Feed Programme',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                _FeedPhaseRow(
                    phase: 'Starter',
                    dayRange: 'Day 1 - $feedTransition',
                    color: Colors.orange),
                _FeedPhaseRow(
                    phase: 'Grower',
                    dayRange: 'Day ${feedTransition + 1} - $finisherDay',
                    color: Colors.teal),
                _FeedPhaseRow(
                    phase: 'Finisher',
                    dayRange: 'Day ${finisherDay + 1}+',
                    color: Colors.brown),
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
                  const Text('Targets',
                      style:
                          TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
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

  Widget _buildGrowthTab() {
    final analysis = _growthAnalysis;
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (analysis != null)
            _SummaryCard(children: [
              _SummaryRow('Current age', 'Day ${analysis.ageDays}'),
              _SummaryRow('Records', '${analysis.records.length}'),
              _SummaryRow('FCR', analysis.fcr?.toStringAsFixed(2) ?? '-'),
            ]),
          const SizedBox(height: 12),
          if (_growthRecords.isNotEmpty) ...[
            GrowthChart(
                records: _growthRecords,
                targets: _breedTargets,
                startDate: _flock?.startDate),
            FcrChart(
                records: _growthRecords,
                targets: _breedTargets,
                currentFcr: analysis?.fcr,
                startDate: _flock?.startDate),
          ],
          if (_growthRecords.isEmpty)
            const Center(
                child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No growth records yet.')))
          else
            ..._growthRecords.reversed.map((r) => _RecordCard(
                  title:
                      'Day ${r.recordDate.difference(DateTime.parse(_flock!.startDate ?? r.recordDate.toIso8601String())).inDays}',
                  subtitle: '${r.avgWeight} kg avg · ${r.sampleSize} sampled',
                  trailing:
                      Text(r.recordDate.toIso8601String().split('T').first),
                  onEdit: AuthService.canEdit
                      ? () => _navigateToForm(
                          GrowthRecordForm(flockId: widget.flockId, record: r))
                      : null,
                  onDelete: AuthService.canDelete
                      ? () => _deleteRecord<GrowthRecord>(
                            label: 'growth record',
                            record: r,
                            name: (r) =>
                                '${r.avgWeight} kg on ${r.recordDate.toIso8601String().split('T').first}',
                            onDelete: () =>
                                BroilerService.deleteGrowthRecord(r.id),
                          )
                      : null,
                )),
        ],
      ),
    );
  }

  Widget _buildFeedTab() {
    final summary = _feedSummary;
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (summary != null)
            _SummaryCard(children: [
              _SummaryRow(
                  'Total feed', '${summary.totalFeedKg.toStringAsFixed(1)} kg'),
              _SummaryRow('Total cost',
                  'ZMW ${summary.totalCostZmw.toStringAsFixed(2)}'),
              _SummaryRow(
                  'Cost/bird', 'ZMW ${summary.costPerBird.toStringAsFixed(2)}'),
            ]),
          const SizedBox(height: 12),
          if (_feedRecords.isNotEmpty) FeedChart(records: _feedRecords),
          if (_feedRecords.isEmpty)
            const Center(
                child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No feed records yet.')))
          else
            ..._feedRecords.reversed.map((r) => _RecordCard(
                  title:
                      '${r.feedType} · ${r.quantityKg.toStringAsFixed(1)} kg',
                  subtitle: r.supplierName != null
                      ? 'Supplier: ${r.supplierName}'
                      : null,
                  trailing: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(r.recordDate.toIso8601String().split('T').first),
                      if (r.costZmw != null)
                        Text('ZMW ${r.costZmw!.toStringAsFixed(2)}',
                            style:
                                const TextStyle(fontWeight: FontWeight.bold)),
                    ],
                  ),
                  onEdit: AuthService.canEdit
                      ? () => _navigateToForm(
                          FeedRecordForm(flockId: widget.flockId, record: r))
                      : null,
                  onDelete: AuthService.canDelete
                      ? () => _deleteRecord<FeedRecord>(
                            label: 'feed record',
                            record: r,
                            name: (r) =>
                                '${r.quantityKg.toStringAsFixed(1)} kg ${r.feedType}',
                            onDelete: () =>
                                BroilerService.deleteFeedRecord(r.id),
                          )
                      : null,
                )),
        ],
      ),
    );
  }

  Widget _buildWaterTab() {
    final ratio = _waterRatio;
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (ratio != null)
            _SummaryCard(children: [
              _SummaryRow('Total water',
                  '${ratio.totalWaterLiters.toStringAsFixed(1)} L'),
              _SummaryRow(
                  'Total feed', '${ratio.totalFeedKg.toStringAsFixed(1)} kg'),
              _SummaryRow('Water:feed', ratio.waterToFeedRatio ?? '-'),
            ]),
          const SizedBox(height: 12),
          if (_waterRecords.isNotEmpty) WaterChart(records: _waterRecords),
          if (_waterRecords.isEmpty)
            const Center(
                child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No water records yet.')))
          else
            ..._waterRecords.reversed.map((r) => _RecordCard(
                  title: '${r.quantityLiters.toStringAsFixed(1)} L',
                  subtitle:
                      'pH ${r.ph?.toStringAsFixed(1) ?? '-'} · ${r.temperature?.toStringAsFixed(1) ?? '-'}°C',
                  trailing:
                      Text(r.recordDate.toIso8601String().split('T').first),
                  onEdit: AuthService.canEdit
                      ? () => _navigateToForm(
                          WaterRecordForm(flockId: widget.flockId, record: r))
                      : null,
                  onDelete: AuthService.canDelete
                      ? () => _deleteRecord<WaterRecord>(
                            label: 'water record',
                            record: r,
                            name: (r) =>
                                '${r.quantityLiters.toStringAsFixed(1)} L',
                            onDelete: () =>
                                BroilerService.deleteWaterRecord(r.id),
                          )
                      : null,
                )),
        ],
      ),
    );
  }

  Widget _buildMortalityTab() {
    final summary = _mortalitySummary;
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (summary != null)
            _SummaryCard(children: [
              _SummaryRow('Total deaths', '${summary.totalDeaths}'),
              _SummaryRow('Mortality rate', '${summary.mortalityRate}%'),
              _SummaryRow('Current count', '${summary.currentCount}'),
            ]),
          const SizedBox(height: 12),
          if (_mortalityEvents.isNotEmpty)
            MortalityChart(records: _mortalityEvents),
          if (_mortalityEvents.isEmpty)
            const Center(
                child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No mortality events yet.')))
          else
            ..._mortalityEvents.reversed.map((r) => _RecordCard(
                  title: '${r.count} birds · ${r.cause ?? 'Unknown cause'}',
                  subtitle: r.ageDays != null ? 'Age day ${r.ageDays}' : null,
                  trailing:
                      Text(r.eventDate.toIso8601String().split('T').first),
                  onEdit: AuthService.canEdit
                      ? () => _navigateToForm(MortalityEventForm(
                          flockId: widget.flockId, record: r))
                      : null,
                  onDelete: AuthService.canDelete
                      ? () => _deleteRecord<MortalityEvent>(
                            label: 'mortality event',
                            record: r,
                            name: (r) =>
                                '${r.count} birds on ${r.eventDate.toIso8601String().split('T').first}',
                            onDelete: () =>
                                BroilerService.deleteMortalityEvent(r.id),
                          )
                      : null,
                )),
        ],
      ),
    );
  }

  Widget _buildVaccinationTab() {
    final status = _vaccinationStatus;
    final completed = status?.completed ?? _vaccinationEvents;
    final overdue = status?.overdue ?? <VaccinationScheduleItem>[];
    final upcoming = status?.upcoming ?? <VaccinationScheduleItem>[];

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (overdue.isNotEmpty)
            _SummaryCard(children: [
              const Text('Overdue',
                  style: TextStyle(
                      color: Colors.red, fontWeight: FontWeight.bold)),
              ...overdue
                  .map((i) => _SummaryRow(i.vaccineName, 'Day ${i.ageDays}')),
            ]),
          if (upcoming.isNotEmpty)
            _SummaryCard(children: [
              const Text('Upcoming',
                  style: TextStyle(
                      color: Colors.green, fontWeight: FontWeight.bold)),
              ...upcoming
                  .map((i) => _SummaryRow(i.vaccineName, 'Day ${i.ageDays}')),
            ]),
          const SizedBox(height: 12),
          if (completed.isNotEmpty) VaccinationChart(records: completed),
          if (completed.isEmpty)
            const Center(
                child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No vaccination records yet.')))
          else
            ...completed.reversed.map((r) => _RecordCard(
                  title: r.vaccineName,
                  subtitle:
                      '${r.adminMethod} · Day ${r.ageDays}${r.batchNumber != null ? ' · Batch ${r.batchNumber}' : ''}',
                  trailing:
                      Text(r.adminDate.toIso8601String().split('T').first),
                  onEdit: AuthService.canEdit
                      ? () => _navigateToForm(VaccinationEventForm(
                          flockId: widget.flockId, record: r))
                      : null,
                  onDelete: AuthService.canDelete
                      ? () => _deleteRecord<VaccinationEvent>(
                            label: 'vaccination event',
                            record: r,
                            name: (r) => r.vaccineName,
                            onDelete: () =>
                                BroilerService.deleteVaccinationEvent(r.id),
                          )
                      : null,
                )),
        ],
      ),
    );
  }

  Widget _buildFinancialTab() {
    final summary = _financialSummary;
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (summary != null)
            _SummaryCard(children: [
              _SummaryRow(
                  'Revenue', 'ZMW ${summary.totalRevenue.toStringAsFixed(2)}'),
              _SummaryRow(
                  'Costs', 'ZMW ${summary.totalCost.toStringAsFixed(2)}'),
              _SummaryRow('Profit', 'ZMW ${summary.profit.toStringAsFixed(2)}'),
              _SummaryRow('Profit/bird',
                  'ZMW ${summary.profitPerBird.toStringAsFixed(2)}'),
            ]),
          const SizedBox(height: 12),
          if (_financialRecords.isNotEmpty)
            FinancialChart(records: _financialRecords),
          if (_financialRecords.isEmpty)
            const Center(
                child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No financial records yet.')))
          else
            ..._financialRecords.map((r) => _RecordCard(
                  title: '${r.category} · ${r.description}',
                  subtitle: r.isSystemGenerated ? 'System-generated' : null,
                  trailing: Text(
                    '${r.isIncome ? '+' : '-'} ZMW ${r.amountZmw.toStringAsFixed(2)}',
                    style: TextStyle(
                        color: r.isIncome ? Colors.green : Colors.red,
                        fontWeight: FontWeight.bold),
                  ),
                  onEdit: AuthService.canEdit && !r.isSystemGenerated
                      ? () => _navigateToForm(FinancialRecordForm(
                          flockId: widget.flockId, record: r))
                      : null,
                  onDelete: AuthService.canDelete && !r.isSystemGenerated
                      ? () => _deleteRecord<FinancialRecord>(
                            label: 'financial record',
                            record: r,
                            name: (r) => r.description,
                            onDelete: () =>
                                BroilerService.deleteFinancialRecord(r.id),
                          )
                      : null,
                )),
        ],
      ),
    );
  }

  Widget _buildEnvironmentTab() {
    final envDays =
        _calendarDays.where((d) => d.lightingTemperature != null).toList();
    final docsUrl =
        '${ApiService.baseUrl}/docs/environment/Ross308_Zambia_Lighting_Temperature_Guide.md';

    // Combine header + chart + logged records section + target schedule items
    // Sections: [0] chart (if records exist), [1] docs link, [2] "Logged Records" header,
    //           [3..n+2] logged records, [n+3] "Targets" header, [n+4..] target days
    final hasChart = _environmentalRecords.any((r) => r.temperatureC != null);
    final loggedCount = _environmentalRecords.length;
    final targetCount = envDays.length;
    final chartOffset = hasChart ? 1 : 0;
    // indices: 0=chart(if hasChart), 0+chartOffset=docs, 1+chartOffset=loggedHeader,
    //          2+chartOffset..loggedCount+1+chartOffset=logged,
    //          loggedCount+2+chartOffset=targetsHeader, loggedCount+3+chartOffset..end=targets
    final totalItems = chartOffset + 1 + 1 + loggedCount + 1 + targetCount;

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: totalItems,
        itemBuilder: (context, index) {
          if (hasChart && index == 0) {
            return EnvironmentChart(records: _environmentalRecords);
          }
          final adjustedIndex = index - chartOffset;
          if (adjustedIndex == 0) {
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

          // Logged records section header
          if (adjustedIndex == 1) {
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                children: [
                  const Expanded(
                    child: Text('Logged Readings',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                  if (_environmentalRecords.isEmpty)
                    const Text('None yet',
                        style: TextStyle(color: Colors.grey)),
                ],
              ),
            );
          }

          // Logged records
          if (adjustedIndex >= 2 && adjustedIndex <= loggedCount + 1) {
            final r = _environmentalRecords[adjustedIndex - 2];
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                leading: const Icon(Icons.thermostat, color: Colors.teal),
                title: Text(r.recordDate.toIso8601String().split('T').first +
                    (r.timeOfDay != null ? ' · ${r.timeOfDay}' : '')),
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (r.temperatureC != null)
                      Text('Temp: ${r.temperatureC}°C'),
                    if (r.humidityPct != null)
                      Text('Humidity: ${r.humidityPct}%'),
                    if (r.ammoniaPpm != null)
                      Text('Ammonia: ${r.ammoniaPpm} ppm'),
                    if (r.lightHours != null) Text('Light: ${r.lightHours}h'),
                    if (r.litterScore != null)
                      Text('Litter: ${r.litterScore}/5'),
                    if (r.notes != null && r.notes!.isNotEmpty) Text(r.notes!),
                  ],
                ),
                isThreeLine: true,
                trailing: AuthService.canEdit
                    ? Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.edit),
                            onPressed: () => _navigateToForm(
                              EnvironmentalRecordForm(
                                  flockId: widget.flockId, record: r),
                            ),
                          ),
                          if (AuthService.canDelete)
                            IconButton(
                              icon: const Icon(Icons.delete, color: Colors.red),
                              onPressed: () =>
                                  _deleteRecord<EnvironmentalRecord>(
                                label: 'environmental record',
                                record: r,
                                name: (r) => r.recordDate
                                    .toIso8601String()
                                    .split('T')
                                    .first,
                                onDelete: () =>
                                    BroilerService.deleteEnvironmentalRecord(
                                        r.id),
                              ),
                            ),
                        ],
                      )
                    : null,
              ),
            );
          }

          // Target schedule header
          if (adjustedIndex == loggedCount + 2) {
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                'Target Schedule (Ross 308)',
                style:
                    const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            );
          }

          // Target schedule days
          if (envDays.isEmpty) {
            return const Center(
                child: Padding(
                    padding: EdgeInsets.all(16),
                    child: Text('No environment targets scheduled')));
          }
          final dayIndex = adjustedIndex - (loggedCount + 3);
          if (dayIndex < 0 || dayIndex >= envDays.length) {
            return const SizedBox.shrink();
          }
          final day = envDays[dayIndex];
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
                            style: const TextStyle(
                                fontSize: 18, fontWeight: FontWeight.bold)),
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
                            Text('Light: ${env.lightHours ?? "-"}h'),
                            Text('Dark: ${env.darkHours ?? "-"}h'),
                          ],
                        ),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Temp: ${env.targetTempC ?? "-"}°C'),
                            Text(
                                'Range: ${env.targetTempMinC ?? "-"}-${env.targetTempMaxC ?? "-"}°C'),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                      'Humidity: ${env.targetRhMinPct ?? "-"}-${env.targetRhMaxPct ?? "-"}%'),
                  if (env.notes != null && env.notes!.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(env.notes!,
                        style:
                            const TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildSalesTab() {
    final summary = _saleSummary;
    final totalBirdsSold = summary != null
        ? (summary['totalBirdsSold'] ?? summary['total_birds_sold'] ?? 0)
        : _saleRecords.fold(0, (sum, r) => sum + r.birdCount);
    final totalRevenue = summary != null
        ? double.tryParse((summary['totalRevenueZmw'] ??
                    summary['total_revenue_zmw'] ??
                    0)
                .toString()) ??
            0
        : _saleRecords.fold(0.0, (sum, r) => sum + r.totalAmountZmw);

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Expanded(
                child: _StatCard(
                    label: 'Birds sold',
                    value: '$totalBirdsSold',
                    color: Colors.green),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _StatCard(
                  label: 'Total revenue',
                  value: 'ZMW ${totalRevenue.toStringAsFixed(2)}',
                  color: Colors.teal,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (_saleRecords.isEmpty)
            const Center(
                child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No sale records yet.')))
          else
            ..._saleRecords.reversed.map((r) {
              final statusColor = r.paymentStatus == 'paid'
                  ? Colors.green
                  : r.paymentStatus == 'partial'
                      ? Colors.orange
                      : Colors.grey;
              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: ListTile(
                  title: Text(r.saleDate.toIso8601String().split('T').first),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (r.customerName != null && r.customerName!.isNotEmpty)
                        Text('Customer: ${r.customerName}'),
                      Text(
                          '${r.birdCount} birds · ZMW ${r.totalAmountZmw.toStringAsFixed(2)}'),
                      if (r.avgWeightKg != null)
                        Text('Avg weight: ${r.avgWeightKg} kg'),
                    ],
                  ),
                  trailing: Chip(
                    label: Text(
                      r.paymentStatus,
                      style: TextStyle(fontSize: 10, color: statusColor),
                    ),
                    backgroundColor: statusColor.withAlpha(30),
                  ),
                  onTap: AuthService.canManageSales
                      ? () => _navigateToForm(
                          SaleRecordForm(flockId: widget.flockId, record: r))
                      : null,
                  onLongPress: AuthService.canManageSales
                      ? () => _deleteRecord<SaleRecord>(
                            label: 'sale record',
                            record: r,
                            name: (r) =>
                                'sale on ${r.saleDate.toIso8601String().split('T').first} (${r.birdCount} birds)',
                            onDelete: () =>
                                BroilerService.deleteSaleRecord(r.id),
                          )
                      : null,
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildDocumentsTab() {
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_documents.isEmpty)
            const Center(
                child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No documents yet.')))
          else
            ..._documents.map((doc) {
              final icon = _documentIcon(doc.mimeType);
              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: ListTile(
                  leading: Icon(icon, size: 36),
                  title: Text(doc.fileName),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${doc.fileSizeKb} KB · ${doc.category}'),
                      Text(
                          'Uploaded: ${doc.createdAt.toIso8601String().split('T').first}'),
                    ],
                  ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.download),
                        onPressed: () => _downloadDocument(doc),
                      ),
                      if (AuthService.canManageDocuments)
                        IconButton(
                          icon: const Icon(Icons.edit, size: 20),
                          onPressed: () async {
                            final result = await Navigator.push<bool>(
                              context,
                              MaterialPageRoute(
                                builder: (_) => DocumentForm(
                                    flockId: widget.flockId, record: doc),
                              ),
                            );
                            if (result == true) _loadData();
                          },
                        ),
                      if (AuthService.canManageDocuments)
                        IconButton(
                          icon: const Icon(Icons.delete, color: Colors.red),
                          onPressed: () => _deleteRecord<DocumentRecord>(
                            label: 'document',
                            record: doc,
                            name: (d) => d.fileName,
                            onDelete: () =>
                                BroilerService.deleteDocument(doc.id),
                          ),
                        ),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }

  IconData _documentIcon(String mimeType) {
    if (mimeType.contains('pdf')) return Icons.picture_as_pdf;
    if (mimeType.contains('image')) return Icons.image;
    if (mimeType.contains('word') || mimeType.contains('document')) {
      return Icons.description;
    }
    if (mimeType.contains('csv') || mimeType.contains('sheet')) {
      return Icons.table_chart;
    }
    return Icons.attach_file;
  }

  Future<void> _downloadDocument(DocumentRecord doc) async {
    final url = '${ApiService.baseUrl}/api/v1/documents/${doc.id}/download';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not open document: $url')),
      );
    }
  }

  Widget _buildMedicationTab() {
    return MedicationScreen(
      flockId: widget.flockId,
      records: _medicationRecords,
      onRefresh: _loadData,
    );
  }

  Widget _buildTasksTab() {
    return TasksScreen(flockId: widget.flockId);
  }

  Widget _buildCalendarTab() {
    if (_flock == null) return const Center(child: CircularProgressIndicator());
    return CalendarScreen(flock: _flock!, days: _calendarDays);
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatCard(
      {required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Text(value,
                style: TextStyle(
                    fontSize: 20, fontWeight: FontWeight.bold, color: color)),
            Text(label,
                style: const TextStyle(fontSize: 12, color: Colors.grey)),
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

  const _FeedPhaseRow(
      {required this.phase, required this.dayRange, required this.color});

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

class _SummaryCard extends StatelessWidget {
  final List<Widget> children;

  const _SummaryCard({required this.children});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: children,
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;

  const _SummaryRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label),
          Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

class _RecordCard extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget trailing;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;

  const _RecordCard({
    required this.title,
    this.subtitle,
    required this.trailing,
    this.onEdit,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        title: Text(title),
        subtitle: subtitle != null ? Text(subtitle!) : null,
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            trailing,
            if (onEdit != null)
              IconButton(icon: const Icon(Icons.edit), onPressed: onEdit),
            if (onDelete != null)
              IconButton(
                  icon: const Icon(Icons.delete, color: Colors.red),
                  onPressed: onDelete),
          ],
        ),
      ),
    );
  }
}
