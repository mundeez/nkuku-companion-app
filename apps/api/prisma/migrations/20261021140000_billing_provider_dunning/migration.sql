-- P-4: payment provider selection + dunning bookkeeping on invoices
ALTER TABLE "invoices" ADD COLUMN "provider" VARCHAR(30) NOT NULL DEFAULT 'flutterwave';
ALTER TABLE "invoices" ADD COLUMN "reminders_sent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN "last_reminder_at" TIMESTAMPTZ(6);
