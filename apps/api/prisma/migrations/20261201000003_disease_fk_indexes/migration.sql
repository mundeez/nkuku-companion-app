-- Indexes for the new disease_id FKs (Phase F). mortality_events.disease_id
-- was already indexed in 20261201000001.
CREATE INDEX "vaccination_events_disease_id_idx" ON "vaccination_events"("disease_id");
CREATE INDEX "alerts_disease_id_idx" ON "alerts"("disease_id");
CREATE INDEX "vaccination_schedule_items_disease_id_idx" ON "vaccination_schedule_items"("disease_id");
