-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'manager', 'flock_minder', 'sales_person', 'viewer');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('monthly', 'cycle_3mo', 'annual');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'suspended', 'cancelled');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible');

-- CreateEnum
CREATE TYPE "StageType" AS ENUM ('feed', 'chick', 'medication', 'other');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('planned', 'active', 'completed');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('planned', 'active', 'harvested', 'closed');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('feed', 'chick', 'medication', 'labor', 'utilities', 'transport', 'other');

-- CreateEnum
CREATE TYPE "OverheadCategory" AS ENUM ('medication', 'vaccination', 'labour', 'electricity', 'water', 'litter', 'transport_to_market', 'other');

-- CreateEnum
CREATE TYPE "EquipmentCategory" AS ENUM ('raising_equipment', 'abattoir', 'cold_storage', 'building', 'other');

-- CreateEnum
CREATE TYPE "FlockStatus" AS ENUM ('active', 'sold', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "HousingType" AS ENUM ('whole_house', 'spot_brooding');

-- CreateEnum
CREATE TYPE "FinancialCategory" AS ENUM ('chick_purchase', 'feed', 'vaccines', 'medication', 'labor', 'utilities', 'equipment', 'sales', 'other');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('temperature_adjustment', 'vaccination_due', 'feed_transition', 'weight_check', 'mortality_threshold', 'environmental', 'financial', 'medication_due', 'withdrawal_due', 'vaccine_expiry', 'environmental_threshold', 'task_due');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('info', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "MedicationCategory" AS ENUM ('antibiotic', 'coccidiostat', 'electrolyte', 'vitamin', 'probiotic', 'acidifier', 'phytogenic', 'other');

-- CreateEnum
CREATE TYPE "VaccineInventoryStatus" AS ENUM ('available', 'in_use', 'expired', 'depleted');

-- CreateEnum
CREATE TYPE "FlockTaskCategory" AS ENUM ('vaccination', 'feed', 'water', 'environment', 'health', 'biosecurity', 'management');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('monthly', 'quarterly', 'annual');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'delete', 'period_close', 'report_generate', 'virus_scan_rejected');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('income_statement', 'balance_sheet', 'cash_flow', 'cost_breakdown', 'flock_profitability', 'cycle_summary');

-- CreateEnum
CREATE TYPE "ReportFrequency" AS ENUM ('weekly', 'monthly', 'quarterly');

-- CreateEnum
CREATE TYPE "ReportScope" AS ENUM ('global', 'flock', 'cycle');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('pdf', 'csv', 'excel');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('success', 'failed', 'running');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');

-- CreateEnum
CREATE TYPE "NormalBalance" AS ENUM ('debit', 'credit');

-- CreateEnum
CREATE TYPE "JournalSourceType" AS ENUM ('manual', 'feed_record', 'vaccination_event', 'mortality_event', 'water_record', 'batch_expense', 'overhead_cost', 'sales', 'migration', 'period_close');

-- CreateEnum
CREATE TYPE "AdPricingModel" AS ENUM ('flat', 'cpm', 'cpc');

-- CreateEnum
CREATE TYPE "AdCampaignStatus" AS ENUM ('draft', 'active', 'paused', 'completed');

-- CreateEnum
CREATE TYPE "AdPlacement" AS ENUM ('banner', 'native');

-- CreateEnum
CREATE TYPE "AdPage" AS ENUM ('dashboard', 'projections', 'document_search', 'flock_detail');

-- CreateEnum
CREATE TYPE "AdEventType" AS ENUM ('impression', 'click');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('active', 'expired', 'revoked', 'suspended');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "phone" VARCHAR(20),
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'viewer',
    "name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "phone_verified_at" TIMESTAMPTZ(6),
    "email_verified_at" TIMESTAMPTZ(6),
    "consent_accepted_at" TIMESTAMPTZ(6),
    "consent_version" VARCHAR(20),
    "is_platform_admin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_accounts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "provider_user_id" VARCHAR(255) NOT NULL,
    "provider_email" VARCHAR(255),
    "provider_name" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "phone" VARCHAR(20) NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "purpose" VARCHAR(20) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_devices" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "device_fingerprint" VARCHAR(64) NOT NULL,
    "device_label" VARCHAR(200),
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "country" VARCHAR(2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'ZMW',
    "plan_code" VARCHAR(30) NOT NULL DEFAULT 'free',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'viewer',
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'viewer',
    "token" VARCHAR(64) NOT NULL,
    "invited_by" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "accepted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_code" VARCHAR(30) NOT NULL,
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'monthly',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
    "current_period_start" TIMESTAMPTZ(6),
    "current_period_end" TIMESTAMPTZ(6),
    "provider" VARCHAR(30),
    "provider_ref" VARCHAR(100),
    "canceled_at" TIMESTAMPTZ(6),
    "trial_ends_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "invoice_number" VARCHAR(50) NOT NULL,
    "plan_code" VARCHAR(30) NOT NULL,
    "billing_cycle" "BillingCycle" NOT NULL,
    "amount_due" DECIMAL(12,2) NOT NULL,
    "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'ZMW',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "period_end" TIMESTAMPTZ(6) NOT NULL,
    "due_date" TIMESTAMPTZ(6) NOT NULL,
    "paid_at" TIMESTAMPTZ(6),
    "provider_ref" VARCHAR(100),
    "payment_link" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "provider_ref" VARCHAR(100) NOT NULL,
    "provider_txn_id" VARCHAR(100),
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'ZMW',
    "status" VARCHAR(20) NOT NULL,
    "raw_payload" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "chicken_type" VARCHAR(50),
    "contact" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_stages" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "stage_name" VARCHAR(50) NOT NULL,
    "stage_type" "StageType" NOT NULL DEFAULT 'feed',
    "day_range_start" INTEGER,
    "day_range_end" INTEGER,
    "unit_size_kg" DECIMAL(10,3) NOT NULL,
    "unit_price_zmw" DECIMAL(12,2) NOT NULL,
    "intake_per_bird_kg" DECIMAL(8,4) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "feed_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_stage_price_history" (
    "id" UUID NOT NULL,
    "feed_stage_id" UUID NOT NULL,
    "old_unit_price_zmw" DECIMAL(12,2) NOT NULL,
    "new_unit_price_zmw" DECIMAL(12,2) NOT NULL,
    "old_unit_size_kg" DECIMAL(10,3) NOT NULL,
    "new_unit_size_kg" DECIMAL(10,3) NOT NULL,
    "changed_by" UUID,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_stage_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_category_templates" (
    "id" UUID NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "supplier_category_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_category_template_items" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "item_name" VARCHAR(50) NOT NULL,
    "item_type" "StageType" NOT NULL DEFAULT 'feed',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "default_fields" JSONB,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "supplier_category_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_cycles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "label" VARCHAR(50),
    "notes" TEXT,
    "status" "CycleStatus" NOT NULL DEFAULT 'planned',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "production_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "shoot_label" VARCHAR(20) NOT NULL,
    "target_execution_dt" DATE NOT NULL,
    "sales_date" DATE NOT NULL,
    "growth_qty_added" INTEGER NOT NULL DEFAULT 0,
    "total_qty_at_hand" INTEGER NOT NULL,
    "revenue_target_zmw" DECIMAL(14,2),
    "sales_price_per_bird" DECIMAL(10,2),
    "actual_birds_sold" INTEGER,
    "actual_sale_price" DECIMAL(10,2),
    "mortality_pct_assumed" DECIMAL(5,4) NOT NULL DEFAULT 0.0500,
    "status" "BatchStatus" NOT NULL DEFAULT 'planned',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_expenses" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "feed_stage_id" UUID,
    "expense_category" "ExpenseCategory" NOT NULL DEFAULT 'feed',
    "description" VARCHAR(200),
    "quantity_items" DECIMAL(12,4),
    "quantity_rounded_up" INTEGER,
    "unit_price_zmw" DECIMAL(12,2) NOT NULL,
    "subtotal_zmw" DECIMAL(14,2) NOT NULL,
    "is_projected" BOOLEAN NOT NULL DEFAULT true,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overhead_costs" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "category" "OverheadCategory" NOT NULL,
    "description" VARCHAR(200),
    "amount_zmw" DECIMAL(14,2) NOT NULL,
    "is_projected" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overhead_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mortality_records" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,
    "day_of_cycle" INTEGER,
    "birds_lost" INTEGER NOT NULL DEFAULT 0,
    "cause" VARCHAR(100),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mortality_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projections" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "bird_count" INTEGER NOT NULL,
    "sales_price_per_bird" DECIMAL(10,2) NOT NULL,
    "mortality_pct" DECIMAL(5,4) NOT NULL DEFAULT 0.0500,
    "effective_bird_count" DECIMAL(12,2) NOT NULL,
    "total_feed_cost" DECIMAL(14,2) NOT NULL,
    "total_chick_cost" DECIMAL(14,2) NOT NULL,
    "total_overhead_cost" DECIMAL(14,2),
    "total_expenses" DECIMAL(14,2) NOT NULL,
    "projected_revenue" DECIMAL(14,2) NOT NULL,
    "gross_profit" DECIMAL(14,2) NOT NULL,
    "net_profit" DECIMAL(14,2) NOT NULL,
    "calculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" UUID NOT NULL,
    "currency_from" CHAR(3) NOT NULL DEFAULT 'USD',
    "currency_to" CHAR(3) NOT NULL DEFAULT 'ZMW',
    "rate" DECIMAL(12,6) NOT NULL,
    "effective_date" DATE NOT NULL,
    "source" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_items" (
    "id" UUID NOT NULL,
    "category" "EquipmentCategory" NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "unit_cost_usd" DECIMAL(14,2),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "is_compulsory" BOOLEAN NOT NULL DEFAULT false,
    "useful_life_years" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "equipment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "breeds" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "supplier" VARCHAR(100) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "breeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_targets" (
    "id" UUID NOT NULL,
    "breed_id" UUID NOT NULL,
    "age_days" INTEGER NOT NULL,
    "target_weight" DECIMAL(10,3) NOT NULL,
    "target_feed" DECIMAL(10,3) NOT NULL,
    "target_fcr" DECIMAL(5,3) NOT NULL,
    "target_water" DECIMAL(10,3),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "performance_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broiler_flocks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "breed_id" UUID NOT NULL,
    "supplier_id" UUID,
    "order_date" DATE,
    "start_date" DATE,
    "initial_count" INTEGER NOT NULL,
    "current_count" INTEGER NOT NULL,
    "target_weight" DECIMAL(10,3),
    "target_age" INTEGER,
    "feed_transition_day" INTEGER,
    "finisher_day" INTEGER,
    "chick_price_zmw" DECIMAL(14,2),
    "chicks_collected" BOOLEAN NOT NULL DEFAULT false,
    "collection_date" DATE,
    "expected_collection_start" DATE,
    "expected_collection_end" DATE,
    "chick_quality_notes" VARCHAR(500),
    "sale_price_zmw" DECIMAL(14,2),
    "sold_date" DATE,
    "status" "FlockStatus" NOT NULL DEFAULT 'active',
    "housing_type" "HousingType" NOT NULL DEFAULT 'whole_house',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "broiler_flocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_records" (
    "id" UUID NOT NULL,
    "flock_id" UUID NOT NULL,
    "record_date" DATE NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "avg_weight" DECIMAL(10,3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "growth_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_records" (
    "id" UUID NOT NULL,
    "flock_id" UUID NOT NULL,
    "supplier_id" UUID,
    "record_date" DATE NOT NULL,
    "feedType" VARCHAR(50) NOT NULL,
    "feed_brand" VARCHAR(100),
    "quantity_kg" DECIMAL(10,3) NOT NULL,
    "cost_zmw" DECIMAL(14,2),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "feed_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_purchases" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "flock_id" UUID NOT NULL,
    "feed_stage_id" UUID,
    "supplier_id" UUID,
    "purchase_date" DATE NOT NULL,
    "stage_name" VARCHAR(50) NOT NULL,
    "bag_size_kg" DECIMAL(10,3) NOT NULL,
    "bags_purchased" INTEGER NOT NULL,
    "unit_price_zmw" DECIMAL(12,2) NOT NULL,
    "total_cost_zmw" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "feed_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "water_records" (
    "id" UUID NOT NULL,
    "flock_id" UUID NOT NULL,
    "record_date" DATE NOT NULL,
    "quantity_liters" DECIMAL(10,2) NOT NULL,
    "ph" DECIMAL(4,2),
    "temperature_c" DECIMAL(5,2),
    "cost_zmw" DECIMAL(14,2),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "water_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mortality_events" (
    "id" UUID NOT NULL,
    "flock_id" UUID NOT NULL,
    "event_date" DATE NOT NULL,
    "count" INTEGER NOT NULL,
    "cause" VARCHAR(200),
    "age_days" INTEGER,
    "cost_zmw" DECIMAL(14,2),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "mortality_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccination_events" (
    "id" UUID NOT NULL,
    "flock_id" UUID NOT NULL,
    "vaccine_name" VARCHAR(100) NOT NULL,
    "vaccine_type" VARCHAR(100) NOT NULL,
    "admin_date" DATE NOT NULL,
    "admin_method" VARCHAR(50) NOT NULL,
    "age_days" INTEGER NOT NULL,
    "cost_zmw" DECIMAL(14,2),
    "next_due_date" DATE,
    "batch_number" VARCHAR(100),
    "expiry_date" DATE,
    "vaccine_inventory_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vaccination_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_records" (
    "id" UUID NOT NULL,
    "flock_id" UUID NOT NULL,
    "source_record_id" UUID,
    "source_table" VARCHAR(50),
    "record_date" DATE NOT NULL,
    "category" "FinancialCategory" NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "amount_zmw" DECIMAL(14,2) NOT NULL,
    "is_income" BOOLEAN NOT NULL DEFAULT false,
    "is_system_generated" BOOLEAN NOT NULL DEFAULT false,
    "is_projection" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "financial_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL,
    "flock_id" UUID NOT NULL,
    "alert_type" "AlertType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'info',
    "due_date" DATE NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diseases" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "incubation" VARCHAR(100),
    "mortality_rate" VARCHAR(50),
    "symptoms" TEXT,
    "prevention" TEXT,
    "treatment" TEXT,
    "organic_treatments" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "diseases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccination_schedules" (
    "id" UUID NOT NULL,
    "breed_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vaccination_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccination_schedule_items" (
    "id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "vaccine_name" VARCHAR(100) NOT NULL,
    "vaccine_type" VARCHAR(100) NOT NULL,
    "age_days" INTEGER NOT NULL,
    "admin_method" VARCHAR(50) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vaccination_schedule_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lighting_temperature_schedules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "breed_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "housing_type" "HousingType" NOT NULL DEFAULT 'whole_house',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lighting_temperature_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lighting_temperature_schedule_items" (
    "id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "age_days" INTEGER NOT NULL,
    "light_hours" DECIMAL(4,2),
    "dark_hours" DECIMAL(4,2),
    "light_intensity_lux" INTEGER,
    "dark_intensity_lux" INTEGER,
    "target_temp_c" DECIMAL(5,2),
    "target_temp_min_c" DECIMAL(5,2),
    "target_temp_max_c" DECIMAL(5,2),
    "target_rh_min_pct" INTEGER,
    "target_rh_max_pct" INTEGER,
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lighting_temperature_schedule_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_records" (
    "id" UUID NOT NULL,
    "flock_id" UUID NOT NULL,
    "record_date" DATE NOT NULL,
    "product_name" VARCHAR(100) NOT NULL,
    "category" "MedicationCategory" NOT NULL,
    "dose" VARCHAR(100),
    "route" VARCHAR(50),
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "withdrawal_days" INTEGER,
    "withdrawal_date" DATE,
    "cost_zmw" DECIMAL(14,2),
    "veterinarian" VARCHAR(100),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "medication_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccine_inventory" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "disease" VARCHAR(100),
    "supplier" VARCHAR(100),
    "batch_number" VARCHAR(100) NOT NULL,
    "quantity_doses" INTEGER NOT NULL,
    "expiry_date" DATE NOT NULL,
    "status" "VaccineInventoryStatus" NOT NULL DEFAULT 'available',
    "cost_zmw" DECIMAL(14,2),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vaccine_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environmental_records" (
    "id" UUID NOT NULL,
    "flock_id" UUID NOT NULL,
    "record_date" DATE NOT NULL,
    "time_of_day" VARCHAR(20),
    "temperature_c" DECIMAL(5,2),
    "humidity_pct" DECIMAL(5,2),
    "ammonia_ppm" DECIMAL(5,2),
    "light_hours" DECIMAL(4,2),
    "litter_score" INTEGER,
    "ventilation_note" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "environmental_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flock_tasks" (
    "id" UUID NOT NULL,
    "flock_id" UUID NOT NULL,
    "task_date" DATE NOT NULL,
    "age_days" INTEGER NOT NULL,
    "category" "FlockTaskCategory" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "is_skipped" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "flock_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_periods" (
    "id" UUID NOT NULL,
    "label" VARCHAR(20) NOT NULL,
    "period_type" "PeriodType" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "financial_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "previous_state" JSONB,
    "new_state" JSONB,
    "ip_address" VARCHAR(45),
    "period_id" UUID,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_reports" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "report_type" "ReportType" NOT NULL,
    "frequency" "ReportFrequency" NOT NULL,
    "scope" "ReportScope" NOT NULL,
    "scope_id" UUID,
    "recipients" JSONB NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMPTZ(6),
    "next_run_at" TIMESTAMPTZ(6),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_executions" (
    "id" UUID NOT NULL,
    "scheduled_report_id" UUID NOT NULL,
    "status" "ExecutionStatus" NOT NULL,
    "fileUrl" VARCHAR(500),
    "error_message" TEXT,
    "executed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_overheads" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "year_month" VARCHAR(7) NOT NULL,
    "category" "OverheadCategory" NOT NULL,
    "description" VARCHAR(200),
    "amount_zmw" DECIMAL(14,2) NOT NULL,
    "contract_type" VARCHAR(20) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,

    CONSTRAINT "monthly_overheads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flock_overhead_allocations" (
    "id" UUID NOT NULL,
    "monthly_overhead_id" UUID NOT NULL,
    "flock_id" UUID NOT NULL,
    "allocation_date" DATE NOT NULL,
    "days_active_in_month" INTEGER NOT NULL,
    "total_active_flock_days" INTEGER NOT NULL,
    "allocated_amount" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flock_overhead_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "account_type" "AccountType" NOT NULL,
    "normal_balance" "NormalBalance" NOT NULL,
    "parent_code" VARCHAR(10),
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "entry_number" VARCHAR(20) NOT NULL,
    "entry_date" DATE NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "reference" VARCHAR(100),
    "source_type" "JournalSourceType" NOT NULL,
    "source_id" UUID,
    "period_label" VARCHAR(20),
    "is_reversing" BOOLEAN NOT NULL DEFAULT false,
    "reverses_id" UUID,
    "posted_by" UUID,
    "posted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" UUID NOT NULL,
    "journal_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "debit_zmw" DECIMAL(14,2),
    "credit_zmw" DECIMAL(14,2),
    "description" VARCHAR(200),
    "flock_id" UUID,
    "batch_id" UUID,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_balances" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "period_label" VARCHAR(20) NOT NULL,
    "opening_debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "opening_credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "period_debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "period_credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "closing_debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "closing_credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "flock_id" UUID,
    "record_type" VARCHAR(50) NOT NULL,
    "record_id" UUID,
    "file_name" VARCHAR(255) NOT NULL,
    "file_path" VARCHAR(500),
    "storage_key" VARCHAR(500),
    "bucket" VARCHAR(100),
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size_kb" INTEGER NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "content_text" TEXT,
    "scan_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "scanned_at" TIMESTAMPTZ(6),
    "extraction_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "financial_record_id" UUID,
    "journal_entry_id" UUID,
    "sale_record_id" UUID,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "flock_id" UUID NOT NULL,
    "sale_date" DATE NOT NULL,
    "customer_name" VARCHAR(200),
    "customer_phone" VARCHAR(50),
    "bird_count" INTEGER NOT NULL,
    "avg_weight_kg" DECIMAL(10,3),
    "price_per_bird_zmw" DECIMAL(14,2) NOT NULL,
    "total_amount_zmw" DECIMAL(14,2) NOT NULL,
    "payment_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "amount_paid_zmw" DECIMAL(14,2),
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sale_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaigns" (
    "id" UUID NOT NULL,
    "advertiser_name" VARCHAR(150) NOT NULL,
    "creative_image_url" TEXT NOT NULL,
    "target_url" TEXT NOT NULL,
    "alt_text" VARCHAR(200) NOT NULL,
    "placement" "AdPlacement" NOT NULL,
    "pages" "AdPage"[],
    "country_targets" TEXT[],
    "pricing_model" "AdPricingModel" NOT NULL,
    "flat_fee_amount" DECIMAL(12,2),
    "cpm_rate" DECIMAL(10,4),
    "cpc_rate" DECIMAL(10,4),
    "currency" CHAR(3) NOT NULL DEFAULT 'ZMW',
    "budget_cap" DECIMAL(12,2),
    "spend_to_date" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "priority_weight" INTEGER NOT NULL DEFAULT 1,
    "start_date" TIMESTAMPTZ(6) NOT NULL,
    "end_date" TIMESTAMPTZ(6) NOT NULL,
    "status" "AdCampaignStatus" NOT NULL DEFAULT 'draft',
    "impressions_count" INTEGER NOT NULL DEFAULT 0,
    "clicks_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_events" (
    "id" UUID NOT NULL,
    "ad_campaign_id" UUID NOT NULL,
    "organization_id" UUID,
    "event_type" "AdEventType" NOT NULL,
    "page" "AdPage" NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licenses" (
    "id" UUID NOT NULL,
    "license_key" TEXT NOT NULL,
    "licensed_to" TEXT NOT NULL,
    "licensed_to_email" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'enterprise',
    "max_users" INTEGER,
    "max_organizations" INTEGER,
    "is_white_label" BOOLEAN NOT NULL DEFAULT false,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    "status" "LicenseStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "social_accounts_userId_idx" ON "social_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_provider_provider_user_id_key" ON "social_accounts"("provider", "provider_user_id");

-- CreateIndex
CREATE INDEX "otp_codes_phone_purpose_idx" ON "otp_codes"("phone", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_userId_device_fingerprint_key" ON "user_devices"("userId", "device_fingerprint");

-- CreateIndex
CREATE INDEX "organization_members_user_id_idx" ON "organization_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization_members"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "invites_token_key" ON "invites"("token");

-- CreateIndex
CREATE INDEX "invites_organization_id_idx" ON "invites"("organization_id");

-- CreateIndex
CREATE INDEX "invites_email_idx" ON "invites"("email");

-- CreateIndex
CREATE INDEX "subscriptions_organization_id_idx" ON "subscriptions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_provider_ref_key" ON "invoices"("provider_ref");

-- CreateIndex
CREATE INDEX "invoices_organization_id_idx" ON "invoices"("organization_id");

-- CreateIndex
CREATE INDEX "invoices_subscription_id_idx" ON "invoices"("subscription_id");

-- CreateIndex
CREATE INDEX "payment_events_invoice_id_idx" ON "payment_events"("invoice_id");

-- CreateIndex
CREATE INDEX "payment_events_provider_ref_idx" ON "payment_events"("provider_ref");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_name_key" ON "suppliers"("name");

-- CreateIndex
CREATE INDEX "suppliers_organization_id_idx" ON "suppliers"("organization_id");

-- CreateIndex
CREATE INDEX "feed_stages_supplier_id_sort_order_idx" ON "feed_stages"("supplier_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "feed_stages_supplier_id_stage_name_key" ON "feed_stages"("supplier_id", "stage_name");

-- CreateIndex
CREATE INDEX "feed_stage_price_history_feed_stage_id_changed_at_idx" ON "feed_stage_price_history"("feed_stage_id", "changed_at");

-- CreateIndex
CREATE INDEX "supplier_category_templates_sort_order_idx" ON "supplier_category_templates"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_category_templates_category_key" ON "supplier_category_templates"("category");

-- CreateIndex
CREATE INDEX "supplier_category_template_items_template_id_sort_order_idx" ON "supplier_category_template_items"("template_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_category_template_items_template_id_item_name_key" ON "supplier_category_template_items"("template_id", "item_name");

-- CreateIndex
CREATE UNIQUE INDEX "production_cycles_cycle_number_key" ON "production_cycles"("cycle_number");

-- CreateIndex
CREATE INDEX "production_cycles_organization_id_idx" ON "production_cycles"("organization_id");

-- CreateIndex
CREATE INDEX "batches_cycle_id_shoot_label_idx" ON "batches"("cycle_id", "shoot_label");

-- CreateIndex
CREATE INDEX "batches_organization_id_idx" ON "batches"("organization_id");

-- CreateIndex
CREATE INDEX "batch_expenses_batch_id_idx" ON "batch_expenses"("batch_id");

-- CreateIndex
CREATE INDEX "overhead_costs_batch_id_idx" ON "overhead_costs"("batch_id");

-- CreateIndex
CREATE INDEX "mortality_records_batch_id_recorded_at_idx" ON "mortality_records"("batch_id", "recorded_at");

-- CreateIndex
CREATE INDEX "projections_batch_id_idx" ON "projections"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_currency_from_currency_to_effective_date_key" ON "exchange_rates"("currency_from", "currency_to", "effective_date");

-- CreateIndex
CREATE UNIQUE INDEX "breeds_name_key" ON "breeds"("name");

-- CreateIndex
CREATE INDEX "performance_targets_breed_id_age_days_idx" ON "performance_targets"("breed_id", "age_days");

-- CreateIndex
CREATE UNIQUE INDEX "performance_targets_breed_id_age_days_key" ON "performance_targets"("breed_id", "age_days");

-- CreateIndex
CREATE INDEX "broiler_flocks_breed_id_status_idx" ON "broiler_flocks"("breed_id", "status");

-- CreateIndex
CREATE INDEX "broiler_flocks_supplier_id_idx" ON "broiler_flocks"("supplier_id");

-- CreateIndex
CREATE INDEX "broiler_flocks_organization_id_idx" ON "broiler_flocks"("organization_id");

-- CreateIndex
CREATE INDEX "growth_records_flock_id_record_date_idx" ON "growth_records"("flock_id", "record_date");

-- CreateIndex
CREATE INDEX "feed_records_flock_id_record_date_idx" ON "feed_records"("flock_id", "record_date");

-- CreateIndex
CREATE INDEX "feed_purchases_flock_id_purchase_date_idx" ON "feed_purchases"("flock_id", "purchase_date");

-- CreateIndex
CREATE INDEX "feed_purchases_organization_id_idx" ON "feed_purchases"("organization_id");

-- CreateIndex
CREATE INDEX "feed_purchases_feed_stage_id_idx" ON "feed_purchases"("feed_stage_id");

-- CreateIndex
CREATE INDEX "water_records_flock_id_record_date_idx" ON "water_records"("flock_id", "record_date");

-- CreateIndex
CREATE INDEX "mortality_events_flock_id_event_date_idx" ON "mortality_events"("flock_id", "event_date");

-- CreateIndex
CREATE INDEX "vaccination_events_flock_id_admin_date_idx" ON "vaccination_events"("flock_id", "admin_date");

-- CreateIndex
CREATE INDEX "financial_records_flock_id_record_date_idx" ON "financial_records"("flock_id", "record_date");

-- CreateIndex
CREATE INDEX "financial_records_source_record_id_idx" ON "financial_records"("source_record_id");

-- CreateIndex
CREATE INDEX "financial_records_is_system_generated_idx" ON "financial_records"("is_system_generated");

-- CreateIndex
CREATE INDEX "alerts_flock_id_is_resolved_due_date_idx" ON "alerts"("flock_id", "is_resolved", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "diseases_name_key" ON "diseases"("name");

-- CreateIndex
CREATE UNIQUE INDEX "vaccination_schedules_name_key" ON "vaccination_schedules"("name");

-- CreateIndex
CREATE INDEX "vaccination_schedule_items_schedule_id_sort_order_idx" ON "vaccination_schedule_items"("schedule_id", "sort_order");

-- CreateIndex
CREATE INDEX "lighting_temperature_schedules_breed_id_housing_type_create_idx" ON "lighting_temperature_schedules"("breed_id", "housing_type", "created_by");

-- CreateIndex
CREATE INDEX "lighting_temperature_schedules_organization_id_idx" ON "lighting_temperature_schedules"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "lighting_temperature_schedules_name_key" ON "lighting_temperature_schedules"("name");

-- CreateIndex
CREATE INDEX "lighting_temperature_schedule_items_schedule_id_age_days_idx" ON "lighting_temperature_schedule_items"("schedule_id", "age_days");

-- CreateIndex
CREATE INDEX "lighting_temperature_schedule_items_schedule_id_sort_order_idx" ON "lighting_temperature_schedule_items"("schedule_id", "sort_order");

-- CreateIndex
CREATE INDEX "medication_records_flock_id_record_date_idx" ON "medication_records"("flock_id", "record_date");

-- CreateIndex
CREATE INDEX "environmental_records_flock_id_record_date_idx" ON "environmental_records"("flock_id", "record_date");

-- CreateIndex
CREATE INDEX "flock_tasks_flock_id_task_date_idx" ON "flock_tasks"("flock_id", "task_date");

-- CreateIndex
CREATE INDEX "financial_periods_start_date_end_date_idx" ON "financial_periods"("start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "financial_periods_label_period_type_key" ON "financial_periods"("label", "period_type");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_occurred_at_idx" ON "audit_logs"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_occurred_at_idx" ON "audit_logs"("user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "report_executions_scheduled_report_id_executed_at_idx" ON "report_executions"("scheduled_report_id", "executed_at");

-- CreateIndex
CREATE INDEX "monthly_overheads_organization_id_idx" ON "monthly_overheads"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_overheads_organization_id_year_month_category_descr_key" ON "monthly_overheads"("organization_id", "year_month", "category", "description");

-- CreateIndex
CREATE INDEX "flock_overhead_allocations_flock_id_allocation_date_idx" ON "flock_overhead_allocations"("flock_id", "allocation_date");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_code_key" ON "accounts"("code");

-- CreateIndex
CREATE INDEX "accounts_account_type_idx" ON "accounts"("account_type");

-- CreateIndex
CREATE INDEX "journal_entries_entry_date_period_label_idx" ON "journal_entries"("entry_date", "period_label");

-- CreateIndex
CREATE INDEX "journal_entries_source_type_source_id_idx" ON "journal_entries"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "journal_entries_organization_id_idx" ON "journal_entries"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_organization_id_entry_number_key" ON "journal_entries"("organization_id", "entry_number");

-- CreateIndex
CREATE INDEX "journal_lines_journal_id_idx" ON "journal_lines"("journal_id");

-- CreateIndex
CREATE INDEX "journal_lines_account_id_idx" ON "journal_lines"("account_id");

-- CreateIndex
CREATE INDEX "ledger_balances_organization_id_idx" ON "ledger_balances"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_balances_organization_id_account_id_period_label_key" ON "ledger_balances"("organization_id", "account_id", "period_label");

-- CreateIndex
CREATE INDEX "documents_flock_id_record_type_idx" ON "documents"("flock_id", "record_type");

-- CreateIndex
CREATE INDEX "documents_record_type_record_id_idx" ON "documents"("record_type", "record_id");

-- CreateIndex
CREATE INDEX "documents_financial_record_id_idx" ON "documents"("financial_record_id");

-- CreateIndex
CREATE INDEX "documents_journal_entry_id_idx" ON "documents"("journal_entry_id");

-- CreateIndex
CREATE INDEX "documents_sale_record_id_idx" ON "documents"("sale_record_id");

-- CreateIndex
CREATE INDEX "documents_organization_id_idx" ON "documents"("organization_id");

-- CreateIndex
CREATE INDEX "sale_records_flock_id_sale_date_idx" ON "sale_records"("flock_id", "sale_date");

-- CreateIndex
CREATE INDEX "sale_records_sale_date_idx" ON "sale_records"("sale_date");

-- CreateIndex
CREATE INDEX "sale_records_organization_id_idx" ON "sale_records"("organization_id");

-- CreateIndex
CREATE INDEX "sale_records_organization_id_customer_name_idx" ON "sale_records"("organization_id", "customer_name");

-- CreateIndex
CREATE INDEX "ad_campaigns_status_start_date_end_date_idx" ON "ad_campaigns"("status", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "ad_events_ad_campaign_id_event_type_occurred_at_idx" ON "ad_events"("ad_campaign_id", "event_type", "occurred_at");

-- CreateIndex
CREATE INDEX "ad_events_organization_id_idx" ON "ad_events"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "licenses_license_key_key" ON "licenses"("license_key");

-- CreateIndex
CREATE INDEX "licenses_status_idx" ON "licenses"("status");

-- CreateIndex
CREATE INDEX "licenses_license_key_idx" ON "licenses"("license_key");

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_stages" ADD CONSTRAINT "feed_stages_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_stage_price_history" ADD CONSTRAINT "feed_stage_price_history_feed_stage_id_fkey" FOREIGN KEY ("feed_stage_id") REFERENCES "feed_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_category_template_items" ADD CONSTRAINT "supplier_category_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "supplier_category_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_cycles" ADD CONSTRAINT "production_cycles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_cycles" ADD CONSTRAINT "production_cycles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "production_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_expenses" ADD CONSTRAINT "batch_expenses_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_expenses" ADD CONSTRAINT "batch_expenses_feed_stage_id_fkey" FOREIGN KEY ("feed_stage_id") REFERENCES "feed_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overhead_costs" ADD CONSTRAINT "overhead_costs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mortality_records" ADD CONSTRAINT "mortality_records_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projections" ADD CONSTRAINT "projections_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projections" ADD CONSTRAINT "projections_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_targets" ADD CONSTRAINT "performance_targets_breed_id_fkey" FOREIGN KEY ("breed_id") REFERENCES "breeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broiler_flocks" ADD CONSTRAINT "broiler_flocks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broiler_flocks" ADD CONSTRAINT "broiler_flocks_breed_id_fkey" FOREIGN KEY ("breed_id") REFERENCES "breeds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broiler_flocks" ADD CONSTRAINT "broiler_flocks_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broiler_flocks" ADD CONSTRAINT "broiler_flocks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_records" ADD CONSTRAINT "growth_records_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "broiler_flocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_records" ADD CONSTRAINT "feed_records_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "broiler_flocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_records" ADD CONSTRAINT "feed_records_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_purchases" ADD CONSTRAINT "feed_purchases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_purchases" ADD CONSTRAINT "feed_purchases_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "broiler_flocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_purchases" ADD CONSTRAINT "feed_purchases_feed_stage_id_fkey" FOREIGN KEY ("feed_stage_id") REFERENCES "feed_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_purchases" ADD CONSTRAINT "feed_purchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_purchases" ADD CONSTRAINT "feed_purchases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_records" ADD CONSTRAINT "water_records_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "broiler_flocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mortality_events" ADD CONSTRAINT "mortality_events_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "broiler_flocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_events" ADD CONSTRAINT "vaccination_events_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "broiler_flocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_events" ADD CONSTRAINT "vaccination_events_vaccine_inventory_id_fkey" FOREIGN KEY ("vaccine_inventory_id") REFERENCES "vaccine_inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_records" ADD CONSTRAINT "financial_records_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "broiler_flocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "broiler_flocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_schedule_items" ADD CONSTRAINT "vaccination_schedule_items_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "vaccination_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lighting_temperature_schedules" ADD CONSTRAINT "lighting_temperature_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lighting_temperature_schedules" ADD CONSTRAINT "lighting_temperature_schedules_breed_id_fkey" FOREIGN KEY ("breed_id") REFERENCES "breeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lighting_temperature_schedules" ADD CONSTRAINT "lighting_temperature_schedules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lighting_temperature_schedule_items" ADD CONSTRAINT "lighting_temperature_schedule_items_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "lighting_temperature_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_records" ADD CONSTRAINT "medication_records_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "broiler_flocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environmental_records" ADD CONSTRAINT "environmental_records_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "broiler_flocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flock_tasks" ADD CONSTRAINT "flock_tasks_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "broiler_flocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "financial_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_executions" ADD CONSTRAINT "report_executions_scheduled_report_id_fkey" FOREIGN KEY ("scheduled_report_id") REFERENCES "scheduled_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_overheads" ADD CONSTRAINT "monthly_overheads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_overheads" ADD CONSTRAINT "monthly_overheads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reverses_id_fkey" FOREIGN KEY ("reverses_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "broiler_flocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_financial_record_id_fkey" FOREIGN KEY ("financial_record_id") REFERENCES "financial_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_sale_record_id_fkey" FOREIGN KEY ("sale_record_id") REFERENCES "sale_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_records" ADD CONSTRAINT "sale_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_records" ADD CONSTRAINT "sale_records_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "broiler_flocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_records" ADD CONSTRAINT "sale_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_events" ADD CONSTRAINT "ad_events_ad_campaign_id_fkey" FOREIGN KEY ("ad_campaign_id") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_events" ADD CONSTRAINT "ad_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- Document full-text search — tsvector generated column + GIN index
--
-- Run AFTER `prisma db push` (Prisma cannot manage GENERATED columns):
--   docker compose exec api psql "$DATABASE_URL" -f /app/prisma/sql/documents-search.sql
-- Or from host:
--   docker exec nkuku-companion-app-postgres-1 psql -U nkuku_user -d nkuku_db -f /docker-entrypoint-initdb.d/documents-search.sql
--
-- Idempotent: uses IF NOT EXISTS / OR REPLACE where supported.
-- ============================================================

-- Add search_vector as a GENERATED column from content_text.
-- Uses to_tsvector with 'english' config and coalesce to handle NULLs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE documents
      ADD COLUMN search_vector tsvector
      GENERATED ALWAYS AS (to_tsvector('english', coalesce(content_text, ''))) STORED;
  END IF;
END $$;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS documents_search_vector_idx
  ON documents USING GIN(search_vector);
-- ── MILESTONE G: JOURNAL ENTRY IMMUTABILITY ────────
-- Run after prisma db push to enforce immutability at DB level.
-- These rules prevent any UPDATE or DELETE on journal_entries and journal_lines.
-- Reversal is the only correction mechanism (POST /api/v1/journal/:id/reverse).

-- Prevent UPDATE on journal_entries
CREATE OR REPLACE RULE no_update_journal_entries AS
  ON UPDATE TO journal_entries DO INSTEAD NOTHING;

-- Prevent DELETE on journal_entries
CREATE OR REPLACE RULE no_delete_journal_entries AS
  ON DELETE TO journal_entries DO INSTEAD NOTHING;

-- Prevent UPDATE on journal_lines
CREATE OR REPLACE RULE no_update_journal_lines AS
  ON UPDATE TO journal_lines DO INSTEAD NOTHING;

-- Prevent DELETE on journal_lines
CREATE OR REPLACE RULE no_delete_journal_lines AS
  ON DELETE TO journal_lines DO INSTEAD NOTHING;

-- ── CHECK CONSTRAINTS ───────────────────────────────
-- A journal line must have exactly one of debit or credit (not both, not neither)
-- Postgres has no "ADD CONSTRAINT IF NOT EXISTS"; use a DO block.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'journal_lines'::regclass AND conname = 'one_side_only'
  ) THEN
    ALTER TABLE journal_lines ADD CONSTRAINT one_side_only
      CHECK (
        (debit_zmw IS NOT NULL AND credit_zmw IS NULL) OR
        (debit_zmw IS NULL AND credit_zmw IS NOT NULL)
      );
  END IF;
END $$;

-- Amounts cannot be negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'journal_lines'::regclass AND conname = 'amounts_nonneg'
  ) THEN
    ALTER TABLE journal_lines ADD CONSTRAINT amounts_nonneg
      CHECK (
        (debit_zmw IS NULL OR debit_zmw >= 0) AND
        (credit_zmw IS NULL OR credit_zmw >= 0)
      );
  END IF;
END $$;
