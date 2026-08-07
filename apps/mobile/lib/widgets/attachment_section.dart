import 'package:flutter/material.dart';
import '../../../models/document.dart';
import '../../../services/broiler_service.dart';
import '../../../services/auth_service.dart';
import '../screens/broiler/records/document_form.dart';

/// A reusable widget that displays and manages document attachments
/// for any financial transaction (FinancialRecord, JournalEntry, SaleRecord, or Flock).
class AttachmentSection extends StatefulWidget {
  final String? flockId;
  final String? financialRecordId;
  final String? journalEntryId;
  final String? saleRecordId;
  final String title;

  const AttachmentSection({
    super.key,
    this.flockId,
    this.financialRecordId,
    this.journalEntryId,
    this.saleRecordId,
    this.title = 'Attachments',
  });

  @override
  State<AttachmentSection> createState() => _AttachmentSectionState();
}

class _AttachmentSectionState extends State<AttachmentSection> {
  List<DocumentRecord> _documents = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadDocuments();
  }

  Future<void> _loadDocuments() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final docs = await BroilerService.getDocumentsFor(
        flockId: widget.flockId,
        financialRecordId: widget.financialRecordId,
        journalEntryId: widget.journalEntryId,
        saleRecordId: widget.saleRecordId,
      );
      if (mounted) {
        setState(() {
          _documents = docs;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  Future<void> _deleteDocument(String id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Document'),
        content: const Text('Are you sure you want to delete this document?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await BroilerService.deleteDocument(id);
      _loadDocuments();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to delete: $e')),
        );
      }
    }
  }

  void _openUploadForm() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => DocumentForm(
          flockId: widget.flockId,
          financialRecordId: widget.financialRecordId,
          journalEntryId: widget.journalEntryId,
          saleRecordId: widget.saleRecordId,
        ),
      ),
    ).then((result) {
      if (result == true) _loadDocuments();
    });
  }

  @override
  Widget build(BuildContext context) {
    final canManage = AuthService.canManageDocuments;

    return Card(
      margin: const EdgeInsets.only(top: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.attach_file, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      '${widget.title} (${_documents.length})',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ],
                ),
                if (canManage)
                  IconButton(
                    icon: const Icon(Icons.add),
                    onPressed: _openUploadForm,
                    tooltip: 'Upload document',
                  ),
              ],
            ),
            const Divider(),
            if (_loading)
              const Center(
                  child: Padding(
                      padding: EdgeInsets.all(16),
                      child: CircularProgressIndicator()))
            else if (_error != null)
              Padding(
                padding: const EdgeInsets.all(8),
                child: Text(_error!,
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error)),
              )
            else if (_documents.isEmpty)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Center(
                  child: Text('No attachments yet',
                      style: TextStyle(color: Colors.grey)),
                ),
              )
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _documents.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final doc = _documents[index];
                  return ListTile(
                    leading: Icon(
                      doc.mimeType.startsWith('image/')
                          ? Icons.image
                          : Icons.description,
                      color: doc.mimeType.contains('pdf')
                          ? Colors.red
                          : Colors.blue,
                    ),
                    title: Text(doc.fileName, overflow: TextOverflow.ellipsis),
                    subtitle: Text(
                      '${(doc.fileSizeKb / 1024).toStringAsFixed(1)} MB · ${doc.category.replaceAll('_', ' ')}',
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (doc.scanStatus == 'clean')
                          const Icon(Icons.verified_user,
                              size: 16, color: Colors.green)
                        else if (doc.scanStatus == 'skipped')
                          const Icon(Icons.warning,
                              size: 16, color: Colors.orange),
                        if (canManage) ...[
                          IconButton(
                            icon: const Icon(Icons.delete_outline, size: 20),
                            onPressed: () => _deleteDocument(doc.id),
                          ),
                        ],
                      ],
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}
