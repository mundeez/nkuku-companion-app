import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../models/breed.dart';
import '../../models/document.dart';
import '../../models/environmental_record.dart';
import '../../models/financial_record.dart';
import '../../models/feed_record.dart';
import '../../models/feed_purchase.dart';
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
import '../../widgets/record_card.dart';
import '../../widgets/skeleton.dart';
import '../../widgets/stat_card.dart';
import '../../widgets/summary_card.dart';
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

/// A single sub-section within a top-level tab group. `flatIndex` maps back
/// to the legacy per-record-type index used by [_FlockDetailScreenState._onAddRecord]
/// (`-1` means the section has no "add record" action, e.g. Overview/Tasks/Calendar).
class _TabDef {
  final String title;
  final IconData icon;
  final Widget Function() builder;
  final int flatIndex;
  const _TabDef(this.title, this.icon, this.builder, this.flatIndex);
}

/// A top-level tab group. Groups with a single [_TabDef] render that section
/// directly; groups with multiple render a `SegmentedButton` sub-nav above an
/// `IndexedStack` of the sections (kept flat/non-nested-TabBar per the
/// modernization plan, to avoid re-creating the original crowding problem).
class _GroupDef {
  final String title;
  final IconData icon;
  final List<_TabDef> tabs;
  const _GroupDef(this.title, this.icon, this.tabs);
}

class _FlockDetailScreenState extends State<FlockDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _groupController;
  final List<int> _subIndex = [0, 0, 0, 0, 0, 0];
  BroilerFlock? _flock;
  List<CalendarDay> _calendarDays = [];
  bool _loading = true;
  String? _error;

  List<GrowthRecord> _growthRecords = [];
  GrowthRecordAnalysis? _growthAnalysis;
  List<FeedRecord> _feedRecords = [];
  List<FeedPurchase> _feedPurchases = [];
  FeedSummary? _feedSummary;
  FeedProjection? _feedProjection;
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

  // Bulk selection for records
  bool _recordSelectMode = false;
  String?
      _currentRecordType; // 'growth', 'feed', 'water', 'mortality', 'vaccination', 'financial'
  final Set<String> _selectedRecordIds = {};
  bool _bulkSaving = false;

  /// Top-level tab groups (13 legacy flat tabs consolidated into 6 groups —
  /// see the mobile modernization plan). Declared `late` since the builder
  /// tear-offs (`_buildOverviewTab` etc.) reference instance methods.
  late final List<_GroupDef> _groups = [
    _GroupDef('Overview', Icons.info_outline, [
      _TabDef('Overview', Icons.info_outline, _buildOverviewTab, -1),
    ]),
    _GroupDef('Growth', Icons.trending_up, [
      _TabDef('Growth', Icons.trending_up, _buildGrowthTab, 1),
      _TabDef('Feed', Icons.grass, _buildFeedTab, 2),
      _TabDef('Water', Icons.water_drop, _buildWaterTab, 3),
      _TabDef('Environment', Icons.thermostat, _buildEnvironmentTab, 7),
    ]),
    _GroupDef('Health', Icons.health_and_safety_outlined, [
      _TabDef('Mortality', Icons.warning_amber_outlined, _buildMortalityTab, 4),
      _TabDef('Vaccination', Icons.vaccines_outlined, _buildVaccinationTab, 5),
      _TabDef('Medication', Icons.medication_outlined, _buildMedicationTab, 8),
    ]),
    _GroupDef('Finance', Icons.attach_money, [
      _TabDef('Financial', Icons.attach_money, _buildFinancialTab, 6),
      _TabDef('Sales', Icons.point_of_sale_outlined, _buildSalesTab, 11),
    ]),
    _GroupDef('Planning', Icons.event_note_outlined, [
      _TabDef('Tasks', Icons.task_alt, _buildTasksTab, -1),
      _TabDef('Calendar', Icons.calendar_month_outlined, _buildCalendarTab, -1),
    ]),
    _GroupDef('Docs', Icons.attach_file, [
      _TabDef('Docs', Icons.attach_file, _buildDocumentsTab, 12),
    ]),
  ];

  @override
  void initState() {
    super.initState();
    _groupController = TabController(length: _groups.length, vsync: this);
    // The FAB depends on the selected group; TabController changes don't
    // otherwise trigger a Scaffold rebuild on their own.
    _groupController.addListener(() {
      if (mounted) setState(() {});
    });
    _loadData();
  }

  @override
  void dispose() {
    _groupController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      // Kick off every request that doesn't depend on another response
      // immediately, instead of awaiting them one at a time. Only the breed
      // performance targets genuinely depend on the flock (its breedId), so
      // that's the sole sequential step; everything else — including the
      // flock fetch itself — now runs concurrently, cutting the critical
      // path from ~17 sequential/partially-parallel round-trips down to a
      // handful of concurrent batches.
      final flockFuture = BroilerService.getFlock(widget.flockId);

      final calendarFuture = ApiService.dio
          .get('/api/v1/broiler-flocks/${widget.flockId}/summary')
          .then((res) => (res.data['days'] as List)
              .map((e) => CalendarDay.fromJson(e))
              .toList())
          .catchError((_) => <CalendarDay>[]);

      final recordsFuture = Future.wait([
        BroilerService.getGrowthRecords(widget.flockId)
            .catchError((_) => <GrowthRecord>[]),
        BroilerService.getFeedRecords(widget.flockId)
            .catchError((_) => <FeedRecord>[]),
        BroilerService.getFeedPurchases(widget.flockId)
            .catchError((_) => <FeedPurchase>[]),
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
            .then((r) => r.items)
            .catchError((_) => <SaleRecord>[]),
        BroilerService.getDocuments(widget.flockId)
            .catchError((_) => <DocumentRecord>[]),
      ]);

      final summariesFuture = Future.wait([
        _safeCall(BroilerService.getGrowthAnalysis(widget.flockId)),
        _safeCall(BroilerService.getFeedSummary(widget.flockId)),
        _safeCall(BroilerService.getWaterRatio(widget.flockId)),
        _safeCall(BroilerService.getMortalitySummary(widget.flockId)),
        _safeCall(BroilerService.getVaccinationScheduleStatus(widget.flockId)),
        _safeCall(BroilerService.getFinancialSummary(widget.flockId)),
        _safeCall(BroilerService.getFeedProjection(widget.flockId)),
      ]);

      final saleSummaryFuture =
          _safeCall(BroilerService.getSaleRecordSummary(widget.flockId));

      final flock = await flockFuture;

      // Fetch breed performance targets for growth chart — the only truly
      // sequential dependency (needs flock.breedId) — while everything else
      // above continues resolving concurrently in the background.
      List<PerformanceTarget> breedTargets = [];
      try {
        final breedRes =
            await ApiService.dio.get('/api/v1/breeds/${flock.breedId}');
        final breed = Breed.fromJson(breedRes.data);
        breedTargets = breed.performanceTargets;
      } catch (_) {}

      final days = await calendarFuture;
      final results = await recordsFuture;
      final summaries = await summariesFuture;
      final saleSummary = await saleSummaryFuture;

      final growth = results[0] as List<GrowthRecord>;
      final feed = results[1] as List<FeedRecord>;
      final feedPurchases = results[2] as List<FeedPurchase>;
      final water = results[3] as List<WaterRecord>;
      final mortality = results[4] as List<MortalityEvent>;
      final vaccination = results[5] as List<VaccinationEvent>;
      final financial = results[6] as List<FinancialRecord>;
      final medication = results[7] as List<MedicationRecord>;
      final environment = results[8] as List<EnvironmentalRecord>;
      final sales = results[9] as List<SaleRecord>;
      final documents = results[10] as List<DocumentRecord>;

      final analysis = summaries[0] as GrowthRecordAnalysis?;
      final feedSummary = summaries[1] as FeedSummary?;
      final waterRatio = summaries[2] as WaterRatio?;
      final mortalitySummary = summaries[3] as MortalitySummary?;
      final vaccinationStatus = summaries[4] as VaccinationScheduleStatus?;
      final financialSummary = summaries[5] as FinancialSummary?;
      final feedProjection = summaries[6] as FeedProjection?;

      setState(() {
        _flock = flock;
        _calendarDays = days;
        _growthRecords = growth;
        _growthAnalysis = analysis;
        _feedRecords = feed;
        _feedPurchases = feedPurchases;
        _feedSummary = feedSummary;
        _feedProjection = feedProjection;
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

  /// The legacy flat tab index (0-12) for whichever group/sub-tab is
  /// currently selected, or `-1` if that section has no "add record" action.
  int get _currentFlatIndex {
    final group = _groups[_groupController.index];
    final sub = group.tabs.length == 1 ? 0 : _subIndex[_groupController.index];
    return group.tabs[sub].flatIndex;
  }

  void _onAddRecord() {
    if (_flock == null) return;
    final flock = _flock!;
    switch (_currentFlatIndex) {
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
    final flatIndex = _currentFlatIndex;
    // -1 = no "add record" action for this section (Overview, Tasks, Calendar)
    if (flatIndex == -1) return null;
    if (flatIndex == 11) {
      if (!AuthService.canManageSales) return null;
    } else if (flatIndex == 12) {
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

  // Bulk record selection
  void _enterRecordSelectMode(String type) {
    setState(() {
      _recordSelectMode = true;
      _currentRecordType = type;
      _selectedRecordIds.clear();
    });
  }

  void _exitRecordSelectMode() {
    setState(() {
      _recordSelectMode = false;
      _currentRecordType = null;
      _selectedRecordIds.clear();
    });
  }

  void _toggleRecordSelect(String id) {
    setState(() {
      if (_selectedRecordIds.contains(id)) {
        _selectedRecordIds.remove(id);
      } else {
        _selectedRecordIds.add(id);
      }
    });
  }

  List<String> _currentRecordIds() {
    switch (_currentRecordType) {
      case 'growth':
        return _growthRecords.map((r) => r.id).toList();
      case 'feed':
        return _feedPurchases.map((r) => r.id).toList();
      case 'water':
        return _waterRecords.map((r) => r.id).toList();
      case 'mortality':
        return _mortalityEvents.map((r) => r.id).toList();
      case 'vaccination':
        return _vaccinationEvents.map((r) => r.id).toList();
      case 'financial':
        return _financialRecords.map((r) => r.id).toList();
      default:
        return [];
    }
  }

  void _toggleSelectAllRecords() {
    final allIds = _currentRecordIds();
    setState(() {
      if (_selectedRecordIds.length == allIds.length) {
        _selectedRecordIds.clear();
      } else {
        _selectedRecordIds.addAll(allIds);
      }
    });
  }

  Future<void> _bulkDeleteRecords() async {
    if (_selectedRecordIds.isEmpty || _currentRecordType == null) return;
    if (!AuthService.canDelete) return;
    final count = _selectedRecordIds.length;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Delete $count record${count == 1 ? '' : 's'}?'),
        content: Text(
            'This will permanently delete $count ${_currentRecordType} record${count == 1 ? '' : 's'}. '
            'Linked financial records and flock counts will be updated. This cannot be undone.'),
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
    setState(() => _bulkSaving = true);
    try {
      await BroilerService.bulkDeleteRecords(
          _currentRecordType!, _selectedRecordIds.toList());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Deleted $count record${count == 1 ? '' : 's'}')),
        );
      }
      _exitRecordSelectMode();
      _loadData();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Bulk delete failed: $e'),
              backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _bulkSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Selection mode app bar
    final selectAppBar = AppBar(
      leading: IconButton(
        icon: const Icon(Icons.close),
        onPressed: _exitRecordSelectMode,
      ),
      title: Text('${_selectedRecordIds.length} selected'),
      actions: [
        IconButton(
          icon: Icon(
            _selectedRecordIds.length == _currentRecordIds().length &&
                    _currentRecordIds().isNotEmpty
                ? Icons.deselect
                : Icons.select_all,
          ),
          tooltip: 'Select all',
          onPressed: _toggleSelectAllRecords,
        ),
      ],
    );

    final normalAppBar = AppBar(
      title: Text(widget.flockName),
      actions: [
        IconButton(icon: const Icon(Icons.refresh), onPressed: _loadData),
      ],
      bottom: TabBar(
        controller: _groupController,
        isScrollable: true,
        tabs: [
          for (final group in _groups)
            Tab(icon: Icon(group.icon), text: group.title),
        ],
      ),
    );

    // Bulk action bar
    final bulkActionBar = _recordSelectMode && _selectedRecordIds.isNotEmpty
        ? Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withAlpha(20),
                  blurRadius: 4,
                  offset: const Offset(0, -2),
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.delete),
                    label: const Text('Delete Selected'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red,
                      foregroundColor: Colors.white,
                    ),
                    onPressed: _bulkSaving ? null : _bulkDeleteRecords,
                  ),
                ),
              ],
            ),
          )
        : const SizedBox.shrink();

    return Scaffold(
      appBar: _recordSelectMode ? selectAppBar : normalAppBar,
      floatingActionButton: _recordSelectMode ? null : _floatingActionButton,
      body: _loading
          ? ListView(
              padding: const EdgeInsets.all(16),
              children: const [
                Skeleton(height: 160),
                SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: Skeleton(height: 70)),
                    SizedBox(width: 8),
                    Expanded(child: Skeleton(height: 70)),
                    SizedBox(width: 8),
                    Expanded(child: Skeleton(height: 70)),
                  ],
                ),
                SizedBox(height: 12),
                Skeleton(height: 120),
              ],
            )
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
              : _bulkSaving
                  ? const Center(child: CircularProgressIndicator())
                  : TabBarView(
                      controller: _groupController,
                      children: [
                        for (var gi = 0; gi < _groups.length; gi++)
                          _buildGroupBody(_groups[gi], gi),
                      ],
                    ),
      bottomNavigationBar: bulkActionBar,
    );
  }

  /// Renders a single tab group. Groups with one section render it directly;
  /// groups with multiple sections show a horizontally-scrollable
  /// `SegmentedButton` sub-nav above an `IndexedStack` of the sections (all
  /// sections stay built/alive, matching the previous `TabBarView` behavior).
  Widget _buildGroupBody(_GroupDef group, int groupIndex) {
    if (group.tabs.length == 1) return group.tabs.first.builder();

    final selected = _subIndex[groupIndex];
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SegmentedButton<int>(
              showSelectedIcon: false,
              segments: [
                for (var i = 0; i < group.tabs.length; i++)
                  ButtonSegment(
                    value: i,
                    label: Text(group.tabs[i].title),
                    icon: Icon(group.tabs[i].icon, size: 18),
                  ),
              ],
              selected: {selected},
              onSelectionChanged: (s) =>
                  setState(() => _subIndex[groupIndex] = s.first),
            ),
          ),
        ),
        Expanded(
          child: IndexedStack(
            index: selected,
            children: [for (final tab in group.tabs) tab.builder()],
          ),
        ),
      ],
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
                child: StatCard(
                    label: 'Birds',
                    value: '${flock.currentCount}',
                    color: Colors.green)),
            const SizedBox(width: 8),
            Expanded(
                child: StatCard(
                    label: 'Initial',
                    value: '${flock.initialCount}',
                    color: Colors.blue)),
            const SizedBox(width: 8),
            Expanded(
                child: StatCard(
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
                FeedPhaseRow(
                    phase: 'Starter',
                    dayRange: 'Day 1 - $feedTransition',
                    color: Colors.orange),
                FeedPhaseRow(
                    phase: 'Grower',
                    dayRange: 'Day ${feedTransition + 1} - $finisherDay',
                    color: Colors.teal),
                FeedPhaseRow(
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
            SummaryCard(children: [
              SummaryRow('Current age', 'Day ${analysis.ageDays}'),
              SummaryRow('Records', '${analysis.records.length}'),
              SummaryRow('FCR', analysis.fcr?.toStringAsFixed(2) ?? '-'),
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
          else ...[
            if (AuthService.canDelete && !_recordSelectMode)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  icon: const Icon(Icons.checklist),
                  label: const Text('Select'),
                  onPressed: () => _enterRecordSelectMode('growth'),
                ),
              ),
            ..._growthRecords.reversed.map((r) => RecordCard(
                  title:
                      'Day ${r.recordDate.difference(DateTime.parse(_flock!.startDate ?? r.recordDate.toIso8601String())).inDays}',
                  subtitle: '${r.avgWeight}g avg · ${r.sampleSize} sampled',
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
                                '${r.avgWeight}g on ${r.recordDate.toIso8601String().split('T').first}',
                            onDelete: () =>
                                BroilerService.deleteGrowthRecord(r.id),
                          )
                      : null,
                  selectable:
                      _recordSelectMode && _currentRecordType == 'growth',
                  selected: _selectedRecordIds.contains(r.id),
                  onSelectChanged: (v) {
                    if (!_recordSelectMode) {
                      _enterRecordSelectMode('growth');
                    }
                    _toggleRecordSelect(r.id);
                  },
                )),
          ],
        ],
      ),
    );
  }

  // ── Feed projection helpers ─────────────────

  Widget _projectionHeader() {
    const style = TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey);
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          const Expanded(flex: 3, child: Text('Stage', style: style)),
          const Expanded(flex: 2, child: Text('Day', style: style, textAlign: TextAlign.center)),
          const Expanded(flex: 2, child: Text('Req', style: style, textAlign: TextAlign.end)),
          const Expanded(flex: 2, child: Text('Bought', style: style, textAlign: TextAlign.end)),
          const Expanded(flex: 2, child: Text('Left', style: style, textAlign: TextAlign.end)),
        ],
      ),
    );
  }

  Widget _projectionStageRow(FeedProjectionStage s) {
    final remainingColor = s.bagsRemaining > 0 ? Colors.orange : Colors.green;
    final dayRange = s.dayRangeStart != null
        ? 'Day ${s.dayRangeStart}${s.dayRangeEnd != null ? '-${s.dayRangeEnd}' : '+'}'
        : '-';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(flex: 3, child: Text(s.stageName, style: const TextStyle(fontSize: 13))),
          Expanded(flex: 2, child: Text(dayRange, style: TextStyle(fontSize: 11, color: Colors.grey[600]), textAlign: TextAlign.center)),
          Expanded(flex: 2, child: Text('${s.bagsRequired}', style: const TextStyle(fontSize: 13), textAlign: TextAlign.end)),
          Expanded(flex: 2, child: Text('${s.bagsPurchased}', style: const TextStyle(fontSize: 13), textAlign: TextAlign.end)),
          Expanded(flex: 2, child: Text(
            '${s.bagsRemaining}',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: remainingColor),
            textAlign: TextAlign.end,
          )),
        ],
      ),
    );
  }

  Widget _projectionTotalRow(FeedProjection p) {
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(
        children: [
          const Expanded(flex: 3, child: Text('Total', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold))),
          const Expanded(flex: 2, child: SizedBox()),
          Expanded(flex: 2, child: Text('${p.totals.bagsRequired}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold), textAlign: TextAlign.end)),
          Expanded(flex: 2, child: Text('${p.totals.bagsPurchased}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold), textAlign: TextAlign.end)),
          Expanded(flex: 2, child: Text(
            '${p.totals.bagsRemaining}',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: p.totals.bagsRemaining > 0 ? Colors.orange : Colors.green,
            ),
            textAlign: TextAlign.end,
          )),
        ],
      ),
    );
  }

  Widget _buildFeedTab() {
    final summary = _feedSummary;
    final projection = _feedProjection;
    final totalPurchaseCost = _feedPurchases.fold<double>(
        0, (sum, p) => sum + p.totalCostZmw);
    final totalBags = _feedPurchases.fold<int>(0, (sum, p) => sum + p.bagsPurchased);
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Feed Projection (required vs purchased) ──
          if (projection != null && projection.stages.isNotEmpty) ...[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.inventory_2, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Feed Projection & Procurement',
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Based on ${projection.initialCount} initial birds'
                      '${projection.supplierName != null ? ' · ${projection.supplierName}' : ''}',
                      style: TextStyle(
                          fontSize: 12, color: Colors.grey[600]),
                    ),
                    const SizedBox(height: 12),
                    // Header row
                    _projectionHeader(),
                    ...projection.stages.map((s) => _projectionStageRow(s)),
                    const Divider(height: 1),
                    _projectionTotalRow(projection),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],
          if (summary != null)
            SummaryCard(children: [
              SummaryRow(
                  'Total feed', '${summary.totalFeedKg.toStringAsFixed(1)} kg'),
              SummaryRow('Total cost',
                  'ZMW ${summary.totalCostZmw.toStringAsFixed(2)}'),
              SummaryRow(
                  'Cost/bird', 'ZMW ${summary.costPerBird.toStringAsFixed(2)}'),
            ]),
          const SizedBox(height: 12),
          if (_feedPurchases.isNotEmpty)
            SummaryCard(children: [
              SummaryRow('Purchases', '$totalBags bags'),
              SummaryRow('Purchase cost',
                  'ZMW ${totalPurchaseCost.toStringAsFixed(2)}'),
            ]),
          if (_feedPurchases.isNotEmpty) const SizedBox(height: 12),
          if (_feedRecords.isNotEmpty) FeedChart(records: _feedRecords),
          if (_feedPurchases.isEmpty && _feedRecords.isEmpty)
            const Center(
                child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No feed purchases yet. Tap + to record one.')))
          else ...[
            if (AuthService.canDelete && !_recordSelectMode && _feedPurchases.isNotEmpty)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  icon: const Icon(Icons.checklist),
                  label: const Text('Select'),
                  onPressed: () => _enterRecordSelectMode('feed'),
                ),
              ),
            ..._feedPurchases.map((p) => RecordCard(
                  title:
                      '${p.stageName ?? 'Unknown'} · ${p.bagsPurchased} × ${p.bagSizeKg}kg',
                  subtitle: p.supplierName != null
                      ? 'Supplier: ${p.supplierName}'
                      : null,
                  trailing: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(p.purchaseDate.toIso8601String().split('T').first),
                      Text(
                          'ZMW ${p.totalCostZmw.toStringAsFixed(2)}',
                          style:
                              const TextStyle(fontWeight: FontWeight.bold)),
                    ],
                  ),
                  onEdit: AuthService.canEdit
                      ? () => _navigateToForm(
                          FeedRecordForm(flockId: widget.flockId, record: p))
                      : null,
                  onDelete: AuthService.canDelete
                      ? () => _deleteRecord<FeedPurchase>(
                            label: 'feed purchase',
                            record: p,
                            name: (p) =>
                                '${p.bagsPurchased} × ${p.bagSizeKg}kg ${p.stageName ?? ''}',
                            onDelete: () =>
                                BroilerService.deleteFeedPurchase(p.id),
                          )
                      : null,
                  selectable: _recordSelectMode && _currentRecordType == 'feed',
                  selected: _selectedRecordIds.contains(p.id),
                  onSelectChanged: (v) {
                    if (!_recordSelectMode) _enterRecordSelectMode('feed');
                    _toggleRecordSelect(p.id);
                  },
                )),
          ],
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
            SummaryCard(children: [
              SummaryRow('Total water',
                  '${ratio.totalWaterLiters.toStringAsFixed(1)} L'),
              SummaryRow(
                  'Total feed', '${ratio.totalFeedKg.toStringAsFixed(1)} kg'),
              SummaryRow('Water:feed', ratio.waterToFeedRatio ?? '-'),
            ]),
          const SizedBox(height: 12),
          if (_waterRecords.isNotEmpty) WaterChart(records: _waterRecords),
          if (_waterRecords.isEmpty)
            const Center(
                child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No water records yet.')))
          else ...[
            if (AuthService.canDelete && !_recordSelectMode)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  icon: const Icon(Icons.checklist),
                  label: const Text('Select'),
                  onPressed: () => _enterRecordSelectMode('water'),
                ),
              ),
            ..._waterRecords.reversed.map((r) => RecordCard(
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
                  selectable:
                      _recordSelectMode && _currentRecordType == 'water',
                  selected: _selectedRecordIds.contains(r.id),
                  onSelectChanged: (v) {
                    if (!_recordSelectMode) _enterRecordSelectMode('water');
                    _toggleRecordSelect(r.id);
                  },
                )),
          ],
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
            SummaryCard(children: [
              SummaryRow('Total deaths', '${summary.totalDeaths}'),
              SummaryRow('Mortality rate', '${summary.mortalityRate}%'),
              SummaryRow('Current count', '${summary.currentCount}'),
            ]),
          const SizedBox(height: 12),
          if (_mortalityEvents.isNotEmpty)
            MortalityChart(records: _mortalityEvents),
          if (_mortalityEvents.isEmpty)
            const Center(
                child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No mortality events yet.')))
          else ...[
            if (AuthService.canDelete && !_recordSelectMode)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  icon: const Icon(Icons.checklist),
                  label: const Text('Select'),
                  onPressed: () => _enterRecordSelectMode('mortality'),
                ),
              ),
            ..._mortalityEvents.reversed.map((r) => RecordCard(
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
                  selectable:
                      _recordSelectMode && _currentRecordType == 'mortality',
                  selected: _selectedRecordIds.contains(r.id),
                  onSelectChanged: (v) {
                    if (!_recordSelectMode) _enterRecordSelectMode('mortality');
                    _toggleRecordSelect(r.id);
                  },
                )),
          ],
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
          // ── Vaccination schedule reference ──
          if (overdue.isNotEmpty || upcoming.isNotEmpty) ...[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.vaccines, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Vaccination Schedule',
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                        ),
                        if (status != null)
                          Text(
                            'Day ${status.ageDays}',
                            style: TextStyle(
                                fontSize: 12, color: Colors.grey[600]),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (overdue.isNotEmpty) ...[
                      const Text('Overdue',
                          style: TextStyle(
                              color: Colors.red,
                              fontWeight: FontWeight.bold,
                              fontSize: 13)),
                      const SizedBox(height: 4),
                      ...overdue.map((i) => _scheduleItemRow(i, Colors.red)),
                      if (upcoming.isNotEmpty) const SizedBox(height: 12),
                    ],
                    if (upcoming.isNotEmpty) ...[
                      const Text('Upcoming',
                          style: TextStyle(
                              color: Colors.green,
                              fontWeight: FontWeight.bold,
                              fontSize: 13)),
                      const SizedBox(height: 4),
                      ...upcoming.map((i) => _scheduleItemRow(i, Colors.green)),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],
          if (completed.isNotEmpty) VaccinationChart(records: completed),
          if (completed.isEmpty)
            const Center(
                child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No vaccination records yet.')))
          else ...[
            if (AuthService.canDelete && !_recordSelectMode)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  icon: const Icon(Icons.checklist),
                  label: const Text('Select'),
                  onPressed: () => _enterRecordSelectMode('vaccination'),
                ),
              ),
            ...completed.reversed.map((r) => RecordCard(
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
                  selectable:
                      _recordSelectMode && _currentRecordType == 'vaccination',
                  selected: _selectedRecordIds.contains(r.id),
                  onSelectChanged: (v) {
                    if (!_recordSelectMode)
                      _enterRecordSelectMode('vaccination');
                    _toggleRecordSelect(r.id);
                  },
                )),
          ],
        ],
      ),
    );
  }

  Widget _scheduleItemRow(VaccinationScheduleItem item, Color accent) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 4),
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: accent, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.vaccineName,
                    style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
                Text(
                  'Day ${item.ageDays} · ${item.adminMethod.replaceAll('_', ' ')}'
                  '${item.vaccineType.isNotEmpty ? ' · ${item.vaccineType}' : ''}',
                  style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                ),
                if (item.notes != null && item.notes!.isNotEmpty)
                  Text(item.notes!,
                      style: TextStyle(fontSize: 11, color: Colors.grey[500])),
              ],
            ),
          ),
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
            SummaryCard(children: [
              SummaryRow(
                  'Revenue', 'ZMW ${summary.totalRevenue.toStringAsFixed(2)}'),
              SummaryRow(
                  'Costs', 'ZMW ${summary.totalCost.toStringAsFixed(2)}'),
              SummaryRow('Profit', 'ZMW ${summary.profit.toStringAsFixed(2)}'),
              SummaryRow('Profit/bird',
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
          else ...[
            if (AuthService.canDelete &&
                _financialRecords.any((r) => !r.isSystemGenerated) &&
                !_recordSelectMode)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  icon: const Icon(Icons.checklist),
                  label: const Text('Select'),
                  onPressed: () => _enterRecordSelectMode('financial'),
                ),
              ),
            ..._financialRecords.map((r) => RecordCard(
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
                  selectable: _recordSelectMode &&
                      _currentRecordType == 'financial' &&
                      !r.isSystemGenerated,
                  selected: _selectedRecordIds.contains(r.id),
                  onSelectChanged: r.isSystemGenerated
                      ? null
                      : (v) {
                          if (!_recordSelectMode)
                            _enterRecordSelectMode('financial');
                          _toggleRecordSelect(r.id);
                        },
                )),
          ],
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
          final isCurrent =
              _flock?.ageDays != null && day.day == _flock!.ageDays;
          final primary = Theme.of(context).colorScheme.primary;
          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: isCurrent
                  ? BorderSide(color: primary, width: 2)
                  : BorderSide.none,
            ),
            color: isCurrent ? primary.withAlpha(15) : null,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: isCurrent
                            ? primary.withAlpha(60)
                            : Colors.orange.withAlpha(30),
                        child: Text('${day.day}'),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text('Day ${day.day}',
                            style: const TextStyle(
                                fontSize: 18, fontWeight: FontWeight.bold)),
                      ),
                      if (isCurrent)
                        Container(
                          margin: const EdgeInsets.only(right: 8),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: primary,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Text('Today',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold)),
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
        ? double.tryParse((summary['totalRevenue'] ??
                    summary['totalRevenueZmw'] ??
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
                child: StatCard(
                    label: 'Birds sold',
                    value: '$totalBirdsSold',
                    color: Colors.green),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: StatCard(
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
                  onLongPress: AuthService.isOwner
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
