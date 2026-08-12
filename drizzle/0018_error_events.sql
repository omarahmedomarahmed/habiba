-- Server errors, recorded where somebody will see them.
--
-- There was no error reporting at all. SENTRY_DSN was read in lib/env.ts and
-- referenced nowhere else, and the security page told readers that "error
-- reporting strips request bodies and URLs" — a claim about the behaviour of a
-- system that did not exist. A patient in crisis hitting a 500 was invisible.
--
-- Deliberately a table in the product's own database rather than a third-party
-- drain, for one reason that outranks the convenience: an error from this
-- application can carry a patient's words in a stack frame, and shipping that
-- to a vendor is a disclosure. Here it lives under the same access control,
-- the same audit log and the same retention rules as the rest of the record.
--
-- `fingerprint` is what turns four thousand rows into nine problems. It is a
-- hash of the route and the top of the stack — not the message, because
-- messages carry ids and interpolated values that would split one bug into
-- hundreds of groups.

CREATE TABLE IF NOT EXISTS "error_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "fingerprint" text NOT NULL,
  "route" text NOT NULL,
  "method" text,
  "kind" text NOT NULL DEFAULT 'server',
  "message" text NOT NULL,
  "stack" text,
  "digest" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- The admin view is "what is broken lately", so every query is time-ordered.
CREATE INDEX IF NOT EXISTS "error_events_created_idx" ON "error_events" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "error_events_fingerprint_idx" ON "error_events" ("fingerprint");
