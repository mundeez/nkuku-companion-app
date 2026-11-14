-- P5: materialised daily platform analytics rollups (PLAN-super-admin-console §6)
CREATE TABLE "platform_daily_stats" (
    "id" UUID NOT NULL,
    "stat_date" DATE NOT NULL,
    "signups" INTEGER NOT NULL DEFAULT 0,
    "activations" INTEGER NOT NULL DEFAULT 0,
    "wau" INTEGER NOT NULL DEFAULT 0,
    "mau" INTEGER NOT NULL DEFAULT 0,
    "mrr_basic" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "mrr_grower" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "mrr_business" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "mrr_enterprise" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "new_mrr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expansion_mrr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "churned_mrr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "failed_payments" INTEGER NOT NULL DEFAULT 0,
    "failed_payment_recoveries" INTEGER NOT NULL DEFAULT 0,
    "countries_json" JSONB,
    "funnel_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_daily_stats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_daily_stats_stat_date_key" ON "platform_daily_stats"("stat_date");
