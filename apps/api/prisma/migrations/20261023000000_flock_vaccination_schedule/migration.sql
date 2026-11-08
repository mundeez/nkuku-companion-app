-- Per-flock vaccination schedule choice + per-org default schedule and ambient
-- temperature for daily water estimates. All columns additive/nullable.
ALTER TABLE "broiler_flocks" ADD COLUMN "vaccination_schedule_id" UUID;
ALTER TABLE "organizations" ADD COLUMN "default_vaccination_schedule_id" UUID;
ALTER TABLE "organizations" ADD COLUMN "ambient_temp_c" DECIMAL(4,1) NOT NULL DEFAULT 25;

ALTER TABLE "broiler_flocks" ADD CONSTRAINT "broiler_flocks_vaccination_schedule_id_fkey" FOREIGN KEY ("vaccination_schedule_id") REFERENCES "vaccination_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_default_vaccination_schedule_id_fkey" FOREIGN KEY ("default_vaccination_schedule_id") REFERENCES "vaccination_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "broiler_flocks_vaccination_schedule_id_idx" ON "broiler_flocks"("vaccination_schedule_id");
