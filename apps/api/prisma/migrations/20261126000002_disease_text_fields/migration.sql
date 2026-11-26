-- AlterTable: widen descriptive free-text fields (seed content is prose, not short labels)
ALTER TABLE "diseases" ALTER COLUMN "incubation" TYPE TEXT,
ALTER COLUMN "mortality_rate" TYPE TEXT;
