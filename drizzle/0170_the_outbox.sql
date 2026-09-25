-- 🔴 0170: A MESSAGE TO NOBODY IS KEPT, NOT SENT.
--
-- An email to an invented address (example.com, reserved by RFC 2606) reaches
-- nobody and a bounce costs the sending domain its reputation. While the
-- simulation runs, a WhatsApp message to an invented number might reach a real
-- stranger. Both are written here in full instead of being sent, so the cast
-- can read what they were sent (codes and links included) and the report can
-- count every message the product meant to send.
CREATE TABLE IF NOT EXISTS "sim_outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "channel" text NOT NULL,
  "to_address" text NOT NULL,
  "subject" text,
  "body" text NOT NULL,
  "kind" text,
  "reason" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sim_outbox_channel" CHECK ("channel" IN ('email', 'whatsapp'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sim_outbox_to_idx" ON "sim_outbox" ("to_address", "created_at");
