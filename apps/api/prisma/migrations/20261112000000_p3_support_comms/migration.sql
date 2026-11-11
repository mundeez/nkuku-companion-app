-- Support inbox, comms log & system ops (P3, super-admin console).
-- Additive only: one enum + five new tables, no changes to existing tables.

-- Ticket lifecycle enum for the tenant support inbox.
CREATE TYPE "ticket_status" AS ENUM ('open', 'in_progress', 'waiting_on_user', 'resolved', 'closed');

-- Tenant support tickets ("Contact support"). The requester FK cascades on
-- user delete; organization FK cascades on org delete (tickets are tenant
-- data, not audit). `meta` holds client diagnostics (app version, device).
CREATE TABLE "support_tickets" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "subject" VARCHAR(200) NOT NULL,
  "category" VARCHAR(40) NOT NULL DEFAULT 'general',
  "status" "ticket_status" NOT NULL DEFAULT 'open',
  "priority" VARCHAR(10) NOT NULL DEFAULT 'normal',
  "assigned_staff_id" UUID,
  "resolved_at" TIMESTAMPTZ(6),
  "last_message_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "meta" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_tickets_organization_id_fkey" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "support_tickets_assigned_staff_id_fkey" FOREIGN KEY ("assigned_staff_id")
    REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "support_tickets_organization_id_idx" ON "support_tickets"("organization_id");
CREATE INDEX "support_tickets_status_last_message_at_idx" ON "support_tickets"("status", "last_message_at");

-- Ticket thread. author_type 'user'|'staff'; the matching author FK is set.
-- internal_note rows are staff-only — never returned to tenant callers.
CREATE TABLE "ticket_messages" (
  "id" UUID NOT NULL,
  "ticket_id" UUID NOT NULL,
  "author_type" VARCHAR(10) NOT NULL,
  "author_user_id" UUID,
  "author_staff_id" UUID,
  "body" TEXT NOT NULL,
  "internal_note" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id")
    REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ticket_messages_author_user_id_fkey" FOREIGN KEY ("author_user_id")
    REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ticket_messages_author_staff_id_fkey" FOREIGN KEY ("author_staff_id")
    REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ticket_messages_ticket_id_idx" ON "ticket_messages"("ticket_id");

-- Platform communications log — one row per attempted outbound message
-- (email now; 'sms'/'push' channels reserved for the Kannel path and FCM).
-- org/user/staff FKs are SetNull so log rows survive tenant deletion —
-- same audit-survival rule as platform_audit_events.
CREATE TABLE "comms_log" (
  "id" UUID NOT NULL,
  "organization_id" UUID,
  "user_id" UUID,
  "channel" VARCHAR(10) NOT NULL,
  "to_addr" VARCHAR(320) NOT NULL,
  "subject" VARCHAR(300),
  "body" TEXT,
  "template" VARCHAR(60),
  "provider_ref" VARCHAR(200),
  "status" VARCHAR(12) NOT NULL,
  "error" TEXT,
  "resend_of_id" UUID,
  "sent_by_staff_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "comms_log_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "comms_log_organization_id_fkey" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "comms_log_user_id_fkey" FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "comms_log_sent_by_staff_id_fkey" FOREIGN KEY ("sent_by_staff_id")
    REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "comms_log_resend_of_id_fkey" FOREIGN KEY ("resend_of_id")
    REFERENCES "comms_log"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "comms_log_organization_id_created_at_idx" ON "comms_log"("organization_id", "created_at");
CREATE INDEX "comms_log_status_created_at_idx" ON "comms_log"("status", "created_at");

-- Cron execution history for the platform health panel. The cron wrapper
-- (main.ts) writes 'running' at start, then 'success'/'failed' at finish.
CREATE TABLE "cron_runs" (
  "id" UUID NOT NULL,
  "name" VARCHAR(60) NOT NULL,
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMPTZ(6),
  "status" VARCHAR(10) NOT NULL,
  "error" TEXT,
  "meta" JSONB,

  CONSTRAINT "cron_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "cron_runs_name_started_at_idx" ON "cron_runs"("name", "started_at");

-- Generic platform flags store. Holds 'maintenance_mode' now
-- ({ enabled, message, by, at }); P4 feature flags reuse this table.
CREATE TABLE "platform_flags" (
  "key" VARCHAR(60) NOT NULL,
  "value" JSONB NOT NULL,
  "updated_by_staff_id" UUID,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "platform_flags_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "platform_flags_updated_by_staff_id_fkey" FOREIGN KEY ("updated_by_staff_id")
    REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
