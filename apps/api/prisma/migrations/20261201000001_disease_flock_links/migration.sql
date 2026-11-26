-- Phase F — disease↔flock integration.
-- Additive/nullable only: new disease_id FKs (ON DELETE SET NULL), disease
-- keywords + susceptible age windows, and the disease_risk alert type.
-- NOTE: prisma migrate dev could not run (no shadow-DB privilege on the
-- shared Postgres); this file was produced via `prisma migrate diff` and
-- hand-filtered to exclude unrelated schema↔DB drift (trgm indexes,
-- documents.search_vector, FK re-assertions).

-- AlterEnum
ALTER TYPE "AlertType" ADD VALUE 'disease_risk';

-- AlterTable
ALTER TABLE "alerts" ADD COLUMN "disease_id" UUID;

ALTER TABLE "diseases"
  ADD COLUMN "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "susceptible_age_max_days" INTEGER,
  ADD COLUMN "susceptible_age_min_days" INTEGER;

ALTER TABLE "mortality_events" ADD COLUMN "disease_id" UUID;

ALTER TABLE "vaccination_events" ADD COLUMN "disease_id" UUID;

ALTER TABLE "vaccination_schedule_items" ADD COLUMN "disease_id" UUID;

-- CreateIndex (mortality_events.disease_id — declared in schema)
CREATE INDEX "mortality_events_disease_id_idx" ON "mortality_events"("disease_id");

-- NOTE: the partial unique index on alerts (flock_id, disease_id) for
-- unresolved disease_risk alerts lives in the FOLLOWING migration
-- (20261201000002_disease_risk_alert_unique_idx) — Postgres forbids USING
-- a just-added enum value later in the same migration transaction
-- (55P04 "unsafe use of new value"), so the index must be created after
-- the AlertType enum addition has committed.

-- AddForeignKey
ALTER TABLE "mortality_events"
  ADD CONSTRAINT "mortality_events_disease_id_fkey"
  FOREIGN KEY ("disease_id") REFERENCES "diseases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vaccination_events"
  ADD CONSTRAINT "vaccination_events_disease_id_fkey"
  FOREIGN KEY ("disease_id") REFERENCES "diseases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vaccination_schedule_items"
  ADD CONSTRAINT "vaccination_schedule_items_disease_id_fkey"
  FOREIGN KEY ("disease_id") REFERENCES "diseases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "alerts"
  ADD CONSTRAINT "alerts_disease_id_fkey"
  FOREIGN KEY ("disease_id") REFERENCES "diseases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
