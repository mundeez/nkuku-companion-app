-- Platform tenant ops (P2, super-admin console).
-- Additive only: new nullable columns on organizations/users/audit_logs
-- + the new tenant_overrides table. No changes to existing constraints.

-- Staff-initiated org suspension (authenticate() → 423 ORG_SUSPENDED).
ALTER TABLE "organizations" ADD COLUMN "suspended_at" TIMESTAMPTZ(6);
ALTER TABLE "organizations" ADD COLUMN "suspended_reason" TEXT;
ALTER TABLE "organizations" ADD COLUMN "suspended_message" TEXT;

-- Global sign-out marker for tenant users (force logout / password reset
-- support ops): authenticate() rejects JWTs with iat < tokens_valid_after.
ALTER TABLE "users" ADD COLUMN "tokens_valid_after" TIMESTAMPTZ(6);

-- Tenant-visible attribution of impersonated mutations. Intentionally NOT
-- a foreign key — audit rows must never block staff-user deletion.
ALTER TABLE "audit_logs" ADD COLUMN "impersonated_by_staff_id" UUID;

-- Staff plan/limit overrides and comps. getEffectivePlanCode() consults the
-- newest active row ((comp_until IS NULL OR comp_until > now) AND
-- (expires_at IS NULL OR expires_at > now)) before the subscription.
CREATE TABLE "tenant_overrides" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "plan_code" VARCHAR(30),
  "limits_json" JSONB,
  "comp_until" TIMESTAMPTZ(6),
  "reason" TEXT NOT NULL,
  "created_by_staff_id" UUID,
  "expires_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tenant_overrides_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tenant_overrides_organization_id_fkey" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tenant_overrides_created_by_staff_id_fkey" FOREIGN KEY ("created_by_staff_id")
    REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "tenant_overrides_organization_id_idx" ON "tenant_overrides"("organization_id");
