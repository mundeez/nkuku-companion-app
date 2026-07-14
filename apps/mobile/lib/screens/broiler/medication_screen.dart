import 'package:flutter/material.dart';
import '../../models/medication_record.dart';
import '../../services/auth_service.dart';
import '../../services/broiler_service.dart';
import 'records/medication_record_form.dart';

class MedicationScreen extends StatelessWidget {
  final String flockId;
  final List<MedicationRecord> records;
  final VoidCallback? onRefresh;

  const MedicationScreen({super.key, required this.flockId, required this.records, this.onRefresh});

  Future<void> _delete(BuildContext context, MedicationRecord record) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete medication record?'),
        content: Text('Delete ${record.productName}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await BroilerService.deleteMedicationRecord(record.id);
      onRefresh?.call();
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Delete failed: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async => onRefresh?.call(),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: records.isEmpty ? 1 : records.length,
        itemBuilder: (context, index) {
          if (records.isEmpty) {
            return const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('No medication records yet.')));
          }
          final r = records[index];
          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: ListTile(
              title: Text(r.productName),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${r.category} · ${r.recordDate.toIso8601String().split('T').first}'),
                  if (r.dose != null) Text('Dose: ${r.dose}'),
                  if (r.withdrawalDays != null) Text('Withdrawal: ${r.withdrawalDays} days'),
                  if (r.costZmw != null) Text('Cost: ZMW ${r.costZmw!.toStringAsFixed(2)}'),
                ],
              ),
              isThreeLine: true,
              trailing: AuthService.canEdit
                  ? Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.edit),
                          onPressed: () async {
                            final result = await Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => MedicationRecordForm(flockId: flockId, record: r)),
                            );
                            if (result == true) onRefresh?.call();
                          },
                        ),
                        if (AuthService.canDelete)
                          IconButton(
                            icon: const Icon(Icons.delete, color: Colors.red),
                            onPressed: () => _delete(context, r),
                          ),
                      ],
                    )
                  : null,
            ),
          );
        },
      ),
    );
  }
}
