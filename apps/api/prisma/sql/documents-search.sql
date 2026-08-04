-- ============================================================
-- Document full-text search — tsvector generated column + GIN index
--
-- Run AFTER `prisma db push` (Prisma cannot manage GENERATED columns):
--   docker compose exec api psql "$DATABASE_URL" -f /app/prisma/sql/documents-search.sql
-- Or from host:
--   docker exec nkuku-companion-app-postgres-1 psql -U nkuku_user -d nkuku_db -f /docker-entrypoint-initdb.d/documents-search.sql
--
-- Idempotent: uses IF NOT EXISTS / OR REPLACE where supported.
-- ============================================================

-- Add search_vector as a GENERATED column from content_text.
-- Uses to_tsvector with 'english' config and coalesce to handle NULLs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE documents
      ADD COLUMN search_vector tsvector
      GENERATED ALWAYS AS (to_tsvector('english', coalesce(content_text, ''))) STORED;
  END IF;
END $$;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS documents_search_vector_idx
  ON documents USING GIN(search_vector);
