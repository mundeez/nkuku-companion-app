-- Sale payment history + AR posting support. Additive; idempotent backfill.
-- NOTE: "JournalSourceType" values 'sale' and 'sale_payment' are added by a
-- superuser one-off script (infra/sql/add-sale-source-types.sql) because the
-- app DB user does not own the enum type on the shared Postgres instance.

ALTER TABLE "sale_records" ADD COLUMN "journal_entry_id" UUID;

CREATE TABLE "sale_payments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sale_record_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "amount_zmw" DECIMAL(12,2) NOT NULL,
  "paid_at" DATE NOT NULL,
  "method" VARCHAR(30) NOT NULL,
  "reference" VARCHAR(120),
  "note" TEXT,
  "journal_entry_id" UUID,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "sale_payments_sale_record_id_fkey" FOREIGN KEY ("sale_record_id") REFERENCES "sale_records"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "sale_payments_sale_record_id_idx" ON "sale_payments"("sale_record_id");
CREATE INDEX "sale_payments_organization_id_paid_at_idx" ON "sale_payments"("organization_id", "paid_at");

-- One-time backfill: existing paid amounts become a single opening_balance row.
INSERT INTO "sale_payments" ("id","sale_record_id","organization_id","amount_zmw","paid_at","method","note","created_at")
SELECT gen_random_uuid(), s."id", s."organization_id", s."amount_paid_zmw", s."sale_date", 'opening_balance', 'Opening balance — recorded before payment history', now()
FROM "sale_records" s
WHERE s."amount_paid_zmw" > 0
  AND NOT EXISTS (SELECT 1 FROM "sale_payments" p WHERE p."sale_record_id" = s."id");
