-- Platform staff identity & security foundation (P1, super-admin console).
-- Additive only: new enum + new tables, no changes to existing tables.

CREATE TYPE "StaffRole" AS ENUM ('super_admin', 'support', 'finance', 'content_editor', 'marketing', 'auditor');

CREATE TABLE "staff_users" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "role" "StaffRole" NOT NULL,
  "totp_secret_enc" TEXT,
  "totp_enabled_at" TIMESTAMPTZ(6),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_login_at" TIMESTAMPTZ(6),
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "staff_users_email_key" ON "staff_users"("email");
ALTER TABLE "staff_users" ADD CONSTRAINT "staff_users_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "staff_sessions" (
  "id" UUID NOT NULL,
  "staff_user_id" UUID NOT NULL,
  "refresh_token_hash" VARCHAR(64) NOT NULL,
  "device_label" VARCHAR(200),
  "ip" VARCHAR(45),
  "user_agent" VARCHAR(500),
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "revoked_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "staff_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_sessions_staff_user_id_fkey" FOREIGN KEY ("staff_user_id")
    REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "staff_sessions_refresh_token_hash_key" ON "staff_sessions"("refresh_token_hash");
CREATE INDEX "staff_sessions_staff_user_id_idx" ON "staff_sessions"("staff_user_id");

CREATE TABLE "staff_recovery_codes" (
  "id" UUID NOT NULL,
  "staff_user_id" UUID NOT NULL,
  "code_hash" VARCHAR(64) NOT NULL,
  "used_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "staff_recovery_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_recovery_codes_staff_user_id_fkey" FOREIGN KEY ("staff_user_id")
    REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "staff_recovery_codes_staff_user_id_idx" ON "staff_recovery_codes"("staff_user_id");

-- Append-only platform audit log. UPDATE/DELETE are blocked at the DB level
-- by CREATE RULE in prisma/sql/platform-audit-immutability.sql (applied after
-- migrate). organization_id is intentionally not an FK: audit rows must
-- survive tenant (GDPR) deletion.
CREATE TABLE "platform_audit_events" (
  "id" UUID NOT NULL,
  "actor_staff_id" UUID NOT NULL,
  "actor_role" "StaffRole" NOT NULL,
  "action" VARCHAR(80) NOT NULL,
  "target_type" VARCHAR(50) NOT NULL,
  "target_id" VARCHAR(80),
  "organization_id" UUID,
  "reason" TEXT,
  "before" JSONB,
  "after" JSONB,
  "ip" VARCHAR(45),
  "user_agent" VARCHAR(500),
  "request_id" VARCHAR(80),
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "platform_audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "platform_audit_events_actor_staff_id_fkey" FOREIGN KEY ("actor_staff_id")
    REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "platform_audit_events_actor_staff_id_idx" ON "platform_audit_events"("actor_staff_id");
CREATE INDEX "platform_audit_events_action_idx" ON "platform_audit_events"("action");
CREATE INDEX "platform_audit_events_organization_id_idx" ON "platform_audit_events"("organization_id");
CREATE INDEX "platform_audit_events_occurred_at_idx" ON "platform_audit_events"("occurred_at");

CREATE TABLE "impersonation_sessions" (
  "id" UUID NOT NULL,
  "staff_user_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "target_user_id" UUID NOT NULL,
  "reason" TEXT NOT NULL,
  "ticket_id" VARCHAR(80),
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMPTZ(6),
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "ip" VARCHAR(45),

  CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "impersonation_sessions_staff_user_id_fkey" FOREIGN KEY ("staff_user_id")
    REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "impersonation_sessions_organization_id_fkey" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "impersonation_sessions_target_user_id_fkey" FOREIGN KEY ("target_user_id")
    REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "impersonation_sessions_staff_user_id_idx" ON "impersonation_sessions"("staff_user_id");
CREATE INDEX "impersonation_sessions_organization_id_idx" ON "impersonation_sessions"("organization_id");
