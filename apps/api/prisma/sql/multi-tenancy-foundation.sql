-- Multi-tenancy foundation (Monetization Phase 1)
-- Adds Organization / OrganizationMember / Subscription tables and an
-- organization_id column to every tenant-scoped table, then backfills all
-- existing production data into a single "Organization #1" so nothing is
-- lost or re-owned.
--
-- IMPORTANT: journal_entries (and journal_lines) have immutability RULEs
-- (no UPDATE, no DELETE) per prisma/sql/journal-immutability.sql. A plain
-- UPDATE to backfill organization_id on journal_entries would silently be
-- turned into a no-op by that rule. We avoid this by adding the column
-- with a DEFAULT of the backfill organization's id: populating existing
-- rows during ADD COLUMN happens as part of DDL execution, not as a
-- user-issued UPDATE, so the immutability rule does not intercept it.
--
-- Idempotent: safe to run more than once.

BEGIN;

-- ── ENUMS ────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "BillingCycle" AS ENUM ('monthly', 'cycle_3mo', 'annual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'suspended', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── ORGANIZATIONS ────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(150) NOT NULL,
  country     varchar(2) NOT NULL,
  currency    char(3) NOT NULL DEFAULT 'ZMW',
  plan_code   varchar(30) NOT NULL DEFAULT 'free',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz(6) NOT NULL DEFAULT now(),
  updated_at  timestamptz(6) NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            "Role" NOT NULL DEFAULT 'viewer',
  joined_at       timestamptz(6) NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS organization_members_user_id_idx ON organization_members (user_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_code             varchar(30) NOT NULL,
  billing_cycle         "BillingCycle" NOT NULL DEFAULT 'monthly',
  status                "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
  current_period_start  timestamptz(6),
  current_period_end    timestamptz(6),
  provider              varchar(30),
  provider_ref          varchar(100),
  created_at            timestamptz(6) NOT NULL DEFAULT now(),
  updated_at            timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_organization_id_idx ON subscriptions (organization_id);

-- ── SEED "ORGANIZATION #1" FROM EXISTING PRODUCTION DATA ─────
-- Owned by the current owner account; all existing users become members.
DO $$
DECLARE
  org1_id uuid;
  owner_id uuid;
BEGIN
  SELECT id INTO owner_id FROM users WHERE role = 'owner' ORDER BY created_at LIMIT 1;

  IF NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'Nkuku Companion Farm (Org #1)') THEN
    INSERT INTO organizations (name, country, currency, plan_code, is_active)
    VALUES ('Nkuku Companion Farm (Org #1)', 'ZM', 'ZMW', 'free', true)
    RETURNING id INTO org1_id;
  ELSE
    SELECT id INTO org1_id FROM organizations WHERE name = 'Nkuku Companion Farm (Org #1)';
  END IF;

  INSERT INTO organization_members (organization_id, user_id, role)
  SELECT org1_id, u.id, u.role
  FROM users u
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- Stash org1_id in a temp table so subsequent ALTER TABLE statements can
  -- use it as a column DEFAULT for backfilling.
  CREATE TEMP TABLE IF NOT EXISTS _org1 (id uuid);
  DELETE FROM _org1;
  INSERT INTO _org1 VALUES (org1_id);
END $$;

-- ── ADD organization_id TO TENANT-SCOPED TABLES ──────────────
-- Each ADD COLUMN uses a dynamic DEFAULT of org1's id so existing rows are
-- backfilled as part of the DDL (not a DML UPDATE), then the default is
-- dropped so future inserts must set organization_id explicitly.
DO $$
DECLARE
  org1_id uuid;
  tbl text;
  -- NOTE: `accounts` (chart of accounts) is intentionally NOT in this list.
  -- It's a shared reference catalog like Breed/Disease, not organization-
  -- scoped — see the comment on the Account model in schema.prisma.
  tables text[] := ARRAY[
    'suppliers', 'production_cycles', 'broiler_flocks', 'documents',
    'monthly_overheads', 'lighting_temperature_schedules', 'sale_records',
    'journal_entries', 'batches'
  ];
BEGIN
  SELECT id INTO org1_id FROM _org1;

  FOREACH tbl IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = tbl AND column_name = 'organization_id'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD COLUMN organization_id uuid DEFAULT %L REFERENCES organizations(id)',
        tbl, org1_id
      );
      EXECUTE format('ALTER TABLE %I ALTER COLUMN organization_id DROP DEFAULT', tbl);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (organization_id)', tbl || '_organization_id_idx', tbl);
    END IF;
  END LOOP;
END $$;

-- ── RE-SCOPE UNIQUE CONSTRAINTS THAT WERE GLOBAL, NOW PER-ORG ────
-- Prisma's @unique implements as a plain UNIQUE INDEX, not a table
-- CONSTRAINT, so these must be dropped with DROP INDEX, not
-- ALTER TABLE ... DROP CONSTRAINT.
-- (accounts.code stays globally unique — see NOTE above.)
DROP INDEX IF EXISTS journal_entries_entry_number_key;
DO $$ BEGIN
  ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_organization_id_entry_number_key UNIQUE (organization_id, entry_number);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DROP INDEX IF EXISTS monthly_overheads_year_month_category_description_key;
DO $$ BEGIN
  ALTER TABLE monthly_overheads ADD CONSTRAINT monthly_overheads_organization_id_year_month_category_descr_key
    UNIQUE (organization_id, year_month, category, description);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DROP TABLE IF EXISTS _org1;

COMMIT;
