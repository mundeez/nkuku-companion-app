-- FeedBag lifecycle tracking + explicit fulfillsFeedType attribution.
-- (Hand-scoped from prisma migrate diff: pre-existing schema drift — trgm
-- indexes, documents.search_vector, JournalSourceType values — is managed
-- out-of-band and intentionally excluded here.)

-- CreateEnum
CREATE TYPE "FeedBagStatus" AS ENUM ('sealed', 'open', 'finished');

-- AlterTable
ALTER TABLE "feed_purchases" ADD COLUMN "fulfills_feed_type" VARCHAR(50);

-- CreateTable
CREATE TABLE "feed_bags" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "flock_id" UUID NOT NULL,
    "purchase_id" UUID NOT NULL,
    "feed_stage_id" UUID,
    "supplier_id" UUID,
    "stage_name" VARCHAR(50) NOT NULL,
    "bag_size_kg" DECIMAL(10,3) NOT NULL,
    "bag_index" INTEGER NOT NULL,
    "status" "FeedBagStatus" NOT NULL DEFAULT 'sealed',
    "opened_at" TIMESTAMPTZ(6),
    "opened_by_id" UUID,
    "finished_at" TIMESTAMPTZ(6),
    "finished_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "feed_bags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feed_bags_flock_id_status_idx" ON "feed_bags"("flock_id", "status");

-- CreateIndex
CREATE INDEX "feed_bags_purchase_id_idx" ON "feed_bags"("purchase_id");

-- CreateIndex
CREATE INDEX "feed_bags_organization_id_idx" ON "feed_bags"("organization_id");

-- AddForeignKey
ALTER TABLE "feed_bags" ADD CONSTRAINT "feed_bags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_bags" ADD CONSTRAINT "feed_bags_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "broiler_flocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_bags" ADD CONSTRAINT "feed_bags_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "feed_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_bags" ADD CONSTRAINT "feed_bags_feed_stage_id_fkey" FOREIGN KEY ("feed_stage_id") REFERENCES "feed_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_bags" ADD CONSTRAINT "feed_bags_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
