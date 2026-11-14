import 'package:flutter/material.dart';
import '../api.dart';

/// Ops tab — cron freshness board, comms log, active impersonation sessions.
class OpsScreen extends StatefulWidget {
  const OpsScreen({super.key});

  @override
  State<OpsScreen> createState() => _OpsScreenState();
}

class _OpsScreenState extends State<OpsScreen> {
  Map<String, dynamic>? _health;
  List<dynamic> _comms = [];
  List<dynamic> _sessions = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final results = await Future.wait([
        Api.opsHealth(),
        Api.comms(),
        Api.impersonationSessions(active: true),
      ]);
      if (mounted) {
        setState(() {
          _health = results[0] as Map<String, dynamic>;
          _comms = results[1] as List<dynamic>;
          _sessions = results[2] as List<dynamic>;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  Color _rag(String? s) => s == 'green'
      ? Colors.green
      : s == 'amber'
          ? Colors.orange
          : Colors.red;

  @override
  Widget build(BuildContext context) {
    final cron = (_health?['checks']?['cron']) as Map<String, dynamic>?;
    final jobs = (cron?['jobs'] as List?) ?? [];
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text('Load failed: $_error',
                  style: const TextStyle(color: Colors.red)),
            ),
          if (_health == null && _error == null)
            const Padding(
              padding: EdgeInsets.all(48),
              child: Center(child: CircularProgressIndicator()),
            ),
          // ── Cron freshness ──
          Row(children: [
            const Text('Cron jobs',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(width: 8),
            if (cron != null)
              Icon(Icons.circle, size: 10, color: _rag('${cron['status']}')),
          ]),
          const SizedBox(height: 8),
          Card(
            child: Column(children: [
              if (jobs.isEmpty)
                const Padding(
                    padding: EdgeInsets.all(12),
                    child: Text('No jobs registered')),
              for (final j in jobs)
                ListTile(
                  dense: true,
                  leading: Icon(Icons.circle,
                      size: 10, color: _rag('${j['rag']}')),
                  title: Text('${j['name']}',
                      style: const TextStyle(fontSize: 13)),
                  subtitle: Text(
                    '${j['schedule'] ?? ''} · ${j['detail'] ?? j['lastStatus'] ?? ''}',
                    style: const TextStyle(fontSize: 11),
                  ),
                ),
            ]),
          ),
          const SizedBox(height: 16),
          // ── Impersonation sessions ──
          const Text('Impersonation sessions',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 8),
          Card(
            child: Column(children: [
              if (_sessions.isEmpty)
                const Padding(
                    padding: EdgeInsets.all(12),
                    child: Text('No active sessions')),
              for (final s in _sessions)
                ListTile(
                  dense: true,
                  leading: const Icon(Icons.person_search_outlined),
                  title: Text(
                    '${s['staffUser']?['email'] ?? '?'} → ${s['targetUser']?['email'] ?? '?'}',
                    style: const TextStyle(fontSize: 13),
                  ),
                  subtitle: Text(
                    '${s['organization']?['name'] ?? ''} · expires ${s['expiresAt'] ?? ''}',
                    style: const TextStyle(fontSize: 11),
                  ),
                  trailing: TextButton(
                    child: const Text('End'),
                    onPressed: () async {
                      try {
                        await Api.endImpersonation('${s['id']}');
                        _load();
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('End failed: $e')));
                        }
                      }
                    },
                  ),
                ),
            ]),
          ),
          const SizedBox(height: 16),
          // ── Comms log ──
          const Text('Comms log',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 8),
          Card(
            child: Column(children: [
              if (_comms.isEmpty)
                const Padding(
                    padding: EdgeInsets.all(12),
                    child: Text('No outbound messages')),
              for (final c in _comms.take(15))
                ListTile(
                  dense: true,
                  leading: Icon(
                    c['status'] == 'sent'
                        ? Icons.check_circle_outline
                        : Icons.error_outline,
                    size: 18,
                    color:
                        c['status'] == 'sent' ? Colors.green : Colors.red,
                  ),
                  title: Text('${c['subject'] ?? c['template'] ?? '(no subject)'}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13)),
                  subtitle: Text(
                    '${c['channel']} → ${c['toAddr'] ?? ''} · ${c['organization']?['name'] ?? ''}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11),
                  ),
                ),
            ]),
          ),
        ],
      ),
    );
  }
}
