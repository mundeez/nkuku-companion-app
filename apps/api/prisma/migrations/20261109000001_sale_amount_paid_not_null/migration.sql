-- Normalize legacy NULL amount_paid (pre-payment-history rows) and make it required.
UPDATE "sale_records" SET "amount_paid_zmw" = 0 WHERE "amount_paid_zmw" IS NULL;
ALTER TABLE "sale_records"
  ALTER COLUMN "amount_paid_zmw" SET NOT NULL,
  ALTER COLUMN "amount_paid_zmw" SET DEFAULT 0;
