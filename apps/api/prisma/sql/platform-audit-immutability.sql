-- ── PLATFORM AUDIT EVENT IMMUTABILITY (P1) ───────────────
-- Run after `prisma migrate deploy` (or prisma db push) to enforce the
-- append-only contract on platform_audit_events at the DB level — the
-- same CREATE RULE approach used for journal_entries/journal_lines.
-- Audit rows must never be modified or deleted; corrections are new rows.

-- Prevent UPDATE on platform_audit_events
CREATE OR REPLACE RULE no_update_platform_audit_events AS
  ON UPDATE TO platform_audit_events DO INSTEAD NOTHING;

-- Prevent DELETE on platform_audit_events
CREATE OR REPLACE RULE no_delete_platform_audit_events AS
  ON DELETE TO platform_audit_events DO INSTEAD NOTHING;
