-- Link auto-created feed records to the feed bag that produced them.
ALTER TABLE "feed_records" ADD COLUMN "feed_bag_id" UUID;
ALTER TABLE "feed_records" ADD CONSTRAINT "feed_records_feed_bag_id_fkey"
  FOREIGN KEY ("feed_bag_id") REFERENCES "feed_bags"("id") ON DELETE SET NULL;
CREATE INDEX "feed_records_feed_bag_id_idx" ON "feed_records"("feed_bag_id");
