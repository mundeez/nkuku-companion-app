import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:youtube_player_flutter/youtube_player_flutter.dart';
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
  String? _orgCountry;
  final Map<String, String> _regionOverrides = {};

  static const _evidenceLabels = {
    'veterinary-recommended': 'Vet recommended',
    'standard-practice': 'Standard practice',
    'traditional-limited-evidence': 'Traditional — limited evidence',
  };

  static const _sourceTypeLabels = {
    'peer-reviewed': 'Peer-reviewed',
    'government': 'Government / WOAH',
    'university-extension': 'University extension',
    'industry': 'Industry reference',
    'ngo': 'NGO / Intl org',
  };

  @override
  void initState() {
    super.initState();
    _loadDiseases();
    _loadOrgCountry();
  }

  Future<void> _loadOrgCountry() async {
    try {
      final res = await ApiService.dio.get('/api/v1/organizations/me');
      final country = res.data?['country']?.toString().toUpperCase();
      if (country != null && country.isNotEmpty && mounted) {
        setState(() => _orgCountry = country);
      }
    } catch (_) {
      // Region notes fall back to "general" — non-fatal.
    }
  }

  Future<void> _loadDiseases() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      // The disease database is static reference data — fetched directly
      // from the API.
      final res = await ApiService.dio.get('/api/v1/diseases');
      final diseases =
          (res.data as List).map((e) => Disease.fromJson(e)).toList();
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
        final q = query.toLowerCase();
        final matchesQuery = d.name.toLowerCase().contains(q) ||
            d.symptoms.toLowerCase().contains(q);
        final matchesCategory = _selectedCategory == null || d.category == _selectedCategory;
        return matchesQuery && matchesCategory;
      }).toList();
    });
  }

  String? _youtubeVideoId(String url) {
    final uri = Uri.tryParse(url);
    if (uri == null) return null;
    // Canonical embed: youtube.com/embed/<id>; also accept watch?v=<id>
    final seg = uri.pathSegments;
    if (seg.isNotEmpty && seg.last.isNotEmpty && seg.contains('embed')) {
      return seg.last;
    }
    return uri.queryParameters['v'];
  }

  Widget _videoSection(Disease d) {
    if (d.videoUrl.isEmpty) return const SizedBox.shrink();
    if (d.videoProvider == 'youtube') {
      final id = _youtubeVideoId(d.videoUrl);
      if (id != null) {
        return Padding(
          padding: const EdgeInsets.only(top: 8),
          child: _DiseaseVideoPlayer(key: ValueKey(id), videoId: id),
        );
      }
    }
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: TextButton.icon(
        icon: const Icon(Icons.play_circle_outline),
        label: const Text('Watch video'),
        onPressed: () => launchUrl(Uri.parse(d.videoUrl),
            mode: LaunchMode.externalApplication),
      ),
    );
  }

  Widget _evidenceChip(String section, String? level) {
    if (level == null) return const SizedBox.shrink();
    final label = _evidenceLabels[level] ?? level;
    final color = level == 'veterinary-recommended'
        ? Colors.green
        : level == 'standard-practice'
            ? Colors.blueGrey
            : Colors.orange;
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Chip(
        label: Text(label, style: const TextStyle(fontSize: 10)),
        visualDensity: VisualDensity.compact,
        side: BorderSide(color: color.withValues(alpha: 0.4)),
        labelStyle: TextStyle(color: color, fontSize: 10),
        backgroundColor: color.withValues(alpha: 0.08),
      ),
    );
  }

  Widget _sectionHeader(String label, String? evidenceLevel) {
    return Row(
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
        _evidenceChip('x', evidenceLevel),
      ],
    );
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
                                clipBehavior: Clip.antiAlias,
                                child: ExpansionTile(
                                  leading: disease.imageUrl.isNotEmpty
                                      ? ClipRRect(
                                          borderRadius: BorderRadius.circular(8),
                                          child: CachedNetworkImage(
                                            imageUrl: disease.imageUrl,
                                            width: 44,
                                            height: 44,
                                            fit: BoxFit.cover,
                                            errorWidget: (_, __, ___) => Icon(
                                                _categoryIcon(disease.category),
                                                color: Colors.red),
                                          ),
                                        )
                                      : Icon(_categoryIcon(disease.category),
                                          color: Colors.red),
                                  title: Text(disease.name,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontWeight: FontWeight.w600)),
                                  subtitle: Text(disease.category,
                                      maxLines: 1, overflow: TextOverflow.ellipsis),
                                  children: [
                                    Padding(
                                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          if (disease.imageUrl.isNotEmpty)
                                            Padding(
                                              padding: const EdgeInsets.only(bottom: 8),
                                              child: ClipRRect(
                                                borderRadius: BorderRadius.circular(8),
                                                child: CachedNetworkImage(
                                                  imageUrl: disease.imageUrl,
                                                  width: double.infinity,
                                                  fit: BoxFit.cover,
                                                  placeholder: (_, __) =>
                                                      const SizedBox(
                                                          height: 160,
                                                          child: Center(
                                                              child:
                                                                  CircularProgressIndicator())),
                                                  errorWidget: (_, __, ___) =>
                                                      const SizedBox.shrink(),
                                                ),
                                              ),
                                            ),
                                          _InfoRow(label: 'Incubation', value: disease.incubation),
                                          _InfoRow(label: 'Mortality', value: disease.mortalityRate),
                                          const SizedBox(height: 8),
                                          const Text('Symptoms', style: TextStyle(fontWeight: FontWeight.bold)),
                                          Text(disease.symptoms),
                                          _videoSection(disease),
                                          const SizedBox(height: 8),
                                          _sectionHeader('Prevention', disease.evidenceBadge('prevention')),
                                          Text(disease.prevention),
                                          const SizedBox(height: 8),
                                          _sectionHeader('Treatment', disease.evidenceBadge('treatment')),
                                          Text(disease.treatment, style: const TextStyle(color: Colors.red)),
                                          if (disease.supportiveTreatments.isNotEmpty) ...[
                                            const SizedBox(height: 8),
                                            _sectionHeader('Supportive & Traditional Care',
                                                disease.evidenceBadge('supportiveTreatments')),
                                            Text(disease.supportiveTreatments,
                                                style: const TextStyle(color: Colors.green)),
                                          ],
                                          if (disease.regionalNotes.isNotEmpty) ...[
                                            const SizedBox(height: 12),
                                            Builder(builder: (context) {
                                              final override =
                                                  _regionOverrides[disease.id];
                                              final noteKeys = disease
                                                  .regionalNotes.keys
                                                  .where((k) => k != 'general')
                                                  .toList()
                                                ..sort();
                                              final activeKey = override ??
                                                  (_orgCountry != null &&
                                                          disease.regionalNotes
                                                              .containsKey(_orgCountry)
                                                      ? _orgCountry
                                                      : null);
                                              return Container(
                                                width: double.infinity,
                                                padding: const EdgeInsets.all(12),
                                                decoration: BoxDecoration(
                                                  color: Colors.blueGrey.withValues(alpha: 0.08),
                                                  borderRadius: BorderRadius.circular(8),
                                                  border: Border.all(
                                                      color: Colors.blueGrey.withValues(alpha: 0.3)),
                                                ),
                                                child: Column(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    Row(children: [
                                                      const Icon(Icons.place_outlined,
                                                          size: 16, color: Colors.blueGrey),
                                                      const SizedBox(width: 4),
                                                      Expanded(
                                                        child: Text(
                                                          activeKey != null
                                                              ? 'Regional note — $activeKey'
                                                              : 'Regional note',
                                                          style: const TextStyle(
                                                              fontWeight: FontWeight.bold,
                                                              fontSize: 13),
                                                        ),
                                                      ),
                                                      if (noteKeys.isNotEmpty)
                                                        DropdownButton<String>(
                                                          value: override == 'general'
                                                              ? '__general__'
                                                              : override ?? '__auto__',
                                                          isDense: true,
                                                          underline: const SizedBox.shrink(),
                                                          items: [
                                                            DropdownMenuItem(
                                                                value: '__auto__',
                                                                child: Text(
                                                                    _orgCountry != null
                                                                        ? 'Auto ($_orgCountry)'
                                                                        : 'Auto',
                                                                    style: const TextStyle(fontSize: 12))),
                                                            for (final k in noteKeys)
                                                              DropdownMenuItem(
                                                                  value: k,
                                                                  child: Text(k,
                                                                      style: const TextStyle(fontSize: 12))),
                                                            const DropdownMenuItem(
                                                                value: '__general__',
                                                                child: Text('General',
                                                                    style: TextStyle(fontSize: 12))),
                                                          ],
                                                          onChanged: (v) => setState(() {
                                                            if (v == null ||
                                                                v == '__auto__') {
                                                              _regionOverrides
                                                                  .remove(disease.id);
                                                            } else if (v == '__general__') {
                                                              _regionOverrides[
                                                                      disease.id] =
                                                                  'general';
                                                            } else {
                                                              _regionOverrides[
                                                                      disease.id] =
                                                                  v;
                                                            }
                                                          }),
                                                        ),
                                                    ]),
                                                    const SizedBox(height: 4),
                                                    Text(disease.getRegionalNote(
                                                        _orgCountry, override)),
                                                  ],
                                                ),
                                              );
                                            }),
                                          ],
                                          if (disease.sources.isNotEmpty) ...[
                                            const SizedBox(height: 12),
                                            const Text('Sources & references',
                                                style: TextStyle(fontWeight: FontWeight.bold)),
                                            const SizedBox(height: 4),
                                            for (final s in disease.sources)
                                              Padding(
                                                padding: const EdgeInsets.only(bottom: 4),
                                                child: InkWell(
                                                  onTap: () => launchUrl(Uri.parse(s.url),
                                                      mode: LaunchMode.externalApplication),
                                                  child: Text(
                                                    '• ${s.title} — ${s.publisher} (${_sourceTypeLabels[s.type] ?? s.type})',
                                                    style: const TextStyle(
                                                        fontSize: 12,
                                                        color: Colors.blue,
                                                        decoration: TextDecoration.underline),
                                                  ),
                                                ),
                                              ),
                                          ],
                                          const SizedBox(height: 12),
                                          Container(
                                            width: double.infinity,
                                            padding: const EdgeInsets.all(10),
                                            decoration: BoxDecoration(
                                              color: Colors.orange.withValues(alpha: 0.08),
                                              borderRadius: BorderRadius.circular(8),
                                              border: Border.all(
                                                  color: Colors.orange.withValues(alpha: 0.3)),
                                            ),
                                            child: const Text(
                                              'General educational information only — not a substitute for professional veterinary advice. Some diseases are notifiable; consult a licensed veterinarian and local regulations.',
                                              style: TextStyle(fontSize: 11, color: Colors.orange),
                                            ),
                                          ),
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
      case 'nutritional':
        return Icons.restaurant;
      case 'management':
        return Icons.settings_suggest;
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

/// Owns the YoutubePlayerController lifecycle — created once per video and
/// disposed with the widget, instead of leaking a controller per rebuild.
class _DiseaseVideoPlayer extends StatefulWidget {
  final String videoId;

  const _DiseaseVideoPlayer({super.key, required this.videoId});

  @override
  State<_DiseaseVideoPlayer> createState() => _DiseaseVideoPlayerState();
}

class _DiseaseVideoPlayerState extends State<_DiseaseVideoPlayer> {
  late final YoutubePlayerController _controller;

  @override
  void initState() {
    super.initState();
    _controller = YoutubePlayerController(
      initialVideoId: widget.videoId,
      flags: const YoutubePlayerFlags(
        autoPlay: false,
        mute: false,
        disableDragSeek: false,
      ),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: YoutubePlayer(controller: _controller),
      ),
    );
  }
}
