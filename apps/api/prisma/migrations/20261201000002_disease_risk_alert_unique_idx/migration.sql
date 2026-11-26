-- Phase F follow-up: partial unique index enforcing at most one UNRESOLVED
-- disease_risk alert per (flock, disease). Split out of
-- 20261201000001_disease_flock_links because Postgres forbids USING the
-- just-added 'disease_risk' enum value in the same migration transaction
-- (55P04). Prisma cannot express partial indexes, so this is raw SQL.

CREATE UNIQUE INDEX "alerts_disease_risk_unique_idx"
  ON "alerts" ("flock_id", "disease_id")
  WHERE "alert_type" = 'disease_risk' AND "is_resolved" = false AND "disease_id" IS NOT NULL;
