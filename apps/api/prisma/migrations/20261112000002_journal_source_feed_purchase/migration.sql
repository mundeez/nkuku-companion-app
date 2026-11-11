-- Add feed_purchase to JournalSourceType. The API has posted purchase
-- journals under this source type since the procurement feature shipped,
-- but the enum value was only ever applied out-of-band (or not at all) —
-- on databases missing it, auto-post throws and the journal is skipped.
-- ADD VALUE is idempotent here: safe on DBs that already have it.
ALTER TYPE "JournalSourceType" ADD VALUE IF NOT EXISTS 'feed_purchase';
