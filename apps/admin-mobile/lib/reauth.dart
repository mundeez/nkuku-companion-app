import 'package:flutter/material.dart';
import 'api.dart';

/// Re-auth gate for dangerous platform writes — mobile parity with the
/// web console's `withReauth` / reauth-modal. Checks the server-issued
/// `reauthAt` freshness (≤5 min); when stale, prompts for password OR
/// TOTP and calls POST /platform/auth/reauth.
///
/// Usage:
///   if (!await ensureReauth(context)) return; // user cancelled
///   await Api.flagUpdate(...);
class ReauthCancelled implements Exception {
  const ReauthCancelled();
}

/// Returns true when the session is fresh (or was just re-authed).
/// Throws nothing — returns false when the user dismisses the dialog.
Future<bool> ensureReauth(BuildContext context) async {
  if (await Api.isReauthFresh()) return true;
  if (!context.mounted) return false;
  final ok = await showDialog<bool>(
    context: context,
    barrierDismissible: false,
    builder: (_) => const _ReauthDialog(),
  );
  return ok == true;
}

class _ReauthDialog extends StatefulWidget {
  const _ReauthDialog();

  @override
  State<_ReauthDialog> createState() => _ReauthDialogState();
}

class _ReauthDialogState extends State<_ReauthDialog> {
  final _password = TextEditingController();
  final _totp = TextEditingController();
  bool _busy = false;
  String? _error;

  Future<void> _submit() async {
    final pw = _password.text;
    final code = _totp.text.trim();
    if (pw.isEmpty && code.isEmpty) {
      setState(() => _error = 'Enter your password or an authenticator code.');
      return;
    }
    setState(() { _busy = true; _error = null; });
    try {
      await Api.reauth(
        password: pw.isNotEmpty ? pw : null,
        totp: code.isNotEmpty ? code : null,
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = 'Re-auth failed — check credentials and try again.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Confirm it\'s you'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'This action needs a fresh re-authentication (within the last '
            '5 minutes). Enter your password or a current authenticator code.',
            style: TextStyle(fontSize: 13),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _password,
            obscureText: true,
            decoration: const InputDecoration(
              labelText: 'Password',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _totp,
            keyboardType: TextInputType.number,
            maxLength: 20,
            decoration: const InputDecoration(
              labelText: 'Authenticator code (or recovery code)',
              border: OutlineInputBorder(),
              counterText: '',
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _busy ? null : _submit,
          child: _busy
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Verify'),
        ),
      ],
    );
  }
}
