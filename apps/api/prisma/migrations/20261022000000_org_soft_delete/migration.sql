-- P-6: tenant soft-delete (right to erasure) + purge scheduling
ALTER TABLE "organizations" ADD COLUMN "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "organizations" ADD COLUMN "purge_after" TIMESTAMPTZ(6);
CREATE INDEX "organizations_purge_after_idx" ON "organizations"("purge_after") WHERE "purge_after" IS NOT NULL;
