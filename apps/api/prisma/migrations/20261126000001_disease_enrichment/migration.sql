-- AlterTable
-- Rename preserves existing supportive-care text on databases that already
-- hold organic_treatments values (prod runs migrate deploy without seeds).
ALTER TABLE "diseases" RENAME COLUMN "organic_treatments" TO "supportive_treatments";

ALTER TABLE "diseases"
ADD COLUMN     "evidence" JSONB,
ADD COLUMN     "image_url" VARCHAR(500),
ADD COLUMN     "regional_notes" JSONB,
ADD COLUMN     "sources" JSONB,
ADD COLUMN     "video_provider" VARCHAR(20),
ADD COLUMN     "video_url" VARCHAR(500);
