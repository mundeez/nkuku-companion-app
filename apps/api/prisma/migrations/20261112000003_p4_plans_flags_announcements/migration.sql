-- P4: DB-driven subscription plans, feature flags, announcements

ALTER TABLE "subscriptions" ADD COLUMN "price_override" DECIMAL(12,2);

CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_self_serve" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_trial" BOOLEAN NOT NULL DEFAULT false,
    "trial_days" INTEGER,
    "limits" JSONB NOT NULL,
    "features" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

CREATE TABLE "plan_prices" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "billing_cycle" "BillingCycle" NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "plan_prices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plan_prices_plan_id_billing_cycle_currency_key" ON "plan_prices"("plan_id", "billing_cycle", "currency");

CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL,
    "key" VARCHAR(60) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "enabled_by_default" BOOLEAN NOT NULL DEFAULT true,
    "plan_overrides" JSONB NOT NULL DEFAULT '{}',
    "org_overrides" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "title" VARCHAR(140) NOT NULL,
    "body" TEXT NOT NULL,
    "severity" VARCHAR(20) NOT NULL DEFAULT 'info',
    "audience" VARCHAR(20) NOT NULL DEFAULT 'all',
    "plan_codes" JSONB,
    "org_ids" JSONB,
    "link_url" TEXT,
    "link_label" VARCHAR(60),
    "starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMPTZ(6),
    "is_dismissible" BOOLEAN NOT NULL DEFAULT true,
    "created_by_staff_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "announcements_starts_at_ends_at_idx" ON "announcements"("starts_at", "ends_at");

CREATE TABLE "announcement_dismissals" (
    "announcement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "dismissed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "announcement_dismissals_pkey" PRIMARY KEY ("announcement_id", "user_id")
);

ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "announcement_dismissals" ADD CONSTRAINT "announcement_dismissals_announcement_id_fkey"
    FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
