-- ── MILESTONE G: JOURNAL ENTRY IMMUTABILITY ────────
-- Run after prisma db push to enforce immutability at DB level.
-- These rules prevent any UPDATE or DELETE on journal_entries and journal_lines.
-- Reversal is the only correction mechanism (POST /api/v1/journal/:id/reverse).

-- Prevent UPDATE on journal_entries
CREATE OR REPLACE RULE no_update_journal_entries AS
  ON UPDATE TO journal_entries DO INSTEAD NOTHING;

-- Prevent DELETE on journal_entries
CREATE OR REPLACE RULE no_delete_journal_entries AS
  ON DELETE TO journal_entries DO INSTEAD NOTHING;

-- Prevent UPDATE on journal_lines
CREATE OR REPLACE RULE no_update_journal_lines AS
  ON UPDATE TO journal_lines DO INSTEAD NOTHING;

-- Prevent DELETE on journal_lines
CREATE OR REPLACE RULE no_delete_journal_lines AS
  ON DELETE TO journal_lines DO INSTEAD NOTHING;

-- ── CHECK CONSTRAINTS ───────────────────────────────
-- A journal line must have exactly one of debit or credit (not both, not neither)
ALTER TABLE journal_lines ADD CONSTRAINT IF NOT EXISTS one_side_only
  CHECK (
    (debit_zmw IS NOT NULL AND credit_zmw IS NULL) OR
    (debit_zmw IS NULL AND credit_zmw IS NOT NULL)
  );

-- Amounts cannot be negative
ALTER TABLE journal_lines ADD CONSTRAINT IF NOT EXISTS amounts_nonneg
  CHECK (
    (debit_zmw IS NULL OR debit_zmw >= 0) AND
    (credit_zmw IS NULL OR credit_zmw >= 0)
  );
