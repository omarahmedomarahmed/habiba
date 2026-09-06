-- Sprint 20 — the back office. PLAN.md 20.8–20.26, §3d.
--
-- Additive. Two new tables, columns on `support_tickets` that all default or
-- are nullable, and two new *values* for `users.role` — which needs no schema
-- change at all, because the column is text with the check living in the
-- application's union type. Nothing is backfilled: every existing user keeps
-- the role they have, and every existing ticket is a patient ticket, which is
-- what all four of them are.

-- ------------------------------------------------- the two queues, and the clock --

ALTER TABLE "support_tickets"
  ADD COLUMN IF NOT EXISTS "audience" text DEFAULT 'patient' NOT NULL;
ALTER TABLE "support_tickets"
  ADD COLUMN IF NOT EXISTS "related_session_id" uuid;
ALTER TABLE "support_tickets"
  ADD COLUMN IF NOT EXISTS "related_payout_request_id" uuid;
ALTER TABLE "support_tickets"
  ADD COLUMN IF NOT EXISTS "moved_to_whatsapp_at" timestamptz;
ALTER TABLE "support_tickets"
  ADD COLUMN IF NOT EXISTS "whatsapp_summary" text;
ALTER TABLE "support_tickets"
  ADD COLUMN IF NOT EXISTS "access_token" text;
ALTER TABLE "support_tickets"
  ADD COLUMN IF NOT EXISTS "access_code_hash" text;
ALTER TABLE "support_tickets"
  ADD COLUMN IF NOT EXISTS "access_code_expires_at" timestamptz;

DO $$
BEGIN
  ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_session_fk"
    FOREIGN KEY ("related_session_id") REFERENCES "sessions"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_payout_fk"
    FOREIGN KEY ("related_payout_request_id") REFERENCES "payout_requests"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_audience_known"
    CHECK ("audience" IN ('patient', 'therapist')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 🔴 20.21 — a ticket that went to WhatsApp cannot close without bringing the
-- conversation back. A conversation we cannot see is not a record, and this is
-- the half of that rule a busy night would otherwise skip.
DO $$
BEGIN
  ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_whatsapp_summarised"
    CHECK (
      "moved_to_whatsapp_at" IS NULL
      OR "status" <> 'closed'
      OR length(btrim(COALESCE("whatsapp_summary", ''))) >= 20
    ) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "support_tickets_audience_idx"
  ON "support_tickets" ("audience", "due_at") WHERE "status" <> 'closed';
CREATE UNIQUE INDEX IF NOT EXISTS "support_tickets_access_token_unique"
  ON "support_tickets" ("access_token");

-- --------------------------------------------------------- attachments (20.19) --

CREATE TABLE IF NOT EXISTS "support_attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL,
  "filename" text NOT NULL,
  "content_type" text NOT NULL,
  "byte_size" integer NOT NULL,
  "storage_key" text NOT NULL,
  "uploaded_by_user_id" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "support_attachments"
    ADD CONSTRAINT "support_attachments_ticket_fk"
    FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "support_attachments"
    ADD CONSTRAINT "support_attachments_user_fk"
    FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Images and PDFs only, and a real size. An attachment nobody can open is a
-- support ticket that takes two extra days.
DO $$
BEGIN
  ALTER TABLE "support_attachments"
    ADD CONSTRAINT "support_attachments_type_known"
    CHECK ("content_type" IN ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "support_attachments"
    ADD CONSTRAINT "support_attachments_sized"
    CHECK ("byte_size" > 0 AND "byte_size" <= 26214400);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "support_attachments_ticket_idx"
  ON "support_attachments" ("ticket_id", "created_at");

-- ------------------------------------------------ phone-number changes (20.13) --

CREATE TABLE IF NOT EXISTS "phone_change_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "patient_account_id" uuid NOT NULL,
  "old_phone" text NOT NULL,
  "new_phone" text NOT NULL,
  "reason" text NOT NULL,
  "contact_consent" boolean DEFAULT false NOT NULL,
  "status" text DEFAULT 'requested' NOT NULL,
  "owner_user_id" uuid,
  "approved_by_user_id" uuid,
  "approved_at" timestamptz,
  "verification_hash" text,
  "verification_sent_at" timestamptz,
  "verification_expires_at" timestamptz,
  "verified_at" timestamptz,
  "refused_reason" text,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "phone_change_requests"
    ADD CONSTRAINT "phone_change_account_fk"
    FOREIGN KEY ("patient_account_id") REFERENCES "patient_accounts"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "phone_change_requests"
    ADD CONSTRAINT "phone_change_owner_fk"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "phone_change_requests"
    ADD CONSTRAINT "phone_change_approver_fk"
    FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "phone_change_requests"
    ADD CONSTRAINT "phone_change_status_known"
    CHECK ("status" IN ('requested', 'approved', 'verifying', 'done', 'refused'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 🔴 20.13 — the patient's own words, and their permission to be contacted on
-- the new number. Neither is optional: a change request with no reason is one
-- staff cannot judge, and calling a number nobody authorised is not a check.
DO $$
BEGIN
  ALTER TABLE "phone_change_requests"
    ADD CONSTRAINT "phone_change_reasoned"
    CHECK (length(btrim("reason")) >= 10);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "phone_change_requests"
    ADD CONSTRAINT "phone_change_consented"
    CHECK ("status" = 'refused' OR "contact_consent");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Both numbers are E.164, and they are different numbers.
DO $$
BEGIN
  ALTER TABLE "phone_change_requests"
    ADD CONSTRAINT "phone_change_e164"
    CHECK ("old_phone" ~ '^\+[1-9][0-9]{6,14}$' AND "new_phone" ~ '^\+[1-9][0-9]{6,14}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "phone_change_requests"
    ADD CONSTRAINT "phone_change_actually_changes"
    CHECK ("old_phone" <> "new_phone");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 🔴 20.16 — a completed change was verified. Marking one done without the
-- code from the new number is the whole attack this queue exists to stop.
DO $$
BEGIN
  ALTER TABLE "phone_change_requests"
    ADD CONSTRAINT "phone_change_done_was_verified"
    CHECK ("status" <> 'done' OR "verified_at" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- …and it was approved by somebody who is not the account holder. Staff only
-- (there is no patient user row), so this is the shape rather than the party.
DO $$
BEGIN
  ALTER TABLE "phone_change_requests"
    ADD CONSTRAINT "phone_change_done_was_approved"
    CHECK ("status" <> 'done' OR "approved_by_user_id" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "phone_change_open_idx"
  ON "phone_change_requests" ("created_at")
  WHERE "status" IN ('requested', 'approved', 'verifying');

CREATE UNIQUE INDEX IF NOT EXISTS "phone_change_one_open"
  ON "phone_change_requests" ("patient_account_id")
  WHERE "status" IN ('requested', 'approved', 'verifying');
