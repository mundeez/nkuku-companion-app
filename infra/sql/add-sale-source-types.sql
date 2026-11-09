-- One-off (superuser): nkuku_user does not own JournalSourceType.
-- Run as postgres: docker exec shared-postgres psql -U postgres -d nkuku_db -f ...
ALTER TYPE "JournalSourceType" ADD VALUE IF NOT EXISTS 'sale';
ALTER TYPE "JournalSourceType" ADD VALUE IF NOT EXISTS 'sale_payment';
