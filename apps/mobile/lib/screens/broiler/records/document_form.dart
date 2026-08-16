import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import '../../../models/document.dart';
import '../../../services/auth_service.dart';
import '../../../services/broiler_service.dart';

/// Target type for document attachment.
enum DocumentTargetType { flock, financialRecord, journalEntry, saleRecord }

class DocumentForm extends StatefulWidget {
  final String? flockId;
  final String? financialRecordId;
  final String? journalEntryId;
  final String? saleRecordId;
  final DocumentRecord? record;

  const DocumentForm({
    super.key,
    this.flockId,
    this.financialRecordId,
    this.journalEntryId,
    this.saleRecordId,
    this.record,
  });

  @override
  State<DocumentForm> createState() => _DocumentFormState();
}

class _DocumentFormState extends State<DocumentForm> {
  final _formKey = GlobalKey<FormState>();
  PlatformFile? _selectedFile;
  String _category = 'receipt';
  bool _uploading = false;
  String? _error;

  final _categories = [
    'receipt', 'invoice', 'quotation', 'other',
    'bank_statement', 'contract', 'delivery_note',
  ];

  bool get _isEdit => widget.record != null;

  @override
  void initState() {
    super.initState();
    if (widget.record != null) {
      _category = widget.record!.category;
    }
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'png', 'webp', 'doc', 'docx', 'csv', 'xlsx', 'xls'],
    );
    if (result != null && result.files.isNotEmpty) {
      setState(() {
        _selectedFile = result.files.first;
        _error = null;
      });
    }
  }

  Future<void> _save() async {
    setState(() {
      _uploading = true;
      _error = null;
    });
    try {
      if (_isEdit) {
        await BroilerService.updateDocument(
          widget.record!.id,
          category: _category,
        );
      } else {
        if (_selectedFile == null || _selectedFile!.path == null) {
          setState(() => _error = 'Please select a file first');
          return;
        }
        await BroilerService.uploadDocumentFor(
          flockId: widget.flockId,
          financialRecordId: widget.financialRecordId,
          journalEntryId: widget.journalEntryId,
          saleRecordId: widget.saleRecordId,
          filePath: _selectedFile!.path!,
          category: _category,
        );
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _uploading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!AuthService.canManageDocuments) {
      return Scaffold(
        appBar: AppBar(title: const Text('Upload Document')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'You do not have permission to manage documents.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16, color: Colors.grey),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(_isEdit ? 'Edit Document' : 'Upload Document')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (!_isEdit) ...[
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.attach_file, size: 40),
                    title: Text(
                      _selectedFile?.name ?? 'No file selected',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: _selectedFile != null
                        ? Text('${(_selectedFile!.size / 1024).toStringAsFixed(1)} KB')
                        : const Text('Tap below to choose a file (max 25MB)'),
                    trailing: _selectedFile != null
                        ? IconButton(
                            icon: const Icon(Icons.close),
                            onPressed: () => setState(() => _selectedFile = null),
                          )
                        : null,
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _uploading ? null : _pickFile,
                  icon: const Icon(Icons.file_open),
                  label: Text(_selectedFile != null ? 'Change file' : 'Choose file'),
                ),
                const SizedBox(height: 16),
              ] else ...[
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.attach_file, size: 40),
                    title: Text(
                      widget.record!.fileName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text('${widget.record!.fileSizeKb} KB · ${widget.record!.mimeType}'),
                  ),
                ),
                const SizedBox(height: 16),
              ],
              DropdownButtonFormField<String>(
                key: ValueKey(_category),
                initialValue: _category,
                decoration: const InputDecoration(labelText: 'Category'),
                items: _categories
                    .map((c) => DropdownMenuItem(
                          value: c,
                          child: Text(c.replaceAll('_', ' ').split(' ').map((w) => w[0].toUpperCase() + w.substring(1)).join(' ')),
                        ))
                    .toList(),
                onChanged: (v) => setState(() => _category = v!),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: _uploading || (!_isEdit && _selectedFile == null) ? null : _save,
                icon: _uploading
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : Icon(_isEdit ? Icons.save : Icons.cloud_upload),
                label: Text(_isEdit ? 'Update' : 'Upload'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
