-- Sprint 16 — two rails, two currencies, two entities. PLAN.md §3c, 16.1–16.10.
--
-- Additive only (H16): every column below either has a default or is nullable,
-- and every CHECK on an existing table is added NOT VALID so it binds new
-- writes without scanning the rows already there. The running deployment
-- survives the gap between this migration and the code that uses it.
--
-- Nothing is backfilled. The defaults describe what the existing rows already
-- are: one entity, one currency, one crossing.

-- ------------------------------------------------------------ the entity --

ALTER TABLE "ledger_entries"
  ADD COLUMN IF NOT EXISTS "entity" text DEFAULT 'us' NOT NULL;

DO $$
BEGIN
  ALTER TABLE "ledger_entries"
    ADD CONSTRAINT "ledger_entries_entity_known"
    CHECK ("entity" IN ('us', 'eg')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ledger_entity_idx" ON "ledger_entries" ("entity", "account");

-- ------------------------------------------------- the currency a price is in --

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "rate_currency" text DEFAULT 'usd' NOT NULL;

ALTER TABLE "sessions"
  ADD COLUMN IF NOT EXISTS "price_currency" text DEFAULT 'usd' NOT NULL;

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "settled_currency" text;
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "settled_amount_minor" integer;
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "fx_rate_micro" integer;
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "fx_quoted_at" timestamptz;

-- A settled amount without the rate that produced it is a number nobody can
-- check. Either both halves of the conversion are recorded or neither is.
DO $$
BEGIN
  ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_fx_complete"
    CHECK (
      ("settled_currency" IS NULL AND "settled_amount_minor" IS NULL AND "fx_rate_micro" IS NULL)
      OR ("settled_currency" IS NOT NULL AND "settled_amount_minor" IS NOT NULL AND "fx_rate_micro" IS NOT NULL)
    ) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------- the four crossings --

ALTER TABLE "session_payments"
  ADD COLUMN IF NOT EXISTS "crossing" text DEFAULT 'usd_stripe_to_connect' NOT NULL;
ALTER TABLE "session_payments"
  ADD COLUMN IF NOT EXISTS "entity" text DEFAULT 'us' NOT NULL;

DO $$
BEGIN
  ALTER TABLE "session_payments"
    ADD CONSTRAINT "session_payments_crossing_known"
    CHECK ("crossing" IN (
      'usd_stripe_to_connect', 'egp_local_to_manual',
      'usd_stripe_to_manual', 'egp_local_to_connect'
    )) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "session_payments"
    ADD CONSTRAINT "session_payments_entity_known"
    CHECK ("entity" IN ('us', 'eg')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- --------------------------------------------------------- payout methods --

CREATE TABLE IF NOT EXISTS "payout_methods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "therapist_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "method" text NOT NULL,
  "identifier" text NOT NULL,
  "account_name" text NOT NULL,
  "currency" text DEFAULT 'egp' NOT NULL,
  "edited_by_user_id" uuid,
  "edited_at" timestamptz DEFAULT now() NOT NULL,
  "is_default" boolean DEFAULT true NOT NULL,
  "deleted_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "payout_methods"
    ADD CONSTRAINT "payout_methods_therapist_fk"
    FOREIGN KEY ("therapist_id") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "payout_methods"
    ADD CONSTRAINT "payout_methods_org_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "payout_methods"
    ADD CONSTRAINT "payout_methods_editor_fk"
    FOREIGN KEY ("edited_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- A name is what the receiving bank matches on. An empty one is a transfer
-- that bounces after somebody has already done the work.
DO $$
BEGIN
  ALTER TABLE "payout_methods"
    ADD CONSTRAINT "payout_methods_named"
    CHECK (length(btrim("account_name")) > 2 AND length(btrim("identifier")) > 2);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "payout_methods"
    ADD CONSTRAINT "payout_methods_method_known"
    CHECK ("method" IN ('instapay', 'wallet', 'stripe'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "payout_methods_therapist_idx" ON "payout_methods" ("therapist_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payout_methods_default_unique"
  ON "payout_methods" ("therapist_id") WHERE "is_default" AND "deleted_at" IS NULL;

-- -------------------------------------------------------- payout requests --

CREATE TABLE IF NOT EXISTS "payout_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "therapist_id" uuid NOT NULL,
  "amount_cents" integer NOT NULL,
  "payout_amount_minor" integer NOT NULL,
  "payout_currency" text DEFAULT 'egp' NOT NULL,
  "fx_rate_micro" integer,
  "fx_quoted_at" timestamptz,
  "entity" text DEFAULT 'eg' NOT NULL,
  "method_id" uuid,
  "method" text NOT NULL,
  "identifier" text NOT NULL,
  "account_name" text NOT NULL,
  "details_edited_by_user_id" uuid,
  "status" text DEFAULT 'requested' NOT NULL,
  "owner_user_id" uuid,
  "alerted_at" timestamptz,
  "requested_at" timestamptz DEFAULT now() NOT NULL,
  "approved_by_user_id" uuid,
  "approved_at" timestamptz,
  "sent_by_user_id" uuid,
  "sent_at" timestamptz,
  "confirmed_at" timestamptz,
  "rejected_reason" text,
  "proof_url" text,
  "ledger_txn_id" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "payout_requests"
    ADD CONSTRAINT "payout_requests_org_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "payout_requests"
    ADD CONSTRAINT "payout_requests_therapist_fk"
    FOREIGN KEY ("therapist_id") REFERENCES "users"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "payout_requests"
    ADD CONSTRAINT "payout_requests_method_fk"
    FOREIGN KEY ("method_id") REFERENCES "payout_methods"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "payout_requests"
    ADD CONSTRAINT "payout_requests_approver_fk"
    FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "payout_requests"
    ADD CONSTRAINT "payout_requests_sender_fk"
    FOREIGN KEY ("sent_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "payout_requests"
    ADD CONSTRAINT "payout_requests_owner_fk"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "payout_requests"
    ADD CONSTRAINT "payout_requests_editor_fk"
    FOREIGN KEY ("details_edited_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Nobody requests nothing, and nobody is sent nothing.
DO $$
BEGIN
  ALTER TABLE "payout_requests"
    ADD CONSTRAINT "payout_requests_amount_positive"
    CHECK ("amount_cents" > 0 AND "payout_amount_minor" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "payout_requests"
    ADD CONSTRAINT "payout_requests_status_known"
    CHECK ("status" IN ('requested', 'approved', 'sent', 'confirmed', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "payout_requests"
    ADD CONSTRAINT "payout_requests_entity_known"
    CHECK ("entity" IN ('us', 'eg'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 🔴 C74, in the database rather than in a code path somebody can forget.
--
-- A clinician may not approve their own payout, and the person who last
-- edited where the money goes may not be the person who approves sending it
-- there. Two separate constraints because they are two separate frauds and a
-- combined one would not say which fired.
DO $$
BEGIN
  ALTER TABLE "payout_requests"
    ADD CONSTRAINT "payout_requests_approver_not_payee"
    CHECK ("approved_by_user_id" IS NULL OR "approved_by_user_id" <> "therapist_id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "payout_requests"
    ADD CONSTRAINT "payout_requests_approver_not_editor"
    CHECK (
      "approved_by_user_id" IS NULL
      OR "details_edited_by_user_id" IS NULL
      OR "approved_by_user_id" <> "details_edited_by_user_id"
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- A sent payout has an approver. Skipping approval is the failure C74 names.
DO $$
BEGIN
  ALTER TABLE "payout_requests"
    ADD CONSTRAINT "payout_requests_sent_was_approved"
    CHECK ("sent_at" IS NULL OR "approved_at" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "payout_requests_therapist_idx"
  ON "payout_requests" ("therapist_id", "requested_at");
CREATE INDEX IF NOT EXISTS "payout_requests_open_idx"
  ON "payout_requests" ("requested_at")
  WHERE "status" IN ('requested', 'approved', 'sent');
CREATE INDEX IF NOT EXISTS "payout_requests_status_idx"
  ON "payout_requests" ("status", "requested_at");

-- --------------------------------------------------- the audited transitions --

CREATE TABLE IF NOT EXISTS "payout_request_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "request_id" uuid NOT NULL,
  "from_status" text,
  "to_status" text NOT NULL,
  "actor_user_id" uuid,
  "note" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "payout_request_events"
    ADD CONSTRAINT "payout_request_events_request_fk"
    FOREIGN KEY ("request_id") REFERENCES "payout_requests"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "payout_request_events"
    ADD CONSTRAINT "payout_request_events_actor_fk"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "payout_request_events_request_idx"
  ON "payout_request_events" ("request_id", "created_at");
