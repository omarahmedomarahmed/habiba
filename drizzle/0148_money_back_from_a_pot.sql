-- 🔴 0148: money back out of a company's pot, which the refund terms promise
-- and nothing did. Two people: one asks, another sends (the payout rule), and
-- the database refuses the same person twice. The credit note that follows is
-- in eta_documents under purpose 'pot_return', keyed on this row's id.
CREATE TABLE IF NOT EXISTS "pot_returns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sponsor_id" uuid NOT NULL REFERENCES "sponsors"("id") ON DELETE RESTRICT,
  "net_cents" integer NOT NULL,
  "vat_cents" integer NOT NULL,
  "egp_minor" integer NOT NULL,
  "state" text DEFAULT 'requested' NOT NULL,
  "reason" text NOT NULL,
  "bank_reference" text,
  "requested_by" uuid NOT NULL,
  "decided_by" uuid,
  "txn_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "decided_at" timestamp with time zone,
  CONSTRAINT "pot_returns_state" CHECK ("state" IN ('requested', 'sent', 'cancelled')),
  CONSTRAINT "pot_returns_amounts" CHECK ("net_cents" > 0 AND "vat_cents" >= 0 AND "egp_minor" > 0),
  CONSTRAINT "pot_returns_four_eyes" CHECK ("state" <> 'sent' OR ("decided_by" IS NOT NULL AND "decided_by" <> "requested_by")),
  CONSTRAINT "pot_returns_sent_has_proof" CHECK ("state" <> 'sent' OR ("bank_reference" IS NOT NULL AND "txn_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pot_returns_sponsor" ON "pot_returns" ("sponsor_id", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pot_returns_one_open" ON "pot_returns" ("sponsor_id") WHERE "state" = 'requested';
