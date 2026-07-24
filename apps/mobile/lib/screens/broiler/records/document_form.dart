import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import '../../../services/auth_service.dart';
import '../../../services/broiler_service.dart';

class DocumentForm extends StatefulWidget {
  final String flockId;

  const DocumentForm({super.key, required this.flockId});

  @override
  State<DocumentForm> createState() => _DocumentFormState();
}

class _DocumentFormState extends State<DocumentForm> {
  final _formKey = GlobalKey<FormState>();
  PlatformFile? _selectedFile;
  String _category = 'receipt';
  bool _uploading = false;
  String? _error;

  final _categories = ['receipt', 'invoice', 'quotation', 'other'];

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'png', 'webp', 'doc', 'docx', 'csv'],
    );
    if (result != null && result.files.isNotEmpty) {
      setState(() {
        _selectedFile = result.files.first;
        _error = null;
      });
    }
  }

  Future<void> _upload() async {
    if (_selectedFile == null || _selectedFile!.path == null) {
      setState(() => _error = 'Please select a file first');
      return;
    }
    setState(() {
      _uploading = true;
      _error = null;
    });
    try {
      await BroilerService.uploadDocument(
        flockId: widget.flockId,
        filePath: _selectedFile!.path!,
        category: _category,
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() {
        _error = e.toString();
        _uploading = false;
      });
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
      appBar: AppBar(title: const Text('Upload Document')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Card(
                child: ListTile(
                  leading: const Icon(Icons.attach_file, size: 40),
                  title: Text(_selectedFile?.name ?? 'No file selected'),
                  subtitle: _selectedFile != null
                      ? Text('${(_selectedFile!.size / 1024).toStringAsFixed(1)} KB')
                      : const Text('Tap below to choose a file'),
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
              DropdownButtonFormField<String>(
                key: ValueKey(_category),
                initialValue: _category,
                decoration: const InputDecoration(labelText: 'Category'),
                items: _categories
                    .map((c) => DropdownMenuItem(value: c, child: Text(c[0].toUpperCase() + c.substring(1))))
                    .toList(),
                onChanged: (v) => setState(() => _category = v!),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: _uploading || _selectedFile == null ? null : _upload,
                icon: _uploading
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.cloud_upload),
                label: const Text('Upload'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
