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
-- Postgres has no "ADD CONSTRAINT IF NOT EXISTS"; use a DO block.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'journal_lines'::regclass AND conname = 'one_side_only'
  ) THEN
    ALTER TABLE journal_lines ADD CONSTRAINT one_side_only
      CHECK (
        (debit_zmw IS NOT NULL AND credit_zmw IS NULL) OR
        (debit_zmw IS NULL AND credit_zmw IS NOT NULL)
      );
  END IF;
END $$;

-- Amounts cannot be negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'journal_lines'::regclass AND conname = 'amounts_nonneg'
  ) THEN
    ALTER TABLE journal_lines ADD CONSTRAINT amounts_nonneg
      CHECK (
        (debit_zmw IS NULL OR debit_zmw >= 0) AND
        (credit_zmw IS NULL OR credit_zmw >= 0)
      );
  END IF;
END $$;
