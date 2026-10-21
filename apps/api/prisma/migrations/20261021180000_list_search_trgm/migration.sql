-- M-1: trigram indexes to accelerate ILIKE %q% search on list endpoints
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS broiler_flocks_name_trgm_idx ON broiler_flocks USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS breeds_name_trgm_idx ON breeds USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS alerts_title_trgm_idx ON alerts USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS alerts_message_trgm_idx ON alerts USING gin (message gin_trgm_ops);
CREATE INDEX IF NOT EXISTS suppliers_name_trgm_idx ON suppliers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_name_trgm_idx ON users USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_email_trgm_idx ON users USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS vaccine_inventory_name_trgm_idx ON vaccine_inventory USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS vaccine_inventory_batch_trgm_idx ON vaccine_inventory USING gin (batch_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS sale_records_customer_trgm_idx ON sale_records USING gin (customer_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS journal_entries_description_trgm_idx ON journal_entries USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS journal_entries_entry_number_trgm_idx ON journal_entries USING gin (entry_number gin_trgm_ops);
