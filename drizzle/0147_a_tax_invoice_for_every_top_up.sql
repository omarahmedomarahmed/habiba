-- ETA e-invoicing for company top-ups (C241 unblocked, founder 2026-09-24).
--
-- A company is invoiced as a business (receiver type B), which the Egyptian
-- Tax Authority accepts only with its tax registration number and a
-- structured address; those live on the company. Each document we issue is a
-- row: the invoice for a confirmed top-up, or the credit note for money we
-- return from a pot. The signed text is kept exactly as submitted, because a
-- document is re-read, never rebuilt.
ALTER TABLE "sponsors" ADD COLUMN IF NOT EXISTS "legal_name" text;
--> statement-breakpoint
ALTER TABLE "sponsors" ADD COLUMN IF NOT EXISTS "tax_registration_number" text;
--> statement-breakpoint
ALTER TABLE "sponsors" ADD COLUMN IF NOT EXISTS "tax_address" jsonb;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "eta_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" text NOT NULL,
  "purpose" text NOT NULL,
  "ref_id" uuid NOT NULL,
  "sponsor_id" uuid NOT NULL REFERENCES "sponsors"("id") ON DELETE RESTRICT,
  "original_id" uuid REFERENCES "eta_documents"("id") ON DELETE RESTRICT,
  "internal_id" text NOT NULL,
  "net_minor" integer NOT NULL,
  "vat_minor" integer NOT NULL,
  "total_minor" integer NOT NULL,
  "state" text DEFAULT 'waiting' NOT NULL,
  "waiting_for" text,
  "document_text" text,
  "submission_uuid" text,
  "eta_uuid" text,
  "eta_long_id" text,
  "error" text,
  "attempts" integer DEFAULT 0 NOT NULL,
  "submitted_at" timestamp with time zone,
  "validated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "eta_documents"
    ADD CONSTRAINT "eta_documents_kind_known" CHECK ("kind" IN ('invoice', 'credit_note'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "eta_documents"
    ADD CONSTRAINT "eta_documents_purpose_known" CHECK ("purpose" IN ('pot_topup', 'pot_return'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "eta_documents"
    ADD CONSTRAINT "eta_documents_state_known"
    CHECK ("state" IN ('waiting', 'submitted', 'valid', 'invalid', 'cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "eta_documents"
    ADD CONSTRAINT "eta_documents_amounts_add_up"
    CHECK ("net_minor" > 0 AND "vat_minor" >= 0 AND "total_minor" = "net_minor" + "vat_minor");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "eta_documents"
    ADD CONSTRAINT "eta_documents_credit_note_points_back"
    CHECK ("kind" = 'invoice' OR "original_id" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "eta_documents"
    ADD CONSTRAINT "eta_documents_accepted_has_uuid"
    CHECK ("state" NOT IN ('submitted', 'valid', 'invalid', 'cancelled') OR "eta_uuid" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "eta_documents_internal_id_unique" ON "eta_documents" ("internal_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "eta_documents_one_per_ref" ON "eta_documents" ("purpose", "ref_id", "kind");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eta_documents_open_idx" ON "eta_documents" ("state") WHERE "state" IN ('waiting', 'submitted');
