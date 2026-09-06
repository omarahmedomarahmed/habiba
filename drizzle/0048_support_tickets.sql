-- Sprint 18R — the contact form is a support ticket. PLAN.md 18R.2–18R.5, C91.
--
-- Additive: two new tables and nothing touched. Nothing is backfilled — there
-- is no history of contact messages to import, because until now the page had
-- a mailto: link and every message went somewhere this system cannot see.

CREATE TABLE IF NOT EXISTS "support_tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reference" text NOT NULL,
  "source" text DEFAULT 'contact_form' NOT NULL,
  "name" text NOT NULL,
  "email" text,
  "phone" text,
  "patient_account_id" uuid,
  "user_id" uuid,
  "topic" text NOT NULL,
  "message" text NOT NULL,
  "locale" text DEFAULT 'en' NOT NULL,
  "entity" text DEFAULT 'us' NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "owner_user_id" uuid,
  "due_at" timestamptz NOT NULL,
  "waiting_since" timestamptz,
  "extended_at" timestamptz,
  "extension_reason" text,
  "closed_at" timestamptz,
  "closed_by_user_id" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_account_fk"
    FOREIGN KEY ("patient_account_id") REFERENCES "patient_accounts"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_user_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_owner_fk"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_closer_fk"
    FOREIGN KEY ("closed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 🔴 §3b's shape, one table further out: a person is reachable by an address
-- OR a number, and a ticket with neither is a message nobody can answer.
DO $$
BEGIN
  ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_one_handle"
    CHECK (
      (COALESCE(btrim("email"), '') <> '') OR (COALESCE(btrim("phone"), '') <> '')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- An empty message is a submit button pressed twice, not a request for help.
DO $$
BEGIN
  ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_message_present"
    CHECK (length(btrim("message")) >= 10);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_topic_known"
    CHECK ("topic" IN (
      'account', 'billing', 'my_record', 'a_session',
      'a_therapist', 'joining_as_a_therapist', 'something_else'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_status_known"
    CHECK ("status" IN ('open', 'waiting_on_them', 'closed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_entity_known"
    CHECK ("entity" IN ('us', 'eg'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- A closed ticket has a time on it. "Closed" with no date is the state a
-- performance report cannot count and a patient cannot be told about.
DO $$
BEGIN
  ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_closed_dated"
    CHECK (("status" <> 'closed') OR ("closed_at" IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "support_tickets_reference_unique"
  ON "support_tickets" ("reference");
CREATE INDEX IF NOT EXISTS "support_tickets_open_idx"
  ON "support_tickets" ("due_at") WHERE "status" <> 'closed';
CREATE INDEX IF NOT EXISTS "support_tickets_topic_idx"
  ON "support_tickets" ("topic", "created_at");
CREATE INDEX IF NOT EXISTS "support_tickets_owner_idx"
  ON "support_tickets" ("owner_user_id", "status");

CREATE TABLE IF NOT EXISTS "support_ticket_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "actor_user_id" uuid,
  "note" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "support_ticket_events"
    ADD CONSTRAINT "support_ticket_events_ticket_fk"
    FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "support_ticket_events"
    ADD CONSTRAINT "support_ticket_events_actor_fk"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "support_ticket_events_ticket_idx"
  ON "support_ticket_events" ("ticket_id", "created_at");
